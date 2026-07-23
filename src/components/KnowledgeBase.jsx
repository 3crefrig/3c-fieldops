import React, { useState, useEffect } from "react";
import { sb, SUPABASE_URL, B, F, M, IS, LS, BP, BS, cleanText } from "../shared";
import { Card, Badge, Modal, Toast, Spinner } from "./ui";

// --- KB photo helpers (2026-07-23) ---------------------------------------
// Photos upload straight to the public kb-files Storage bucket (same pattern
// as project Files — no Google Drive access wall) and can be shown INLINE in
// article text by typing [photo:N] where N is the photo's number. Numbering
// follows upload order (oldest = #1); the gallery shows each photo's number.

const compressImage = async (file) => {
  if (!file.type.startsWith("image/") || file.size <= 1048576) return file;
  try {
    const img = new Image(); const u = URL.createObjectURL(file);
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = u; });
    const cv = document.createElement("canvas"); const s = Math.min(1, 1400 / img.width);
    cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(u);
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (e) { return file; }
};

const kbStorageUpload = async (file) => {
  const safe = (file.name || "file").replace(/[^A-Za-z0-9._-]/g, "_");
  const path = "kb/" + Date.now() + "_" + safe;
  const { error } = await sb().storage.from("kb-files").upload(path, file, { contentType: file.type || "application/octet-stream", cacheControl: "3600" });
  if (error) throw error;
  return SUPABASE_URL + "/storage/v1/object/public/kb-files/" + path;
};

const kbStorageRemove = async (url) => {
  try { if (url && url.includes("/kb-files/")) { const p = url.split("/kb-files/")[1]; if (p) await sb().storage.from("kb-files").remove([decodeURIComponent(p)]); } } catch (e) { }
};

const PHOTO_RE = /(\[photo:?\s*\d+\])/gi;

// Render article text with [photo:N] markers replaced by the matching photo.
function RichText({ text, photos }) {
  if (!text) return null;
  const parts = String(text).split(PHOTO_RE);
  return (<div style={{ margin: "6px 0 0", color: B.text, fontSize: 13, lineHeight: 1.6 }}>
    {parts.map((p, i) => {
      const m = /^\[photo:?\s*(\d+)\]$/i.exec(p);
      if (m) {
        const ph = photos[parseInt(m[1]) - 1];
        if (!ph) return <span key={i} style={{ color: B.textDim, fontSize: 11 }}>[photo {m[1]} not found]</span>;
        return (<span key={i} style={{ display: "block", margin: "10px 0" }}>
          <a href={ph.file_url} target="_blank" rel="noreferrer"><img src={ph.file_url} alt={ph.caption || ""} style={{ width: "100%", maxWidth: 560, borderRadius: 10, border: "1px solid " + B.border, display: "block" }} /></a>
          {ph.caption && <span style={{ display: "block", fontSize: 11, color: B.textDim, marginTop: 4, maxWidth: 560 }}>{ph.caption}</span>}
        </span>);
      }
      return p ? <span key={i} style={{ whiteSpace: "pre-wrap" }}>{p}</span> : null;
    })}
  </div>);
}

function KnowledgeBase({ userName, userRole }) {
  const isMgr = userRole === "admin" || userRole === "manager";
  const [articles, setArticles] = useState([]), [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all"), [search, setSearch] = useState(""), [showCreate, setShowCreate] = useState(false), [selArticle, setSelArticle] = useState(null);
  const [title, setTitle] = useState(""), [category, setCategory] = useState("guide"), [content, setContent] = useState(""), [symptoms, setSymptoms] = useState(""), [fixSteps, setFixSteps] = useState(""), [partNum, setPartNum] = useState(""), [supplier, setSupplier] = useState(""), [tags, setTags] = useState(""), [saving, setSaving] = useState(false), [toast, setToast] = useState("");
  const [articleFiles, setArticleFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // photos/files uploaded while creating a NEW article (attached on save)
  const [captionDraft, setCaptionDraft] = useState(""); // optional caption applied to the next photo uploaded from the editor
  const msg = m => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const load = async () => { const { data } = await sb().from("kb_articles").select("*").order("created_at", { ascending: false }); setArticles(data || []); setLoading(false); };
  useEffect(() => { load(); }, []);
  const cats = { guide: "📖 Troubleshooting", manual: "📄 Manuals & Specs", tip: "💡 Tips & Tricks", parts: "🔩 Parts Reference", sop: "📋 SOPs" };
  const catColors = { guide: B.cyan, manual: B.purple, tip: B.green, parts: B.orange, sop: B.red };
  const filtered = articles.filter(a => { if (!isMgr && a.status !== "approved") return false; if (tab !== "all" && tab !== "pending" && a.category !== tab) return false; if (tab === "pending" && a.status !== "pending") return false; if (search) { const s = search.toLowerCase(); return a.title.toLowerCase().includes(s) || a.content?.toLowerCase().includes(s) || a.symptoms?.toLowerCase().includes(s) || a.tags?.some(t => t.toLowerCase().includes(s)) || (a.part_number || "").toLowerCase().includes(s); } return true; });
  const pendingCount = articles.filter(a => a.status === "pending").length;
  const resetForm = () => { setTitle(""); setCategory("guide"); setContent(""); setSymptoms(""); setFixSteps(""); setPartNum(""); setSupplier(""); setTags(""); setPendingFiles([]); };
  const openEdit = (a) => { setTitle(a.title); setCategory(a.category); setContent(a.content || ""); setSymptoms(a.symptoms || ""); setFixSteps(a.fix_steps || ""); setPartNum(a.part_number || ""); setSupplier(a.supplier || ""); setTags((a.tags || []).join(", ")); setSelArticle(a); setPendingFiles([]); loadFiles(a.id); setShowCreate(true); };
  const save = async () => {
    if (!title.trim() || saving) return; if (cleanText(title, "Title") === null || cleanText(content, "Content") === null) return; setSaving(true);
    try {
      const obj = { title: title.trim(), category, content: content.trim(), symptoms: symptoms.trim(), fix_steps: fixSteps.trim(), part_number: partNum.trim(), supplier: supplier.trim(), tags: tags.split(",").map(t => t.trim()).filter(Boolean), status: isMgr ? "approved" : "pending", author: userName };
      if (selArticle) { await sb().from("kb_articles").update({ ...obj, updated_at: new Date().toISOString() }).eq("id", selArticle.id); }
      else {
        const { data: created, error } = await sb().from("kb_articles").insert(obj).select("id").single();
        if (error) throw error;
        // Attach any photos/files uploaded while drafting.
        if (created && pendingFiles.length) { await sb().from("kb_files").insert(pendingFiles.map(f => ({ ...f, article_id: created.id, uploaded_by: userName }))); }
      }
      setSaving(false); setShowCreate(false); resetForm(); setSelArticle(null); await load(); msg(selArticle ? "Updated" : isMgr ? "Published" : "Submitted for approval");
    } catch (e) { console.error(e); setSaving(false); msg("Save failed"); }
  };
  const approve = async (id) => { await sb().from("kb_articles").update({ status: "approved", approved_by: userName, approved_at: new Date().toISOString() }).eq("id", id); await load(); msg("Approved"); };
  const reject = async (id) => { if (!window.confirm("Reject this article?")) return; await sb().from("kb_articles").delete().eq("id", id); await load(); msg("Removed"); };
  const del = async (id) => { if (!window.confirm("Delete this article?")) return; await sb().from("kb_articles").delete().eq("id", id); await load(); msg("Deleted"); };
  // Ascending order = stable photo numbering (#1 is the first photo uploaded).
  const loadFiles = async (aid) => { const { data } = await sb().from("kb_files").select("*").eq("article_id", aid).order("uploaded_at", { ascending: true }); setArticleFiles(data || []); };
  const uploadFile = async (file, articleId, isPhoto, captionText) => {
    if (!file) return; setSaving(true);
    try {
      const up = isPhoto ? await compressImage(file) : file;
      const url = await kbStorageUpload(up);
      const caption = isPhoto ? ((captionText || "").trim() || null) : null;
      const row = { file_url: url, thumbnail_url: isPhoto ? url : null, file_name: file.name, file_type: isPhoto ? "photo" : "file", caption };
      if (articleId) { await sb().from("kb_files").insert({ ...row, article_id: articleId, uploaded_by: userName }); await loadFiles(articleId); }
      else { setPendingFiles(p => [...p, row]); }
      setCaptionDraft("");
      msg((isPhoto ? "Photo" : "File") + " added" + (isPhoto ? " — type [photo:N] in the text to place it" : ""));
    } catch (e) { console.error(e); msg("Upload error"); }
    setSaving(false);
  };
  const deleteFile = async (fid, aid) => { const f = articleFiles.find(x => x.id === fid); await sb().from("kb_files").delete().eq("id", fid); if (f) await kbStorageRemove(f.file_url); await loadFiles(aid); msg("Removed"); };
  const editCaption = async (f, aid) => { const c = window.prompt("Photo caption:", f.caption || ""); if (c === null) return; await sb().from("kb_files").update({ caption: c.trim() || null }).eq("id", f.id); await loadFiles(aid); };
  const removePending = async (idx) => { const f = pendingFiles[idx]; setPendingFiles(p => p.filter((_, i) => i !== idx)); if (f) await kbStorageRemove(f.file_url); };

  // Photos available to the open editor (existing article's photos, or pending ones on a new draft)
  const editorPhotos = (selArticle ? articleFiles.filter(f => f.file_type === "photo") : pendingFiles.filter(f => f.file_type === "photo"));

  if (selArticle && !showCreate) {
    const a = articles.find(x => x.id === selArticle.id); if (!a) { setSelArticle(null); return null; }
    if (articleFiles.length === 0 || articleFiles[0]?.article_id !== a.id) loadFiles(a.id);
    const aPhotos = articleFiles.filter(f => f.file_type === "photo"); const aDocs = articleFiles.filter(f => f.file_type !== "photo");
    return (<div><Toast msg={toast} />
      <button onClick={() => { setSelArticle(null); setArticleFiles([]); }} style={{ background: "none", border: "none", color: B.cyan, fontSize: 12, cursor: "pointer", fontFamily: F, marginBottom: 10 }}>← Back</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div><Badge color={catColors[a.category]}>{cats[a.category]}</Badge><h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: B.text }}>{a.title}</h2><div style={{ fontSize: 11, color: B.textDim, marginTop: 4 }}>By {a.author} · {new Date(a.created_at).toLocaleDateString()}{a.status === "pending" && <span style={{ color: B.orange, marginLeft: 8 }}>⏳ Pending approval</span>}</div></div>
        <div style={{ display: "flex", gap: 6 }}>{isMgr && <button onClick={() => openEdit(a)} style={{ background: "none", border: "none", color: B.cyan, fontSize: 11, cursor: "pointer" }}>Edit</button>}{isMgr && <button onClick={() => { del(a.id); setSelArticle(null); }} style={{ background: "none", border: "none", color: B.red, fontSize: 11, cursor: "pointer" }}>Delete</button>}</div>
      </div>
      {a.tags && a.tags.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>{a.tags.map(t => <span key={t} style={{ padding: "2px 8px", borderRadius: 4, background: B.cyanGlow, color: B.cyan, fontSize: 10, fontWeight: 600 }}>{t}</span>)}</div>}
      {a.symptoms && <Card style={{ padding: 14, marginBottom: 12, borderLeft: "3px solid " + (a.category === "sop" ? B.red : B.orange) }}><span style={{ fontSize: 10, fontWeight: 700, color: a.category === "sop" ? B.red : B.orange, textTransform: "uppercase" }}>{a.category === "sop" ? "Scope / Purpose" : "Symptoms"}</span><RichText text={a.symptoms} photos={aPhotos} /></Card>}
      {a.fix_steps && <Card style={{ padding: 14, marginBottom: 12, borderLeft: "3px solid " + (a.category === "sop" ? B.red : B.green) }}><span style={{ fontSize: 10, fontWeight: 700, color: a.category === "sop" ? B.red : B.green, textTransform: "uppercase" }}>{a.category === "sop" ? "Procedure" : "Fix / Steps"}</span><RichText text={a.fix_steps} photos={aPhotos} /></Card>}
      {a.content && <Card style={{ padding: 14, marginBottom: 12 }}><RichText text={a.content} photos={aPhotos} /></Card>}
      {(a.part_number || a.supplier) && <Card style={{ padding: 14, marginBottom: 12, borderLeft: "3px solid " + B.purple }}><span style={{ fontSize: 10, fontWeight: 700, color: B.purple, textTransform: "uppercase" }}>Parts Info</span>{a.part_number && <div style={{ marginTop: 6, fontSize: 13, color: B.text }}>Part #: <strong style={{ fontFamily: M }}>{a.part_number}</strong></div>}{a.supplier && <div style={{ fontSize: 13, color: B.text }}>Supplier: <strong>{a.supplier}</strong></div>}</Card>}
      {aPhotos.length > 0 && <Card style={{ padding: 14, marginBottom: 12 }}><span style={{ fontSize: 10, fontWeight: 700, color: B.textDim, textTransform: "uppercase" }}>Photos</span><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginTop: 8 }}>{aPhotos.map((f, i) => <div key={f.id} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid " + B.border, position: "relative" }}><span style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, fontFamily: M }}>#{i + 1}</span><a href={f.file_url} target="_blank" rel="noreferrer"><img src={f.thumbnail_url || f.file_url} alt="" style={{ width: "100%", height: 100, objectFit: "cover" }} /></a><div style={{ padding: "4px 6px", background: B.surface }}>{f.caption && <div style={{ fontSize: 9, color: B.textMuted, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.caption}</div>}<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 9, color: B.textDim }}>{f.uploaded_by}</span><span>{isMgr && <button onClick={() => editCaption(f, a.id)} style={{ background: "none", border: "none", color: B.cyan + "AA", fontSize: 10, cursor: "pointer" }}>✎</button>}{isMgr && <button onClick={() => deleteFile(f.id, a.id)} style={{ background: "none", border: "none", color: B.red + "66", fontSize: 12, cursor: "pointer" }}>×</button>}</span></div></div></div>)}</div><div style={{ fontSize: 10, color: B.textDim, marginTop: 8 }}>Tip: edit the article and type <span style={{ fontFamily: M, color: B.cyan }}>[photo:2]</span> anywhere in the text to show photo #2 at that exact spot.</div></Card>}
      {aDocs.length > 0 && <Card style={{ padding: 14, marginBottom: 12 }}><span style={{ fontSize: 10, fontWeight: 700, color: B.textDim, textTransform: "uppercase" }}>Files & Documents</span>{aDocs.map(f => <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid " + B.border }}><span style={{ fontSize: 16 }}>📄</span><a href={f.file_url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, fontWeight: 600, color: B.cyan, textDecoration: "none" }}>{f.file_name}</a><span style={{ fontSize: 9, color: B.textDim }}>{f.uploaded_by}</span>{isMgr && <button onClick={() => deleteFile(f.id, a.id)} style={{ background: "none", border: "none", color: B.red + "66", fontSize: 12, cursor: "pointer" }}>×</button>}</div>)}</Card>}
      {a.file_url && <Card style={{ padding: 14, marginBottom: 12 }}><a href={a.file_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: B.cyan, textDecoration: "none" }}><span style={{ fontSize: 20 }}>📄</span><div><div style={{ fontSize: 13, fontWeight: 600 }}>{a.file_name || "Attached File"}</div><div style={{ fontSize: 10, color: B.textDim }}>Tap to view/download</div></div></a></Card>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...BS, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11 }}>{saving ? "Uploading..." : "📷 Add Photo"}<input type="file" accept="image/*" capture="environment" onChange={e => { uploadFile(e.target.files[0], a.id, true); e.target.value = ""; }} style={{ display: "none" }} /></label>
        <label style={{ ...BS, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11 }}>{saving ? "Uploading..." : "📎 Add File"}<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => { uploadFile(e.target.files[0], a.id, false); e.target.value = ""; }} style={{ display: "none" }} /></label>
      </div>
      {isMgr && a.status === "pending" && <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button onClick={() => approve(a.id)} style={{ ...BP, flex: 1, background: B.green }}>✓ Approve</button><button onClick={() => { reject(a.id); setSelArticle(null); }} style={{ ...BP, flex: 1, background: B.red }}>✗ Reject</button></div>}
    </div>);
  }

  return (<div><Toast msg={toast} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: B.text }}>Knowledge Base</h3>
      <button onClick={() => { resetForm(); setSelArticle(null); setArticleFiles([]); setShowCreate(true); }} style={{ ...BP, fontSize: 12 }}>+ New Article</button>
    </div>
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles, symptoms, parts..." style={{ ...IS, marginBottom: 12, padding: 12, fontSize: 14 }} />
    <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap", overflowX: "auto" }}>
      <button onClick={() => setTab("all")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid " + (tab === "all" ? B.cyan : B.border), background: tab === "all" ? B.cyanGlow : "transparent", color: tab === "all" ? B.cyan : B.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>All ({articles.filter(a => isMgr || a.status === "approved").length})</button>
      {Object.entries(cats).map(([k, v]) => <button key={k} onClick={() => setTab(k)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid " + (tab === k ? catColors[k] : B.border), background: tab === k ? catColors[k] + "22" : "transparent", color: tab === k ? catColors[k] : B.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>{v}</button>)}
      {isMgr && pendingCount > 0 && <button onClick={() => setTab("pending")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid " + B.orange, background: tab === "pending" ? B.orange + "22" : "transparent", color: B.orange, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{"⏳ Pending (" + pendingCount + ")"}</button>}
    </div>
    {loading && <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>}
    {!loading && filtered.length === 0 && <Card style={{ textAlign: "center", padding: 30, color: B.textDim }}><div style={{ fontSize: 24, marginBottom: 6 }}>📖</div><div style={{ fontSize: 13 }}>{search ? "No results for \"" + search + "\"" : "No articles yet. Add one to get started."}</div></Card>}
    {filtered.map(a => <Card key={a.id} onClick={() => setSelArticle(a)} style={{ padding: "14px 16px", marginBottom: 8, cursor: "pointer", borderLeft: "3px solid " + catColors[a.category] }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><Badge color={catColors[a.category]}>{cats[a.category]?.split(" ")[1] || a.category}</Badge>{a.status === "pending" && <Badge color={B.orange}>Pending</Badge>}{a.tags && a.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 9, color: B.textDim, background: B.bg, padding: "1px 6px", borderRadius: 3 }}>{t}</span>)}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.text, marginTop: 4 }}>{a.title}</div>
          <div style={{ fontSize: 11, color: B.textDim, marginTop: 2 }}>{a.author} · {new Date(a.created_at).toLocaleDateString()}</div>
        </div>
        {a.file_url && <span style={{ fontSize: 16, flexShrink: 0 }}>📎</span>}
      </div>
    </Card>)}
    {showCreate && <Modal title={selArticle ? "Edit Article" : "New Knowledge Base Article"} onClose={() => { setShowCreate(false); setSelArticle(null); }} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label style={LS}>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Walk-in cooler not defrosting" style={IS} /></div>
        <div><label style={LS}>Category</label><select value={category} onChange={e => setCategory(e.target.value)} style={{ ...IS, cursor: "pointer" }}>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        {(category === "guide") && <>
          <div><label style={LS}>Symptoms <span style={{ color: B.textDim, fontWeight: 400 }}>(what the tech sees)</span></label><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={3} placeholder={"Ice buildup on evaporator coils\nBox temp rising above setpoint\nDefrost timer not advancing"} style={{ ...IS, resize: "vertical", lineHeight: 1.5 }} /></div>
          <div><label style={LS}>Fix / Steps</label><textarea value={fixSteps} onChange={e => setFixSteps(e.target.value)} rows={4} placeholder={"1. Check defrost timer — rotate to defrost cycle\n2. Verify heaters are energizing (amp check)\n3. Check defrost termination switch\n4. Inspect drain line for blockage"} style={{ ...IS, resize: "vertical", lineHeight: 1.5 }} /></div>
        </>}
        {category === "sop" && <>
          <div><label style={LS}>Scope / Purpose <span style={{ color: B.textDim, fontWeight: 400 }}>(when does this SOP apply?)</span></label><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2} placeholder={"This procedure applies to all quarterly PM inspections on walk-in coolers."} style={{ ...IS, resize: "vertical", lineHeight: 1.5 }} /></div>
          <div><label style={LS}>Procedure Steps</label><textarea value={fixSteps} onChange={e => setFixSteps(e.target.value)} rows={6} placeholder={"1. Lock out / tag out unit\n2. Inspect evaporator coils for frost buildup\n3. Check refrigerant pressures\n4. Verify condenser fan motor amps\n5. Clean condenser coils\n6. Check door gaskets and hinges\n7. Record all readings on PM checklist\n8. Restore power and verify operation"} style={{ ...IS, resize: "vertical", lineHeight: 1.5 }} /></div>
        </>}
        {category === "parts" && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={LS}>Part Number</label><input value={partNum} onChange={e => setPartNum(e.target.value)} placeholder="PN-12345" style={{ ...IS, fontFamily: M }} /></div>
            <div><label style={LS}>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Carrier, Emerson, etc." style={IS} /></div>
          </div>
        </>}
        <div><label style={LS}>{category === "guide" ? "Additional Notes" : category === "tip" ? "Tip Details" : category === "sop" ? "Additional Notes / Safety" : "Description"}</label><textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder={category === "sop" ? "Safety notes, PPE requirements, references..." : "Enter details..."} style={{ ...IS, resize: "vertical", lineHeight: 1.5 }} /></div>
        <div><label style={LS}>Photos <span style={{ color: B.textDim, fontWeight: 400 }}>(type [photo:1] in any text box to place photo #1 inline)</span></label>
          {editorPhotos.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6, marginBottom: 8 }}>{editorPhotos.map((f, i) => <div key={f.id || i} style={{ borderRadius: 6, overflow: "hidden", border: "1px solid " + B.border, position: "relative" }}><span style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, fontFamily: M }}>#{i + 1}</span><img src={f.thumbnail_url || f.file_url} alt="" style={{ width: "100%", height: 64, objectFit: "cover", display: "block" }} /><button onClick={() => selArticle ? deleteFile(f.id, selArticle.id) : removePending(pendingFiles.indexOf(f))} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", borderRadius: 3, padding: "1px 5px" }}>×</button></div>)}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...BS, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, padding: "8px 14px", minHeight: 0, flexShrink: 0 }}>{saving ? "Uploading..." : "📷 Add Photo"}<input type="file" accept="image/*" onChange={e => { uploadFile(e.target.files[0], selArticle ? selArticle.id : null, true, captionDraft); e.target.value = ""; }} style={{ display: "none" }} /></label>
            <input value={captionDraft} onChange={e => setCaptionDraft(e.target.value)} placeholder="Caption for next photo (optional)" style={{ ...IS, flex: 1, minWidth: 160, padding: "8px 12px", fontSize: 12 }} />
          </div>
        </div>
        <div><label style={LS}>Tags <span style={{ color: B.textDim, fontWeight: 400 }}>(comma-separated)</span></label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="defrost, walk-in, cooler, Heatcraft" style={IS} /></div>
        <div style={{ display: "flex", gap: 8 }}><button onClick={() => { setShowCreate(false); setSelArticle(null); }} style={{ ...BS, flex: 1 }}>Cancel</button><button onClick={save} disabled={saving} style={{ ...BP, flex: 1, opacity: saving ? .6 : 1 }}>{saving ? "Saving..." : (isMgr ? (selArticle ? "Save" : "Publish") : "Submit for Approval")}</button></div>
      </div>
    </Modal>}
  </div>);
}

export { KnowledgeBase };
