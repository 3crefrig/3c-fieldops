// customer-health — Supabase Edge Function
// Calculates a health score (0-100) per customer based on:
// feedback, payment timeliness, service frequency, equipment condition, agreement status.
//
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customer_id } = await req.json();

    // Get customer
    const { data: customer } = await sb.from("customers")
      .select("*").eq("id", customer_id).single();
    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scores: Record<string, { score: number; max: number; detail: string }> = {};

    // 1. FEEDBACK (0-20): avg star rating
    const { data: feedback } = await sb.from("feedback")
      .select("star_rating")
      .eq("customer_name", customer.name)
      .order("submitted_at", { ascending: false })
      .limit(10);

    if (feedback && feedback.length > 0) {
      const avg = feedback.reduce((s: number, f: any) => s + f.star_rating, 0) / feedback.length;
      scores.feedback = { score: Math.round((avg / 5) * 20), max: 20, detail: `${avg.toFixed(1)}/5 avg (${feedback.length} reviews)` };
    } else {
      scores.feedback = { score: 10, max: 20, detail: "No feedback yet (neutral)" };
    }

    // 2. PAYMENT TIMELINESS (0-20): based on invoice payment speed
    const { data: invoices } = await sb.from("invoices")
      .select("status,date_issued,date_paid")
      .eq("customer", customer.name)
      .order("created_at", { ascending: false })
      .limit(10);

    if (invoices && invoices.length > 0) {
      const paid = invoices.filter((inv: any) => inv.status === "paid" && inv.date_issued && inv.date_paid);
      if (paid.length > 0) {
        const avgDays = paid.reduce((s: number, inv: any) => {
          const issued = new Date(inv.date_issued).getTime();
          const paidAt = new Date(inv.date_paid).getTime();
          return s + (paidAt - issued) / 86400000;
        }, 0) / paid.length;
        // Under 15 days = 20, 15-30 = 15, 30-45 = 10, 45-60 = 5, 60+ = 0
        const pts = avgDays <= 15 ? 20 : avgDays <= 30 ? 15 : avgDays <= 45 ? 10 : avgDays <= 60 ? 5 : 0;
        scores.payment = { score: pts, max: 20, detail: `${Math.round(avgDays)}d avg payment time` };
      } else {
        const overdue = invoices.filter((inv: any) => inv.status === "sent");
        scores.payment = { score: overdue.length > 2 ? 5 : 10, max: 20, detail: `${overdue.length} unpaid invoices` };
      }
    } else {
      scores.payment = { score: 10, max: 20, detail: "No invoices yet (neutral)" };
    }

    // 3. SERVICE FREQUENCY (0-20): regular engagement is healthy
    const { data: wos } = await sb.from("work_orders")
      .select("created_at,status,wo_type")
      .eq("customer", customer.name)
      .order("created_at", { ascending: false })
      .limit(20);

    if (wos && wos.length > 0) {
      const completed = wos.filter((w: any) => w.status === "completed").length;
      const pmCount = wos.filter((w: any) => w.wo_type === "PM").length;
      const recentCount = wos.filter((w: any) => {
        const d = new Date(w.created_at);
        return d > new Date(Date.now() - 180 * 86400000); // last 6 months
      }).length;
      // Active customer with regular service = high score
      const pts = Math.min(20, Math.round((recentCount / 6) * 10 + (pmCount > 0 ? 5 : 0) + (completed > 5 ? 5 : completed > 2 ? 3 : 0)));
      scores.service = { score: pts, max: 20, detail: `${recentCount} jobs in 6mo, ${pmCount} PMs, ${completed} completed` };
    } else {
      scores.service = { score: 5, max: 20, detail: "No service history" };
    }

    // 4. EQUIPMENT CONDITION (0-20): warranty status, age
    const { data: equipment } = await sb.from("equipment")
      .select("warranty_expiration,install_date,status")
      .eq("customer_id", customer_id)
      .eq("status", "active");

    if (equipment && equipment.length > 0) {
      const today = new Date();
      const warrantyOk = equipment.filter((e: any) => e.warranty_expiration && new Date(e.warranty_expiration) > today).length;
      const warrantyPct = warrantyOk / equipment.length;
      const pts = Math.round(warrantyPct * 15 + 5); // 5 base for having equipment registered
      scores.equipment = { score: Math.min(20, pts), max: 20, detail: `${equipment.length} units, ${warrantyOk} under warranty` };
    } else {
      scores.equipment = { score: 10, max: 20, detail: "No equipment registered (neutral)" };
    }

    // 5. AGREEMENT STATUS (0-20): active agreement = great
    const { data: agreements } = await sb.from("service_agreements")
      .select("status,auto_renew")
      .eq("customer_id", customer_id);

    if (agreements && agreements.length > 0) {
      const active = agreements.filter((a: any) => a.status === "active").length;
      const autoRenew = agreements.filter((a: any) => a.auto_renew).length;
      const pts = active > 0 ? (autoRenew > 0 ? 20 : 15) : 5;
      scores.agreement = { score: pts, max: 20, detail: `${active} active, ${autoRenew} auto-renew` };
    } else {
      scores.agreement = { score: 5, max: 20, detail: "No service agreement" };
    }

    const totalScore = Object.values(scores).reduce((s, v) => s + v.score, 0);
    const maxScore = Object.values(scores).reduce((s, v) => s + v.max, 0);

    // Save to customer record
    await sb.from("customers").update({
      health_score: totalScore,
      health_score_updated_at: new Date().toISOString(),
    }).eq("id", customer_id);

    return new Response(JSON.stringify({
      success: true,
      customer_name: customer.name,
      total_score: totalScore,
      max_score: maxScore,
      breakdown: scores,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("customer-health error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
