// job-intelligence — Supabase Edge Function
// Generates an AI brief when a tech opens a work order:
// past visits, common issues, parts used, estimated duration.
//
// Secrets required:
//   ANTHROPIC_API_KEY
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Use service role for DB queries (auth provided by Supabase API gateway)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { customer_name, location, building, equipment_id, wo_title } = await req.json();

    if (!customer_name) {
      return new Response(JSON.stringify({ error: "customer_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context from the database
    // 1. Recent WOs at this customer + location
    let woQuery = sb.from("work_orders").select("wo_id,title,status,assignee,work_performed,date_completed,created_at,wo_type")
      .eq("customer", customer_name)
      .order("created_at", { ascending: false })
      .limit(8);
    if (location) woQuery = woQuery.eq("location", location);
    const { data: recentWOs } = await woQuery;

    // 2. POs (parts used) for those WOs
    const woIds = (recentWOs || []).map((w: any) => w.id).filter(Boolean);
    let recentPOs: any[] = [];
    if (recentWOs && recentWOs.length > 0) {
      // Get POs by matching wo_id from work_orders table
      const { data: wosWithIds } = await sb.from("work_orders")
        .select("id,wo_id")
        .eq("customer", customer_name)
        .order("created_at", { ascending: false })
        .limit(8);
      const ids = (wosWithIds || []).map((w: any) => w.id);
      if (ids.length > 0) {
        const { data: pos } = await sb.from("purchase_orders")
          .select("description,amount,status,wo_id")
          .in("wo_id", ids)
          .eq("status", "approved");
        recentPOs = pos || [];
      }
    }

    // 3. Equipment history if linked
    let equipmentInfo = null;
    if (equipment_id) {
      const { data: eq } = await sb.from("equipment")
        .select("model,serial_number,manufacturer,equipment_type,refrigerant_type,install_date,warranty_expiration,notes")
        .eq("id", equipment_id)
        .single();
      equipmentInfo = eq;
    }

    // 4. Time entries for duration estimation
    let avgHours = 0;
    if (recentWOs && recentWOs.length > 0) {
      const { data: wosWithIds } = await sb.from("work_orders")
        .select("id")
        .eq("customer", customer_name)
        .eq("status", "completed")
        .limit(8);
      const completedIds = (wosWithIds || []).map((w: any) => w.id);
      if (completedIds.length > 0) {
        const { data: timeEntries } = await sb.from("time_entries")
          .select("hours,wo_id")
          .in("wo_id", completedIds);
        if (timeEntries && timeEntries.length > 0) {
          const woHoursMap: Record<string, number> = {};
          timeEntries.forEach((t: any) => {
            woHoursMap[t.wo_id] = (woHoursMap[t.wo_id] || 0) + parseFloat(t.hours || 0);
          });
          const totals = Object.values(woHoursMap);
          avgHours = totals.reduce((s: number, h: number) => s + h, 0) / totals.length;
        }
      }
    }

    // 5. Customer feedback
    const { data: feedback } = await sb.from("feedback")
      .select("star_rating,private_feedback,testimonial_text")
      .eq("customer_name", customer_name)
      .order("submitted_at", { ascending: false })
      .limit(3);

    // Build context for Claude
    let context = `Customer: ${customer_name}\n`;
    if (location) context += `Location: ${location}\n`;
    if (building) context += `Building: ${building}\n`;
    if (wo_title) context += `Current WO: ${wo_title}\n`;

    if (equipmentInfo) {
      context += `\nEquipment: ${equipmentInfo.model || "Unknown"} by ${equipmentInfo.manufacturer || "Unknown"}`;
      context += `\n  Type: ${equipmentInfo.equipment_type}, Refrigerant: ${equipmentInfo.refrigerant_type || "N/A"}`;
      if (equipmentInfo.install_date) context += `\n  Installed: ${equipmentInfo.install_date}`;
      if (equipmentInfo.warranty_expiration) context += `, Warranty expires: ${equipmentInfo.warranty_expiration}`;
      if (equipmentInfo.notes) context += `\n  Notes: ${equipmentInfo.notes}`;
    }

    if (recentWOs && recentWOs.length > 0) {
      context += `\n\nRecent work orders at this customer/location (newest first):\n`;
      recentWOs.forEach((w: any) => {
        context += `  - ${w.wo_id}: ${w.title} [${w.status}] ${w.date_completed ? "completed " + w.date_completed : ""}\n`;
        if (w.work_performed) context += `    Work: ${w.work_performed.slice(0, 150)}\n`;
      });
    }

    if (recentPOs.length > 0) {
      context += `\nParts/materials used in recent jobs:\n`;
      recentPOs.forEach((p: any) => {
        context += `  - ${p.description} ($${p.amount})\n`;
      });
    }

    if (avgHours > 0) {
      context += `\nAverage job duration at this customer: ${avgHours.toFixed(1)} hours\n`;
    }

    if (feedback && feedback.length > 0) {
      context += `\nRecent customer feedback:\n`;
      feedback.forEach((f: any) => {
        context += `  - Rating: ${f.star_rating}/5`;
        if (f.private_feedback) context += ` — "${f.private_feedback.slice(0, 100)}"`;
        context += `\n`;
      });
    }

    // Call Claude
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a job intelligence assistant for 3C Refrigeration field technicians. Given context about a customer, location, and service history, generate a brief that helps the tech prepare for the job.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "1-2 sentence overview of this customer/location",
  "common_issues": ["issue 1", "issue 2"],
  "parts_used_previously": [{"name": "part name", "frequency": 2}],
  "avg_duration_hours": 2.5,
  "customer_notes": "Any relevant notes about customer preferences or site specifics",
  "suggested_approach": "Brief suggestion for how to approach this job based on history"
}

Keep it concise and actionable. If there's limited history, say so and provide general guidance.`,
        messages: [{ role: "user", content: context }],
      }),
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      console.error("Claude API error:", err);
      return new Response(JSON.stringify({ error: "Claude API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResp.json();
    const text = claudeData.content?.[0]?.text || "";

    let result;
    try {
      const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse", raw: text }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("job-intelligence error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
