import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Static Template Sections ────────────────────────────────
// These never change and cost zero tokens — stitched client-side.

const TEMPLATES = {
  pm: {
    pricing_and_billing: `Pricing & Billing

Labor rates shall be billed on a time-and-materials basis at the following hourly rates:

a) Licensed Technician: $135.00/hr (Standard) | $190.00/hr (Emergency)
b) Senior Technician: $120.00/hr (Standard) | $175.00/hr (Emergency)

Parts and materials shall be billed at cost plus a 30% markup to cover procurement, handling, and warranty administration.

Normal operating hours are 7:30 AM to 4:00 PM, Monday through Friday. Emergency service is available 24/7, subject to a minimum 4-hour charge at emergency rates.

Invoicing shall be conducted on a bi-weekly basis. Payment terms are Net 30 from the date of invoice. 3C Refrigeration is committed to full transparency in all billing and will provide itemized invoices detailing labor hours, parts used, and services rendered.`,

    terms_and_conditions: `Terms & Conditions

a) Disclaimer
This proposal is prepared for informational purposes and is intended to outline the scope and pricing for the services described herein. All terms are subject to negotiation and mutual agreement prior to commencement of work.

b) Proposal Validity
This proposal shall remain valid for a period of six (6) months from the date of issue. After this period, terms and pricing may be subject to review and adjustment.`,

    closing_statement: `We appreciate the opportunity to present this proposal and look forward to the possibility of partnering with you to ensure the continued reliability and performance of your refrigeration and HVAC systems. Should you have any questions or require clarification on any aspect of this proposal, please do not hesitate to contact us.

Respectfully submitted,

Alex Clapp
Owner/Operator
3C Refrigeration
(336) 264-0935
aclapp@3crefrigeration.com`,
  },

  project: {
    pricing_and_billing: `Pricing & Billing

A detailed cost breakdown is provided as an attachment to this proposal. Billing terms are as follows:

a) A deposit of 25% of the total project cost is required upon acceptance of this proposal to secure scheduling and initiate equipment procurement.
b) Progress billing shall occur at agreed-upon project milestones, with invoices reflecting work completed and materials delivered.
c) Final payment is due upon project completion, successful commissioning, and client acceptance.
d) Payment terms are Net 30 from the date of each invoice.

Note: Equipment and material pricing is subject to market fluctuation and is guaranteed for 30 days from the date of this proposal. After 30 days, pricing may be adjusted to reflect current market conditions.`,

    terms_and_conditions: `Terms & Conditions

a) Disclaimer
This proposal is prepared for informational purposes and is intended to outline the scope and pricing for the project described herein. All terms are subject to negotiation and mutual agreement prior to commencement of work.

b) Proposal Validity
This proposal shall remain valid for a period of six (6) months from the date of issue. Equipment pricing is subject to a 30-day fluctuation clause as noted in the Pricing & Billing section.`,

    closing_statement: `We appreciate the opportunity to present this proposal and look forward to the possibility of partnering with you on this project. Our team is committed to delivering work of the highest quality, on schedule, and in full compliance with all applicable standards and regulations. Should you have any questions or require clarification on any aspect of this proposal, please do not hesitate to contact us.

Respectfully submitted,

Alex Clapp
Owner/Operator
3C Refrigeration
(336) 264-0935
aclapp@3crefrigeration.com`,
  },
};

// ── Lean System Prompt ──────────────────────────────────────
// Only describes the sections AI must generate (~400 tokens vs ~1200 before)

const SYSTEM_PROMPT = `You are a proposal writer for 3C Refrigeration, a commercial HVAC/refrigeration service company serving universities, biotech, healthcare, and research facilities.

TONE: Formal, institutional, thorough. Use "shall provide", emphasize compliance, operational excellence, protecting client operations/research. NOT sales-y.

Detect from the scope whether this is:
A) PM/SERVICE PROPOSAL — ongoing maintenance
B) PROJECT/RETROFIT — one-time installation/construction

For TYPE A, return JSON:
{
  "type": "pm",
  "project_summary": "1-2 formal paragraphs about the maintenance program's purpose, what it protects, alignment with client's mission.",
  "project_objectives": "a) Preventative Maintenance — paragraph about systematic inspections, servicing. b) Corrective Maintenance — paragraph about diagnosis, repair, restoring functionality.",
  "scope_of_work": "Location + detailed sub-sections with bullet points: a) Refrigeration Systems Maintenance, b) Controls Inspection & Service, c) Components Inspection & Service, d) Reporting & Documentation, e) Emergency Response",
  "corrective_maintenance": "a) Identification & Diagnosis, b) Repair & Replacement, c) Testing & Verification, d) Emergency CM, e) Documentation"
}

For TYPE B, return JSON:
{
  "type": "project",
  "project_summary": "2-3 formal paragraphs: what will be done, why, commitment to documentation.",
  "project_objectives": "a) Primary objective (specific to the work), b) Supporting objective (reliability, compliance, cost reduction).",
  "scope_of_work": "Location + Introduction + sub-sections: a) Primary Installation/Retrofit Work, b) Components Service & Integration, c) Auxiliary Installation Tasks, d) Documentation & Compliance, e) Commissioning, f) Quality Assurance & Client Review"
}

Return ONLY valid JSON. No markdown, no explanation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      customer_name,
      project_title,
      scope_description,
      customer_type,
      location,
      scope_snippets,
      estimate_summary,
    } = await req.json();

    if (!customer_name || !scope_description) {
      return new Response(
        JSON.stringify({ error: "Customer name and scope description required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    let userPrompt = `Generate a proposal for:

Customer: ${customer_name}
${customer_type ? `Type: ${customer_type}` : ""}
${project_title ? `Project: ${project_title}` : ""}
${location ? `Location: ${location}` : ""}

Scope:
${scope_description}`;

    if (scope_snippets && scope_snippets.length > 0) {
      userPrompt += `\n\nInclude these service areas in the scope:\n${scope_snippets.join("\n")}`;
    }

    if (estimate_summary) {
      userPrompt += `\n\nEstimate: ${estimate_summary}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || "";

    let aiSections: Record<string, string>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiSections = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      aiSections = { project_summary: content, scope_of_work: "", project_objectives: "" };
    }

    // Determine type and attach static templates
    const proposalType = aiSections.type === "project" ? "project" : "pm";
    const templateSections = TEMPLATES[proposalType];

    return new Response(
      JSON.stringify({
        success: true,
        proposal_type: proposalType,
        ai_sections: aiSections,
        template_sections: templateSections,
        usage: result.usage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
