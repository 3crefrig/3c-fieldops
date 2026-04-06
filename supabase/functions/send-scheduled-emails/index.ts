// send-scheduled-emails — Supabase Edge Function
// Triggered by pg_cron every minute. Checks for pending scheduled emails
// and sends them via Gmail API when send_at <= now().
//
// Secrets required:
//   GOOGLE_SERVICE_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_IMPERSONATE_EMAIL
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

// ── Gmail Send ──────────────────────────────────────────────

function buildMimeMessage(
  from: string,
  to: string,
  cc: string | null,
  subject: string,
  htmlBody: string,
  attachment?: { name: string; content: string; type: string }
): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");

  let headers = `From: 3C REFRIGERATION <${from}>\r\n`;
  headers += `To: ${to}\r\n`;
  if (cc) headers += `Cc: ${cc}\r\n`;
  headers += `Subject: ${subject}\r\n`;
  headers += `MIME-Version: 1.0\r\n`;

  if (attachment) {
    headers += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    let mime = headers;
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    mime += htmlBody + "\r\n\r\n";
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${attachment.type}; name="${attachment.name}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${attachment.name}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mime += attachment.content + "\r\n";
    mime += `--${boundary}--`;
    return mime;
  } else {
    headers += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    return headers + htmlBody;
  }
}

async function sendEmail(
  token: string,
  from: string,
  to: string,
  cc: string | null,
  subject: string,
  body: string,
  attachment?: { name: string; content: string; type: string }
) {
  const mime = buildMimeMessage(from, to, cc, subject, body, attachment);
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const resp = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  const result = await resp.json();
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  return result;
}

// ── Main Handler ────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_SERVICE_EMAIL = Deno.env.get("GOOGLE_SERVICE_EMAIL")!;
    const GOOGLE_PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY")!;
    const GOOGLE_IMPERSONATE_EMAIL = Deno.env.get("GOOGLE_IMPERSONATE_EMAIL") || "service@3crefrigeration.com";

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Find pending emails whose send_at has passed
    const { data: pending, error: fetchErr } = await sb
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google access token
    const token = await getGoogleAccessToken(
      GOOGLE_SERVICE_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_IMPERSONATE_EMAIL,
      ["https://www.googleapis.com/auth/gmail.send"]
    );

    let sentCount = 0;
    for (const email of pending) {
      try {
        const attachment = email.attachment_base64
          ? { name: email.attachment_name || "invoice.pdf", content: email.attachment_base64, type: "application/pdf" }
          : undefined;

        await sendEmail(
          token,
          GOOGLE_IMPERSONATE_EMAIL,
          email.to_emails,
          email.cc_emails || null,
          email.subject,
          email.body,
          attachment
        );

        await sb
          .from("scheduled_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);

        sentCount++;
      } catch (sendErr: unknown) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error("Failed to send email", email.id, errMsg);
        await sb
          .from("scheduled_emails")
          .update({ status: "failed", error_msg: errMsg.slice(0, 500) })
          .eq("id", email.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("send-scheduled-emails error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
