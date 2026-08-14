import React, { useState, useEffect, useMemo, useCallback } from "react";
import { sb, B, F, M, IS, LS, BP, BS, fmtDate } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, EmptyState } from "./ui";

// ─── Price Book ──────────────────────────────────────────────
// Every price ever observed for a part, and who charged it. Fed
// automatically by the ticket/bill scan triggers; reference prices are
// typed in so "what would this cost elsewhere" works before we've bought
// anywhere else.
//
// Loads its own data instead of riding on App's loadData — the catalog is
// manager-only and would otherwise add three queries and a few hundred KB
// to every app boot for every user.

const SOURCE_LABEL = { purchase: "Paid", quote: "Quoted", reference: "Reference", manual: "Manual" };
const SOURCE_COLOR = () => ({ purchase: B.cyan, quote: B.orange, reference: B.green, manual: B.textDim });
const money = (n) => n == null || n === "" ? "—" : "$" + Number(n).toFixed(2);
const pct = (n) => n == null ? null : Number(n);

function AddPriceForm({ part, vendors, onSaved, onClose }) {
  const [vendorId, setVendorId] = useState("");
  const [price, setPrice] = useState("");
  const [source, setSource] = useState("reference");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    const p = parseFloat(price);
    if (!(p > 0)) { setErr("Enter a price greater than zero."); return; }
    if (!vendorId) { setErr("Pick a vendor."); return; }
    setSaving(true); setErr("");
    const { error } = await sb().from("part_prices").insert({
      part_id: part.part_id, vendor_id: vendorId, unit_price: p,
      source, source_ref: ref.trim() || null, observed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };
  return (
    <Modal title={"Add a price — " + part.part_no} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: B.textDim, background: B.bg, padding: "8px 12px", borderRadius: 6, border: "1px solid " + B.border }}>
          Use <b>Reference</b> for a price you looked up but haven't bought at — that's what makes the comparison column work.
        </div>
        <div><label style={LS}>Vendor</label>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={{ ...IS, cursor: "pointer" }}>
            <option value="">— pick a vendor —</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.role === "reference" ? " (not yet used)" : ""}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div><label style={LS}>Unit price ($)</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{ ...IS, fontFamily: M }} /></div>
          <div><label style={LS}>Type</label>
            <select value={source} onChange={e => setSource(e.target.value)} style={{ ...IS, cursor: "pointer" }}>
              <option value="reference">Reference (looked up)</option>
              <option value="quote">Quote (vendor gave it)</option>
              <option value="purchase">Purchase (we paid it)</option>
            </select></div>
        </div>
        <div><label style={LS}>Where it came from <span style={{ color: B.textDim, fontWeight: 400, fontSize: 9 }}>optional</span></label>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="quote #, website, counter call…" style={IS} /></div>
        {err && <div style={{ fontSize: 12, color: B.red }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...BS, flex: 1 }}>Cancel</button>
          <button onClick={go} disabled={saving} style={{ ...BP, flex: 1, opacity: saving ? .6 : 1 }}>{saving ? "Saving…" : "Save price"}</button>
        </div>
      </div>
    </Modal>
  );
}

function PartDetail({ part, vendors, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    const { data } = await sb().from("part_prices")
      .select("id,unit_price,qty,source,source_ref,observed_at,vendor_id")
      .eq("part_id", part.part_id).order("observed_at", { ascending: false });
    setRows(data || []);
  }, [part.part_id]);
  useEffect(() => { load(); }, [load]);
  const vname = (id) => (vendors.find(v => v.id === id) || {}).name || "—";
  const SC = SOURCE_COLOR();

  return (
    <Modal title={part.part_no} onClose={onClose} wide>
      <div style={{ fontSize: 13, color: B.textMuted, marginBottom: 14 }}>{part.description || "No description"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Avg paid" value={money(part.avg_paid)} icon="💵" color={B.cyan} />
        <StatCard label="Range" value={money(part.min_price) + " – " + money(part.max_price)} icon="↕" color={pct(part.own_spread_pct) > 25 ? B.orange : B.textDim} />
        <StatCard label="Buys" value={part.buys || 0} icon="🧾" color={B.textDim} />
        {part.best_alternative != null && <StatCard label="Best elsewhere" value={money(part.best_alternative)} icon="🔍" color={B.green} />}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={LS}>Every price on record</span>
        <button onClick={() => setAdding(true)} style={{ ...BP, padding: "7px 14px", fontSize: 12, minHeight: 34 }}>+ Add a price</button>
      </div>

      {rows === null ? <Spinner /> : rows.length === 0 ? <div style={{ color: B.textDim, fontSize: 13, padding: 16 }}>No prices recorded yet.</div> : (
        <div style={{ border: "1px solid " + B.border, borderRadius: 8, overflow: "hidden" }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 12px", background: i % 2 ? B.bg : "transparent", borderBottom: i < rows.length - 1 ? "1px solid " + B.border + "60" : "none" }}>
              <span style={{ fontFamily: M, fontWeight: 700, fontSize: 14, minWidth: 74 }}>{money(r.unit_price)}</span>
              <Badge color={SC[r.source] || B.textDim}>{SOURCE_LABEL[r.source] || r.source}</Badge>
              <span style={{ fontSize: 12, color: B.textMuted, flex: "1 1 120px", minWidth: 0 }}>{vname(r.vendor_id)}</span>
              {r.qty != null && <span style={{ fontSize: 11, color: B.textDim, fontFamily: M }}>qty {Number(r.qty)}</span>}
              <span style={{ fontSize: 11, color: B.textDim }}>{r.observed_at ? fmtDate(String(r.observed_at).slice(0, 10)) : ""}</span>
              {r.source_ref && <span style={{ fontSize: 10, color: B.textDim, fontStyle: "italic", flexBasis: "100%" }}>{r.source_ref}</span>}
            </div>
          ))}
        </div>
      )}

      {adding && <AddPriceForm part={part} vendors={vendors} onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); if (onChanged) onChanged(); }} />}
    </Modal>
  );
}

export function PriceBook({ userRole }) {
  const isMgr = userRole === "admin" || userRole === "manager";
  const [rows, setRows] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("all");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");
  const msg = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    const [c, v] = await Promise.all([
      sb().from("part_price_compare").select("*"),
      sb().from("vendors").select("id,name,role,active").order("name"),
    ]);
    setRows(c.data || []);
    setVendors((v.data || []).filter(x => x.active !== false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let r = rows || [];
    if (view === "spread") r = r.filter(x => pct(x.own_spread_pct) >= 25 && (x.buys || 0) >= 3);
    if (view === "cheaper") r = r.filter(x => x.best_alternative != null && pct(x.pct_cheaper_elsewhere) > 0);
    if (view === "repeat") r = r.filter(x => (x.buys || 0) >= 5);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter(x => (x.part_no || "").toLowerCase().includes(s) || (x.description || "").toLowerCase().includes(s) || (x.vendor_name || "").toLowerCase().includes(s));
    }
    const key = view === "cheaper" ? "pct_cheaper_elsewhere" : "own_spread_pct";
    return [...r].sort((a, b) => (Number(b[key]) || -1) - (Number(a[key]) || -1));
  }, [rows, view, q]);

  if (!isMgr) return <EmptyState icon="🔒" title="Managers only" sub="Part cost data is restricted." />;
  if (rows === null) return <Spinner />;

  const totalPoints = rows.reduce((s, r) => s + (r.buys || 0), 0);
  const cheaper = rows.filter(r => r.best_alternative != null && pct(r.pct_cheaper_elsewhere) > 0);
  const wide = rows.filter(r => pct(r.own_spread_pct) >= 25 && (r.buys || 0) >= 3);

  return (<div>
    <Toast msg={toast} />
    <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
      <StatCard label="Parts tracked" value={rows.length} icon="📦" color={B.cyan} />
      <StatCard label="Price points" value={totalPoints} icon="🏷" color={B.textDim} />
      <StatCard label="Wide price swings" value={wide.length} icon="⚠️" color={wide.length ? B.orange : B.textDim} />
      <StatCard label="Cheaper elsewhere" value={cheaper.length} icon="🔍" color={cheaper.length ? B.green : B.textDim} />
    </div>

    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
      {[["all", "All parts"], ["spread", "Wide price swings (" + wide.length + ")"], ["cheaper", "Cheaper elsewhere (" + cheaper.length + ")"], ["repeat", "Bought 5+ times"]].map(([k, l]) =>
        <button key={k} onClick={() => setView(k)} style={{ padding: "6px 14px", borderRadius: 4, border: "1px solid " + (view === k ? B.cyan : B.border), background: view === k ? B.cyanGlow : "transparent", color: view === k ? B.cyan : B.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{l}</button>)}
    </div>

    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by part number, description or vendor…" style={{ ...IS, marginBottom: 14, padding: "8px 12px", fontSize: 12 }} />

    {view === "cheaper" && cheaper.length === 0 &&
      <div style={{ fontSize: 12, color: B.textDim, background: B.bg, border: "1px solid " + B.border, borderRadius: 8, padding: "12px 14px", marginBottom: 12, lineHeight: 1.55 }}>
        Nothing to compare yet. Open a part and add a <b>Reference</b> price — what another supply house charges — and the gap shows up here.
      </div>}

    {filtered.length === 0 ? <EmptyState icon="📦" title="No parts match" sub="Prices land here automatically when a pickup ticket or vendor bill is scanned." /> : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.slice(0, 200).map(r => {
          const spread = pct(r.own_spread_pct), saves = pct(r.pct_cheaper_elsewhere);
          return (
            <Card key={r.part_id} onClick={() => setSel(r)} className="card-hover"
              style={{ padding: "12px 14px", cursor: "pointer", borderLeft: "3px solid " + (saves > 0 ? B.green : spread >= 25 ? B.orange : B.border) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: M, fontWeight: 700, fontSize: 14 }}>{r.part_no}</span>
                    {r.vendor_name && <Badge color={B.textDim}>{r.vendor_name}</Badge>}
                    {r.stocked && <Badge color={B.cyan}>stocked</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: B.textMuted, marginTop: 3 }}>{r.description || "—"}</div>
                  <div style={{ fontSize: 11, color: B.textDim, marginTop: 3, fontFamily: M }}>
                    {r.buys} buy{r.buys === 1 ? "" : "s"} · {money(r.min_price)}–{money(r.max_price)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: M, fontWeight: 700, fontSize: 16 }}>{money(r.avg_paid)}</div>
                  <div style={{ fontSize: 10, color: B.textDim }}>avg paid</div>
                  {saves > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: B.green, marginTop: 4 }}>{saves.toFixed(0)}% less at {money(r.best_alternative)}</div>}
                  {/* A negative gap means this vendor beat the outside price —
                      worth saying out loud, or the tab reads as an indictment
                      of a supplier that is winning on half the catalog. */}
                  {saves != null && saves <= 0 && <div style={{ fontSize: 11, fontWeight: 700, color: B.cyan, marginTop: 4 }}>best price we have · {Math.abs(saves).toFixed(0)}% under {money(r.best_alternative)}</div>}
                  {saves == null && spread >= 25 && <div style={{ fontSize: 11, fontWeight: 700, color: B.orange, marginTop: 4 }}>{spread.toFixed(0)}% swing</div>}
                </div>
              </div>
            </Card>);
        })}
        {filtered.length > 200 && <div style={{ textAlign: "center", fontSize: 11, color: B.textDim, padding: 10 }}>Showing 200 of {filtered.length} — narrow it with search.</div>}
      </div>
    )}

    {sel && <PartDetail part={sel} vendors={vendors} onClose={() => setSel(null)}
      onChanged={() => { load(); msg("Price added"); }} />}
  </div>);
}
