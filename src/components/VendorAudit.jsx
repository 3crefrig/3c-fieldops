import React, { useState, useMemo, useRef } from "react";
import { sb, B, F, M, IS, LS, BP, BS, fnFetch, fmtDate, cleanText } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, EmptyState, CustomSelect } from "./ui";

/*
 * Supply House Audit — 3-way match: PO ↔ pickup tickets ↔ vendor bill.
 * Techs photograph the counter ticket at pickup (OCR → structured lines on
 * the PO). When the supplier's bill arrives it is scanned and every bill
 * line must find a ticket line: no ticket = exception, qty over = exception,
 * price above the ticket/quote price (>$1 or >1%) = exception. Managers
 * review only the exceptions, with ticket photos as dispute evidence.
 */

// ── Matching engine ─────────────────────────────────────────────
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const words = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 1);
const descSim = (a, b) => { const wa = new Set(words(a)), wb = new Set(words(b)); if (!wa.size || !wb.size) return 0; let hit = 0; wa.forEach(w => { if (wb.has(w)) hit++; }); return hit / Math.max(wa.size, wb.size); };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const EXCEPTION_STATUSES = ["price_mismatch", "qty_over", "no_ticket"];
export const MS_LABELS = { matched: "Matched", price_mismatch: "Price High", qty_over: "Qty Over", qty_under: "Qty Under", no_ticket: "No Ticket", price_unverified: "No Price Ref", accepted: "Accepted" };
export const msColor = (s) => ({ matched: B.green, price_mismatch: B.orange, qty_over: B.red, qty_under: B.purple, no_ticket: B.red, price_unverified: B.textDim, accepted: B.green }[s] || B.textDim);

// Match every bill line against the pickup-ticket lines in scope.
// Returns per-line statuses + an "unbilled" info list + a summary.
export function auditBill(billLines, ticketLines) {
  // Group ticket lines by part number (fallback: each priceless-desc line its own group)
  const groups = []; const byPart = {};
  ticketLines.forEach(t => {
    const pk = norm(t.part_no);
    let g = pk ? byPart[pk] : null;
    if (!g) {
      g = { part: pk || null, desc: t.description || "", qty: 0, pricedQty: 0, priceSum: 0, lines: [], billedQty: 0 };
      if (pk) byPart[pk] = g;
      groups.push(g);
    }
    const q = num(t.qty) ?? 1;
    g.qty += q;
    const up = num(t.unit_price);
    if (up != null) { g.pricedQty += q; g.priceSum += up * q; }
    g.lines.push(t);
    if (!g.desc && t.description) g.desc = t.description;
  });
  groups.forEach(g => { g.avgPrice = g.pricedQty > 0 ? g.priceSum / g.pricedQty : null; });

  // Match each bill line to a group: exact part number first, then fuzzy description
  const findGroup = (bl) => {
    const pk = norm(bl.part_no);
    if (pk && byPart[pk]) return byPart[pk];
    let best = null, bestScore = 0;
    groups.forEach(g => {
      g.lines.forEach(tl => { const s = descSim(bl.description, tl.description); if (s > bestScore) { bestScore = s; best = g; } });
      if (!g.lines.length) { const s = descSim(bl.description, g.desc); if (s > bestScore) { bestScore = s; best = g; } }
    });
    return bestScore >= 0.45 ? best : null;
  };

  // Aggregate bill lines per matched group so multi-pickup quantities compare correctly
  const perGroup = new Map(); const orphans = [];
  billLines.forEach((bl, idx) => {
    const g = findGroup(bl);
    if (!g) { orphans.push({ bl, idx }); return; }
    if (!perGroup.has(g)) perGroup.set(g, []);
    perGroup.get(g).push({ bl, idx });
  });

  const results = billLines.map(bl => ({ ...bl }));
  const lineAmt = (bl) => num(bl.amount) ?? ((num(bl.qty) ?? 1) * (num(bl.unit_price) ?? 0));

  perGroup.forEach((entries, g) => {
    const bQty = entries.reduce((s, e) => s + (num(e.bl.qty) ?? 1), 0);
    const bAmt = entries.reduce((s, e) => s + lineAmt(e.bl), 0);
    const bPrice = bQty > 0 ? bAmt / bQty : null;
    g.billedQty += bQty;
    const tol = g.avgPrice != null ? Math.max(1, 0.01 * g.avgPrice) : 0;
    let status;
    if (bQty > g.qty + 1e-9) status = "qty_over";
    else if (g.avgPrice != null && bPrice != null && bPrice - g.avgPrice > tol) status = "price_mismatch";
    else if (bQty < g.qty - 1e-9) status = "qty_under";
    else if (g.avgPrice == null) status = "price_unverified";
    else status = "matched";
    const expectedAmt = g.avgPrice != null ? Math.min(bQty, g.qty) * g.avgPrice : Math.min(bQty, g.qty) * (bPrice ?? 0);
    const variance = EXCEPTION_STATUSES.includes(status) ? r2(bAmt - expectedAmt) : 0;
    entries.forEach((e, i) => {
      const r = results[e.idx];
      r.match_status = status;
      r.expected_price = g.avgPrice != null ? r2(g.avgPrice) : null;
      r.expected_qty = g.qty;
      r.matched_ticket_item_id = g.lines[0]?.id || null;
      r.variance = i === 0 ? variance : 0; // variance counted once per group
    });
  });
  orphans.forEach(({ bl, idx }) => {
    const r = results[idx];
    r.match_status = "no_ticket";
    r.expected_price = null; r.expected_qty = null; r.matched_ticket_item_id = null;
    r.variance = r2(lineAmt(bl));
  });

  const unbilled = groups.filter(g => g.billedQty === 0).map(g => ({ part_no: g.part ? (g.lines[0]?.part_no || g.part) : null, description: g.desc, qty: g.qty, unit_price: g.avgPrice != null ? r2(g.avgPrice) : null }));
  const exceptions = results.filter(r => EXCEPTION_STATUSES.includes(r.match_status));
  const summary = {
    bill_lines: results.length,
    ticket_lines: ticketLines.length,
    exceptions: exceptions.length,
    variance: r2(exceptions.reduce((s, r) => s + Math.max(0, num(r.variance) || 0), 0)),
    unbilled: unbilled.length,
  };
  return { results, unbilled, summary };
}

// ── File helpers (camera photo or PDF → base64 for OCR + blob for storage) ──
const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function prepareDoc(file) {
  if (file.type === "application/pdf") {
    if (file.size > 15 * 1024 * 1024) throw new Error("PDF too large (15MB max)");
    const durl = await readDataUrl(file);
    return { blob: file, base64: durl.split(",")[1], mime: "application/pdf", ext: "pdf" };
  }
  const durl = await readDataUrl(file);
  if (file.size <= 600 * 1024) return { blob: file, base64: durl.split(",")[1], mime: file.type || "image/jpeg", ext: "jpg" };
  // Compress large photos (keeps OCR sharp at 1600px, shrinks upload + tokens)
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = durl; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpegUrl = canvas.toDataURL("image/jpeg", 0.85);
  const blob = await (await fetch(jpegUrl)).blob();
  return { blob, base64: jpegUrl.split(",")[1], mime: "image/jpeg", ext: "jpg" };
}
async function uploadVendorDoc(doc, folder) {
  const path = folder + "/" + Date.now() + "_scan." + doc.ext;
  const { error } = await sb().storage.from("vendor-docs").upload(path, doc.blob, { contentType: doc.mime, upsert: false });
  if (error) throw error;
  const { data } = sb().storage.from("vendor-docs").getPublicUrl(path);
  return data?.publicUrl || null;
}
async function ocrDoc(doc, documentType) {
  const resp = await fnFetch("scan-document", { image: doc.base64, mimeType: doc.mime, documentType });
  const r = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(r.error || ("Scan failed (" + resp.status + ")"));
  return r.extracted || r; // function returns {success, documentType, extracted}
}

// ── Shared line-item editor grid ────────────────────────────────
const cellIS = { padding: "7px 8px", fontSize: 12, borderRadius: 6 };
function LineGrid({ lines, setLines, statusChips }) {
  const upd = (i, k, v) => setLines(lines.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const del = (i) => setLines(lines.filter((_, j) => j !== i));
  return (<div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "4px 0" }}>
    <div style={{ minWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: statusChips ? "96px 110px 1fr 56px 76px 80px 26px" : "110px 1fr 56px 76px 80px 26px", gap: 6, padding: "0 2px", marginBottom: 4 }}>
        {statusChips && <span style={LS}>Status</span>}<span style={LS}>Part #</span><span style={LS}>Description</span><span style={LS}>Qty</span><span style={LS}>Price</span><span style={LS}>Amount</span><span />
      </div>
      {lines.map((l, i) => (<div key={i} style={{ display: "grid", gridTemplateColumns: statusChips ? "96px 110px 1fr 56px 76px 80px 26px" : "110px 1fr 56px 76px 80px 26px", gap: 6, marginBottom: 6, alignItems: "center" }}>
        {statusChips && <span style={{ fontSize: 9, fontWeight: 800, color: msColor(l.match_status), textTransform: "uppercase", letterSpacing: 0.3 }}>{MS_LABELS[l.match_status] || "—"}</span>}
        <input value={l.part_no || ""} onChange={e => upd(i, "part_no", e.target.value)} placeholder="—" style={{ ...IS, ...cellIS, fontFamily: M }} />
        <input value={l.description || ""} onChange={e => upd(i, "description", e.target.value)} placeholder="Item" style={{ ...IS, ...cellIS }} />
        <input value={l.qty ?? ""} onChange={e => upd(i, "qty", e.target.value)} type="number" step="any" style={{ ...IS, ...cellIS, fontFamily: M }} />
        <input value={l.unit_price ?? ""} onChange={e => upd(i, "unit_price", e.target.value)} type="number" step="0.01" placeholder="—" style={{ ...IS, ...cellIS, fontFamily: M }} />
        <input value={l.amount ?? ""} onChange={e => upd(i, "amount", e.target.value)} type="number" step="0.01" style={{ ...IS, ...cellIS, fontFamily: M }} />
        <button onClick={() => del(i)} title="Remove line" style={{ background: "none", border: "none", color: B.red, cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
      </div>))}
      <button onClick={() => setLines([...lines, { part_no: "", description: "", qty: 1, unit_price: "", amount: "" }])} style={{ ...BS, padding: "6px 12px", fontSize: 11, minHeight: 30 }}>+ Add Line</button>
    </div>
  </div>);
}

function ScanButton({ onFile, busy, label }) {
  const ref = useRef(null);
  return (<>
    <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    <button onClick={() => ref.current?.click()} disabled={busy} type="button" style={{ ...BP, width: "100%", padding: "12px 14px", fontSize: 13, opacity: busy ? .6 : 1 }}>{busy ? "AI is reading the document…" : label}</button>
  </>);
}

const poLabel = (po) => po.po_id + " · $" + (parseFloat(po.amount) || 0).toFixed(0);
const poOptions = (pos) => [{ value: "", label: "No PO (stock / misc pickup)" }, ...pos.map(p => ({ value: p.id, label: poLabel(p), sub: [(p.description || "").slice(0, 50), p.notes].filter(Boolean).join(" · ") }))];

// ── Pickup ticket capture ───────────────────────────────────────
export function TicketCaptureModal({ po, pos, onClose, onSaved, userName, userId }) {
  const [selPO, setSelPO] = useState(po?.id || "");
  const [vendor, setVendor] = useState(po?.notes || "");
  const [ticketNo, setTicketNo] = useState("");
  const [tDate, setTDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([]);
  const [tax, setTax] = useState(""); const [total, setTotal] = useState("");
  const [doc, setDoc] = useState(null);
  const [scanning, setScanning] = useState(false); const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState(false); const [err, setErr] = useState("");

  const onFile = async (file) => {
    setScanning(true); setErr("");
    try {
      const d = await prepareDoc(file); setDoc(d);
      const x = await ocrDoc(d, "pickup_ticket");
      if (x.vendor_name) setVendor(x.vendor_name);
      if (x.ticket_number) setTicketNo(String(x.ticket_number));
      if (x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date)) setTDate(x.date);
      if (Array.isArray(x.line_items) && x.line_items.length) setLines(x.line_items.map(li => ({ part_no: li.part_no || "", description: li.description || "", qty: li.quantity ?? 1, unit_price: li.unit_price ?? "", amount: li.amount ?? "" })));
      if (x.tax != null) setTax(String(x.tax));
      if (x.total != null) setTotal(String(x.total));
      setScanned(true);
    } catch (e) { console.error("Ticket scan error:", e); setErr("Could not read the ticket — you can still enter lines manually. (" + (e.message || e) + ")"); }
    finally { setScanning(false); }
  };

  const save = async () => {
    if (saving) return;
    if (!vendor.trim() && lines.length === 0) { setErr("Add a vendor or at least one line."); return; }
    if (cleanText(vendor, "Vendor") === null) return;
    setSaving(true); setErr("");
    try {
      let imageUrl = null;
      if (doc) { try { imageUrl = await uploadVendorDoc(doc, "tickets"); } catch (e) { console.warn("Ticket image upload failed:", e); } }
      const sub = lines.reduce((s, l) => s + (num(l.amount) ?? ((num(l.qty) ?? 1) * (num(l.unit_price) ?? 0))), 0);
      const { data: inserted, error } = await sb().from("po_tickets").insert({
        po_id: selPO || null, vendor_name: vendor.trim() || null, ticket_number: ticketNo.trim() || null,
        ticket_date: tDate || null, image_url: imageUrl, subtotal: r2(sub) || null,
        tax: num(tax), total: num(total) ?? (r2(sub + (num(tax) || 0)) || null),
        created_by: userId || null, created_by_name: userName || null,
      }).select("id").single();
      if (error) throw error;
      if (lines.length) {
        const rows = lines.map((l, i) => ({ ticket_id: inserted.id, line_no: i + 1, part_no: l.part_no || null, description: l.description || null, qty: num(l.qty), unit_price: num(l.unit_price), amount: num(l.amount) ?? r2((num(l.qty) ?? 1) * (num(l.unit_price) ?? 0)) }));
        const { error: e2 } = await sb().from("po_ticket_items").insert(rows);
        if (e2) throw e2;
      }
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      console.error("Ticket save error:", e);
      setErr(String(e.message || e).includes("duplicate") ? "This ticket looks like it was already captured (same vendor + ticket #)." : "Save failed: " + (e.message || e));
    } finally { setSaving(false); }
  };

  return (<Modal title={"Pickup Ticket" + (po ? " — " + po.po_id : "")} onClose={onClose} wide>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, color: B.textDim, background: B.bg, padding: "8px 12px", borderRadius: 6, border: "1px solid " + B.border }}>📸 Snap the counter ticket <b>before leaving the supply house</b>. It becomes the proof of what was actually picked up when the bill is audited.</div>
      <ScanButton onFile={onFile} busy={scanning} label="📷 Scan Counter Ticket (photo or PDF)" />
      {err && <div style={{ fontSize: 11, color: B.red, background: B.red + "12", padding: "8px 12px", borderRadius: 6 }}>{err}</div>}
      {!po && pos && <div><label style={LS}>Purchase Order</label><CustomSelect value={selPO} onChange={setSelPO} options={poOptions(pos)} placeholder="— Link to a PO —" /></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div><label style={LS}>Supply House</label><input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. United Refrigeration" style={IS} /></div>
        <div><label style={LS}>Ticket #</label><input value={ticketNo} onChange={e => setTicketNo(e.target.value)} placeholder="—" style={{ ...IS, fontFamily: M }} /></div>
        <div><label style={LS}>Date</label><input value={tDate} onChange={e => setTDate(e.target.value)} type="date" style={IS} /></div>
      </div>
      {(scanned || lines.length > 0) && <div>
        <label style={LS}>Items Picked Up {scanned && <span style={{ color: B.cyan, fontWeight: 400, textTransform: "none" }}>— check against the paper ticket</span>}</label>
        <LineGrid lines={lines} setLines={setLines} />
      </div>}
      {!scanned && lines.length === 0 && <button onClick={() => setLines([{ part_no: "", description: "", qty: 1, unit_price: "", amount: "" }])} style={{ ...BS, fontSize: 12 }}>✏️ Enter lines manually instead</button>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={LS}>Tax ($)</label><input value={tax} onChange={e => setTax(e.target.value)} type="number" step="0.01" placeholder="—" style={{ ...IS, fontFamily: M }} /></div>
        <div><label style={LS}>Ticket Total ($)</label><input value={total} onChange={e => setTotal(e.target.value)} type="number" step="0.01" placeholder="auto" style={{ ...IS, fontFamily: M }} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ ...BS, flex: 1 }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...BP, flex: 1, opacity: saving ? .6 : 1 }}>{saving ? "Saving…" : "Save Ticket"}</button>
      </div>
    </div>
  </Modal>);
}

// ── Vendor bill scan + audit ────────────────────────────────────
function BillAuditModal({ pos, tickets, ticketItems, A, onClose, onSaved, userName, userId }) {
  const [vendor, setVendor] = useState(""); const [billNo, setBillNo] = useState("");
  const [bDate, setBDate] = useState(""); const [total, setTotal] = useState(""); const [tax, setTax] = useState("");
  const [lines, setLines] = useState([]);
  const [selPO, setSelPO] = useState("");
  const [doc, setDoc] = useState(null);
  const [scanning, setScanning] = useState(false); const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState(false); const [err, setErr] = useState("");
  const [showUnbilled, setShowUnbilled] = useState(false);

  // Ticket scope: the selected PO's tickets, else all tickets from the same vendor
  const scopeTickets = useMemo(() => {
    if (selPO) return tickets.filter(t => t.po_id === selPO);
    const v = norm(vendor);
    if (!v) return [];
    return tickets.filter(t => { const tv = norm(t.vendor_name); return tv && (tv.includes(v) || v.includes(tv)); });
  }, [selPO, vendor, tickets]);
  const scopeLines = useMemo(() => { const ids = new Set(scopeTickets.map(t => t.id)); return ticketItems.filter(i => ids.has(i.ticket_id)); }, [scopeTickets, ticketItems]);
  const audit = useMemo(() => lines.length ? auditBill(lines, scopeLines) : null, [lines, scopeLines]);
  const auditedLines = audit ? audit.results : lines;

  const onFile = async (file) => {
    setScanning(true); setErr("");
    try {
      const d = await prepareDoc(file); setDoc(d);
      const x = await ocrDoc(d, "vendor_invoice");
      if (x.vendor_name) setVendor(x.vendor_name);
      if (x.invoice_number) setBillNo(String(x.invoice_number));
      if (x.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(x.invoice_date)) setBDate(x.invoice_date);
      if (x.total != null) setTotal(String(x.total));
      if (x.tax != null) setTax(String(x.tax));
      if (Array.isArray(x.line_items) && x.line_items.length) setLines(x.line_items.map(li => ({ part_no: li.part_no || "", description: li.description || "", qty: li.quantity ?? 1, unit_price: li.unit_price ?? "", amount: li.amount ?? "" })));
      // Auto-link the PO the supplier printed on the bill
      if (x.po_number) { const hit = pos.find(p => norm(p.po_id) === norm(x.po_number)); if (hit) setSelPO(hit.id); }
      setScanned(true);
    } catch (e) { console.error("Bill scan error:", e); setErr("Could not read the bill — you can still enter lines manually. (" + (e.message || e) + ")"); }
    finally { setScanning(false); }
  };

  const save = async () => {
    if (saving || !audit) return;
    if (cleanText(vendor, "Vendor") === null) return;
    setSaving(true); setErr("");
    try {
      let imageUrl = null;
      if (doc) { try { imageUrl = await uploadVendorDoc(doc, "bills"); } catch (e) { console.warn("Bill upload failed:", e); } }
      const bill = {
        po_id: selPO || null, vendor_name: vendor.trim() || null, bill_number: billNo.trim() || null,
        bill_date: bDate || null, image_url: imageUrl, tax: num(tax), total: num(total),
        subtotal: num(total) != null && num(tax) != null ? r2(num(total) - num(tax)) : null,
        status: audit.summary.exceptions > 0 ? "review" : "clean",
        audit_json: { ...audit.summary, unbilled_items: audit.unbilled },
        created_by: userId || null, created_by_name: userName || null,
      };
      const items = audit.results.map((l, i) => ({
        line_no: i + 1, part_no: l.part_no || null, description: l.description || null,
        qty: num(l.qty), unit_price: num(l.unit_price), amount: num(l.amount) ?? r2((num(l.qty) ?? 1) * (num(l.unit_price) ?? 0)),
        match_status: l.match_status || null, matched_ticket_item_id: l.matched_ticket_item_id || null,
        expected_price: l.expected_price, expected_qty: l.expected_qty, variance: l.variance || 0,
      }));
      await A.addVendorBill({ bill, items });
      if (onSaved) onSaved(audit.summary);
      onClose();
    } catch (e) {
      console.error("Bill save error:", e);
      setErr(String(e.message || e).includes("duplicate") ? "This bill was already entered (same vendor + bill #) — possible duplicate billing!" : "Save failed: " + (e.message || e));
      setSaving(false);
    }
  };

  return (<Modal title="Audit a Vendor Bill" onClose={onClose} wide>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ScanButton onFile={onFile} busy={scanning} label="📄 Scan Vendor Bill (photo or PDF)" />
      {err && <div style={{ fontSize: 11, color: B.red, background: B.red + "12", padding: "8px 12px", borderRadius: 6 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div><label style={LS}>Vendor</label><input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Supply house" style={IS} /></div>
        <div><label style={LS}>Bill / Invoice #</label><input value={billNo} onChange={e => setBillNo(e.target.value)} style={{ ...IS, fontFamily: M }} /></div>
        <div><label style={LS}>Bill Date</label><input value={bDate} onChange={e => setBDate(e.target.value)} type="date" style={IS} /></div>
      </div>
      <div><label style={LS}>Purchase Order (audit scope)</label><CustomSelect value={selPO} onChange={setSelPO} options={poOptions(pos)} placeholder="— Match against a PO's tickets —" />
        <div style={{ fontSize: 10, color: B.textDim, marginTop: 4 }}>{selPO ? scopeTickets.length + " ticket(s) on this PO in scope" : vendor ? scopeTickets.length + " ticket(s) from this vendor in scope" : "Pick a PO, or the vendor name will select the tickets to match against."}</div>
      </div>
      {(scanned || lines.length > 0) && <>
        {audit && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: audit.summary.exceptions > 0 ? B.orangeGlow : B.greenGlow, border: "1px solid " + (audit.summary.exceptions > 0 ? B.orange : B.green) + "40" }}>
          <span style={{ fontSize: 18 }}>{audit.summary.exceptions > 0 ? "⚠️" : "✅"}</span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: audit.summary.exceptions > 0 ? B.orange : B.green }}>{audit.summary.exceptions > 0 ? audit.summary.exceptions + " exception(s) — $" + audit.summary.variance.toFixed(2) + " over" : "All " + audit.summary.bill_lines + " lines match the tickets"}</div>
            <div style={{ fontSize: 10, color: B.textDim }}>{audit.summary.bill_lines} bill lines vs {audit.summary.ticket_lines} ticket lines{audit.summary.unbilled > 0 ? " · " + audit.summary.unbilled + " picked-up item(s) not on this bill" : ""}</div>
          </div>
        </div>}
        <div>
          <label style={LS}>Bill Lines <span style={{ color: B.textDim, fontWeight: 400, textTransform: "none" }}>— edit any OCR mistakes; the audit re-runs live</span></label>
          <LineGrid lines={auditedLines} setLines={setLines} statusChips={!!audit} />
        </div>
        {audit && audit.unbilled.length > 0 && <div>
          <button onClick={() => setShowUnbilled(!showUnbilled)} style={{ ...BS, padding: "6px 12px", fontSize: 11, minHeight: 30 }}>{showUnbilled ? "▾" : "▸"} Picked up but not on this bill ({audit.unbilled.length})</button>
          {showUnbilled && <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>{audit.unbilled.map((u, i) => <div key={i} style={{ fontSize: 11, color: B.textMuted, padding: "6px 10px", background: B.bg, borderRadius: 6, border: "1px solid " + B.border }}><span style={{ fontFamily: M, color: B.cyan }}>{u.part_no || "—"}</span> {u.description} · qty {u.qty}{u.unit_price != null ? " @ $" + u.unit_price.toFixed(2) : ""} <span style={{ color: B.textDim }}>(likely a future bill — or capture the missing ticket)</span></div>)}</div>}
        </div>}
      </>}
      {!scanned && lines.length === 0 && <button onClick={() => setLines([{ part_no: "", description: "", qty: 1, unit_price: "", amount: "" }])} style={{ ...BS, fontSize: 12 }}>✏️ Enter bill lines manually instead</button>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={LS}>Tax ($)</label><input value={tax} onChange={e => setTax(e.target.value)} type="number" step="0.01" placeholder="—" style={{ ...IS, fontFamily: M }} /></div>
        <div><label style={LS}>Bill Total ($)</label><input value={total} onChange={e => setTotal(e.target.value)} type="number" step="0.01" style={{ ...IS, fontFamily: M }} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ ...BS, flex: 1 }}>Cancel</button>
        <button onClick={save} disabled={saving || !audit} style={{ ...BP, flex: 1, opacity: (saving || !audit) ? .6 : 1 }}>{saving ? "Saving…" : "Save Audit"}</button>
      </div>
    </div>
  </Modal>);
}

// ── Saved bill review / exception resolution ────────────────────
function BillDetailModal({ bill, items, pos, A, onClose, msg }) {
  const po = pos.find(p => p.id === bill.po_id);
  const [busy, setBusy] = useState(false);
  const openExc = items.filter(i => EXCEPTION_STATUSES.includes(i.match_status));
  const accept = async (item) => {
    const note = window.prompt("Accept this flagged line? Add a note (e.g. 'verified with counter — restock fee ok'):", "");
    if (note === null) return;
    setBusy(true);
    try { await A.updateVendorBillItem({ id: item.id, match_status: "accepted", resolution: note || "accepted" }); msg("Line accepted"); } finally { setBusy(false); }
  };
  const setStatus = async (status) => { setBusy(true); try { await A.updateVendorBill({ id: bill.id, status }); msg("Bill marked " + status); } finally { setBusy(false); } };
  const del = async () => { if (!window.confirm("Delete this bill audit? The ticket captures stay.")) return; setBusy(true); try { await A.deleteVendorBill(bill.id); onClose(); } finally { setBusy(false); } };
  const s = bill.audit_json || {};
  return (<Modal title={(bill.vendor_name || "Vendor") + (bill.bill_number ? " · #" + bill.bill_number : "")} onClose={onClose} wide>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge color={bill.status === "clean" || bill.status === "resolved" ? B.green : bill.status === "disputed" ? B.red : B.orange}>{bill.status}</Badge>
        {po && <span style={{ fontFamily: M, fontSize: 12, color: B.cyan, fontWeight: 700 }}>{po.po_id}</span>}
        {bill.bill_date && <span style={{ fontSize: 11, color: B.textDim }}>{fmtDate(bill.bill_date)}</span>}
        {bill.total != null && <span style={{ fontFamily: M, fontSize: 13, fontWeight: 800, color: B.text }}>${parseFloat(bill.total).toFixed(2)}</span>}
        {bill.image_url && <a href={bill.image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: B.cyan, marginLeft: "auto" }}>📎 View bill</a>}
      </div>
      {openExc.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: B.orange, background: B.orangeGlow, padding: "8px 12px", borderRadius: 6 }}>⚠️ {openExc.length} open exception(s) — ${openExc.reduce((sm, i) => sm + Math.max(0, parseFloat(i.variance) || 0), 0).toFixed(2)} potentially overbilled. Dispute windows are usually 21–30 days.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {items.map(it => (<div key={it.id} style={{ padding: "8px 12px", background: B.bg, borderRadius: 8, border: "1px solid " + B.border, borderLeft: "3px solid " + msColor(it.match_status) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: msColor(it.match_status), textTransform: "uppercase", letterSpacing: 0.4, minWidth: 68 }}>{MS_LABELS[it.match_status] || "—"}</span>
            {it.part_no && <span style={{ fontFamily: M, fontSize: 11, color: B.cyan }}>{it.part_no}</span>}
            <span style={{ fontSize: 12, color: B.text, flex: 1, minWidth: 120 }}>{it.description}</span>
            <span style={{ fontFamily: M, fontSize: 11, color: B.textMuted }}>{(it.qty ?? 1) + " × $" + (parseFloat(it.unit_price) || 0).toFixed(2)}</span>
            <span style={{ fontFamily: M, fontSize: 12, fontWeight: 700, color: B.text }}>${(parseFloat(it.amount) || 0).toFixed(2)}</span>
            {EXCEPTION_STATUSES.includes(it.match_status) && <button onClick={() => accept(it)} disabled={busy} style={{ ...BS, padding: "4px 10px", fontSize: 10, minHeight: 26 }}>Accept</button>}
          </div>
          {EXCEPTION_STATUSES.includes(it.match_status) && <div style={{ fontSize: 10, color: B.orange, marginTop: 3 }}>
            {it.match_status === "no_ticket" && "No pickup ticket has this item — verify it was actually received."}
            {it.match_status === "price_mismatch" && it.expected_price != null && "Ticket price $" + parseFloat(it.expected_price).toFixed(2) + " → billed $" + (parseFloat(it.unit_price) || 0).toFixed(2) + (it.variance ? " (+$" + parseFloat(it.variance).toFixed(2) + ")" : "")}
            {it.match_status === "qty_over" && it.expected_qty != null && "Picked up " + it.expected_qty + ", billed " + (it.qty ?? "?") + (it.variance ? " (+$" + parseFloat(it.variance).toFixed(2) + ")" : "")}
          </div>}
          {it.resolution && <div style={{ fontSize: 10, color: B.textDim, marginTop: 3, fontStyle: "italic" }}>✓ {it.resolution}</div>}
        </div>))}
      </div>
      {s.unbilled_items?.length > 0 && <div style={{ fontSize: 10, color: B.textDim }}>ℹ️ {s.unbilled_items.length} picked-up item(s) were not on this bill (expected on a later invoice).</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={del} disabled={busy} style={{ ...BS, color: B.red, borderColor: B.red + "40", fontSize: 12 }}>Delete</button>
        <div style={{ flex: 1 }} />
        {bill.status !== "disputed" && openExc.length > 0 && <button onClick={() => setStatus("disputed")} disabled={busy} style={{ ...BP, background: B.red, fontSize: 12 }}>Mark Disputed</button>}
        {bill.status !== "resolved" && <button onClick={() => setStatus("resolved")} disabled={busy} style={{ ...BP, background: B.green, fontSize: 12 }}>Mark Resolved</button>}
        <button onClick={onClose} style={{ ...BS, fontSize: 12 }}>Close</button>
      </div>
    </div>
  </Modal>);
}

// ── Dashboard (Supply Audit tab) ────────────────────────────────
export function AuditDashboard({ D, A, userRole, userName, userId }) {
  const tickets = D.poTickets || [], tItems = D.poTicketItems || [], bills = D.vendorBills || [], bItems = D.vendorBillItems || [], pos = D.pos || [];
  const [view, setView] = useState("bills");
  const [filter, setFilter] = useState("open");
  const [showBillModal, setShowBillModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState("");
  const msg = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const openBillIds = new Set(bills.filter(b => b.status === "review" || b.status === "disputed").map(b => b.id));
  const openExc = bItems.filter(i => EXCEPTION_STATUSES.includes(i.match_status) && openBillIds.has(i.bill_id));
  const flagged = openExc.reduce((s, i) => s + Math.max(0, parseFloat(i.variance) || 0), 0);
  const fltBills = bills.filter(b => filter === "all" ? true : filter === "open" ? (b.status === "review" || b.status === "disputed") : b.status === filter);
  const detailBill = detail ? bills.find(b => b.id === detail) : null;

  return (<div><Toast msg={toast} />
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <StatCard label="Bills to Review" value={bills.filter(b => b.status === "review" || b.status === "disputed").length} icon="📄" color={B.orange} />
      <StatCard label="Open Exceptions" value={openExc.length} icon="⚠️" color={B.red} />
      <StatCard label="$ Flagged" value={"$" + flagged.toFixed(0)} icon="💰" color={B.purple} />
      <StatCard label="Tickets Captured" value={tickets.length} icon="🧾" color={B.cyan} />
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <button onClick={() => setShowBillModal(true)} style={{ ...BP, padding: "10px 16px", fontSize: 12 }}>📄 Audit a Vendor Bill</button>
      <button onClick={() => setShowTicketModal(true)} style={{ ...BS, padding: "10px 16px", fontSize: 12 }}>📷 Add Pickup Ticket</button>
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {[["bills", "Bills (" + bills.length + ")"], ["tickets", "Pickup Tickets (" + tickets.length + ")"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid " + (view === k ? B.cyan : B.border), background: view === k ? B.cyanGlow : "transparent", color: view === k ? B.cyan : B.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{l}</button>)}
      {view === "bills" && <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>{[["open", "Open"], ["clean", "Clean"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid " + (filter === k ? B.cyan : B.border), background: filter === k ? B.cyanGlow : "transparent", color: filter === k ? B.cyan : B.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{l}</button>)}</div>}
    </div>

    {view === "bills" && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {fltBills.length === 0 && <EmptyState icon="🧾" title={bills.length === 0 ? "No bills audited yet" : "Nothing here"} subtitle={bills.length === 0 ? "Techs snap pickup tickets as they leave the counter; when the supplier's bill arrives, scan it here and every line gets checked automatically. ~27% of supplier invoices contain errors." : "Try another filter."} />}
      {fltBills.map(b => { const items = bItems.filter(i => i.bill_id === b.id); const exc = items.filter(i => EXCEPTION_STATUSES.includes(i.match_status)); const v = exc.reduce((s, i) => s + Math.max(0, parseFloat(i.variance) || 0), 0); const po = pos.find(p => p.id === b.po_id); return (
        <Card key={b.id} onClick={() => setDetail(b.id)} style={{ padding: "14px 16px", borderLeft: "3px solid " + (b.status === "clean" || b.status === "resolved" ? B.green : b.status === "disputed" ? B.red : B.orange) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: B.text }}>{b.vendor_name || "Vendor"}</span>
                {b.bill_number && <span style={{ fontFamily: M, fontSize: 11, color: B.textDim }}>#{b.bill_number}</span>}
                <Badge color={b.status === "clean" || b.status === "resolved" ? B.green : b.status === "disputed" ? B.red : B.orange}>{b.status}</Badge>
                {po && <span style={{ fontFamily: M, fontSize: 11, color: B.cyan }}>{po.po_id}</span>}
              </div>
              <div style={{ fontSize: 11, color: B.textDim, marginTop: 4 }}>
                {b.bill_date ? fmtDate(b.bill_date) + " · " : ""}{items.length} lines
                {exc.length > 0 ? <span style={{ color: B.orange, fontWeight: 700 }}> · {exc.length} exception(s){v > 0 ? " · $" + v.toFixed(2) + " over" : ""}</span> : b.status === "clean" || exc.length === 0 ? <span style={{ color: B.green }}> · all matched ✓</span> : null}
              </div>
            </div>
            {b.total != null && <span style={{ fontFamily: M, fontSize: 15, fontWeight: 800, color: B.text }}>${parseFloat(b.total).toFixed(2)}</span>}
          </div>
        </Card>); })}
    </div>}

    {view === "tickets" && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tickets.length === 0 && <EmptyState icon="📷" title="No pickup tickets yet" subtitle="Snap the counter ticket every time parts leave the supply house — from here, from a PO, or from the PO modal on a work order. They become the proof the bill gets audited against." />}
      {tickets.map(t => { const items = tItems.filter(i => i.ticket_id === t.id); const po = pos.find(p => p.id === t.po_id); return (
        <Card key={t.id} style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{t.vendor_name || "Vendor"}</span>
                {t.ticket_number && <span style={{ fontFamily: M, fontSize: 11, color: B.textDim }}>#{t.ticket_number}</span>}
                {po && <span style={{ fontFamily: M, fontSize: 11, color: B.cyan }}>{po.po_id}</span>}
              </div>
              <div style={{ fontSize: 11, color: B.textDim, marginTop: 3 }}>{t.ticket_date ? fmtDate(t.ticket_date) + " · " : ""}{items.length} lines{t.total != null ? " · $" + parseFloat(t.total).toFixed(2) : ""}{t.created_by_name ? " · by " + t.created_by_name : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {t.image_url && <a href={t.image_url} target="_blank" rel="noreferrer" style={{ ...BS, padding: "6px 10px", fontSize: 11, minHeight: 30, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>📎 View</a>}
              {(userRole === "admin" || userRole === "manager") && <button onClick={async () => { if (window.confirm("Delete this ticket capture?")) { await A.deletePOTicket(t.id); msg("Ticket deleted"); } }} style={{ ...BS, padding: "6px 10px", fontSize: 11, minHeight: 30, color: B.red, borderColor: B.red + "40" }}>✕</button>}
            </div>
          </div>
        </Card>); })}
    </div>}

    {showBillModal && <BillAuditModal pos={pos} tickets={tickets} ticketItems={tItems} A={A} userName={userName} userId={userId} onClose={() => setShowBillModal(false)} onSaved={(s) => msg(s.exceptions > 0 ? s.exceptions + " exception(s) flagged — $" + s.variance.toFixed(2) : "Bill is clean — all lines matched")} />}
    {showTicketModal && <TicketCaptureModal pos={pos} userName={userName} userId={userId} onClose={() => setShowTicketModal(false)} onSaved={() => { msg("Pickup ticket saved"); if (A.reloadTable) { A.reloadTable("po_tickets"); A.reloadTable("po_ticket_items"); } }} />}
    {detailBill && <BillDetailModal bill={detailBill} items={bItems.filter(i => i.bill_id === detailBill.id)} pos={pos} A={A} msg={msg} onClose={() => setDetail(null)} />}
  </div>);
}
