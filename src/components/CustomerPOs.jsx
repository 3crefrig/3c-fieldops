import React, { useState } from "react";
import { sb, B, F, M, IS, LS, BP, BS, todayLocal, localDateStr, fmtDate } from "../shared";
import { Badge, Modal } from "./ui";

// Customer purchase orders — the master list of every PO number a customer has
// issued to 3C (retainers, blanket/fiscal-year POs, project POs, one-offs).
// Feeds the PO picker in the invoice generator. Table: customer_pos.

export const PO_KINDS={retainer:"Retainer",blanket:"Blanket",project:"Project",one_time:"One-time"};
const kindColor=(k)=>k==="retainer"?B.green:k==="project"?B.cyan:k==="blanket"?B.orange:B.textDim;

export const fmtMoney=(n)=>"$"+(parseFloat(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

// Dollars already billed against a saved PO. Old invoices (before customer_po_id
// existed) count when their printed PO number matches, so balances are right
// from day one.
export function poUsage(po,invoices){
  const num=(po.po_number||"").trim();
  const used=(invoices||[]).filter(i=>i.customer_po_id===po.id||(!i.customer_po_id&&i.customer===po.customer_name&&(i.po_number||"").trim()===num)).reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
  const authorized=po.amount==null||po.amount===""?null:parseFloat(po.amount);
  return{used,authorized,remaining:authorized==null?null:authorized-used};
}
export function poIsLive(po,today){
  const t=today||todayLocal();
  if(po.status&&po.status!=="active")return false;
  if(po.end_date&&po.end_date<t)return false;
  if(po.start_date&&po.start_date>t)return false;
  return true;
}
// Days of warning before a PO expires (6 weeks — the lead most AP departments
// need to cut a renewal) and the balance thresholds the daily sweep alerts on.
export const PO_EXPIRY_WARN_DAYS=42;
export function poRequiredFor(customer){return!!(customer&&customer.invoice_settings&&customer.invoice_settings.po_required);}
// True when a live PO is about to expire or is nearly/fully used — drives the
// orange "needs attention" count on the customer card.
export function poNeedsAttention(po,invoices,today){
  if(po.status==="closed")return false;
  const t=today||todayLocal();
  if(po.end_date){const warn=new Date(t+"T00:00:00");warn.setDate(warn.getDate()+PO_EXPIRY_WARN_DAYS);if(po.end_date<=localDateStr(warn))return true;}
  const{used,authorized}=poUsage(po,invoices);
  return authorized!=null&&authorized>0&&used/authorized>=0.9;
}
export function customerPOsFor(customerPOs,customerName){
  return(customerPOs||[]).filter(p=>p.customer_name===customerName).sort((a,b)=>(b.is_default?1:0)-(a.is_default?1:0)||(b.created_at||"").localeCompare(a.created_at||""));
}

// Single write path used by the Customers tab, the invoice picker's inline add,
// and the project screen. Keeps one default per customer and mirrors a
// project-linked PO back onto projects.customer_po (the project screen's cache).
export async function saveCustomerPO(po,{id,userName}={}){
  const row={customer_id:po.customer_id||null,customer_name:po.customer_name||"",po_number:(po.po_number||"").trim(),label:(po.label||"").trim()||null,kind:PO_KINDS[po.kind]?po.kind:"blanket",amount:po.amount==null||po.amount===""?null:(parseFloat(po.amount)||0),start_date:po.start_date||null,end_date:po.end_date||null,project_id:po.project_id||null,is_default:!!po.is_default,status:po.status==="closed"?"closed":"active",notes:(po.notes||"").trim()||null,updated_at:new Date().toISOString()};
  if(!row.po_number)throw new Error("PO number is required");
  if(!row.customer_name)throw new Error("Customer is required");
  // Same number saved twice for one customer is almost always a mistake (and would
  // split the balance tracking). Case/space-insensitive.
  const norm=(v)=>(v||"").replace(/\s+/g,"").toLowerCase();
  {const{data:dups}=await sb().from("customer_pos").select("id,po_number").eq("customer_name",row.customer_name);
    if((dups||[]).some(d=>d.id!==id&&norm(d.po_number)===norm(row.po_number)))throw new Error("PO "+row.po_number+" is already saved for "+row.customer_name+" — edit that one instead.");}
  if(row.is_default){const{error}=await sb().from("customer_pos").update({is_default:false}).eq("customer_name",row.customer_name).eq("is_default",true);if(error)throw error;}
  let saved;
  if(id){
    // A raised amount or a pushed-out expiry means the sweep's "90% used" /
    // "expiring" alerts should be allowed to fire again.
    const{data:old}=await sb().from("customer_pos").select("amount,end_date").eq("id",id).maybeSingle();
    if(old&&(String(old.amount==null?"":old.amount)!==String(row.amount==null?"":row.amount)||(old.end_date||"")!==(row.end_date||"")))row.alert_flags={};
    const{data,error}=await sb().from("customer_pos").update(row).eq("id",id).select("*").single();if(error)throw error;saved=data;}
  else{const{data,error}=await sb().from("customer_pos").insert({...row,created_by:userName||null}).select("*").single();if(error)throw error;saved=data;}
  if(saved.project_id){await sb().from("projects").update({customer_po:saved.status==="active"?saved.po_number:null}).eq("id",saved.project_id);}
  return saved;
}
export async function deleteCustomerPO(po){
  if(po.project_id)await sb().from("projects").update({customer_po:null}).eq("id",po.project_id);
  const{error}=await sb().from("customer_pos").delete().eq("id",po.id);if(error)throw error;
}
const friendlyErr=(e)=>{const m=(e&&e.message)||String(e);if(/customer_pos_project_uniq/.test(m))return"That project already has a saved PO — edit that one instead.";return m;};

// ---- Form (modal body) ----
export function CustomerPOForm({customerName,customerId,projects,initial,onSaved,onCancel,userName}){
  const init=initial||{};
  const renewing=!!init._renewFrom;
  const[poNumber,setPoNumber]=useState(init.po_number||"");
  const[label,setLabel]=useState(init.label||"");
  const[kind,setKind]=useState(init.kind||"blanket");
  const[amount,setAmount]=useState(init.amount==null?"":String(init.amount));
  const[startDate,setStartDate]=useState(init.start_date||"");
  const[endDate,setEndDate]=useState(init.end_date||"");
  const[projectId,setProjectId]=useState(init.project_id||"");
  const[isDefault,setIsDefault]=useState(!!init.is_default);
  const[notes,setNotes]=useState(init.notes||"");
  const[saving,setSaving]=useState(false),[err,setErr]=useState("");
  const custProjects=(projects||[]).filter(p=>p.customer===customerName);
  const save=async()=>{
    if(saving)return;setErr("");
    if(!poNumber.trim()){setErr("Enter the PO number.");return;}
    setSaving(true);
    try{
      const saved=await saveCustomerPO({customer_id:customerId||init.customer_id||null,customer_name:customerName,po_number:poNumber,label:label||(kind==="project"&&projectId?(custProjects.find(p=>p.id===projectId)||{}).name:""),kind,amount,start_date:startDate,end_date:endDate,project_id:kind==="project"?projectId:null,is_default:isDefault,status:init.status||"active",notes},{id:init.id,userName});
      // Renewal: the old PO closes once the replacement is saved.
      if(renewing){await sb().from("customer_pos").update({status:"closed",is_default:false,updated_at:new Date().toISOString()}).eq("id",init._renewFrom);}
      onSaved&&onSaved(saved);
    }catch(e){console.error(e);setErr(friendlyErr(e));}
    setSaving(false);
  };
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{fontSize:11,color:B.textDim}}>Customer: <strong style={{color:B.text}}>{customerName||"—"}</strong></div>
    {renewing&&<div style={{fontSize:11,color:B.text,padding:"8px 10px",background:B.cyan+"12",border:"1px solid "+B.cyan+"44",borderRadius:6}}>Renewing <span style={{fontFamily:M,fontWeight:700}}>{init._renewFromNumber}</span> — enter the new PO number the customer issued. The old one closes when you save; its invoices keep their printed number.</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div><label style={LS}>PO Number</label><input value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="4605021670" style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Type</label><select value={kind} onChange={e=>setKind(e.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(PO_KINDS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    </div>
    <div><label style={LS}>Label <span style={{color:B.textDim,fontWeight:400}}>(what it covers)</span></label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="SOM monthly retainer FY26" style={IS}/></div>
    {kind==="project"&&<div><label style={LS}>Project</label><select value={projectId} onChange={e=>setProjectId(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— none —</option>{custProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))",gap:12}}>
      <div><label style={LS}>Authorized $ <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" placeholder="tracks remaining" style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Start</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Expires</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={{...IS,fontFamily:M}}/></div>
    </div>
    <div onClick={()=>setIsDefault(!isDefault)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isDefault?B.cyan+"15":B.bg,border:"1px solid "+(isDefault?B.cyan:B.border),borderRadius:8,cursor:"pointer"}}>
      <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(isDefault?B.cyan:B.border),background:isDefault?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDefault&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}</div>
      <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>Default for this customer</div><div style={{fontSize:10.5,color:B.textDim}}>Pre-selected on new invoices unless a project PO or work-order number applies</div></div>
    </div>
    <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="AP contact, renewal reminders…" style={IS}/></div>
    {err&&<div style={{fontSize:11,color:B.red}}>{err}</div>}
    <div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={save} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(init.id?"Save":renewing?"Save renewal":"Add PO")}</button></div>
  </div>);
}

// ---- One PO as a ledger row ----
function PORow({po,invoices,onEdit,onToggleClose,onDelete,onSetDefault,onRenew}){
  const{used,authorized,remaining}=poUsage(po,invoices);
  const live=poIsLive(po);
  const expired=po.end_date&&po.end_date<todayLocal();
  const low=remaining!=null&&remaining<=0;
  const attention=live&&poNeedsAttention(po,invoices);
  const pct=authorized>0?Math.round(used/authorized*100):null;
  return(<div className="list-row" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,padding:"9px 0",borderBottom:"1px solid "+B.border,opacity:live?1:.6,flexWrap:"wrap"}}>
    <div style={{flex:1,minWidth:200}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.text}}>{po.po_number}</span>
        <Badge color={kindColor(po.kind)}>{PO_KINDS[po.kind]||po.kind}</Badge>
        {po.is_default&&<Badge color={B.cyan}>Default</Badge>}
        {po.status==="closed"&&<Badge color={B.textDim}>Closed</Badge>}
        {expired&&po.status!=="closed"&&<Badge color={B.red}>Expired</Badge>}
        {low&&po.status!=="closed"&&<Badge color={B.red}>Exhausted</Badge>}
        {attention&&!low&&!expired&&<Badge color={B.orange}>{pct!=null&&pct>=90?pct+"% used":"Expiring soon"}</Badge>}
      </div>
      {po.label&&<div style={{fontSize:12,color:B.text,marginTop:2}}>{po.label}</div>}
      <div style={{fontSize:11,color:B.textDim,marginTop:2,fontFamily:M}}>
        {authorized!=null?<span style={{color:low?B.red:B.textDim}}>{fmtMoney(remaining)} left of {fmtMoney(authorized)}</span>:<span>{fmtMoney(used)} billed</span>}
        {(po.start_date||po.end_date)&&<span> · {po.start_date?fmtDate(po.start_date):"…"} → {po.end_date?fmtDate(po.end_date):"open"}</span>}
      </div>
      {po.notes&&<div style={{fontSize:10.5,color:B.textDim,marginTop:2,fontStyle:"italic"}}>{po.notes}</div>}
    </div>
    <div style={{display:"flex",gap:4,flexWrap:"wrap",maxWidth:"100%"}}>
      {(po.end_date||low)&&po.kind!=="project"&&<button onClick={()=>onRenew(po)} title="Save the replacement PO and close this one" style={{background:"none",border:"1px solid "+(attention||expired||low?B.orange:B.border),color:attention||expired||low?B.orange:B.textDim,fontSize:11,padding:"6px 10px",minHeight:32,borderRadius:6,cursor:"pointer",fontFamily:F,fontWeight:600}}>Renew</button>}
      {!po.is_default&&po.status!=="closed"&&<button onClick={()=>onSetDefault(po)} title="Pre-select on new invoices" style={{background:"none",border:"1px solid "+B.border,color:B.textDim,fontSize:11,padding:"6px 10px",minHeight:32,borderRadius:6,cursor:"pointer",fontFamily:F,fontWeight:600}}>Set default</button>}
      <button onClick={()=>onEdit(po)} style={{background:"none",border:"1px solid "+B.border,color:B.textDim,fontSize:11,padding:"6px 10px",minHeight:32,borderRadius:6,cursor:"pointer",fontFamily:F,fontWeight:600}}>Edit</button>
      <button onClick={()=>onToggleClose(po)} style={{background:"none",border:"1px solid "+B.border,color:B.textDim,fontSize:11,padding:"6px 10px",minHeight:32,borderRadius:6,cursor:"pointer",fontFamily:F,fontWeight:600}}>{po.status==="closed"?"Reopen":"Close"}</button>
      <button onClick={()=>onDelete(po)} title="Delete" style={{background:"none",border:"1px solid "+B.red+"55",color:B.red+"cc",fontSize:11,padding:"6px 10px",minHeight:32,borderRadius:6,cursor:"pointer",fontFamily:F,fontWeight:600}}>×</button>
    </div>
  </div>);
}

// ---- List + add/edit, used on the Customers tab ----
export function CustomerPOList({customer,customerPOs,invoices,projects,userName,onChanged,msg}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[showClosed,setShowClosed]=useState(false);
  const all=customerPOsFor(customerPOs,customer.name);
  const open=all.filter(p=>p.status!=="closed"),closed=all.filter(p=>p.status==="closed");
  const say=(m)=>msg&&msg(m);
  const refresh=()=>onChanged&&onChanged();
  const toggleClose=async(po)=>{try{await saveCustomerPO({...po,status:po.status==="closed"?"active":"closed",is_default:po.status==="closed"?po.is_default:false},{id:po.id,userName});refresh();say(po.status==="closed"?"PO reopened":"PO closed");}catch(e){say("Failed: "+friendlyErr(e));}};
  const setDefault=async(po)=>{try{await saveCustomerPO({...po,is_default:true},{id:po.id,userName});refresh();say(po.po_number+" is now the default");}catch(e){say("Failed: "+friendlyErr(e));}};
  const del=async(po)=>{if(!window.confirm("Delete PO "+po.po_number+"? Invoices keep their printed PO number; only the saved entry goes away."))return;try{await deleteCustomerPO(po);refresh();say("PO deleted");}catch(e){say("Failed: "+friendlyErr(e));}};
  // Renewal pre-fills everything but the number: same kind/label/amount, dates
  // rolled forward by the old PO's term (default one year), default flag carried over.
  const renew=(po)=>{
    const addDays=(d,n)=>{const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return localDateStr(x);};
    const termDays=po.start_date&&po.end_date?Math.max(1,Math.round((new Date(po.end_date+"T00:00:00")-new Date(po.start_date+"T00:00:00"))/86400000)+1):365;
    const start=po.end_date?addDays(po.end_date,1):todayLocal();
    setEditing({_renewFrom:po.id,_renewFromNumber:po.po_number,customer_id:po.customer_id,kind:po.kind,label:po.label,amount:po.amount,start_date:start,end_date:po.end_date?addDays(start,termDays-1):"",is_default:po.is_default,notes:po.notes});
    setShowForm(true);
  };
  return(<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+B.border}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
      <div style={{fontSize:11,fontWeight:700,color:B.textMuted,textTransform:"uppercase",letterSpacing:0.5}}>Purchase Orders</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {closed.length>0&&<button onClick={()=>setShowClosed(!showClosed)} style={{...BS,fontSize:11,padding:"6px 10px"}}>{showClosed?"Hide closed":"Show closed ("+closed.length+")"}</button>}
        <button onClick={()=>{setEditing(null);setShowForm(true);}} style={{...BP,fontSize:11,padding:"6px 12px"}}>+ Add PO</button>
      </div>
    </div>
    {open.length===0&&<div style={{fontSize:11,color:B.textDim,padding:"6px 0"}}>No saved POs. Add the customer's retainer, blanket, or project PO numbers so they show in the invoice dropdown.</div>}
    {open.map(po=><PORow key={po.id} po={po} invoices={invoices} onEdit={(p)=>{setEditing(p);setShowForm(true);}} onToggleClose={toggleClose} onDelete={del} onSetDefault={setDefault} onRenew={renew}/>)}
    {showClosed&&closed.map(po=><PORow key={po.id} po={po} invoices={invoices} onEdit={(p)=>{setEditing(p);setShowForm(true);}} onToggleClose={toggleClose} onDelete={del} onSetDefault={setDefault} onRenew={renew}/>)}
    {showForm&&<Modal title={editing?(editing._renewFrom?"Renew Customer PO":"Edit Customer PO"):"Add Customer PO"} onClose={()=>setShowForm(false)}>
      <CustomerPOForm customerName={customer.name} customerId={customer.id} projects={projects} initial={editing} userName={userName} onCancel={()=>setShowForm(false)} onSaved={(s)=>{setShowForm(false);refresh();say(editing?(editing._renewFrom?"PO renewed — "+editing._renewFromNumber+" closed, "+s.po_number+" is live":"PO updated"):"PO "+s.po_number+" saved");}}/>
    </Modal>}
  </div>);
}

// ---- Picker used in the invoice generator and invoice edit form ----
// value: the PO text that prints on the invoice; poId: the saved row it came
// from (null when typed by hand). onChange(text, poId).
export function CustomerPOPicker({customerName,customerId,customerPOs,invoices,projects,value,poId,onChange,invoiceTotal,userName,onPOsChanged,excludeInvoiceId,required,label}){
  const[showAdd,setShowAdd]=useState(false);
  const all=customerPOsFor(customerPOs,customerName);
  const live=all.filter(p=>poIsLive(p));
  const selected=poId?all.find(p=>p.id===poId):null;
  const options=selected&&!live.some(p=>p.id===selected.id)?[selected,...live]:live;
  const otherInvoices=(invoices||[]).filter(i=>i.id!==excludeInvoiceId);
  const usage=selected?poUsage(selected,otherInvoices):null;
  const total=parseFloat(invoiceTotal)||0;
  const overBudget=usage&&usage.remaining!=null&&total>usage.remaining;
  const expired=selected&&selected.end_date&&selected.end_date<todayLocal();
  const pick=(e)=>{const v=e.target.value;if(v==="__add"){setShowAdd(true);return;}if(v==="__custom"){onChange(poId?"":value,null);return;}const p=all.find(x=>x.id===v);if(p)onChange(p.po_number,p.id);};
  const optLabel=(p)=>{const u=poUsage(p,otherInvoices);return(p.label?p.label+" — ":"")+p.po_number+(u.remaining!=null?" ("+fmtMoney(u.remaining)+" left)":"")+(p.is_default?" (default)":"");};
  return(<div>
    <label style={LS}>{label||"PO Number"}{required&&<span style={{color:B.orange,fontWeight:400,textTransform:"none",letterSpacing:0}}> — required by this customer</span>}</label>
    {all.length>0||showAdd?<select value={poId||"__custom"} onChange={pick} style={{...IS,cursor:"pointer",fontFamily:M}}>
      {options.map(p=><option key={p.id} value={p.id}>{optLabel(p)}</option>)}
      <option value="__custom">Type a PO / WO# by hand…</option>
      <option value="__add">+ Save a new PO for {customerName||"this customer"}…</option>
    </select>:null}
    {!poId&&<div style={{display:"flex",gap:6,marginTop:all.length>0?6:0}}>
      <input value={value||""} onChange={e=>onChange(e.target.value,null)} placeholder="Customer WO# / PO#" style={{...IS,fontFamily:M,flex:1}}/>
      {all.length===0&&customerName&&<button type="button" onClick={()=>setShowAdd(true)} title="Save this as a reusable PO for the customer" style={{...BS,fontSize:11,padding:"6px 10px",whiteSpace:"nowrap"}}>Save as PO</button>}
    </div>}
    {required&&!(value||"").trim()&&<div style={{fontSize:11,color:B.orange,marginTop:6}}>{customerName||"This customer"} rejects invoices without a PO — pick one above or type it in before generating.</div>}
    {selected&&<div style={{fontSize:11,color:B.textDim,marginTop:6,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
      <Badge color={kindColor(selected.kind)}>{PO_KINDS[selected.kind]||selected.kind}</Badge>
      {usage.remaining!=null&&<span style={{fontFamily:M,color:overBudget?B.red:B.textDim}}>{fmtMoney(usage.remaining)} left of {fmtMoney(usage.authorized)}{overBudget&&" — this invoice exceeds it"}</span>}
      {selected.end_date&&<span style={{color:expired?B.red:B.textDim}}>{expired?"Expired ":"Expires "}{fmtDate(selected.end_date)}</span>}
      {selected.notes&&<span style={{fontStyle:"italic"}}>{selected.notes}</span>}
    </div>}
    {showAdd&&<Modal title={"Save PO for "+(customerName||"customer")} onClose={()=>setShowAdd(false)}>
      <CustomerPOForm customerName={customerName} customerId={customerId} projects={projects} initial={{po_number:!poId?(value||""):""}} userName={userName} onCancel={()=>setShowAdd(false)} onSaved={(s)=>{setShowAdd(false);onChange(s.po_number,s.id);onPOsChanged&&onPOsChanged(s);}}/>
    </Modal>}
  </div>);
}
