import React, { useState, useEffect, useMemo, useRef } from "react";
import { B, F, M, IS } from "../shared";

/*
 * Shared list filter — search + status chips + contextual facets.
 *
 * The problem it solves: the TMS queue holds 112 work orders and had no way
 * to narrow to one customer. A plain dropdown would work, but a dropdown
 * hides the distribution — you can't see that 99 of the 112 are School of
 * Medicine until you've picked it.
 *
 * So facets are chips derived FROM THE CURRENT RESULT SET, each carrying its
 * count, ranked by size. One tap to narrow, and the shape of the backlog is
 * visible without tapping at all. Facets that would show only one option, or
 * that apply to a list short enough to just read, don't render.
 *
 * Filter state persists per list (localStorage) so coming back to a tab
 * doesn't mean re-picking.
 */

const KEY = (k) => "fieldops-filter-" + k;

export function useListFilter(storageKey, items, config) {
  const { searchFields = [], facets = [] } = config || {};
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY(storageKey)) || "{}"); } catch (e) { return {}; }
  });
  const { q = "", ...picked } = state;
  const set = (next) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      Object.keys(merged).forEach((k) => { if (!merged[k]) delete merged[k]; });
      try { localStorage.setItem(KEY(storageKey), JSON.stringify(merged)); } catch (e) {}
      return merged;
    });
  };

  const val = (item, f) => {
    const v = typeof f.get === "function" ? f.get(item) : item[f.key];
    return v == null || v === "" ? null : String(v);
  };

  // Text search first, then each facet in turn.
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items || [];
    return (items || []).filter((it) =>
      searchFields.some((f) => {
        const v = typeof f === "function" ? f(it) : it[f];
        return v != null && String(v).toLowerCase().includes(s);
      }));
  }, [items, q, searchFields]);

  const result = useMemo(() => {
    let r = searched;
    facets.forEach((f) => { const sel = picked[f.key]; if (sel) r = r.filter((it) => val(it, f) === sel); });
    return r;
  }, [searched, facets, JSON.stringify(picked)]);

  // Counts come from the set filtered by every OTHER facet, so a facet's own
  // options don't vanish the moment you pick one.
  const facetData = useMemo(() => facets.map((f) => {
    let base = searched;
    facets.forEach((o) => { if (o.key !== f.key && picked[o.key]) base = base.filter((it) => val(it, o) === picked[o.key]); });
    const counts = {};
    base.forEach((it) => { const v = val(it, f); if (v) counts[v] = (counts[v] || 0) + 1; });
    const options = Object.entries(counts).map(([v, n]) => ({ v, n })).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v));
    return { ...f, options, selected: picked[f.key] || "" };
  }), [searched, facets, JSON.stringify(picked)]);

  const activeCount = (q.trim() ? 1 : 0) + Object.keys(picked).filter((k) => picked[k]).length;
  return {
    q, setQ: (v) => set({ q: v }),
    picked, pick: (k, v) => set({ [k]: picked[k] === v ? "" : v }),
    clear: () => { try { localStorage.removeItem(KEY(storageKey)); } catch (e) {} setState({}); },
    result, facetData, activeCount, total: (items || []).length,
  };
}

const chipStyle = (on, accent) => ({
  padding: "5px 11px", borderRadius: 14, cursor: "pointer", fontFamily: F,
  border: "1px solid " + (on ? (accent || B.cyan) : B.border),
  background: on ? (accent || B.cyan) + "1F" : "transparent",
  color: on ? (accent || B.cyan) : B.textDim,
  fontSize: 11, fontWeight: on ? 700 : 500, whiteSpace: "nowrap",
  display: "inline-flex", alignItems: "center", gap: 5, transition: "all .12s",
});

export function ListFilterBar({ filter, placeholder, showing, minToFacet = 8 }) {
  const { q, setQ, facetData, pick, clear, activeCount, result, total } = filter;
  const [draft, setDraft] = useState(q);
  const t = useRef(null);
  useEffect(() => { setDraft(q); }, [q]);
  useEffect(() => {
    if (draft === q) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => setQ(draft), 180);
    return () => clearTimeout(t.current);
  }, [draft]);

  // Only offer a facet when it can actually cut the list down.
  const useful = facetData.filter((f) => f.options.length > 1 && (result.length >= minToFacet || f.selected));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ position: "relative", marginBottom: useful.length ? 8 : 0 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder || "Search…"}
          style={{ ...IS, padding: "8px 30px 8px 12px", fontSize: 12 }} />
        {draft && <button onClick={() => setDraft("")} aria-label="Clear search"
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: B.textDim, fontSize: 15, cursor: "pointer", lineHeight: 1, padding: 2 }}>×</button>}
      </div>

      {useful.map((f) => (
        <div key={f.key} style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 9.5, color: B.textDim, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase", marginRight: 2 }}>{f.label}</span>
          {f.options.slice(0, f.selected ? 99 : 6).map((o) => (
            <button key={o.v} onClick={() => pick(f.key, o.v)} title={o.v}
              style={chipStyle(f.selected === o.v, f.accent)}>
              <span style={{ maxWidth: 168, overflow: "hidden", textOverflow: "ellipsis" }}>{f.short ? f.short(o.v) : o.v}</span>
              <span style={{ fontFamily: M, fontSize: 10, opacity: .75 }}>{o.n}</span>
            </button>
          ))}
          {!f.selected && f.options.length > 6 &&
            <span style={{ fontSize: 10, color: B.textDim }}>+{f.options.length - 6} more — search to narrow</span>}
        </div>
      ))}

      {activeCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: B.textMuted, fontFamily: M }}>
            {showing ? showing(result.length, total) : result.length + " of " + total}
          </span>
          <button onClick={clear} style={{ background: "none", border: "none", color: B.cyan, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: F }}>Clear filters</button>
        </div>
      )}
    </div>
  );
}
