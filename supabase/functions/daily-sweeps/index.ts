// Daily notification sweeps — runs once/day via pg_cron (service-role only).
// Ports the time-based checks that used to run in every user's browser on every
// app open. The notif_daily_dedupe partial unique index makes inserts idempotent
// (duplicate type+message+utc-day is silently ignored), so a re-run is safe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const excl = (name: string) => { const n = (name || "").toLowerCase(); return n.includes("school of medicine") || (n.includes("duke") && n.includes("facilities maintenance")); };
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // Service-role only (decode the gateway-verified JWT and require role=service_role).
  const token = (req.headers.get("Authorization") || "").replace(/^[Bb]earer[ ]+/, "").trim();
  let role: string | null = null;
  if (token === SVC) role = "service_role";
  else try { const seg = (token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"); role = JSON.parse(atob(seg + "=".repeat((4 - seg.length % 4) % 4))).role; } catch (_e) {}
  if (role !== "service_role") return new Response(JSON.stringify({ error: "service credential required" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

  const db = createClient(SB_URL, SVC);
  const today = new Date().toISOString().slice(0, 10);
  const cutISO = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const cutDate = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const plusDate = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const counts: Record<string, number> = {};
  const notif = async (type: string, title: string, message: string, for_role: string | null) => {
    const { error } = await db.from("notifications").insert({ type, title, message, for_role });
    if (!error) counts[type] = (counts[type] || 0) + 1;
  };
  const push = (payload: any) => fetch(SB_URL + "/functions/v1/send-push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SVC }, body: JSON.stringify(payload) }).catch(() => {});

  try {
    // 1) Overdue by due date (bell for all + push assignee/managers)
    const { data: nc } = await db.from("work_orders").select("wo_id,title,assignee,due_date").neq("status", "completed");
    for (const w of nc || []) if (isDate(w.due_date) && w.due_date < today) {
      await notif("wo_past_due", "Work Order Overdue", `${w.wo_id} — ${w.title || ""} was due ${w.due_date}`, null);
      push({ userNames: w.assignee && w.assignee !== "Unassigned" ? [w.assignee] : [], roles: ["manager"], title: "Overdue Work Order", body: `${w.wo_id} was due ${w.due_date}`, url: "/#tab=orders", emailFallback: true });
    }

    // 2) Ready to invoice (managers) — recent, non-project, billable customer
    const { data: custs } = await db.from("customers").select("name,auto_invoice");
    const autoNames = new Set((custs || []).filter((c: any) => c.auto_invoice).map((c: any) => c.name));
    const { data: done } = await db.from("work_orders").select("id,wo_id,customer,date_completed").eq("status", "completed").or("invoiced.is.null,invoiced.eq.false").is("project_id", null);
    for (const w of done || []) if (isDate(w.date_completed) && w.date_completed >= cutDate(30) && (w.customer || "").trim() !== "" && !excl(w.customer) && !autoNames.has(w.customer))
      await notif("wo_needs_invoice", "Ready to Invoice", `${w.wo_id} — ${w.customer} is complete and needs invoicing`, "manager");

    // 3) Unassigned WO > 24h (managers + push)
    const { data: un } = await db.from("work_orders").select("wo_id,title,assignee,created_at").neq("status", "completed").lte("created_at", cutISO(1));
    for (const w of un || []) if (!w.assignee || w.assignee === "Unassigned" || String(w.assignee).trim() === "") {
      await notif("wo_unassigned", "Unassigned Work Order", `${w.wo_id} — ${w.title || ""} has been unassigned over 24h`, "manager");
      push({ roles: ["manager", "admin"], title: "Unassigned Work Order", body: `${w.wo_id} needs a tech (24h+)`, url: "/#tab=orders" });
    }

    // 4) PO awaiting approval > 24h (managers + push)
    const { data: pos } = await db.from("purchase_orders").select("po_id,amount,requested_by").eq("status", "pending").lte("created_at", cutISO(1));
    for (const p of pos || []) {
      await notif("po_approval_stale", "PO Awaiting Approval", `${p.po_id} — $${p.amount || 0} from ${p.requested_by || ""} pending over 24h`, "manager");
      push({ roles: ["manager", "admin"], title: "PO Awaiting Approval", body: `${p.po_id} — $${p.amount || 0} pending 24h+`, url: "/#tab=pos" });
    }

    // 5) Completed WO missing hours/signature (managers)
    const { data: cg } = await db.from("work_orders").select("id,wo_id,title,customer,signature,date_completed").eq("status", "completed").or("invoiced.is.null,invoiced.eq.false").is("project_id", null);
    const rel = (cg || []).filter((w: any) => isDate(w.date_completed) && w.date_completed >= cutDate(30) && (w.customer || "").trim() !== "" && !excl(w.customer));
    if (rel.length) {
      const { data: times } = await db.from("time_entries").select("wo_id,hours").in("wo_id", rel.map((w: any) => w.id));
      const hrs: Record<string, number> = {}; (times || []).forEach((t: any) => hrs[t.wo_id] = (hrs[t.wo_id] || 0) + parseFloat(t.hours || 0));
      for (const w of rel) { const noH = !(hrs[w.id] > 0), noS = !w.signature; if (noH || noS) { const g = []; if (noH) g.push("no hours logged"); if (noS) g.push("no signature"); await notif("wo_completion_gap", "Completed WO Needs Attention", `${w.wo_id} — ${w.title || ""}: ${g.join(" + ")} before invoicing`, "manager"); } }
    }

    // 6) Draft invoice unsent > 3 days (admins)
    const { data: dr } = await db.from("invoices").select("invoice_num,customer,amount").eq("status", "draft").lte("created_at", cutISO(3));
    for (const inv of dr || []) await notif("invoice_draft_stale", "Draft Invoice Unsent", `${inv.invoice_num || "Invoice"} for ${inv.customer || ""} — $${inv.amount || 0} still in draft 3+ days`, "admin");

    // 7) Deadline approaching (due within 2 days)
    const { data: due } = await db.from("work_orders").select("wo_id,title,due_date").neq("status", "completed").gte("due_date", today).lte("due_date", plusDate(2));
    for (const w of due || []) if (isDate(w.due_date)) await notif("deadline_warning", "Deadline Approaching", `${w.wo_id} — ${w.title} is due ${w.due_date}`, null);

    // 8) Equipment warranty expiring within 30 days (managers)
    const { data: eq } = await db.from("equipment").select("model,serial_number,customer_name,warranty_expiration").eq("status", "active").gte("warranty_expiration", today).lte("warranty_expiration", plusDate(30));
    for (const e of eq || []) await notif("warranty_expiring", "Warranty Expiring Soon", `${e.model || "Equipment"} (SN: ${e.serial_number || "N/A"}) at ${e.customer_name} — warranty expires ${e.warranty_expiration}`, "manager");

    // 9) Service agreement renewals (stateful flag, not day-deduped)
    const { data: ag } = await db.from("service_agreements").select("id,agreement_num,customer_name,end_date").eq("status", "active").eq("renewal_reminder_sent", false).gte("end_date", today).lte("end_date", plusDate(30));
    for (const a of ag || []) { await db.from("notifications").insert({ type: "agreement_expiring", title: "Agreement Expiring", message: `${a.agreement_num} for ${a.customer_name} expires ${a.end_date}`, for_role: "manager" }); await db.from("service_agreements").update({ renewal_reminder_sent: true }).eq("id", a.id); counts["agreement_expiring"] = (counts["agreement_expiring"] || 0) + 1; }

    return new Response(JSON.stringify({ success: true, ran: today, counts }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
