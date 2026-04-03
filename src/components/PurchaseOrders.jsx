import React, { useState, useEffect, useRef } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PSC, PSL, haptic, cleanText } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, CustomSelect, Logo } from "./ui";
import { jsPDF } from "jspdf";

async function fetchLogoBase64(){
  if(_logoB64Cache)return _logoB64Cache;
  try{const resp=await fetch("https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png");
    const blob=await resp.blob();return new Promise((res)=>{const r=new FileReader();r.onload=()=>{_logoB64Cache=r.result;res(r.result);};r.readAsDataURL(blob);});
  }catch(e){console.warn("Logo fetch failed:",e);return null;}
}

async function generatePOPdf(po,wo){
  const doc=new jsPDF({unit:"mm",format:"letter"});
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

  // Info grid — light background
  drawRect(lm,y,cw,32,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(lm,y,lm,y+32);

  const col1=lm+6,col2=lm+cw/2+4;
  const labelStyle=()=>{doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);};
  const valueStyle=()=>{doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(...dark);};

  labelStyle();doc.text("DATE",col1,y+7);
  valueStyle();doc.text(po.created_at?new Date(po.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—",col1,y+13);

  labelStyle();doc.text("STATUS",col2,y+7);
  valueStyle();doc.text((po.status||"pending").toUpperCase(),col2,y+13);

  labelStyle();doc.text("REQUESTED BY",col1,y+22);
  valueStyle();doc.text(po.requested_by||"—",col1,y+28);

  labelStyle();doc.text("WORK ORDER",col2,y+22);
  valueStyle();doc.text(wo?wo.wo_id+(wo.title?" — "+wo.title:""):"—",col2,y+28);
  y+=40;

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

  doc.save("PO-"+po.po_id+".pdf");
}

function POReqModal({wo,pos,onCreatePO,onClose,userName,userRole}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
  const[scanningReceipt,setScanningReceipt]=useState(false);const scanReceiptRef=useRef(null);
  const[scanningInvoice,setScanningInvoice]=useState(false);const scanInvoiceRef=useRef(null);
  const handleScanReceipt=async(e)=>{const file=e.target.files?.[0];if(!file)return;setScanningReceipt(true);try{const reader=new FileReader();reader.onload=async()=>{try{const base64=reader.result.split(",")[1];const resp=await fetch(SUPABASE_URL+"/functions/v1/scan-document",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({image:base64,documentType:"purchase_receipt"})});const result=await resp.json();if(result.description)setDesc(result.description);if(result.amount)setAmt(String(result.amount));if(result.vendor||result.notes)setNotes(result.vendor||result.notes||"");}catch(err){console.error("Scan parse error:",err);alert("Could not read the receipt. Please fill in fields manually.");}finally{setScanningReceipt(false);}};reader.readAsDataURL(file);}catch(err){console.error("Scan error:",err);setScanningReceipt(false);}if(scanReceiptRef.current)scanReceiptRef.current.value="";};
  const handleScanInvoice=async(e)=>{const file=e.target.files?.[0];if(!file)return;setScanningInvoice(true);try{const reader=new FileReader();reader.onload=async()=>{try{const base64=reader.result.split(",")[1];const resp=await fetch(SUPABASE_URL+"/functions/v1/scan-document",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({image:base64,documentType:"vendor_invoice"})});const result=await resp.json();if(result.line_items?.[0]?.description||result.description){let d=result.line_items?.[0]?.description||result.description||"";if(result.invoice_number)d+=" (Inv#"+result.invoice_number+")";setDesc(d);}if(result.total||result.amount)setAmt(String(result.total||result.amount));if(result.vendor||result.invoice_number||result.date){const parts=[];if(result.vendor)parts.push(result.vendor);if(result.invoice_number)parts.push("Inv#"+result.invoice_number);if(result.date)parts.push(result.date);setNotes(parts.join(" | "));}}catch(err){console.error("Invoice scan parse error:",err);alert("Could not read the invoice. Please fill in fields manually.");}finally{setScanningInvoice(false);}};reader.readAsDataURL(file);}catch(err){console.error("Invoice scan error:",err);setScanningInvoice(false);}if(scanInvoiceRef.current)scanInvoiceRef.current.value="";};
  const existing=pos.filter(p=>p.wo_id===wo.id);
  const go=async()=>{if(!desc.trim()||saving)return;if(cleanText(desc,"PO Description")===null||cleanText(notes,"PO Notes")===null)return;setSaving(true);await onCreatePO({wo_id:wo.id,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim()});setSaving(false);onClose();};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}><span style={LS}>Existing POs on {wo.wo_id}</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=>{const canSee=isMgr||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.description}{canSee?" · $"+po.amount:""}</span></div><Badge color={PSC[po.status]}>{PSL[po.status]}</Badge></div>})}</div><div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div></div>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><input ref={scanReceiptRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleScanReceipt}/><input ref={scanInvoiceRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleScanInvoice}/><div style={{display:"flex",gap:8}}><button onClick={()=>scanReceiptRef.current?.click()} disabled={scanningReceipt} type="button" style={{...BS,flex:1,padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:scanningReceipt?.6:1}}>{scanningReceipt?"Scanning...":"📷 Scan Receipt"}</button><button onClick={()=>scanInvoiceRef.current?.click()} disabled={scanningInvoice} type="button" style={{...BS,flex:1,padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:scanningInvoice?.6:1}}>{scanningInvoice?"Scanning...":"📄 Scan Vendor Invoice"}</button></div>{(scanningReceipt||scanningInvoice)&&<div style={{fontSize:11,color:B.cyan,marginTop:4,textAlign:"center"}}>AI is reading the {scanningReceipt?"receipt":"invoice"}...</div>}</div>
      <div><label style={LS}>Parts/Materials <span style={{color:B.red}}>*</span></label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Compressor refrigerant R-404A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Estimated Amount ($) <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>optional</span></label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted}}>{wo.wo_id}</div></div></div>
      <div><label style={LS}>Vendor / Where to get it</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Johnstone Supply, Home Depot, etc." style={IS}/></div>
      {!isMgr&&<div style={{fontSize:10,color:B.textDim,background:B.bg,padding:"8px 12px",borderRadius:6,border:"1px solid "+B.border}}>💡 Don't know the exact price? Leave the amount blank — your manager will fill it in before approving.</div>}
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Request PO"}</button></div>
    </div></Modal>);
}

function POEditForm({po,onSave,onClose}){
  const[desc,setDesc]=useState(po.description),[amt,setAmt]=useState(String(po.amount)),[notes,setNotes]=useState(po.notes||""),[status,setStatus]=useState(po.status),[saving,setSaving]=useState(false);
  const go=async()=>{if(saving)return;setSaving(true);await onSave({...po,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim(),status});setSaving(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Description</label><input value={desc} onChange={e=>setDesc(e.target.value)} style={IS}/></div>
    <div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
    <div><label style={LS}>Status</label><select value={status} onChange={e=>setStatus(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revised">Revised</option></select></div>
    <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} style={IS}/></div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
  </div>);
}

function POMgmt({pos,onUpdatePO,onDeletePO,wos}){
  const PAGE_SIZE=50;
  const[filter,setFilter]=useState("all"),[editing,setEditing]=useState(null),[toast,setToast]=useState(""),[search,setSearch]=useState(""),[confirmDelete,setConfirmDelete]=useState(null),[visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};const flt=pos.filter(p=>{if(filter!=="all"&&p.status!==filter)return false;if(search){const s=search.toLowerCase();const wo=wos.find(o=>o.id===p.wo_id);return(p.po_id||"").toLowerCase().includes(s)||(p.description||"").toLowerCase().includes(s)||(p.requested_by||"").toLowerCase().includes(s)||(wo?.title||"").toLowerCase().includes(s)||(wo?.customer||"").toLowerCase().includes(s);}return true;});const pc=pos.filter(p=>p.status==="pending").length;
  useEffect(()=>{setVisibleCount(PAGE_SIZE);},[flt.length]);
  const approve=async(po)=>{if(!parseFloat(po.amount)){msg("⚠️ Set an amount before approving — click Edit first");return;}await onUpdatePO({...po,status:"approved"});msg("PO "+po.po_id+" approved");};
  const reject=async(po)=>{await onUpdatePO({...po,status:"rejected"});msg("PO "+po.po_id+" rejected");};
  const deletePO=async(po)=>{await onDeletePO(po);setConfirmDelete(null);msg("PO "+po.po_id+" deleted");};
  const approved=pos.filter(p=>p.status==="approved");const approvedAmt=approved.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total POs" value={pos.length} icon="📄" color={B.cyan}/><StatCard label="Pending" value={pc} icon="⏳" color={B.orange}/><StatCard label="Approved" value={approved.length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+approvedAmt.toLocaleString()} icon="💰" color={B.purple}/></div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search POs by #, description, tech, customer..." style={{...IS,marginBottom:14,padding:"8px 12px",fontSize:12}}/>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No POs found</div>}
      {flt.slice(0,visibleCount).map(po=>{const wo=wos.find(o=>o.id===po.wo_id);return(
        <Card key={po.id} style={{padding:"14px 16px",borderLeft:"3px solid "+(PSC[po.status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontFamily:M,fontWeight:800,fontSize:15,color:B.text}}>{po.po_id}</span><Badge color={PSC[po.status]||B.textDim}>{PSL[po.status]||po.status}</Badge>{wo&&<span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.wo_id}</span>}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{po.description}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>By {po.requested_by} · {po.created_at?.slice(0,10)} · {parseFloat(po.amount)?<span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(po.amount).toFixed(2)}</span>:<span style={{fontFamily:M,fontWeight:700,color:B.orange}}>$ —  needs amount</span>}{wo&&<span> · {wo.title}</span>}</div>
              {po.notes&&<div style={{fontSize:11,color:B.orange,marginTop:4,fontStyle:"italic"}}>Note: {po.notes}</div>}
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>generatePOPdf(po,wo)} style={{...BS,padding:"5px 10px",fontSize:11}}>📄 PO Form</button>
              <button onClick={()=>setEditing(po)} style={{...BS,padding:"5px 10px",fontSize:11}}>Edit</button>
              {po.status==="pending"&&<><button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Approve</button><button onClick={()=>reject(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.red}}>Reject</button></>}
              {po.status==="rejected"&&<button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Re-approve</button>}
              <button onClick={()=>setConfirmDelete(po)} style={{...BS,padding:"5px 10px",fontSize:11,color:B.red,borderColor:B.red+"40"}}>✕</button>
            </div></div></Card>);})}
      {visibleCount<flt.length&&<button onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)} style={{...BS,width:"100%",marginTop:8,textAlign:"center",fontSize:12}}>Show More ({visibleCount} of {flt.length})</button>}
    </div>
    {editing&&<Modal title={"Edit PO "+editing.po_id} onClose={()=>setEditing(null)}><POEditForm po={editing} onSave={async u=>{await onUpdatePO(u);setEditing(null);msg("PO "+u.po_id+" updated");}} onClose={()=>setEditing(null)}/></Modal>}
    {confirmDelete&&<Modal title="Delete PO?" onClose={()=>setConfirmDelete(null)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>Delete PO {confirmDelete.po_id}?</div>
        <div style={{fontSize:12,color:B.textMuted,marginBottom:4}}>{confirmDelete.description}</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This cannot be undone.</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setConfirmDelete(null)} style={{...BS,flex:1}}>Cancel</button><button onClick={()=>deletePO(confirmDelete)} style={{...BP,flex:1,background:B.red}}>Delete PO</button></div>
      </div>
    </Modal>}
  </div>);
}

export { POReqModal, POEditForm, POMgmt, generatePOPdf, fetchLogoBase64 };
