// process-inbox — Supabase Edge Function
// Polls service@3crefrigeration.com inbox, extracts work order details via Claude,
// creates draft WOs for admin/manager review.
//
// Secrets required:
//   GOOGLE_SERVICE_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATE_EMAIL
//   ANTHROPIC_API_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Google Auth ──────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Handle escaped \n from Supabase secrets storage
  const cleanPem = pem.replace(/\\n/g, "\n");
  const b64 = cleanPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getGoogleAccessToken(
  serviceEmail: string,
  privateKeyPem: string,
  impersonateEmail: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceEmail,
    sub: impersonateEmail,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Google auth failed: " + JSON.stringify(data));
  return data.access_token;
}

// ── Gmail Helpers ────────────────────────────────────────────

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet(path: string, token: string) {
  const r = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}

async function gmailPost(path: string, token: string, body: unknown) {
  const r = await fetch(`${GMAIL_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Find or create the "3C-Processed" label
async function getOrCreateLabel(token: string): Promise<string> {
  const labels = await gmailGet("/labels", token);
  const existing = labels.labels?.find(
    (l: { name: string }) => l.name === "3C-Processed"
  );
  if (existing) return existing.id;

  const created = await gmailPost("/labels", token, {
    name: "3C-Processed",
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
  });
  return created.id;
}

// Apply label to a message (does NOT change read/unread)
async function applyLabel(messageId: string, labelId: string, token: string) {
  await gmailPost(`/messages/${messageId}/modify`, token, {
    addLabelIds: [labelId],
  });
}

// Parse email headers
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// Decode base64url body
function decodeBody(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

// Extract plain text from a message payload (handles multipart)
function extractText(payload: any): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractText(part);
      if (text) return text;
    }
  }
  return "";
}

// Extract image attachments info
function extractImageParts(payload: any): Array<{ attachmentId: string; filename: string; mimeType: string }> {
  const images: Array<{ attachmentId: string; filename: string; mimeType: string }> = [];
  function walk(part: any) {
    if (
      part.mimeType?.startsWith("image/") &&
      part.body?.attachmentId
    ) {
      images.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || "image.jpg",
        mimeType: part.mimeType,
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return images;
}

// ── Claude Extraction ────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a work order extraction assistant for 3C Refrigeration, a commercial refrigeration service company.

You will receive an email (subject, body, and optionally images/screenshots) that is a service request from a customer.

Extract the following fields from the email and any attached images:

1. customer_name — the company/organization requesting service (e.g., "Duke University")
2. customer_wo — the customer's own work order or reference number (e.g., TMS WO# 1637295). Look in the subject line, email body, AND any screenshots of their tracking systems.
3. title — a concise title for the work order (e.g., "Cold Room C240 in alarm — LSRC 7776")
4. location — the specific room or unit (e.g., "C240", "C-360")
5. building — the building name or code (e.g., "LSRC 7776", "7776 LSRC")
6. description — a clear description of the issue and what's needed
7. priority — "high" if urgent/alarm/ASAP/today, "medium" if this week/soon, "low" if no urgency indicated
8. contact_name — the person requesting service (the sender or the person they're forwarding for)
9. contact_email — the requester's email address

Rules:
- If a field is not found, use null
- For screenshots/images of tracking systems (like TMS), read the WO number, equipment ID, description, location, and priority from the image
- For forwarded emails, identify the original requester, not just the forwarder
- The customer_wo is THEIR reference number, not ours
- Be concise in the title and description
- Return a confidence score (0-1) based on how much data you could extract. 1.0 = all fields found clearly, 0.5 = missing key fields, 0.3 = very sparse/informal

Respond with ONLY valid JSON matching this schema:
{
  "customer_name": string | null,
  "customer_wo": string | null,
  "title": string,
  "location": string | null,
  "building": string | null,
  "description": string,
  "priority": "high" | "medium" | "low",
  "contact_name": string | null,
  "contact_email": string | null,
  "confidence": number
}`;

async function extractWithClaude(
  apiKey: string,
  subject: string,
  body: string,
  imageBase64s: Array<{ data: string; mimeType: string }>
): Promise<{ extraction: any; raw: any }> {
  const content: any[] = [
    {
      type: "text",
      text: `Email Subject: ${subject}\n\nEmail Body:\n${body}`,
    },
  ];

  // Add images for vision
  for (const img of imageBase64s) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.data,
      },
    });
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });

  const raw = await resp.json();
  const text = raw.content?.[0]?.text || "{}";

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const extraction = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  return { extraction, raw };
}

// ── Main Handler ─────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Env / secrets
    const GOOGLE_SERVICE_EMAIL = Deno.env.get("GOOGLE_SERVICE_EMAIL")!;
    const GOOGLE_PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY")!;
    const GOOGLE_IMPERSONATE_EMAIL = Deno.env.get("GOOGLE_IMPERSONATE_EMAIL")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DRIVE_UPLOAD_URL = `${SUPABASE_URL}/functions/v1/drive-upload`;

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Auth to Gmail
    const gmailToken = await getGoogleAccessToken(
      GOOGLE_SERVICE_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_IMPERSONATE_EMAIL,
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
      ]
    );

    // 2. Get or create the 3C-Processed label
    const labelId = await getOrCreateLabel(gmailToken);

    // 3. List unread messages NOT already labeled 3C-Processed (last 24h safety window)
    const listResp = await gmailGet(
      `/messages?q=${encodeURIComponent("is:unread -label:3C-Processed in:inbox")}&maxResults=10`,
      gmailToken
    );
    const messageIds: string[] = (listResp.messages || []).map((m: { id: string }) => m.id);

    const errors: any[] = [];
    let draftsCreated = 0;

    // 4. Process each message
    for (const msgId of messageIds) {
      try {
        // 4a. Dedup check
        const { count } = await db
          .from("wo_drafts")
          .select("*", { count: "exact", head: true })
          .eq("email_id", msgId);
        if (count && count > 0) {
          // Already processed — just apply label in case it was missed
          await applyLabel(msgId, labelId, gmailToken);
          continue;
        }

        // 4b. Fetch full message
        const msg = await gmailGet(`/messages/${msgId}?format=full`, gmailToken);
        const headers = msg.payload?.headers || [];
        const from = getHeader(headers, "From");
        const subject = getHeader(headers, "Subject");
        const date = getHeader(headers, "Date");
        const body = extractText(msg.payload);

        // Parse sender name and email
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : from;
        const fromEmail = fromMatch ? fromMatch[2] : from;

        // 4c. Download image attachments
        const imageParts = extractImageParts(msg.payload);
        const imageBase64s: Array<{ data: string; mimeType: string }> = [];
        const driveAttachments: Array<{ url: string; name: string; type: string }> = [];

        for (const img of imageParts) {
          try {
            const attResp = await gmailGet(
              `/messages/${msgId}/attachments/${img.attachmentId}`,
              gmailToken
            );
            if (attResp.data) {
              // Gmail returns base64url — convert to standard base64
              const b64 = attResp.data.replace(/-/g, "+").replace(/_/g, "/");
              imageBase64s.push({ data: b64, mimeType: img.mimeType });

              // 4d. Upload to Drive
              const senderDomain = fromEmail.split("@")[1] || "unknown";
              const dateStr = new Date().toISOString().slice(0, 10);
              const driveResp = await fetch(DRIVE_UPLOAD_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  fileBase64: b64,
                  fileName: `${Date.now()}_${img.filename}`,
                  mimeType: img.mimeType,
                  folderPath: `3C FieldOps/Service Requests/${senderDomain}/${dateStr}`,
                }),
              });
              const driveResult = await driveResp.json();
              if (driveResult.success) {
                driveAttachments.push({
                  url: driveResult.thumbnailUrl || driveResult.webViewLink || "",
                  name: img.filename,
                  type: img.mimeType,
                });
              }
            }
          } catch (imgErr) {
            errors.push({ msgId, attachment: img.filename, error: String(imgErr) });
          }
        }

        // 4e. Call Claude to extract structured data
        const { extraction, raw } = await extractWithClaude(
          ANTHROPIC_API_KEY,
          subject,
          body,
          imageBase64s
        );

        // 4f. Match sender domain to existing customer
        let customerId: string | null = null;
        const senderDomain = fromEmail.split("@")[1]?.toLowerCase();
        if (senderDomain) {
          // Check email_contacts table for domain match
          const { data: contacts } = await db
            .from("email_contacts")
            .select("customer_id")
            .ilike("email", `%@${senderDomain}%`)
            .limit(1);

          if (contacts && contacts.length > 0) {
            customerId = contacts[0].customer_id;
          } else {
            // Fallback: check customers table — match domain to name heuristically
            // e.g., duke.edu → look for "Duke" in customer names
            const domainBase = senderDomain.split(".")[0]; // "duke" from "duke.edu"
            const { data: customers } = await db
              .from("customers")
              .select("id, name")
              .ilike("name", `%${domainBase}%`)
              .limit(1);
            if (customers && customers.length > 0) {
              customerId = customers[0].id;
              // Also use the matched customer name if AI didn't extract one
              if (!extraction.customer_name) {
                extraction.customer_name = customers[0].name;
              }
            }
          }
        }

        // 4g. Insert draft
        const { error: insertErr } = await db.from("wo_drafts").insert({
          email_id: msgId,
          email_from: fromEmail,
          email_from_name: fromName,
          email_subject: subject,
          email_body: body,
          email_date: date ? new Date(date).toISOString() : new Date().toISOString(),
          customer_name: extraction.customer_name || null,
          customer_id: customerId,
          customer_wo: extraction.customer_wo || null,
          title: extraction.title || subject,
          location: extraction.location || null,
          building: extraction.building || null,
          description: extraction.description || body.slice(0, 500),
          priority: extraction.priority || "medium",
          contact_name: extraction.contact_name || fromName,
          contact_email: extraction.contact_email || fromEmail,
          attachments: driveAttachments,
          ai_confidence: extraction.confidence ?? 0.5,
          ai_raw: raw,
        });

        if (insertErr) {
          errors.push({ msgId, error: insertErr.message });
        } else {
          draftsCreated++;
        }

        // 4h. Apply 3C-Processed label (does NOT change read status)
        await applyLabel(msgId, labelId, gmailToken);
      } catch (msgErr) {
        errors.push({ msgId, error: String(msgErr) });
      }
    }

    // 5. Log the run
    await db.from("email_processing_log").insert({
      emails_found: messageIds.length,
      drafts_created: draftsCreated,
      errors: errors.length > 0 ? errors : [],
    });

    return new Response(
      JSON.stringify({
        success: true,
        emails_found: messageIds.length,
        drafts_created: draftsCreated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
