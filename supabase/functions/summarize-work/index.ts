// summarize-work — Supabase Edge Function
// Takes WO completion data (time entries, notes, title) and returns
// a clean customer-facing work summary using Claude.
// Designed for minimal token usage (~400 tokens per call).
//
// Secrets required: ANTHROPIC_API_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You summarize HVAC/R field service work for customer-facing records.
Given work order data, produce ONLY valid JSON:
{"summary":"1-3 sentence professional summary of work performed"}
Rules:
- Write for the customer, not technicians
- Combine redundant entries into clear statements
- Use past tense
- No prices, internal notes, or tech names
- Be specific about what was done, not vague`;

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, notes, field_notes, time_entries, customer, location } = await req.json();

    if (!time_entries || time_entries.length === 0) {
      return new Response(JSON.stringify({ error: "No time entries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build compact user message — only include non-empty fields
    const parts: string[] = [];
    if (title) parts.push(`WO: ${title}`);
    if (customer) parts.push(`Customer: ${customer}`);
    if (location) parts.push(`Location: ${location}`);
    parts.push("Time entries:");
    time_entries.forEach((t: { description: string; hours: number }) => {
      if (t.description) parts.push(`- ${t.hours}h: ${t.description}`);
    });
    if (notes) parts.push(`Job notes: ${notes}`);
    if (field_notes) parts.push(`Field notes: ${field_notes.slice(0, 500)}`);
    parts.push("\nSummarize this service work.");

    const userMessage = parts.join("\n");

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      console.error("Claude API error:", err);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResp.json();
    const text = claudeData.content?.[0]?.text || "";

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // If Claude didn't return valid JSON, use the raw text as the summary
      result = { summary: text.replace(/[{}"]/g, "").trim() };
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("summarize-work error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
