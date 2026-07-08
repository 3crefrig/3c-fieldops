// generate-rfq-docx — Supabase Edge Function
// Renders an RFQ as a branded 3C Refrigeration .docx, uploads it to the
// `rfq-docs` Storage bucket, and writes the path back to rfqs.docx_path.
//
// Request body: { "rfq_id": "<uuid>" }
// Response:     { success, docx_path, public_url }
//
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RFQ_LOGO_URL (optional) — public URL of the rectangular letterhead logo.
//     Falls back to the existing 3C public logo if unset. The function FAILS
//     LOUDLY (502) if the logo cannot be fetched, rather than rendering a
//     blank letterhead.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  Footer,
  PageNumber,
  VerticalAlign,
} from "npm:docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Brand ─────────────────────────────────────────────────────
const CYAN = "00B7E8";
const NAVY = "1B3A5C";
const WHITE = "FFFFFF";
const GREYTEXT = "555555";
const FONT = "Times New Roman";

const DEFAULT_LOGO_URL =
  "https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";

// Default signer (used unless a per-RFQ override is supplied).
const SIGNER = {
  name: "Alex Clapp",
  title: "Owner / Operator, 3C Refrigeration LLC",
  location: "Elon, NC",
  phone: "(336) 264-0935",
  email: "aclapp@3crefrigeration.com",
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

function run(text: string, opts: Record<string, unknown> = {}) {
  return new TextRun({ text, font: FONT, ...opts });
}

// Read intrinsic PNG dimensions from the IHDR chunk (bytes 16–24, big-endian).
function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24) return null;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOGO_URL = Deno.env.get("RFQ_LOGO_URL") || DEFAULT_LOGO_URL;

    const { rfq_id } = await req.json();
    if (!rfq_id) {
      return new Response(JSON.stringify({ error: "rfq_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Load RFQ + children ──────────────────────────────────
    const { data: rfq, error: rfqErr } = await db
      .from("rfqs")
      .select("*")
      .eq("id", rfq_id)
      .single();
    if (rfqErr || !rfq) {
      return new Response(JSON.stringify({ error: "RFQ not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await db
      .from("rfq_items")
      .select("*")
      .eq("rfq_id", rfq_id)
      .order("line_no", { ascending: true });
    const { data: specs } = await db
      .from("rfq_specs")
      .select("*")
      .eq("rfq_id", rfq_id)
      .order("created_at", { ascending: true });

    const notes: string[] = Array.isArray(rfq.notes)
      ? rfq.notes.filter((n: unknown) => typeof n === "string" && n.trim())
      : [];

    // ── Logo (fail loudly if unreachable) ────────────────────
    let logoBytes: Uint8Array;
    try {
      const logoResp = await fetch(LOGO_URL);
      if (!logoResp.ok) throw new Error("HTTP " + logoResp.status);
      logoBytes = new Uint8Array(await logoResp.arrayBuffer());
      if (logoBytes.length === 0) throw new Error("empty logo");
    } catch (e) {
      return new Response(
        JSON.stringify({
          error:
            "RFQ letterhead logo could not be loaded from " + LOGO_URL +
            " (" + String(e) + "). Upload the logo to that path / set RFQ_LOGO_URL before generating RFQs.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const size = pngSize(logoBytes);
    const logoW = 200; // px — letterhead width
    const logoH = size ? Math.round(logoW * (size.h / size.w)) : 40;

    // ── Letterhead: logo (left) / company block (right) ──────
    const letterhead = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      columnWidths: [5000, 5000],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoBytes,
                      transformation: { width: logoW, height: logoH },
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [run("3C Refrigeration LLC", { bold: true, color: NAVY, size: 22 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [run("Elon, NC · (336) 264-0935", { color: GREYTEXT, size: 18 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [run("service@3crefrigeration.com", { color: GREYTEXT, size: 18 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [run("www.3crefrigeration.com", { color: GREYTEXT, size: 18 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Cyan rule under the letterhead
    const cyanRule = new Paragraph({
      spacing: { before: 60, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: CYAN } },
      children: [run("")],
    });

    // ── Title band: navy "REQUEST FOR QUOTATION" + cyan ref ──
    const titleBand = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      columnWidths: [6600, 3400],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: NAVY },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 200, right: 120 },
              children: [
                new Paragraph({
                  children: [run("REQUEST FOR QUOTATION", { bold: true, color: WHITE, size: 30 })],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: CYAN },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 120, right: 200 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [run(rfq.rfq_ref || "", { bold: true, color: NAVY, size: 24 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // ── Info block (To / Account / Date / Prepared By) ───────
    const infoCell = (label: string, value: string) =>
      new TableCell({
        borders: NO_BORDERS,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [
          new Paragraph({ children: [run(label.toUpperCase(), { bold: true, color: CYAN, size: 16 })] }),
          new Paragraph({ children: [run(value || "—", { color: NAVY, size: 22 })] }),
        ],
      });
    const fmtDate = (d: string | null) => {
      if (!d) return "—";
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (!m) return d;
      return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
    };
    const infoBlock = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      columnWidths: [5000, 5000],
      rows: [
        new TableRow({
          children: [
            infoCell("To", rfq.to_vendor + (rfq.vendor_email ? "  <" + rfq.vendor_email + ">" : "")),
            infoCell("Account", rfq.account),
          ],
        }),
        new TableRow({
          children: [
            infoCell("Date", fmtDate(rfq.rfq_date)),
            infoCell("Prepared By", rfq.prepared_by || SIGNER.name),
          ],
        }),
      ],
    });

    // ── Intro paragraph ──────────────────────────────────────
    const introText =
      (rfq.intro_text && rfq.intro_text.trim()) ||
      "Please provide your best pricing and availability for the items listed below. An equivalent may be accepted where an exact replacement is unavailable — please note any substitutions.";
    const intro = new Paragraph({
      spacing: { before: 200, after: 160 },
      children: [run(introText, { size: 22, color: "222222" })],
    });

    // ── Requested Items table ────────────────────────────────
    const headerCell = (text: string, align: AlignmentType = AlignmentType.LEFT) =>
      new TableCell({
        shading: { fill: NAVY },
        margins: { top: 70, bottom: 70, left: 90, right: 90 },
        children: [new Paragraph({ alignment: align, children: [run(text, { bold: true, color: WHITE, size: 18 })] })],
      });
    const bodyCell = (text: string, align: AlignmentType = AlignmentType.LEFT) =>
      new TableCell({
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({ alignment: align, children: [run(text, { size: 20, color: "222222" })] })],
      });

    const itemRows = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("Item"),
          headerCell("Qty", AlignmentType.CENTER),
          headerCell("Part No."),
          headerCell("Description"),
          headerCell("Unit Price", AlignmentType.RIGHT),
        ],
      }),
      ...(items || []).map((it: any, i: number) =>
        new TableRow({
          children: [
            bodyCell(it.item || String(i + 1)),
            bodyCell(it.qty != null ? String(it.qty) : "", AlignmentType.CENTER),
            bodyCell(it.part_no || ""),
            bodyCell(it.description || ""),
            // Unit Price stays blank on the request — the vendor fills it in.
            bodyCell(it.unit_price != null ? "$" + Number(it.unit_price).toFixed(2) : "", AlignmentType.RIGHT),
          ],
        })
      ),
    ];
    const cyanBorder = { style: BorderStyle.SINGLE, size: 4, color: CYAN };
    const itemsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2600, 900, 1800, 3200, 1500],
      borders: {
        top: cyanBorder, bottom: cyanBorder, left: cyanBorder, right: cyanBorder,
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCDCE6" },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCDCE6" },
      },
      rows: itemRows,
    });

    // ── Optional Specifications table ────────────────────────
    const specBlocks: (Paragraph | Table)[] = [];
    if (specs && specs.length > 0) {
      specBlocks.push(
        new Paragraph({
          spacing: { before: 260, after: 100 },
          children: [run("Specifications", { bold: true, color: NAVY, size: 24 })],
        })
      );
      specBlocks.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3600, 6400],
          borders: {
            top: cyanBorder, bottom: cyanBorder, left: cyanBorder, right: cyanBorder,
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCDCE6" },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCDCE6" },
          },
          rows: specs.map((s: any) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: "EEF6FA" },
                  margins: { top: 60, bottom: 60, left: 90, right: 90 },
                  children: [new Paragraph({ children: [run(s.label || "", { bold: true, color: NAVY, size: 20 })] })],
                }),
                bodyCell(s.value || ""),
              ],
            })
          ),
        })
      );
    }

    // ── Notes (cyan bullets) ─────────────────────────────────
    const noteBlocks: Paragraph[] = [];
    if (notes.length > 0) {
      noteBlocks.push(
        new Paragraph({
          spacing: { before: 260, after: 80 },
          children: [run("Notes", { bold: true, color: NAVY, size: 24 })],
        })
      );
      for (const n of notes) {
        noteBlocks.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 220, hanging: 220 },
            children: [run("● ", { color: CYAN, size: 20 }), run(n, { size: 22, color: "222222" })],
          })
        );
      }
    }

    // ── Closing + signature ──────────────────────────────────
    const closing = new Paragraph({
      spacing: { before: 300, after: 200 },
      children: [
        run(
          "Thank you for your time and prompt attention to this request. Please direct your quotation and any questions to the contact below.",
          { size: 22, color: "222222" }
        ),
      ],
    });
    const sig = [
      new Paragraph({ children: [run("Respectfully,", { size: 22, color: "222222" })] }),
      new Paragraph({ spacing: { before: 160 }, children: [run(SIGNER.name, { bold: true, color: NAVY, size: 24 })] }),
      new Paragraph({ children: [run(SIGNER.title, { size: 20, color: GREYTEXT })] }),
      new Paragraph({
        children: [run(SIGNER.location + " · " + SIGNER.phone + " · " + SIGNER.email, { size: 20, color: GREYTEXT })],
      }),
    ];

    // ── Footer ───────────────────────────────────────────────
    const footer = new Footer({
      children: [
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: CYAN } },
          alignment: AlignmentType.CENTER,
          spacing: { before: 80 },
          children: [
            run("3C Refrigeration LLC  ·  service@3crefrigeration.com  ·  (336) 264-0935     Page ", {
              size: 16, color: GREYTEXT,
            }),
            new TextRun({ font: FONT, size: 16, color: GREYTEXT, children: [PageNumber.CURRENT] }),
          ],
        }),
      ],
    });

    const doc = new Document({
      styles: { default: { document: { run: { font: FONT, size: 22 } } } },
      sections: [
        {
          properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
          footers: { default: footer },
          children: [
            letterhead,
            cyanRule,
            titleBand,
            new Paragraph({ spacing: { after: 80 }, children: [run("")] }),
            infoBlock,
            intro,
            itemsTable,
            ...specBlocks,
            ...noteBlocks,
            closing,
            ...sig,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const bytes = new Uint8Array(buffer);

    // ── Upload to Storage + record path ──────────────────────
    const slug = String(rfq.rfq_ref || rfq.id).replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${rfq.id}/${slug}.docx`;
    const { error: upErr } = await db.storage.from("rfq-docs").upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Storage upload failed: " + upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: pathErr } = await db.from("rfqs").update({ docx_path: path }).eq("id", rfq.id);
    if (pathErr) console.error("docx_path update failed:", pathErr.message);

    const public_url = `${SUPABASE_URL}/storage/v1/object/public/rfq-docs/${path}`;
    return new Response(
      JSON.stringify({ success: true, docx_path: path, public_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-rfq-docx error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
