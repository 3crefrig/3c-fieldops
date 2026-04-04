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

    // Gather context from the database — lean queries, pre-aggregate
    // 1. Recent WOs — only titles + status + work_performed summary (not full objects)
    let woQuery = sb.from("work_orders").select("id,wo_id,title,status,work_performed,date_completed,wo_type")
      .eq("customer", customer_name)
      .order("created_at", { ascending: false })
      .limit(5);
    if (location) woQuery = woQuery.eq("location", location);
    const { data: recentWOs } = await woQuery;
    const woDbIds = (recentWOs || []).map((w: any) => w.id).filter(Boolean);

    // 2. Parts — aggregate by description (name + count), not raw PO list
    let partsSummary: Array<{ name: string; count: number }> = [];
    if (woDbIds.length > 0) {
      const { data: pos } = await sb.from("purchase_orders")
        .select("description")
        .in("wo_id", woDbIds)
        .eq("status", "approved");
      if (pos && pos.length > 0) {
        const counts: Record<string, number> = {};
        pos.forEach((p: any) => { counts[p.description] = (counts[p.description] || 0) + 1; });
        partsSummary = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
      }
    }

    // 3. Equipment — lean select
    let equipmentInfo = null;
    if (equipment_id) {
      const { data: eq } = await sb.from("equipment")
        .select("model,manufacturer,equipment_type,refrigerant_type,warranty_expiration,notes")
        .eq("id", equipment_id)
        .single();
      equipmentInfo = eq;
    }

    // 4. Avg hours — aggregate in one query
    let avgHours = 0;
    if (woDbIds.length > 0) {
      const { data: timeEntries } = await sb.from("time_entries")
        .select("hours,wo_id")
        .in("wo_id", woDbIds);
      if (timeEntries && timeEntries.length > 0) {
        const woHoursMap: Record<string, number> = {};
        timeEntries.forEach((t: any) => { woHoursMap[t.wo_id] = (woHoursMap[t.wo_id] || 0) + parseFloat(t.hours || 0); });
        const totals = Object.values(woHoursMap);
        avgHours = totals.reduce((s: number, h: number) => s + h, 0) / totals.length;
      }
    }

    // 5. Customer feedback — just avg rating + count, not full text
    const { data: feedback } = await sb.from("feedback")
      .select("star_rating")
      .eq("customer_name", customer_name);
    const avgRating = feedback && feedback.length > 0
      ? (feedback.reduce((s: number, f: any) => s + (f.star_rating || 0), 0) / feedback.length).toFixed(1)
      : null;

    // Build lean context for Claude — pre-aggregated, minimal tokens
    let context = `Customer: ${customer_name}`;
    if (location) context += ` | Location: ${location}`;
    if (building) context += ` | Building: ${building}`;
    if (wo_title) context += `\nCurrent WO: ${wo_title}`;

    if (equipmentInfo) {
      context += `\nEquipment: ${equipmentInfo.model || "Unknown"} (${equipmentInfo.equipment_type || ""}), ${equipmentInfo.refrigerant_type || ""}`;
      if (equipmentInfo.warranty_expiration) context += `, warranty: ${equipmentInfo.warranty_expiration}`;
      if (equipmentInfo.notes) context += `\nNotes: ${equipmentInfo.notes.slice(0, 100)}`;
    }

    if (recentWOs && recentWOs.length > 0) {
      context += `\n\nRecent WOs:\n`;
      recentWOs.forEach((w: any) => {
        context += `- ${w.wo_id}: ${w.title} [${w.status}]${w.date_completed ? " " + w.date_completed : ""}`;
        if (w.work_performed) context += ` — ${w.work_performed.slice(0, 80)}`;
        context += `\n`;
      });
    }

    if (partsSummary.length > 0) {
      context += `\nCommon parts: ${partsSummary.map(p => p.name + " (×" + p.count + ")").join(", ")}\n`;
    }

    if (avgHours > 0) context += `Avg duration: ${avgHours.toFixed(1)}h\n`;
    if (avgRating) context += `Customer rating: ${avgRating}/5 (${feedback!.length} reviews)\n`;

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
        max_tokens: 600,
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
