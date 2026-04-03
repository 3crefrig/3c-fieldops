// scan-document — Supabase Edge Function
// Accepts a base64 image of a physical document (work order, vendor invoice,
// or purchase receipt) and uses Claude Vision to extract structured data.
//
// Secrets required:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_DOCUMENT_TYPES = [
  "work_order",
  "vendor_invoice",
  "purchase_receipt",
] as const;

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Document-type-specific prompts
// ---------------------------------------------------------------------------

function buildPrompt(documentType: DocumentType): string {
  const shared = `You are an OCR assistant for 3C Refrigeration, a commercial refrigeration company that services universities, biotech companies, and other commercial facilities. Extract data from the scanned document image below.\n\nRules:\n- Return ONLY valid JSON. No markdown fences, no commentary.\n- For every extracted field include a sibling key "<field>_confidence" with a number 0-1 indicating your confidence.\n- If a field is unreadable or missing, set it to null with confidence 0.\n- For dates use YYYY-MM-DD format when possible.\n- For currency amounts use numbers, not strings.\n- Handle handwritten, printed, and email-printout formats.\n`;

  switch (documentType) {
    case "work_order":
      return `${shared}
Extract the following fields from this work order document:
{
  "customer_name": "company or institution name",
  "customer_name_confidence": 0.0,
  "customer_wo": "the customer's own WO or reference number (not 3C's)",
  "customer_wo_confidence": 0.0,
  "title": "short description / title of the work",
  "title_confidence": 0.0,
  "description": "full description of work requested",
  "description_confidence": 0.0,
  "location": "building address or campus name",
  "location_confidence": 0.0,
  "building": "specific building name",
  "building_confidence": 0.0,
  "room": "room number or area",
  "room_confidence": 0.0,
  "priority": "high | medium | low",
  "priority_confidence": 0.0,
  "assignee": "technician name if specified",
  "assignee_confidence": 0.0,
  "due_date": "YYYY-MM-DD",
  "due_date_confidence": 0.0,
  "notes": "any additional notes or special instructions",
  "notes_confidence": 0.0,
  "contact_name": "on-site contact person",
  "contact_name_confidence": 0.0,
  "contact_phone": "contact phone number",
  "contact_phone_confidence": 0.0,
  "contact_email": "contact email address",
  "contact_email_confidence": 0.0,
  "equipment_type": "type of equipment (walk-in cooler, freezer, etc.)",
  "equipment_type_confidence": 0.0,
  "work_type": "PM or CM (preventive maintenance or corrective maintenance)",
  "work_type_confidence": 0.0
}`;

    case "vendor_invoice":
      return `${shared}
Extract the following fields from this vendor invoice:
{
  "vendor_name": "vendor / supplier company name",
  "vendor_name_confidence": 0.0,
  "invoice_number": "invoice number",
  "invoice_number_confidence": 0.0,
  "invoice_date": "YYYY-MM-DD",
  "invoice_date_confidence": 0.0,
  "due_date": "YYYY-MM-DD",
  "due_date_confidence": 0.0,
  "line_items": [
    {
      "description": "item or service description",
      "quantity": 0,
      "unit_price": 0.00,
      "amount": 0.00
    }
  ],
  "line_items_confidence": 0.0,
  "subtotal": 0.00,
  "subtotal_confidence": 0.0,
  "tax": 0.00,
  "tax_confidence": 0.0,
  "total": 0.00,
  "total_confidence": 0.0,
  "payment_terms": "Net 30, Due on receipt, etc.",
  "payment_terms_confidence": 0.0,
  "po_number": "referenced PO number if any",
  "po_number_confidence": 0.0,
  "ship_to_address": "shipping / delivery address",
  "ship_to_address_confidence": 0.0
}`;

    case "purchase_receipt":
      return `${shared}
Extract the following fields from this purchase receipt:
{
  "vendor_name": "store or vendor name",
  "vendor_name_confidence": 0.0,
  "date": "YYYY-MM-DD",
  "date_confidence": 0.0,
  "receipt_number": "receipt or transaction number",
  "receipt_number_confidence": 0.0,
  "line_items": [
    {
      "description": "item name",
      "quantity": 0,
      "amount": 0.00
    }
  ],
  "line_items_confidence": 0.0,
  "subtotal": 0.00,
  "subtotal_confidence": 0.0,
  "tax": 0.00,
  "tax_confidence": 0.0,
  "total": 0.00,
  "total_confidence": 0.0,
  "payment_method": "cash | card | check | other",
  "payment_method_confidence": 0.0,
  "po_number": "any PO or reference number visible",
  "po_number_confidence": 0.0
}`;
  }
}

// ---------------------------------------------------------------------------
// Helper: consistent error response
// ---------------------------------------------------------------------------

function errorResponse(message: string, status: number, details?: string) {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth -----------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    )!;

    // Use service role for DB queries (auth provided by Supabase API gateway)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Parse & validate body -----------------------------------------
    const body = await req.json();
    const { image, mimeType, documentType } = body as {
      image?: string;
      mimeType?: string;
      documentType?: string;
    };

    if (!image) {
      return errorResponse("No image provided", 400);
    }

    if (
      !documentType ||
      !VALID_DOCUMENT_TYPES.includes(documentType as DocumentType)
    ) {
      return errorResponse(
        `Invalid documentType. Must be one of: ${VALID_DOCUMENT_TYPES.join(", ")}`,
        400
      );
    }

    const mediaType = mimeType || "image/jpeg";
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validMimeTypes.includes(mediaType)) {
      return errorResponse(
        `Unsupported mimeType. Must be one of: ${validMimeTypes.join(", ")}`,
        400
      );
    }

    // --- Call Claude Vision --------------------------------------------
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    const prompt = buildPrompt(documentType as DocumentType);

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: image,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      console.error("Claude API error:", err);
      return errorResponse("Claude API error", 500, err);
    }

    const claudeData = await claudeResp.json();
    const rawText = claudeData.content?.[0]?.text || "";

    // --- Parse structured JSON from response ---------------------------
    let extracted: Record<string, unknown>;
    try {
      const jsonStr = rawText
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Failed to parse extracted data",
          raw: rawText,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Return result -------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        documentType,
        extracted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("scan-document error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
