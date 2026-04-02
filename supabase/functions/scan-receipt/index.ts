// scan-receipt — Supabase Edge Function
// Accepts a base64 image of a vendor receipt/invoice,
// uses Claude Vision to extract structured data,
// and optionally matches to an existing PO.
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
    const { imageBase64, mimeType, woId } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Call Claude Vision to extract receipt/invoice data
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Extract the following from this vendor receipt or invoice image. Return ONLY valid JSON, no markdown:
{
  "vendor_name": "store or company name",
  "date": "YYYY-MM-DD format",
  "total_amount": number (the total/grand total),
  "tax_amount": number or null,
  "subtotal": number or null,
  "line_items": [{"description": "item name", "quantity": number, "amount": number}],
  "payment_method": "cash/card/check/other or null",
  "receipt_number": "receipt or invoice number or null",
  "po_number": "any PO or reference number found, or null"
}
If a field cannot be determined, use null. For amounts, use numbers not strings.`,
              },
            ],
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
    let extracted;
    try {
      // Handle potential markdown code blocks
      const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse receipt data", raw: text }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to match to an existing PO
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let matchedPO = null;

    // First try matching by PO number if found on receipt
    if (extracted.po_number) {
      const { data: poMatch } = await sb
        .from("purchase_orders")
        .select("*")
        .ilike("po_id", `%${extracted.po_number}%`)
        .limit(1);
      if (poMatch && poMatch.length > 0) matchedPO = poMatch[0];
    }

    // If no PO match and we have a WO context, try matching by amount
    if (!matchedPO && woId) {
      const { data: woPOs } = await sb
        .from("purchase_orders")
        .select("*")
        .eq("wo_id", woId)
        .eq("status", "approved");
      if (woPOs) {
        // Find PO with closest amount match
        const amt = extracted.total_amount || extracted.subtotal;
        if (amt) {
          const closest = woPOs.reduce((best: any, po: any) => {
            const diff = Math.abs(parseFloat(po.amount) - amt);
            const bestDiff = best ? Math.abs(parseFloat(best.amount) - amt) : Infinity;
            return diff < bestDiff ? po : best;
          }, null);
          if (closest && Math.abs(parseFloat(closest.amount) - amt) < amt * 0.2) {
            matchedPO = closest; // Within 20% of PO amount
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted,
        matchedPO: matchedPO ? { id: matchedPO.id, po_id: matchedPO.po_id, amount: matchedPO.amount, description: matchedPO.description } : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("scan-receipt error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
