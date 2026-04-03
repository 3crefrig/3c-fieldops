// ai-troubleshoot — Supabase Edge Function
// Accepts symptom text, optional image, and equipment context.
// Uses Claude to provide commercial refrigeration diagnostic suggestions.
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

const SYSTEM_PROMPT = `You are a commercial refrigeration diagnostic assistant for 3C Refrigeration, a company specializing in HVAC/R service for university campuses and biotech/pharmaceutical facilities.

Your expertise covers:
- Walk-in coolers and freezers
- Reach-in refrigerators and freezers
- Blast chillers and shock freezers
- Ice machines (Hoshizaki, Manitowoc, Scotsman, etc.)
- Environmental/stability chambers (for pharma/biotech)
- Condenser units and rack systems
- Refrigerant systems (R-404A, R-134a, R-410A, R-290, etc.)

When analyzing symptoms:
1. Cross-reference against common commercial refrigeration failure patterns
2. Consider the equipment type and typical failure modes
3. If an image is provided, look for visible issues: frost patterns, ice buildup, leaks, corrosion, burnt components, error codes on digital displays, unusual condensation, oil stains near fittings
4. Factor in any work order history for recurring issues at the location

Always respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "diagnosis": "Most likely issue in one clear sentence",
  "confidence": 0.0 to 1.0,
  "possible_causes": ["cause 1", "cause 2", "cause 3"],
  "recommended_actions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "parts_likely_needed": ["part name 1", "part name 2"],
  "urgency": "low|medium|high|critical",
  "safety_warnings": ["warning 1 if any"]
}

Urgency levels:
- critical: Food safety risk, refrigerant leak, electrical hazard — needs immediate attention
- high: Equipment down or at risk of failure within 24 hours
- medium: Degraded performance, should be addressed within a few days
- low: Minor issue, can be scheduled for next maintenance visit

If you cannot determine a diagnosis from the information provided, set confidence to 0.2 or lower and ask for more details in the diagnosis field.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the JWT token is valid
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user exists in our users table
    const { data: appUser } = await sb.from("users").select("role").eq("email", user.email).single();
    if (!appUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { symptoms, image, mimeType, equipment_type, customer, wo_history } = await req.json();

    if (!symptoms && !image) {
      return new Response(JSON.stringify({ error: "Provide symptoms text or an image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Build the user message content
    const userContent: any[] = [];

    // Add image first if provided
    if (image) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType || "image/jpeg",
          data: image,
        },
      });
    }

    // Build the text prompt with all context
    let textPrompt = "";
    if (equipment_type) textPrompt += `Equipment type: ${equipment_type}\n`;
    if (customer) textPrompt += `Customer/Location: ${customer}\n`;
    if (wo_history && wo_history.length > 0) {
      textPrompt += `Recent work order history at this location:\n`;
      wo_history.forEach((title: string) => {
        textPrompt += `  - ${title}\n`;
      });
    }
    if (symptoms) textPrompt += `\nReported symptoms: ${symptoms}\n`;
    if (image && !symptoms) textPrompt += `\nAnalyze the attached image for visible equipment issues.\n`;
    if (image && symptoms) textPrompt += `\nAlso analyze the attached image for visible issues that correlate with these symptoms.\n`;

    textPrompt += `\nProvide your diagnostic analysis as JSON.`;

    userContent.push({ type: "text", text: textPrompt });

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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      console.error("Claude API error:", err);
      return new Response(JSON.stringify({ error: "Claude API error", details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResp.json();
    const text = claudeData.content?.[0]?.text || "";

    // Parse JSON from Claude's response
    let result;
    try {
      const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      result = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse diagnostic data", raw: text }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("ai-troubleshoot error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
