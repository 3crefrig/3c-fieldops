// predict-parts — Supabase Edge Function
// Predicts parts likely needed for a work order based on
// description, equipment type, and customer history.
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


// ── Auth guard (2026-07-10 security hardening): service-role callers or
//    registered app users only. OPTIONS passes through to the CORS handler.
const __CORS_G={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
async function __guard(req: Request, allowUser=true): Promise<Response|null>{
  if(req.method==="OPTIONS")return null;
  const hdr=(req.headers.get("Authorization")||"").trim();
  const token=hdr.replace(/^[Bb]earer[ ]+/,"").trim();
  const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const deny=(s: number,m: string)=>new Response(JSON.stringify({error:m}),{status:s,headers:{...__CORS_G,"Content-Type":"application/json"}});
  if(!token)return deny(401,"auth required");
  if(svc&&token===svc)return null;
  let claims: any=null;
  try{const seg=(token.split(".")[1]||"").replace(/-/g,"+").replace(/_/g,"/");claims=JSON.parse(atob(seg+"=".repeat((4-seg.length%4)%4)));}catch(_x){}
  if(!claims)return deny(401,"invalid token");
  if(claims.role==="service_role")return null;
  if(!allowUser)return deny(401,"service credential required");
  if(claims.role!=="authenticated")return deny(401,"invalid token");
  const email=String(claims.email||"").toLowerCase();
  if(!email)return deny(401,"invalid token");
  try{
    const base=Deno.env.get("SUPABASE_URL")||"";
    const q=await fetch(base+"/rest/v1/users?select=role&active=not.is.false&email=ilike."+encodeURIComponent(email),{headers:{apikey:svc,Authorization:"Bearer "+svc}});
    const rows=await q.json();
    if(!Array.isArray(rows)||rows.length===0)return deny(403,"not a registered user");
    return null;
  }catch(_e){return deny(401,"auth check failed");}
}

serve(async (req) => {
  const __d=await __guard(req, true); if(__d) return __d;
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

    const { wo_title, wo_description, equipment_type, customer_name, equipment_model } = await req.json();

    if (!wo_title && !wo_description) {
      return new Response(JSON.stringify({ error: "Provide wo_title or wo_description" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather historical parts data for similar jobs
    let historicalParts: any[] = [];
    if (customer_name) {
      const { data: custWOs } = await sb.from("work_orders")
        .select("id,title,wo_type")
        .eq("customer", customer_name)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (custWOs && custWOs.length > 0) {
        const ids = custWOs.map((w: any) => w.id);
        const { data: pos } = await sb.from("purchase_orders")
          .select("description,amount")
          .in("wo_id", ids)
          .eq("status", "approved");
        historicalParts = pos || [];
      }
    }

    let context = `Work order: ${wo_title || ""}\n`;
    if (wo_description) context += `Description: ${wo_description}\n`;
    if (equipment_type) context += `Equipment type: ${equipment_type}\n`;
    if (equipment_model) context += `Equipment model: ${equipment_model}\n`;
    if (customer_name) context += `Customer: ${customer_name}\n`;

    if (historicalParts.length > 0) {
      context += `\nParts previously used at this customer:\n`;
      historicalParts.forEach((p: any) => {
        context += `  - ${p.description} ($${p.amount})\n`;
      });
    }

    context += `\nBased on the work order description, equipment type, and history, predict what parts and materials the technician will likely need for this job.`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: `You are a parts prediction assistant for 3C Refrigeration, a commercial HVAC/R service company. Given a work order description and context, predict what parts/materials the technician will likely need.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "predicted_parts": [
    {"name": "Part name", "confidence": 0.85, "estimated_cost": 45.00},
    {"name": "Another part", "confidence": 0.60, "estimated_cost": 120.00}
  ],
  "reasoning": "Brief explanation of why these parts are predicted"
}

Rules:
- Confidence 0.0-1.0: how likely this part is needed
- Only include parts with confidence >= 0.4
- Order by confidence descending
- Max 6 predicted parts
- Use real commercial refrigeration part names and realistic price estimates
- Consider the equipment type and common failure modes`,
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
    console.error("predict-parts error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
