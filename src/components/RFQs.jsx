import React, { useState } from "react";
import { sb, B, F, M, IS, LS, BP, BS, haptic, fmtDate, cleanText, SUPABASE_URL } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, EmptyState, Spinner } from "./ui";

// ── Status metadata (computed per render so theme colors stay live) ──
function statusMeta(){
  return {
    draft:{c:B.textDim,l:"Draft"},
    pending_approval:{c:B.orange,l:"Pending Approval"},
    sent:{c:B.cyan,l:"Sent"},
    quoted:{c:B.purple,l:"Quoted"},
    closed:{c:B.green,l:"Closed"},
  };
}
const docxUrl=(rfq)=>rfq?.docx_path?SUPABASE_URL+"/storage/v1/object/public/rfq-docs/"+rfq.docx_path:null;
const todayStr=()=>new Date().toISOString().slice(0,10);

// ── Create / Edit form ────────────────────────────────────────
function RFQForm({initial,onSave,onClose,signerName}){
  const isEdit=!!initial?.id;
  const[toVendor,setToVendor]=useState(initial?.to_vendor||"");
  const[vendorEmail,setVendorEmail]=useState(initial?.vendor_email||"");
  const[account,setAccount]=useState(initial?.account||"");
  const[rfqDate,setRfqDate]=useState(initial?.rfq_date||todayStr());
  const[preparedBy,setPreparedBy]=useState(initial?.prepared_by||signerName||"Alex Clapp");
  const[descriptor,setDescriptor]=useState("");
  const[introText,setIntroText]=useState(initial?.intro_text||"");
  const[items,setItems]=useState(initial?.items?.length?initial.items.map(i=>({item:i.item||"",qty:i.qty??"",part_no:i.part_no||"",description:i.description||""})):[{item:"",qty:"",part_no:"",description:""}]);
  const[specs,setSpecs]=useState(initial?.specs?.map(s=>({label:s.label||"",value:s.value||""}))||[]);
  const[notesText,setNotesText]=useState(Array.isArray(initial?.notes)?initial.notes.join("\n"):"");
  const[saving,setSaving]=useState(false);

  const setItem=(idx,k,v)=>setItems(items.map((it,i)=>i===idx?{...it,[k]:v}:it));
  const addItem=()=>setItems([...items,{item:"",qty:"",part_no:"",description:""}]);
  const rmItem=(idx)=>setItems(items.length>1?items.filter((_,i)=>i!==idx):items);
  const setSpec=(idx,k,v)=>setSpecs(specs.map((s,i)=>i===idx?{...s,[k]:v}:s));
  const addSpec=()=>setSpecs([...specs,{label:"",value:""}]);
  const rmSpec=(idx)=>setSpecs(specs.filter((_,i)=>i!==idx));

  const go=async()=>{
    if(saving)return;
    if(!toVendor.trim()){alert("Vendor name is required.");return;}
    if(cleanText(introText,"Intro")===null)return;
    const cleanItems=items.filter(it=>(it.item||it.part_no||it.description||it.qty!=="")).map(it=>({item:it.item.trim(),qty:it.qty===""?null:parseFloat(it.qty),part_no:it.part_no.trim(),description:it.description.trim()}));
    if(cleanItems.length===0){alert("Add at least one line item.");return;}
    const cleanSpecs=specs.filter(s=>s.label.trim()||s.value.trim()).map(s=>({label:s.label.trim(),value:s.value.trim()}));
    const notes=notesText.split("\n").map(n=>n.trim()).filter(Boolean);
    setSaving(true);
    try{
      await onSave({
        rfq:{to_vendor:toVendor.trim(),vendor_email:vendorEmail.trim()||null,account:account.trim()||null,rfq_date:rfqDate||null,prepared_by:preparedBy.trim()||null,intro_text:introText.trim()||null,notes,descriptor},
        items:cleanItems,specs:cleanSpecs,
      });
      setSaving(false);onClose();
    }catch(e){console.error(e);setSaving(false);}
  };

  return(<Modal title={isEdit?"Edit RFQ "+(initial.rfq_ref||""):"New Request for Quotation"} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Vendor <span style={{color:B.red}}>*</span></label><input value={toVendor} onChange={e=>setToVendor(e.target.value)} placeholder="e.g. Johnstone Supply" style={IS}/></div>
        <div><label style={LS}>Vendor Email</label><input value={vendorEmail} onChange={e=>setVendorEmail(e.target.value)} placeholder="sales@vendor.com" style={IS}/></div>
        <div><label style={LS}>Account #</label><input value={account} onChange={e=>setAccount(e.target.value)} placeholder="Our account with them" style={IS}/></div>
        <div><label style={LS}>Date</label><input type="date" value={rfqDate} onChange={e=>setRfqDate(e.target.value)} style={IS}/></div>
        <div><label style={LS}>Prepared By</label><input value={preparedBy} onChange={e=>setPreparedBy(e.target.value)} style={IS}/></div>
        {!isEdit&&<div><label style={LS}>Reference Tag <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>optional</span></label><input value={descriptor} onChange={e=>setDescriptor(e.target.value)} placeholder="e.g. MSRB2-Motors" style={IS}/></div>}
      </div>
      {!isEdit&&<div style={{fontSize:10,color:B.textDim,marginTop:-4}}>RFQ number: <span style={{fontFamily:M,color:B.cyan}}>3C-RFQ-{descriptor.trim()?descriptor.trim().replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,""):"####"}</span> (auto-numbered if left blank)</div>}

      <div><label style={LS}>Intro / Request Text</label><textarea value={introText} onChange={e=>setIntroText(e.target.value)} placeholder="Greeting + what's requested. Note 'exact replacement' or 'equivalent accepted' as applicable." style={{...IS,minHeight:64,resize:"vertical"}}/></div>

      {/* Line items */}
      <div>
        <label style={LS}>Requested Items <span style={{color:B.red}}>*</span></label>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {items.map((it,idx)=><div key={idx} style={{display:"grid",gridTemplateColumns:"1.4fr 0.6fr 1fr 1.6fr 28px",gap:6,alignItems:"center"}}>
            <input value={it.item} onChange={e=>setItem(idx,"item",e.target.value)} placeholder="Item" style={{...IS,padding:"8px 10px",fontSize:12}}/>
            <input value={it.qty} onChange={e=>setItem(idx,"qty",e.target.value)} type="number" step="any" placeholder="Qty" style={{...IS,padding:"8px 10px",fontSize:12,fontFamily:M}}/>
            <input value={it.part_no} onChange={e=>setItem(idx,"part_no",e.target.value)} placeholder="Part No." style={{...IS,padding:"8px 10px",fontSize:12}}/>
            <input value={it.description} onChange={e=>setItem(idx,"description",e.target.value)} placeholder="Description" style={{...IS,padding:"8px 10px",fontSize:12}}/>
            <button onClick={()=>rmItem(idx)} title="Remove" style={{...BS,padding:"6px 0",minHeight:32,color:B.red,borderColor:B.red+"40"}}>✕</button>
          </div>)}
        </div>
        <button onClick={addItem} style={{...BS,marginTop:6,padding:"6px 14px",fontSize:11}}>+ Add Item</button>
        <div style={{fontSize:10,color:B.textDim,marginTop:4}}>Unit Price is intentionally blank — it's what the vendor fills in.</div>
      </div>

      {/* Specs */}
      <div>
        <label style={LS}>Specifications <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>optional</span></label>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {specs.map((s,idx)=><div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 1.6fr 28px",gap:6,alignItems:"center"}}>
            <input value={s.label} onChange={e=>setSpec(idx,"label",e.target.value)} placeholder="Label" style={{...IS,padding:"8px 10px",fontSize:12}}/>
            <input value={s.value} onChange={e=>setSpec(idx,"value",e.target.value)} placeholder="Value" style={{...IS,padding:"8px 10px",fontSize:12}}/>
            <button onClick={()=>rmSpec(idx)} title="Remove" style={{...BS,padding:"6px 0",minHeight:32,color:B.red,borderColor:B.red+"40"}}>✕</button>
          </div>)}
        </div>
        <button onClick={addSpec} style={{...BS,marginTop:6,padding:"6px 14px",fontSize:11}}>+ Add Spec</button>
      </div>

      <div><label style={LS}>Notes <span style={{color:B.textDim,fontWeight:400,fontSize:9}}>one per line</span></label><textarea value={notesText} onChange={e=>setNotesText(e.target.value)} placeholder={"Tag parts with our account\nRequest lead time on backordered items"} style={{...IS,minHeight:56,resize:"vertical"}}/></div>

      <div style={{display:"flex",gap:8,marginTop:4}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":isEdit?"Save Changes":"Create RFQ"}</button></div>
    </div>
  </Modal>);
}

// ── Manager review & send ─────────────────────────────────────
function ReviewSendModal({rfq,onClose,onApprove,onSend,onRegenerate,msg}){
  const[items,setItems]=useState(null);      // base items (with price) loaded for managers
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState("");
  const url=docxUrl(rfq);

  React.useEffect(()=>{let active=true;(async()=>{
    const{data,error}=await sb().from("rfq_items").select("*").eq("rfq_id",rfq.id).order("line_no",{ascending:true});
    if(active){if(error)console.warn("rfq_items load:",error.message);setItems(data||[]);setLoading(false);}
  })();return()=>{active=false;};},[rfq.id]);

  const approve=async()=>{setBusy("approve");try{await onApprove(rfq);msg&&msg("Approved — ready to send");}finally{setBusy("");}};
  const send=async()=>{setBusy("send");try{const r=await onSend(rfq);if(r&&r.ok){msg&&msg("RFQ sent to "+rfq.vendor_email);onClose();}}finally{setBusy("");}};
  const regen=async()=>{setBusy("regen");try{await onRegenerate(rfq);msg&&msg("Document regenerated");}finally{setBusy("");}};

  const approved=!!rfq.approved_by||rfq.status==="pending_approval"||rfq.status==="sent";
  return(<Modal title={"Review & Send — "+(rfq.rfq_ref||"")} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><span style={LS}>Vendor</span><div style={{fontSize:13,color:B.text,fontWeight:600}}>{rfq.to_vendor||"—"}</div></div>
        <div><span style={LS}>Vendor Email</span><div style={{fontSize:13,color:rfq.vendor_email?B.text:B.red,fontWeight:600}}>{rfq.vendor_email||"⚠ none — required to send"}</div></div>
        <div><span style={LS}>Account</span><div style={{fontSize:13,color:B.text}}>{rfq.account||"—"}</div></div>
        <div><span style={LS}>Date</span><div style={{fontSize:13,color:B.text}}>{rfq.rfq_date?fmtDate(rfq.rfq_date):"—"}</div></div>
      </div>

      {/* Document */}
      <div style={{background:B.bg,border:"1px solid "+B.border,borderRadius:8,padding:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:12,color:B.textMuted}}>{url?"📄 RFQ document ready":"No document generated yet"}</div>
        <div style={{display:"flex",gap:8}}>
          {url&&<a href={url} target="_blank" rel="noreferrer" style={{...BS,textDecoration:"none",padding:"8px 14px",fontSize:12}}>Preview / Download</a>}
          <button onClick={regen} disabled={busy==="regen"} style={{...BS,padding:"8px 14px",fontSize:12,opacity:busy==="regen"?.6:1}}>{busy==="regen"?"Working...":"Regenerate"}</button>
        </div>
      </div>

      {/* Items with vendor quote entry (manager only) */}
      <div>
        <span style={LS}>Line Items {rfq.status==="sent"||rfq.status==="quoted"?"— record vendor's unit prices below":""}</span>
        {loading?<Spinner/>:<div style={{border:"1px solid "+B.border,borderRadius:8,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.5fr 1fr 1.8fr 1fr",gap:0,background:B.surfaceActive,padding:"6px 10px",fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase"}}>
            <div>Item</div><div>Qty</div><div>Part No.</div><div>Description</div><div style={{textAlign:"right"}}>Unit Price</div>
          </div>
          {(items||[]).map((it)=><ItemPriceRow key={it.id} it={it} msg={msg}/>)}
          {(items||[]).length===0&&<div style={{padding:12,fontSize:12,color:B.textDim,textAlign:"center"}}>No items.</div>}
        </div>}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
        {!approved&&<button onClick={approve} disabled={busy==="approve"} style={{...BP,background:B.green,opacity:busy==="approve"?.6:1}}>{busy==="approve"?"Approving...":"Approve"}</button>}
        <button onClick={send} disabled={!approved||!rfq.vendor_email||!url||busy==="send"||rfq.status==="sent"} style={{...BP,opacity:(!approved||!rfq.vendor_email||!url||busy==="send"||rfq.status==="sent")?.5:1}}>{busy==="send"?"Sending...":rfq.status==="sent"?"Already Sent":"Send to Vendor"}</button>
      </div>
      {!approved&&<div style={{fontSize:10,color:B.textDim,textAlign:"right"}}>Approve stamps you as approver, then the Send button emails the vendor.</div>}
    </div>
  </Modal>);
}

// Single editable price row — saves the vendor's quote to the base rfq_items table.
function ItemPriceRow({it,msg}){
  const[price,setPrice]=useState(it.unit_price!=null?String(it.unit_price):"");
  const[saving,setSaving]=useState(false);
  const save=async()=>{
    const v=price===""?null:parseFloat(price);
    if(v!=null&&(isNaN(v)||v<0)){alert("Enter a valid price.");return;}
    setSaving(true);
    const{error}=await sb().from("rfq_items").update({unit_price:v}).eq("id",it.id);
    setSaving(false);
    if(error){alert("Failed to save price: "+error.message);return;}
    msg&&msg("Price saved");
  };
  return(<div style={{display:"grid",gridTemplateColumns:"1.4fr 0.5fr 1fr 1.8fr 1fr",gap:0,padding:"6px 10px",borderTop:"1px solid "+B.border,alignItems:"center",fontSize:12}}>
    <div style={{color:B.text}}>{it.item||"—"}</div>
    <div style={{fontFamily:M,color:B.textMuted}}>{it.qty??""}</div>
    <div style={{color:B.textMuted}}>{it.part_no||""}</div>
    <div style={{color:B.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.description||""}</div>
    <div style={{display:"flex",gap:4,alignItems:"center",justifyContent:"flex-end"}}>
      <input value={price} onChange={e=>setPrice(e.target.value)} onBlur={save} type="number" step="0.01" placeholder="—" style={{...IS,width:78,padding:"6px 8px",fontSize:12,fontFamily:M,textAlign:"right"}}/>
      {saving&&<span style={{fontSize:9,color:B.cyan}}>…</span>}
    </div>
  </div>);
}

// ── Dashboard ─────────────────────────────────────────────────
function RFQDashboard({D,A,userRole,userName,userId}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const rfqs=D.rfqs||[];const rfqItems=D.rfqItems||[];
  const[showCreate,setShowCreate]=useState(false);
  const[editing,setEditing]=useState(null);
  const[review,setReview]=useState(null);
  const[filter,setFilter]=useState("all");
  const[toast,setToast]=useState("");
  const[confirmDelete,setConfirmDelete]=useState(null);
  const msg=(m)=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const SM=statusMeta();

  // Techs only see their own RFQs client-side too (RLS already enforces it).
  const visible=isMgr?rfqs:rfqs.filter(r=>r.created_by===userId||r.prepared_by===userName);
  const flt=filter==="all"?visible:visible.filter(r=>r.status===filter);
  const itemCount=(id)=>rfqItems.filter(i=>i.rfq_id===id).length;

  const openReview=async(rfq)=>{if(!rfq.docx_path){await A.regenerateRFQDocx(rfq);}setReview(rfq);};

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"flex-start"}}>
      <StatCard label="Total RFQs" value={visible.length} icon="📨" color={B.cyan}/>
      <StatCard label="Draft" value={visible.filter(r=>r.status==="draft").length} icon="📝" color={B.textDim}/>
      <StatCard label="Pending" value={visible.filter(r=>r.status==="pending_approval").length} icon="⏳" color={B.orange}/>
      <StatCard label="Sent" value={visible.filter(r=>r.status==="sent").length} icon="📤" color={B.green}/>
      <button onClick={()=>setShowCreate(true)} style={{...BP,padding:"10px 18px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",marginLeft:"auto"}}>+ New RFQ</button>
    </div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["all","All"],["draft","Draft"],["pending_approval","Pending"],["sent","Sent"],["quoted","Quoted"],["closed","Closed"]].map(([k,l])=>
        <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
    </div>

    {flt.length===0?<EmptyState icon="📨" title="No RFQs yet" subtitle="Create a request for quotation to send part pricing requests to a vendor."/>:
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.map(rfq=>{const sm=SM[rfq.status]||{c:B.textDim,l:rfq.status};const url=docxUrl(rfq);const canEditDraft=rfq.status==="draft"&&(isMgr||rfq.created_by===userId);return(
        <Card key={rfq.id} style={{padding:"14px 16px",borderLeft:"3px solid "+sm.c}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontFamily:M,fontWeight:800,fontSize:14,color:B.text}}>{rfq.rfq_ref}</span>
                <Badge color={sm.c}>{sm.l}</Badge>
                <span style={{fontSize:11,color:B.textDim}}>{itemCount(rfq.id)} item{itemCount(rfq.id)!==1?"s":""}</span>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{rfq.to_vendor||"—"}{rfq.account?" · "+rfq.account:""}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>{rfq.rfq_date?fmtDate(rfq.rfq_date):"No date"}{rfq.vendor_email?" · "+rfq.vendor_email:""}{rfq.sent_at?" · sent "+fmtDate(rfq.sent_at.slice(0,10)):""}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
              {url&&<a href={url} target="_blank" rel="noreferrer" style={{...BS,textDecoration:"none",padding:"8px 12px",fontSize:11,minHeight:36,display:"inline-flex",alignItems:"center"}}>📄 Doc</a>}
              {canEditDraft&&<button onClick={()=>setEditing(rfq)} style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36}}>Edit</button>}
              {isMgr&&<button onClick={()=>openReview(rfq)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36}}>Review &amp; Send</button>}
              {(isMgr||canEditDraft)&&<button onClick={()=>setConfirmDelete(rfq)} style={{...BS,padding:"8px 12px",fontSize:12,minHeight:36,color:B.red,borderColor:B.red+"40"}}>✕</button>}
            </div>
          </div>
        </Card>);})}
    </div>}

    {showCreate&&<RFQForm signerName={userName} onClose={()=>setShowCreate(false)} onSave={async(payload)=>{await A.createRFQ(payload);msg("RFQ created");haptic(40);}}/>}
    {editing&&<RFQForm initial={{...editing,items:rfqItems.filter(i=>i.rfq_id===editing.id).sort((a,b)=>(a.line_no||0)-(b.line_no||0))}} signerName={userName} onClose={()=>setEditing(null)} onSave={async(payload)=>{await A.updateRFQ({...payload,id:editing.id});msg("RFQ updated");}}/>}
    {review&&<ReviewSendModal rfq={rfqs.find(r=>r.id===review.id)||review} onClose={()=>setReview(null)} onApprove={A.approveRFQ} onSend={A.sendRFQ} onRegenerate={A.regenerateRFQDocx} msg={msg}/>}
    {confirmDelete&&<Modal title="Delete RFQ?" onClose={()=>setConfirmDelete(null)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>Delete {confirmDelete.rfq_ref}?</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This removes the RFQ and its line items. This cannot be undone.</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setConfirmDelete(null)} style={{...BS,flex:1}}>Cancel</button><button onClick={async()=>{await A.deleteRFQ(confirmDelete.id);setConfirmDelete(null);msg("RFQ deleted");}} style={{...BP,flex:1,background:B.red}}>Delete</button></div>
      </div>
    </Modal>}
  </div>);
}

export { RFQDashboard };
