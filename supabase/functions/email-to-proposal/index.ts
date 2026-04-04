// email-to-proposal — Supabase Edge Function
// Two modes:
//   action: "list"    — returns recent service-related emails (no AI, 0 tokens)
//   action: "extract"  — fetches one email by ID, extracts proposal data (~200 tokens)
//
// Includes 2-hour refresh cooldown on list mode.
//
// Secrets: GOOGLE_SERVICE_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATE_EMAIL,
//          ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Google Auth (same as process-inbox) ──────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem.replace(/\\n/g, "\n");
  const b64 = cleanPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getGoogleAccessToken(
  serviceEmail: string,
  privateKeyPem: string,
  impersonateEmail: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: serviceEmail, sub: impersonateEmail, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
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

// ── Gmail helpers ────────────────────────────────────────────

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet(path: string, token: string) {
  const r = await fetch(`${GMAIL_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBody(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(atob(padded).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
}

function extractText(payload: any): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) { for (const part of payload.parts) { const text = extractText(part); if (text) return text; } }
  return "";
}

// ── Main Handler ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GOOGLE_SERVICE_EMAIL = Deno.env.get("GOOGLE_SERVICE_EMAIL")!;
    const GOOGLE_PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY")!;
    const GOOGLE_IMPERSONATE_EMAIL = Deno.env.get("GOOGLE_IMPERSONATE_EMAIL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { action, messageId, user_id } = await req.json();

    // ── LIST MODE ────────────────────────────────────────────
    if (action === "list") {
      // Check 2-hour cooldown
      if (user_id) {
        const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await db
          .from("email_refresh_log")
          .select("refreshed_at")
          .eq("user_id", user_id)
          .gte("refreshed_at", twoHoursAgo)
          .order("refreshed_at", { ascending: false })
          .limit(1);

        if (recent && recent.length > 0) {
          const nextAllowed = new Date(new Date(recent[0].refreshed_at).getTime() + 2 * 60 * 60 * 1000);
          return new Response(JSON.stringify({
            success: false,
            error: "cooldown",
            next_refresh_at: nextAllowed.toISOString(),
            message: "Please wait before refreshing again",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const gmailToken = await getGoogleAccessToken(
        GOOGLE_SERVICE_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATE_EMAIL,
        ["https://www.googleapis.com/auth/gmail.readonly"]
      );

      // Same keyword filter as process-inbox
      const query = "in:inbox {work order OR service request OR repair OR maintenance OR emergency OR trouble OR broken OR malfunction OR leak OR temperature OR alarm OR unit down OR not cooling OR not working OR PM OR corrective OR WO OR inspection}";
      const listResp = await gmailGet(`/messages?q=${encodeURIComponent(query)}&maxResults=20`, gmailToken);
      const messageIds: string[] = (listResp.messages || []).map((m: { id: string }) => m.id);

      // Fetch headers for each message (no AI)
      const emails = [];
      for (const msgId of messageIds) {
        const msg = await gmailGet(`/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, gmailToken);
        const headers = msg.payload?.headers || [];
        const from = getHeader(headers, "From");
        const subject = getHeader(headers, "Subject");
        const date = getHeader(headers, "Date");
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
        emails.push({
          id: msgId,
          from_name: fromMatch ? fromMatch[1].replace(/"/g, "").trim() : from,
          from_email: fromMatch ? fromMatch[2] : from,
          subject,
          date: date ? new Date(date).toISOString() : null,
          snippet: msg.snippet || "",
        });
      }

      // Log the refresh
      if (user_id) {
        const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await db.from("email_refresh_log").insert({ user_id });
      }

      return new Response(JSON.stringify({ success: true, emails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXTRACT MODE ─────────────────────────────────────────
    if (action === "extract" && messageId) {
      const gmailToken = await getGoogleAccessToken(
        GOOGLE_SERVICE_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATE_EMAIL,
        ["https://www.googleapis.com/auth/gmail.readonly"]
      );

      const msg = await gmailGet(`/messages/${messageId}?format=full`, gmailToken);
      const headers = msg.payload?.headers || [];
      const from = getHeader(headers, "From");
      const subject = getHeader(headers, "Subject");
      const body = extractText(msg.payload);

      const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : from;
      const fromEmail = fromMatch ? fromMatch[2] : from;

      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

      // Minimal extraction prompt (~150 tokens)
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `Extract proposal details from this service email. Return ONLY JSON:
{"customer_name":string|null,"project_title":string|null,"scope_description":string,"location":string|null,"building":string|null,"customer_type":string|null,"contact_name":string|null,"contact_email":string|null,"urgency":"high"|"medium"|"low"}

From: ${fromName} <${fromEmail}>
Subject: ${subject}
Body: ${(body || "").slice(0, 1500)}`
          }],
        }),
      });

      const result = await resp.json();
      const text = result.content?.[0]?.text || "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const extraction = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      // Try to match sender to existing customer
      const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const senderDomain = fromEmail.split("@")[1]?.toLowerCase();
      let matched_customer = null;
      if (senderDomain) {
        const domainBase = senderDomain.split(".")[0];
        const { data: customers } = await db
          .from("customers")
          .select("id, name")
          .ilike("name", `%${domainBase}%`)
          .limit(1);
        if (customers && customers.length > 0) {
          matched_customer = customers[0];
        }
      }

      return new Response(JSON.stringify({
        success: true,
        extraction: {
          ...extraction,
          contact_name: extraction.contact_name || fromName,
          contact_email: extraction.contact_email || fromEmail,
        },
        matched_customer,
        email_subject: subject,
        usage: result.usage,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'list' or 'extract'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-to-proposal error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
