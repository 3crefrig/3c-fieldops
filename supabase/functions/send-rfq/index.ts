// send-rfq — Supabase Edge Function
// Emails a generated RFQ .docx to the vendor. Manager/admin ONLY: the caller's
// role is verified server-side from their JWT, so a technician cannot trigger a
// send even if the UI is bypassed. Requires the RFQ to be approved first.
//
// Request body: { "rfq_id": "<uuid>" }
// Auth: Authorization: Bearer <user access token>  (NOT the anon key)
//
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Base64-encode bytes in chunks (avoids call-stack overflow on large files).
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { rfq_id } = await req.json();
    if (!rfq_id) return json({ error: "rfq_id required" }, 400);

    // ── Identify the caller from their JWT ───────────────────
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    const email = userData?.user?.email;
    if (userErr || !email) return json({ error: "Invalid session" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Role gate (server-side, not UI) ──────────────────────
    const { data: appUser } = await db
      .from("users")
      .select("id, role, name")
      .ilike("email", email)
      .maybeSingle();
    const role = appUser?.role;
    if (role !== "manager" && role !== "admin") {
      return json({ error: "Only managers or admins may send RFQs." }, 403);
    }

    // ── Load RFQ and validate it is ready to send ────────────
    const { data: rfq, error: rfqErr } = await db
      .from("rfqs")
      .select("*")
      .eq("id", rfq_id)
      .single();
    if (rfqErr || !rfq) return json({ error: "RFQ not found" }, 404);
    if (!rfq.vendor_email) return json({ error: "RFQ has no vendor email." }, 400);
    if (!rfq.approved_by) return json({ error: "RFQ must be approved before sending." }, 400);
    if (!rfq.docx_path) return json({ error: "RFQ document has not been generated yet." }, 400);

    // ── Fetch the .docx from Storage ─────────────────────────
    const { data: blob, error: dlErr } = await db.storage.from("rfq-docs").download(rfq.docx_path);
    if (dlErr || !blob) return json({ error: "Could not read RFQ document." }, 500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const b64 = toBase64(bytes);
    const fileName = (rfq.rfq_ref || "RFQ") + ".docx";

    // ── Compose + send via the existing send-email function ──
    const subject = "Request for Quotation — " + (rfq.rfq_ref || "") +
      (rfq.account ? " (" + rfq.account + ")" : "");
    const bodyLines = [
      "Hello" + (rfq.to_vendor ? " " + rfq.to_vendor : "") + ",",
      "",
      "Please find attached a Request for Quotation (" + (rfq.rfq_ref || "") + ") from 3C Refrigeration LLC.",
      (rfq.intro_text ? "" : "") ,
      rfq.intro_text ? rfq.intro_text : "We would appreciate your best pricing and availability for the listed items.",
      "",
      "Please reply with your quotation at your earliest convenience.",
      "",
      "Thank you,",
      appUser?.name || "3C Refrigeration",
      "3C Refrigeration LLC",
      "(336) 264-0935 · service@3crefrigeration.com",
    ];
    const bodyHtml =
      "<div style=\"font-family:Calibri,Arial,sans-serif;font-size:14px;color:#222;line-height:1.5\">" +
      bodyLines.filter((l) => l !== null && l !== undefined).map((l) => (l === "" ? "<br/>" : l)).join("<br/>") +
      "</div>";

    const emailResp = await fetch(SUPABASE_URL + "/functions/v1/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ANON_KEY },
      body: JSON.stringify({
        to: rfq.vendor_email,
        subject,
        body: bodyHtml,
        attachment: {
          name: fileName,
          content: b64,
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }),
    });
    const emailResult = await emailResp.json().catch(() => ({}));
    if (!emailResp.ok || emailResult.success === false) {
      return json({ error: "Email delivery failed: " + (emailResult.error || emailResp.status) }, 502);
    }

    // ── Mark as sent ─────────────────────────────────────────
    const sentAt = new Date().toISOString();
    const { error: updErr } = await db
      .from("rfqs")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", rfq_id);
    if (updErr) return json({ error: "Sent, but failed to update status: " + updErr.message }, 500);

    return json({ success: true, sent_to: rfq.vendor_email, sent_at: sentAt });
  } catch (err) {
    console.error("send-rfq error:", err);
    return json({ success: false, error: String(err) }, 500);
  }
});
