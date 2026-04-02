import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await createClient(supabaseUrl, token).auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { customer_name, project_title, scope_description, customer_type, location, past_examples, estimate_summary } = await req.json();

    if (!customer_name || !scope_description) {
      return new Response(JSON.stringify({ error: "Customer name and scope description required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const systemPrompt = `You are a professional proposal writer for 3C Refrigeration, a commercial HVAC and refrigeration service company. You write formal B2B "Statement of Work" style proposals for large institutional clients like universities, biotech companies, hospitals, and research facilities.

WRITING STYLE:
- Formal, professional, institutional tone — NOT sales-y
- Thorough and technically detailed
- Each section uses numbered/lettered sub-sections with bullet points
- Language emphasizes reliability, compliance, operational excellence, and protecting client's operations/research
- Use phrases like "shall provide", "ensure optimal performance", "full compliance with relevant safety and performance standards"

PROPOSAL TYPES — Detect from the scope description whether this is:
A) PREVENTATIVE MAINTENANCE / SERVICE PROPOSAL — ongoing maintenance contracts
B) PROJECT / RETROFIT PROPOSAL — one-time construction, installation, or retrofit work

For TYPE A (PM/Service), return JSON with these keys:
{
  "project_summary": "1-2 formal paragraphs describing the maintenance program's purpose, what it protects (research materials, operations), and alignment with client's mission. Reference the specific building/location.",
  "project_objectives": "Two sub-sections: a) Implement Preventative Maintenance Program — detailed paragraph about systematic inspections, cleaning, servicing of components. b) Execute Corrective Maintenance Services — paragraph about prompt diagnosis, repair, restoring functionality.",
  "scope_of_work": "Location list + detailed bullet-point sub-sections: a) Refrigeration Systems Maintenance (inspections, coil cleaning, refrigerant testing, lubrication, performance tests, compliance), b) Controls Inspection & Service (temperature/humidity/pressure controls, alarm systems, control panels, wiring), c) Components Inspection & Service (doors, seals, hinges, heaters, latches, corrosion checks), d) Reporting & Documentation (comprehensive reports, records, recommendations), e) Emergency Response (critical issue response, on-call support, operating hours 7:30AM-4:00PM)",
  "corrective_maintenance": "Detailed section: a) Identification & Diagnosis, b) Repair & Replacement of Defective Components (sourcing equivalent/superior parts), c) Testing & Verification (post-repair performance validation), d) Emergency Corrective Maintenance (off-hours, emergency rates, 4-hour minimum), e) Documentation & Reporting",
  "pricing_and_billing": "Present labor tiers with hourly + emergency rates. Parts markup %. Normal hours 7:30AM-4:00PM. Time & materials billing, bi-weekly invoicing, Net 30 terms. Emphasize transparency.",
  "terms_and_conditions": "a) Disclaimer — informational purposes, subject to negotiation. b) Proposal Validity — 6 months, subject to review after expiry.",
  "closing_statement": "Formal gratitude statement thanking the client for the opportunity."
}

For TYPE B (Project/Retrofit), return JSON with these keys:
{
  "project_summary": "2-3 formal paragraphs: what will be done (retrofit/install/construct), why (improve reliability, support research, replace outdated equipment), and commitment to documentation and validation.",
  "project_objectives": "Two objectives as detailed paragraphs: a) Primary objective (retrofit/modernize/install — specific to the work), b) Supporting objective (enhance reliability, compliance, reduce maintenance costs, safeguard research).",
  "scope_of_work": "Location + Introduction paragraph + detailed sub-sections with bullet points: a) Primary Installation/Retrofit Work (remove old, install new, pressure test, commissioning), b) Components Service & Integration (doors, seals, dehumidifiers, component verification), c) Auxiliary Installation Tasks (ductwork, stands, condensate lines, supporting infrastructure), d) Documentation & Compliance (detailed records, compliance docs, recommendations), e) Commissioning (final tests, startup coordination with other contractors), f) Quality Assurance & Client Review (walkthrough, adjustments, sign-off)",
  "pricing_and_billing": "For projects: reference that a detailed pricing breakdown table accompanies the proposal. Include billing terms: 25% deposit required, progress billing at milestones, final payment upon completion and acceptance, Net 30 terms. Note equipment pricing subject to change within 30 days.",
  "terms_and_conditions": "a) Disclaimer — informational purposes, subject to negotiation. b) Proposal Validity — 6 months, equipment pricing subject to 30-day fluctuation.",
  "closing_statement": "Formal gratitude statement thanking the client for the opportunity."
}

COMPANY INFO:
- 3C Refrigeration — commercial refrigeration and HVAC services
- Owner/Operator: Alex Clapp
- Phone: (336) 264-0935 | Email: aclapp@3crefrigeration.com
- Licensed and insured commercial refrigeration contractors
- Serve universities, biotech, healthcare, food service, and research facilities
- Specialize in preventive maintenance, emergency repairs, and system installations
- Standard rates: Licensed Technician $135/hr (Emergency: $190/hr), Senior Technician $120/hr (Emergency: $175/hr)
- Parts markup: 30% standard (varies by customer agreement)
- Normal hours: 7:30 AM - 4:00 PM, emergency minimum 4 hours
- 24/7 emergency service available
- Billing: Time & materials, bi-weekly invoicing, Net 30 payment terms`;

    let userPrompt = `Generate a professional proposal for:

Customer: ${customer_name}
${customer_type ? `Customer Type: ${customer_type}` : ""}
${project_title ? `Project: ${project_title}` : ""}
${location ? `Location: ${location}` : ""}

Scope/Description:
${scope_description}`;

    if (estimate_summary) {
      userPrompt += `\n\nEstimate Summary:\n${estimate_summary}`;
    }

    if (past_examples) {
      userPrompt += `\n\nReference the style and structure of these past proposals:\n${past_examples}`;
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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || "";

    // Try to parse JSON from the response
    let proposal;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      proposal = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      // If JSON parsing fails, return the raw text
      proposal = {
        executive_summary: content,
        scope_of_work: "",
        approach: "",
        timeline: "",
        qualifications: "",
        terms: "",
        pricing_summary: "",
      };
    }

    return new Response(
      JSON.stringify({ success: true, proposal }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
