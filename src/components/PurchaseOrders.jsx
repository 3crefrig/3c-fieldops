import React, { useState, useEffect, useRef } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PSC, PSL, haptic, cleanText , fnFetch , openWO, importRetry, scanDocument, scanLineSummary, scanTotal} from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, CustomSelect, Logo, PdfPreviewModal, previewPdfDoc, usePasteImage } from "./ui";
import { TicketCaptureModal } from "./VendorAudit";

let _logoB64Cache=null;

async function fetchLogoBase64(){
  if(_logoB64Cache)return _logoB64Cache;
  try{const resp=await fetch("https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png");
    const blob=await resp.blob();return new Promise((res)=>{const r=new FileReader();r.onload=()=>{_logoB64Cache=r.result;res(r.result);};r.readAsDataURL(blob);});
  }catch(e){console.warn("Logo fetch failed:",e);return null;}
}

async function generatePOPdf(po,wo,opts){
  const{jsPDF}=await importRetry(()=>import("jspdf"));const doc=new jsPDF({unit:"mm",format:"letter"});
  const pw=215.9,lm=20,rm=20,cw=pw-lm-rm;
  const cyan=[0,229,255],dark=[30,34,42],mid=[120,130,150],light=[240,243,248];
  let y=20;

  // Helper functions
  const drawLine=(y1,color)=>{doc.setDrawColor(...color);doc.setLineWidth(0.3);doc.line(lm,y1,pw-rm,y1);};
  const drawRect=(x,y1,w,h,fill)=>{doc.setFillColor(...fill);doc.rect(x,y1,w,h,"F");};

  // Logo
  const logo=await fetchLogoBase64();
  if(logo)doc.addImage(logo,"PNG",lm,y,40,14);

  // Company info — right aligned
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
  doc.text("3C Refrigeration LLC",pw-rm,y+4,{align:"right"});
  doc.text("service@3crefrigeration.com",pw-rm,y+8,{align:"right"});
  doc.text("www.3crefrigeration.com",pw-rm,y+12,{align:"right"});
  y+=20;

  // Accent bar
  drawRect(lm,y,cw,1.5,cyan);
  y+=8;

  // PURCHASE ORDER title + PO number on same line, properly spaced
  doc.setFont("helvetica","bold");doc.setFontSize(24);doc.setTextColor(...dark);
  doc.text("PURCHASE ORDER",lm,y);
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(...dark);
  doc.text("PO #"+po.po_id,pw-rm,y,{align:"right"});
  y+=10;

  // Info grid — measure WO text first to size the box
  const col1=lm+6,col2=lm+cw/2+4;
  const labelStyle=()=>{doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);};
  const valueStyle=()=>{doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(...dark);};
  valueStyle();const woText=wo?wo.wo_id+(wo.title?" — "+wo.title:""):"—";const woLines=doc.splitTextToSize(woText,cw/2-10);
  const gridH=Math.max(32,28+woLines.length*5);

  drawRect(lm,y,cw,gridH,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(lm,y,lm,y+gridH);

  labelStyle();doc.text("DATE",col1,y+7);
  valueStyle();doc.text(po.created_at?new Date(po.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—",col1,y+13);

  labelStyle();doc.text("STATUS",col2,y+7);
  valueStyle();doc.text((po.status||"pending").toUpperCase(),col2,y+13);

  labelStyle();doc.text("REQUESTED BY",col1,y+22);
  valueStyle();doc.text(po.requested_by||"—",col1,y+28);

  labelStyle();doc.text("WORK ORDER",col2,y+22);
  valueStyle();doc.text(woLines,col2,y+28);
  y+=gridH+8;

  // Line items header
  drawRect(lm,y,cw,9,[30,34,42]);
  doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.text("DESCRIPTION",lm+6,y+6.5);
  doc.text("AMOUNT",pw-rm-6,y+6.5,{align:"right"});
  y+=9;

  // Line item row
  drawRect(lm,y,cw,14,[255,255,255]);
  doc.setDrawColor(220,225,230);doc.setLineWidth(0.2);doc.rect(lm,y,cw,14);
  doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(...dark);
  const descText=doc.splitTextToSize(po.description||"—",cw-50);
  doc.text(descText,lm+6,y+9);
  doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(...dark);
  doc.text("$"+(parseFloat(po.amount)||0).toFixed(2),pw-rm-6,y+9,{align:"right"});
  y+=14;

  // Notes row if present
  if(po.notes){
    drawRect(lm,y,cw,12,[250,251,253]);
    doc.setDrawColor(220,225,230);doc.setLineWidth(0.2);doc.rect(lm,y,cw,12);
    doc.setFont("helvetica","italic");doc.setFontSize(9);doc.setTextColor(...mid);
    doc.text("Note: "+po.notes,lm+6,y+8);
    y+=12;
  }

  // Total bar
  y+=2;
  drawRect(lm,y,cw,14,cyan);
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(255,255,255);
  doc.text("TOTAL",lm+6,y+9.5);
  doc.setFontSize(14);
  doc.text("$"+(parseFloat(po.amount)||0).toFixed(2),pw-rm-6,y+10,{align:"right"});
  y+=24;

  // Payment instructions box
  drawRect(lm,y,cw,30,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(lm,y,lm,y+30);
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...dark);
  doc.text("Payment Instructions",lm+6,y+8);
  doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...mid);
  doc.text("Please email all invoices for this purchase order to:",lm+6,y+16);
  doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(...cyan);
  doc.text("service@3crefrigeration.com",lm+6,y+24);
  y+=38;

  // Authorization line
  drawLine(y,light);y+=8;
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
  doc.text("This purchase order is authorized by 3C Refrigeration LLC.",lm,y);
  y+=5;
  doc.text("Reference this PO number ("+po.po_id+") on all correspondence and invoices.",lm,y);

  // Footer — bottom of page
  const fy=269;
  drawLine(fy-4,[220,225,230]);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...mid);
  doc.text("3C Refrigeration LLC  |  service@3crefrigeration.com",pw/2,fy,{align:"center"});
  doc.text("Generated "+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),pw/2,fy+4,{align:"center"});

  if(opts&&opts.returnDoc)return doc;
  doc.save("PO-"+po.po_id+".pdf");
}

const vendorSuggestions=(pos)=>[...new Set((pos||[]).map(p=>(p.notes||"").trim()).filter(v=>v&&v.length<=40))].slice(0,12);

// A PO can be filled at more than one supply house — Grainger for one part,
// United for the next. Sum the pickup tickets captured against it, broken out
// per vendor, so the PO shows what was actually spent.
export function ticketRollup(tickets,poId){
  const mine=(tickets||[]).filter(t=>t.po_id===poId);
  if(!mine.length)return null;
  const lineTotal=(t)=>{const v=parseFloat(t.total);if(isFinite(v))return v;const s=parseFloat(t.subtotal)||0,x=parseFloat(t.tax)||0;return s+x;};
  const byVendor={};
  mine.forEach(t=>{const n=(t.vendor_name||"Unknown vendor").trim();byVendor[n]=(byVendor[n]||0)+lineTotal(t);});
  return{
    count:mine.length,
    total:mine.reduce((s,t)=>s+lineTotal(t),0),
    vendors:Object.entries(byVendor).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total),
  };
}

// Receipt / vendor-invoice scanning, shared by both PO modals. Fills the three
// fields a PO carries: what was bought, what it cost, and who sold it.
function useReceiptScan(setDesc,setAmt,setNotes){
  const[busy,setBusy]=useState("");
  const receiptRef=useRef(null),invoiceRef=useRef(null);
  const scan=async(file,kind)=>{
    if(!file||busy)return;
    setBusy(kind);
    try{
      const x=await scanDocument(file,kind==="receipt"?"purchase_receipt":"vendor_invoice");
      const ref=kind==="receipt"?x.receipt_number:x.invoice_number;
      const summary=scanLineSummary(x);
      if(summary||ref)setDesc([summary,ref?"(#"+ref+")":""].filter(Boolean).join(" "));
      const total=scanTotal(x);
      if(total!=null)setAmt(total.toFixed(2));
      if(x.vendor_name)setNotes(String(x.vendor_name).trim());
      if(total==null)alert("Read the "+(kind==="receipt"?"receipt":"invoice")+", but couldn't find a total — please type the amount in.");
    }catch(err){
      console.error("Scan error:",err);
      alert("Could not read the "+(kind==="receipt"?"receipt":"invoice")+".\n\n"+(err.message||err)+"\n\nYou can still fill the fields in by hand.");
    }finally{setBusy("");}
  };
  const pick=(ref,kind)=>async(e)=>{const f=e.target.files?.[0];await scan(f,kind);if(ref.current)ref.current.value="";};
  return{busy,receiptRef,invoiceRef,onReceiptFile:pick(receiptRef,"receipt"),onInvoiceFile:pick(invoiceRef,"invoice"),scan};
}

// The scan buttons + hidden file inputs, identical in both PO modals.
function ScanRow({s}){
  return(<div>
    <input ref={s.receiptRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={s.onReceiptFile}/>
    <input ref={s.invoiceRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={s.onInvoiceFile}/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={()=>s.receiptRef.current?.click()} disabled={!!s.busy} type="button" style={{...BS,flex:"1 1 140px",padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:s.busy?.6:1}}>{s.busy==="receipt"?"Scanning...":"Scan Receipt"}</button>
      <button onClick={()=>s.invoiceRef.current?.click()} disabled={!!s.busy} type="button" style={{...BS,flex:"1 1 140px",padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:s.busy?.6:1}}>{s.busy==="invoice"?"Scanning...":"Scan Vendor Invoice"}</button>
    </div>
    {s.busy?<div style={{fontSize:11,color:B.cyan,marginTop:4,textAlign:"center"}}>AI is reading the {s.busy==="receipt"?"receipt":"invoice"}...</div>
      :<div style={{fontSize:10,color:B.textDim,marginTop:4,textAlign:"center"}}>Photo, screenshot, or PDF — you can also paste a screen capture with Ctrl+V</div>}
  </div>);
}

function POReqModal({wo,pos,onCreatePO,onClose,userName,userRole,userId,initial}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[desc,setDesc]=useState(initial?.description||""),[amt,setAmt]=useState(initial?.amount?String(initial.amount):""),[notes,setNotes]=useState(initial?.notes||""),[saving,setSaving]=useState(false);
  const[ticketFor,setTicketFor]=useState(null);
  const scan=useReceiptScan(setDesc,setAmt,setNotes);
  usePasteImage(true,(f)=>scan.scan(f,"receipt"));
  const existing=pos.filter(p=>p.wo_id===wo.id);
  const go=async()=>{if(!desc.trim()||saving)return;if(cleanText(desc,"PO Description")===null||cleanText(notes,"PO Notes")===null)return;setSaving(true);try{await onCreatePO({wo_id:wo.id,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim()});setSaving(false);onClose();}catch(e){console.error(e);setSaving(false);}};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}><span style={LS}>Existing POs on {wo.wo_id}</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=>{const canSee=isMgr||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,gap:6}}><div style={{flex:1,minWidth:0}}><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.description}{canSee?" · $"+po.amount:""}</span></div><button data-tip="Snap the counter ticket at pickup. Supply Audit uses it to catch vendor billing errors later." onClick={()=>setTicketFor(po)} title="Snap the supply house pickup ticket for this PO" style={{...BS,padding:"4px 8px",fontSize:11,minHeight:28,flexShrink:0}}>🧾 Ticket</button><Badge color={PSC[po.status]}>{PSL[po.status]}</Badge></div>})}</div><div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div></div>}
    {ticketFor&&<TicketCaptureModal po={ticketFor} userName={userName} userId={userId} onClose={()=>setTicketFor(null)} onSaved={(warn)=>{if(warn)alert("Ticket saved"+warn);}}/>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <ScanRow s={scan}/>
      <div><label style={LS}>Parts/Materials <span style={{color:B.red}}>*</span></label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Compressor refrigerant R-404A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Estimated Amount ($) <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>optional</span></label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted}}>{wo.wo_id}</div></div></div>
      <div><label style={LS}>Vendor / Where to get it</label><input list="po-vendor-suggest" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Johnstone Supply, Home Depot, etc." style={IS}/><datalist id="po-vendor-suggest">{vendorSuggestions(pos).map(v=><option key={v} value={v}/>)}</datalist></div>
      {!isMgr&&<div style={{fontSize:10,color:B.textDim,background:B.bg,padding:"8px 12px",borderRadius:6,border:"1px solid "+B.border}}>Don't know the exact price? Leave the amount blank — your manager will fill it in before approving.</div>}
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Request PO"}</button></div>
    </div></Modal>);
}

function POEditForm({po,onSave,onClose}){
  const[desc,setDesc]=useState(po.description),[amt,setAmt]=useState(String(po.amount)),[notes,setNotes]=useState(po.notes||""),[status,setStatus]=useState(po.status),[saving,setSaving]=useState(false);
  const[surplusPool,setSurplusPool]=useState(!!po.surplus_pool),[surplusNotes,setSurplusNotes]=useState(po.surplus_notes||"");
  const go=async()=>{if(saving)return;setSaving(true);try{await onSave({...po,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim(),status,surplus_pool:surplusPool,surplus_notes:surplusPool?surplusNotes.trim()||null:null});setSaving(false);}catch(e){console.error(e);setSaving(false);}};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Description</label><input value={desc} onChange={e=>setDesc(e.target.value)} style={IS}/></div>
    <div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
    <div><label style={LS}>Status</label><select value={status} onChange={e=>setStatus(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revised">Revised</option></select></div>
    <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} style={IS}/></div>
    <div style={{padding:"10px 12px",borderRadius:6,border:"1px dashed "+B.orange+"66",background:B.orange+"08"}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
        <input type="checkbox" checked={surplusPool} onChange={e=>setSurplusPool(e.target.checked)}/>
        <span style={{fontSize:12,fontWeight:700,color:B.orange}}>Surplus — material was purchased but not used</span>
      </label>
      <div style={{fontSize:10,color:B.textDim,marginTop:4,marginLeft:24}}>Mark this PO as available to bill on a future job. It will show up in the Surplus Parts picker when creating a new invoice.</div>
      {surplusPool&&<div style={{marginTop:8}}><label style={LS}>Surplus Notes <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>(optional — where stored, qty remaining, etc.)</span></label><input value={surplusNotes} onChange={e=>setSurplusNotes(e.target.value)} placeholder="e.g. 5 contactors left, stored on Truck 3" style={IS}/></div>}
    </div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
  </div>);
}

function StandalonePOModal({onCreatePO,onClose}){
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
  const scan=useReceiptScan(setDesc,setAmt,setNotes);
  usePasteImage(true,(f)=>scan.scan(f,"receipt"));
  const go=async()=>{if(!desc.trim()||saving)return;if(cleanText(desc,"PO Description")===null||cleanText(notes,"PO Notes")===null)return;setSaving(true);try{await onCreatePO({description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim()});setSaving(false);onClose();}catch(e){console.error(e);setSaving(false);}};
  return(<Modal title="Create Standalone PO" onClose={onClose} wide>
    <div style={{fontSize:11,color:B.textDim,background:B.bg,padding:"8px 12px",borderRadius:6,border:"1px solid "+B.border,marginBottom:14}}>This PO will not be linked to a work order. Use for shop stock, tools, office supplies, etc.</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <ScanRow s={scan}/>
      <div><label style={LS}>Parts/Materials <span style={{color:B.red}}>*</span></label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Shop refrigerant stock, tools, office supplies" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Amount ($) <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>optional</span></label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted,fontStyle:"italic"}}>None (standalone)</div></div></div>
      <div><label style={LS}>Vendor / Where to get it</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Johnstone Supply, Home Depot, etc." style={IS}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Create PO"}</button></div>
    </div></Modal>);
}

function POMgmt({pos,onUpdatePO,onDeletePO,wos,onCreatePO,tickets,userName,userId,users,reloadTable}){
  const PAGE_SIZE=50;
  const[filter,setFilter]=useState("all"),[editing,setEditing]=useState(null),[toast,setToast]=useState(""),[search,setSearch]=useState(""),[confirmDelete,setConfirmDelete]=useState(null),[visibleCount,setVisibleCount]=useState(PAGE_SIZE),[showCreate,setShowCreate]=useState(false),[ticketFor,setTicketFor]=useState(null);
  // Preload the PDF library so the first PO PDF doesn't pay its chunk download.
  useEffect(()=>{import("jspdf").catch(()=>{});},[]);
  const[pdfPreview,setPdfPreview]=useState(null);
  // Tie technicians to a PO — same chip + "+ Add" control the WO crew uses.
  const setPOTechs=async(po,techs)=>{
    const{error}=await sb().from("purchase_orders").update({assigned_techs:techs}).eq("id",po.id);
    if(error){msg("Failed: "+error.message);return;}
    if(reloadTable)reloadTable("purchase_orders");
  };
  // Pull the PO's dollar amount up to what the captured receipts actually say.
  const syncPOAmount=async(po,total)=>{
    await onUpdatePO({...po,amount:Number(total.toFixed(2))});
    msg("PO "+po.po_id+" set to $"+total.toFixed(2));
  };
  const[inlineAmt,setInlineAmt]=useState({});   // po.id → amount typed on the card ($0 POs approve inline, no Edit detour)
  const[selPOs,setSelPOs]=useState([]);          // bulk-approve selection (pending filter)
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  // Deep-link: GlobalSearch / bell dispatch "open-po" with a po_id — prefill the search box.
  useEffect(()=>{const h=(e)=>{setFilter("all");setSearch(String(e.detail||""));};window.addEventListener("open-po",h);return()=>window.removeEventListener("open-po",h);},[]);
  const flt=pos.filter(p=>{if(filter!=="all"&&p.status!==filter)return false;if(search){const s=search.toLowerCase();const wo=wos.find(o=>o.id===p.wo_id);return(p.po_id||"").toLowerCase().includes(s)||(p.description||"").toLowerCase().includes(s)||(p.requested_by||"").toLowerCase().includes(s)||((p.assigned_techs||[]).join(" ").toLowerCase().includes(s))||(wo?.title||"").toLowerCase().includes(s)||(wo?.customer||"").toLowerCase().includes(s);}return true;});const pc=pos.filter(p=>p.status==="pending").length;
  useEffect(()=>{setVisibleCount(PAGE_SIZE);},[flt.length]);
  const approve=async(po)=>{const amt=parseFloat(po.amount)||parseFloat(inlineAmt[po.id])||0;if(!amt){msg("Type the amount in the $ box first");return;}await onUpdatePO({...po,amount:amt,status:"approved"});setInlineAmt(a=>({...a,[po.id]:""}));msg("PO "+po.po_id+" approved"+(parseFloat(po.amount)?"":" — $"+amt.toFixed(2))); };
  const toggleSel=(id)=>setSelPOs(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const bulkApprove=async()=>{const sel=pos.filter(p=>selPOs.includes(p.id)&&p.status==="pending");const ok=sel.filter(p=>parseFloat(p.amount));const skip=sel.length-ok.length;for(const p of ok)await onUpdatePO({...p,status:"approved"});setSelPOs([]);msg(ok.length+" PO"+(ok.length!==1?"s":"")+" approved"+(skip>0?" · "+skip+" skipped (needs amount)":""));};
  const reject=async(po)=>{await onUpdatePO({...po,status:"rejected"});msg("PO "+po.po_id+" rejected");};
  const deletePO=async(po)=>{await onDeletePO(po);setConfirmDelete(null);msg("PO "+po.po_id+" deleted");};
  const approved=pos.filter(p=>p.status==="approved");const approvedAmt=approved.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  return(<div><Toast msg={toast}/>{pdfPreview&&<PdfPreviewModal {...pdfPreview} onClose={()=>setPdfPreview(null)}/>}
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"flex-start"}}><StatCard label="Total POs" value={pos.length} icon="📄" color={B.cyan}/><StatCard label="Pending" value={pc} icon="⏳" color={B.orange}/><StatCard label="Approved" value={approved.length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+approvedAmt.toLocaleString()} icon="💰" color={B.green}/>{onCreatePO&&<button data-tip="Create a purchase order not tied to a job — shop stock, tools, supplies. You’re auto-assigned as its tech." data-tour="po-new" onClick={()=>setShowCreate(true)} style={{...BP,padding:"10px 18px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",marginLeft:"auto"}}>+ Create PO</button>}</div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search POs by #, description, tech, customer..." style={{...IS,marginBottom:14,padding:"8px 12px",fontSize:12}}/>
    {selPOs.length>0&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:B.cyanGlow,border:"1px solid "+B.cyan+"40",borderRadius:10,marginBottom:10}}>
      <span style={{fontSize:12,fontWeight:700,color:B.cyan}}>{selPOs.length} selected</span>
      <button onClick={bulkApprove} style={{...BP,padding:"8px 16px",fontSize:12,minHeight:36,background:B.green}}>Approve Selected</button>
      <button onClick={()=>setSelPOs([])} style={{...BS,padding:"8px 14px",fontSize:12,minHeight:36}}>Clear</button>
      <span style={{fontSize:10,color:B.textDim}}>POs without an amount are skipped</span>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No POs found</div>}
      {flt.slice(0,visibleCount).map(po=>{const wo=wos.find(o=>o.id===po.wo_id);return(
        <Card key={po.id} style={{padding:"14px 16px",borderLeft:"3px solid "+(PSC[po.status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            {po.status==="pending"&&<input type="checkbox" checked={selPOs.includes(po.id)} onChange={()=>toggleSel(po.id)} style={{width:18,height:18,accentColor:B.cyan,cursor:"pointer",marginTop:4,flexShrink:0}}/>}
            {/* 240px basis: on a phone the button cluster can't fit beside this,
                so it wraps to its own line instead of squeezing the text to
                one-word-per-line. */}
            <div style={{flex:"1 1 240px",minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontFamily:M,fontWeight:700,fontSize:15,color:B.text}}>{po.po_id}</span><Badge color={PSC[po.status]||B.textDim}>{PSL[po.status]||po.status}</Badge>{wo&&<button onClick={()=>openWO(wo.wo_id||wo.id)} title={"Open "+wo.wo_id+(wo.title?" — "+wo.title:"")} style={{fontFamily:M,fontSize:11,color:B.cyan,background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationColor:B.cyan+"44"}}>{wo.wo_id}</button>}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{po.description}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>By {po.requested_by} · {po.created_at?.slice(0,10)} · {parseFloat(po.amount)?<span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(po.amount).toFixed(2)}</span>:<span style={{fontFamily:M,fontWeight:700,color:B.orange}}>$ —  needs amount</span>}{wo&&<span> · {wo.title}</span>}</div>
              {po.notes&&<div style={{fontSize:11,color:B.orange,marginTop:4,fontStyle:"italic"}}>Note: {po.notes}</div>}
              {(()=>{
                // Actual spend so far, from the pickup tickets captured against
                // this PO — one line per supply house, since a PO can be filled
                // by several vendors.
                const t=ticketRollup(tickets,po.id);if(!t)return null;
                const poAmt=parseFloat(po.amount)||0;const off=Math.abs(t.total-poAmt)>0.01;
                return(<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:B.bg,border:"1px solid "+(off?B.orange+"55":B.border)}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:.4,textTransform:"uppercase"}}>Receipts</span>
                    <span style={{fontFamily:M,fontSize:12,fontWeight:800,color:off?B.orange:B.green}}>${t.total.toFixed(2)}</span>
                    <span style={{fontSize:10,color:B.textDim}}>from {t.count} ticket{t.count!==1?"s":""}</span>
                    {off&&<button onClick={()=>syncPOAmount(po,t.total)} title={"Set the PO amount to the receipts total ($"+t.total.toFixed(2)+")"} style={{...BS,padding:"3px 10px",fontSize:10,minHeight:26,color:B.cyan,borderColor:B.cyan+"55"}}>Set PO to ${t.total.toFixed(2)}</button>}
                  </div>
                  <div style={{fontSize:10,color:B.textMuted,marginTop:3}}>{t.vendors.map(v=>v.name+" $"+v.total.toFixed(2)).join(" · ")}</div>
                </div>);
              })()}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:6}}>
                <span style={{fontSize:10,color:B.textDim,fontWeight:600,letterSpacing:.4,textTransform:"uppercase"}}>Techs</span>
                {(po.assigned_techs||[]).map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,background:B.cyan+"22",color:B.cyan,fontSize:11,fontWeight:600}}>{t}<button onClick={()=>setPOTechs(po,(po.assigned_techs||[]).filter(x=>x!==t))} title={"Remove "+t} style={{background:"none",border:"none",color:B.red,fontSize:14,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button></span>)}
                {(po.assigned_techs||[]).length===0&&<span style={{fontSize:11,color:B.textDim}}>None assigned</span>}
                <select value="" onChange={e=>{if(!e.target.value)return;setPOTechs(po,[...(po.assigned_techs||[]),e.target.value]);e.target.value="";}} style={{...IS,width:"auto",padding:"4px 8px",fontSize:11,cursor:"pointer",minHeight:0}}>
                  <option value="">+ Add</option>
                  {(users||[]).filter(u=>u.active!==false&&!(po.assigned_techs||[]).includes(u.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
              {(()=>{const tc=(tickets||[]).filter(t=>t.po_id===po.id).length;return<button onClick={()=>setTicketFor(po)} title="Capture a supply house pickup ticket against this PO" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36,...(tc>0?{color:B.cyan,borderColor:B.cyan+"50"}:{})}}>{tc>0?"Tickets ("+tc+")":"Ticket"}</button>;})()}
              <button onClick={async()=>{try{const d=await generatePOPdf(po,wo,{returnDoc:true});previewPdfDoc(d,"PO-"+po.po_id,setPdfPreview);}catch(e){msg("Error: "+e.message);}}} title="Preview the PO form (no download)" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36,color:B.cyan,borderColor:B.cyan+"55"}}>Preview</button><button onClick={()=>generatePOPdf(po,wo)} title="Download the PO form" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36}}>PO Form</button>
              <button onClick={()=>setEditing(po)} style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36}}>Edit</button>
              {po.status==="pending"&&<>{!parseFloat(po.amount)&&<div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:12,color:B.textDim}}>$</span><input value={inlineAmt[po.id]||""} onChange={e=>setInlineAmt(a=>({...a,[po.id]:e.target.value}))} type="number" min="0" step="0.01" placeholder="0.00" title="Type the amount and hit Approve — no Edit needed" style={{...IS,width:86,padding:"7px 8px",fontSize:12,fontFamily:M,minHeight:36}}/></div>}<button onClick={()=>approve(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.green}}>Approve</button><button onClick={()=>reject(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.red}}>Reject</button></>}
              {po.status==="rejected"&&<button onClick={()=>approve(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.green}}>Re-approve</button>}
              <button onClick={()=>setConfirmDelete(po)} style={{...BS,padding:"8px 12px",fontSize:12,minHeight:36,color:B.red,borderColor:B.red+"40"}}>✕</button>
            </div></div></Card>);})}
      {visibleCount<flt.length&&<button onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)} style={{...BS,width:"100%",marginTop:8,textAlign:"center",fontSize:12}}>Show More ({visibleCount} of {flt.length})</button>}
    </div>
    {editing&&<Modal title={"Edit PO "+editing.po_id} onClose={()=>setEditing(null)}><POEditForm po={editing} onSave={async u=>{await onUpdatePO(u);setEditing(null);msg("PO "+u.po_id+" updated");}} onClose={()=>setEditing(null)}/></Modal>}
    {confirmDelete&&<Modal title="Delete PO?" onClose={()=>setConfirmDelete(null)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>Delete PO {confirmDelete.po_id}?</div>
        <div style={{fontSize:12,color:B.textMuted,marginBottom:4}}>{confirmDelete.description}</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This cannot be undone.</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setConfirmDelete(null)} style={{...BS,flex:1}}>Cancel</button><button onClick={()=>deletePO(confirmDelete)} style={{...BP,flex:1,background:B.red}}>Delete PO</button></div>
      </div>
    </Modal>}
    {showCreate&&<StandalonePOModal onCreatePO={onCreatePO} onClose={()=>setShowCreate(false)}/>}
    {ticketFor&&<TicketCaptureModal po={ticketFor} userName={userName} userId={userId} onClose={()=>setTicketFor(null)} onSaved={(warn)=>{
      msg("Pickup ticket saved on "+ticketFor.po_id+(warn||""));
      if(reloadTable){reloadTable("po_tickets");reloadTable("po_ticket_items");reloadTable("purchase_orders");}
    }}/>}
  </div>);
}

export { POReqModal, POEditForm, POMgmt, generatePOPdf, fetchLogoBase64 };
