// Nightly full-database backup → private "backups" storage bucket.
//
// Why this exists: the Supabase free tier has no point-in-time recovery. Before
// this function, the disaster-recovery plan for 3C's entire operational history
// was "hope the IndexedDB cache on someone's phone is fresh." Now every night a
// gzipped JSON snapshot of every table lands in a PRIVATE bucket, 14 kept.
//
// Format: { meta:{ts,tables,rowCounts}, data:{ [table]: rows[] } } → gzip.
// Restore: download snapshot (service role or dashboard), gunzip, and insert
// per table — see MAINTENANCE.md "Restore from backup". Storage uploads are
// ingress (free); nothing here touches egress except the tiny function logs.
//
// Service-role only, mirroring daily-sweeps: pg_cron posts with the vault key.

import { createClient } from "jsr:@supabase/supabase-js@2";

const TABLES = [
  "users","customers","work_orders","time_entries","purchase_orders","photos",
  "notifications","recurring_templates","email_templates","email_contacts",
  "projects","project_chambers","project_milestones","project_parts",
  "project_notes","project_photos","project_drawings","wo_drafts","wo_activity",
  "wo_line_items","wo_field_notes","invoices","scheduled_emails","estimates",
  "proposals","feedback","feedback_requests","equipment","service_agreements",
  "agreement_tiers","rfqs","rfq_items","rfq_specs","po_tickets",
  "po_ticket_items","vendor_bills","vendor_bill_items","parts_sales",
  "push_subscriptions","app_settings","refrigerant_log","workflows",
  "workflow_runs","company_events","scope_snippets",
];
const KEEP = 14;

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) {
      // decode-and-check like the other functions: only service_role may run this
      try {
        const payload = JSON.parse(atob(token.split(".")[1] || ""));
        if (payload.role !== "service_role") return new Response("forbidden", { status: 403 });
      } catch (_e) { return new Response("forbidden", { status: 403 }); }
    }
    const sb = createClient(url, serviceKey);

    const data: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    const errors: Record<string, string> = {};
    for (const t of TABLES) {
      // page through so big tables (work_orders w/ signatures) come out whole
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb.from(t).select("*").range(from, from + 999);
        if (error) { errors[t] = error.message; break; }
        rows.push(...(page || []));
        if (!page || page.length < 1000) break;
      }
      data[t] = rows; rowCounts[t] = rows.length;
    }

    const snapshot = JSON.stringify({
      meta: { ts: new Date().toISOString(), tables: TABLES.length, rowCounts, errors },
      data,
    });
    const gz = new Response(
      new Blob([snapshot]).stream().pipeThrough(new CompressionStream("gzip")),
    );
    const bytes = new Uint8Array(await gz.arrayBuffer());

    const name = "fieldops-" + new Date().toISOString().slice(0, 10) + ".json.gz";
    const up = await sb.storage.from("backups").upload(name, bytes, {
      contentType: "application/gzip", upsert: true,
    });
    if (up.error) throw new Error("upload failed: " + up.error.message);

    // retention: keep the newest KEEP snapshots
    const { data: files } = await sb.storage.from("backups").list("", { limit: 200 });
    const old = (files || [])
      .filter((f) => f.name.startsWith("fieldops-"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(KEEP)
      .map((f) => f.name);
    if (old.length) await sb.storage.from("backups").remove(old);

    const totalRows = Object.values(rowCounts).reduce((s, n) => s + n, 0);
    console.log("backup ok", name, totalRows, "rows,", bytes.length, "bytes gz,", Object.keys(errors).length, "table errors");
    return new Response(JSON.stringify({ ok: true, name, totalRows, bytes: bytes.length, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backup failed:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
