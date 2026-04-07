import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PC, SC, SL, PSC, PSL, ROLES, haptic, cleanText, autoCorrect, sanitizeHTML, calcWOHours, genPO, genProjectPO } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, SkeletonLoader, EmptyState, CustomSelect, DSBadge, VoiceInput } from "./ui";
import { SignaturePad } from "./SignaturePad";
import { CameraUpload, PhotoTimeline } from "./CameraUpload";
import { ActivityLog } from "./ActivityLog";
import { POReqModal } from "./PurchaseOrders";
import { EquipmentPicker, EQ_LABELS } from "./Equipment";

function WODetail({wo,onBack,onUpdateWO,onDeleteWO,onCreateWO,canEdit,pos,onCreatePO,timeEntries,onAddTime,onUpdateTime,onDeleteTime,photos,onAddPhoto,users,userName,userRole,loadData,equipment,lineItems}){
  const D_equipment=equipment||[];
  const[showTime,setShowTime]=useState(false),[showPO,setShowPO]=useState(false),[showComplete,setShowComplete]=useState(false),[editingTime,setEditingTime]=useState(null),[completeStep,setCompleteStep]=useState(1),[showReceipt,setShowReceipt]=useState(false),[receiptData,setReceiptData]=useState(null),[scanningReceipt,setScanningReceipt]=useState(false),[showTroubleshoot,setShowTroubleshoot]=useState(false);
  const[jobIntel,setJobIntel]=useState(null),[intelLoading,setIntelLoading]=useState(false),[intelOpen,setIntelOpen]=useState(false);
  const[partsPred,setPartsPred]=useState(null),[partsLoading,setPartsLoading]=useState(false);
  const[localCustWO,setLocalCustWO]=useState(wo.customer_wo||"");
  const[showFollowUp,setShowFollowUp]=useState(false),[fuNotes,setFuNotes]=useState("");
  const[showEdit,setShowEdit]=useState(false),[editWO,setEditWO]=useState({});
  const openEditWO=()=>{setEditWO({title:wo.title||"",notes:wo.notes||"",location:wo.location||"",building:wo.building||"",assignee:wo.assignee||"Unassigned",customer:wo.customer||"",due_date:wo.due_date||"",crew:wo.crew||[]});setShowEdit(true);};
  const saveEditWO=async()=>{if(saving)return;setSaving(true);await onUpdateWO({...wo,...editWO,title:autoCorrect(editWO.title),notes:autoCorrect(editWO.notes),location:autoCorrect(editWO.location)});setSaving(false);setShowEdit(false);msg("Work order updated");};
  const[tH,setTH]=useState(""),[tD,setTD]=useState(""),[tDate,setTDate]=useState(new Date().toISOString().slice(0,10)),[note,setNote]=useState("");
  const[cmpH,setCmpH]=useState(""),[cmpD,setCmpD]=useState(""),[cmpDate,setCmpDate]=useState(new Date().toISOString().slice(0,10));
  const[workPerformed,setWorkPerformed]=useState("");
  const[toast,setToast]=useState(""),[saving,setSaving]=useState(false);
  const[sigCanvas,setSigCanvas]=useState(null),[sigErr,setSigErr]=useState(""),[compDate,setCompDate]=useState(new Date().toISOString().slice(0,10));
  const[showDetails,setShowDetails]=useState(false),[showTimeEntries,setShowTimeEntries]=useState(false),[showLineItems,setShowLineItems]=useState(false),[showPhotos,setShowPhotos]=useState(false),[showPOs,setShowPOs]=useState(false);
  const[liDesc,setLiDesc]=useState(""),[liAmt,setLiAmt]=useState(""),[addingLI,setAddingLI]=useState(false),[savingLI,setSavingLI]=useState(false);
  const isProjectWO=!!wo.project_id;
  const woLineItems=(lineItems||[]).filter(li=>li.wo_id===wo.id);
  const lineItemsTotal=woLineItems.reduce((s,li)=>s+parseFloat(li.amount||0),0);
  const addLineItem=async()=>{if(!liDesc.trim()||!liAmt||savingLI)return;setSavingLI(true);
    await sb().from("wo_line_items").insert({wo_id:wo.id,description:liDesc.trim(),amount:parseFloat(liAmt)||0,sort_order:woLineItems.length});
    setLiDesc("");setLiAmt("");setAddingLI(false);setSavingLI(false);if(loadData)loadData();msg("Line item added");};
  const deleteLineItem=async(id)=>{await sb().from("wo_line_items").delete().eq("id",id);if(loadData)loadData();msg("Line item removed");};
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const woPOs=pos.filter(p=>p.wo_id===wo.id);const woTime=timeEntries.filter(t=>t.wo_id===wo.id);const woPhotos=photos.filter(p=>p.wo_id===wo.id);
  const woHrs=woTime.reduce((s,t)=>s+parseFloat(t.hours||0),0);
  const hasData=woTime.length>0||woPOs.length>0||woPhotos.length>0||(wo.notes&&wo.notes.trim()&&wo.notes!=="No details.")||woHrs>0;
  const isManager=userRole==="admin"||userRole==="manager";
  const canEditTime=(te)=>isManager||te.technician===userName;
  const addTime=async()=>{const h=parseFloat(tH);if(!h||h<=0||!tD.trim()||saving)return;if(cleanText(tD,"Time Description")===null)return;setSaving(true);await onAddTime({wo_id:wo.id,hours:h,description:tD.trim(),logged_date:tDate});setSaving(false);setTH("");setTD("");setShowTime(false);msg("Logged "+h+"h");};
  const saveTimeEdit=async()=>{if(!editingTime||saving)return;const h=parseFloat(editingTime.hours);if(!h||h<=0)return;setSaving(true);await onUpdateTime(editingTime);setSaving(false);setEditingTime(null);msg("Time entry updated");};
  const deleteTimeEntry=async(te)=>{if(saving)return;if(!window.confirm("Delete this time entry ("+te.hours+"h)?"))return;setSaving(true);await onDeleteTime(te.id);setSaving(false);msg("Time entry deleted");};
  const addFieldNote=async()=>{if(!note.trim()||saving)return;if(cleanText(note,"Field Note")===null)return;setSaving(true);const ts=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});const newNotes=(wo.field_notes||"")+"\n["+ts+" — "+userName+"] "+note.trim();const{error}=await sb().from("work_orders").update({field_notes:newNotes}).eq("id",wo.id);if(error)console.error("field note error:",error);await loadData();setSaving(false);setNote("");msg("Field note added");};
  const[editingDetails,setEditingDetails]=useState(false),[detailsText,setDetailsText]=useState(wo.notes||"");
  const saveDetails=async()=>{if(saving)return;setSaving(true);const{error}=await sb().from("work_orders").update({notes:detailsText}).eq("id",wo.id);if(error)console.error("save details error:",error);await loadData();setSaving(false);setEditingDetails(false);msg("Job details updated");};
  const changeStatus=async(newStatus)=>{if(saving)return;if(newStatus==="completed"){openCompleteFlow();return;}setSaving(true);await onUpdateWO({...wo,status:newStatus});setSaving(false);msg("Status → "+SL[newStatus]);};
  const getAutoWorkPerformed=()=>{const descs=woTime.map(t=>t.description).filter(Boolean);const unique=[...new Set(descs)];return wo.work_performed||unique.join(". ")||"";};
  const openCompleteFlow=()=>{setSigErr("");setCmpH("");setCmpD("");setCmpDate(new Date().toISOString().slice(0,10));setCompDate(new Date().toISOString().slice(0,10));setWorkPerformed(getAutoWorkPerformed());
    // Project WOs with line items can skip time entry — go straight to review & sign
    const hasLineItems=isProjectWO&&woLineItems.length>0;
    setCompleteStep((woTime.length>0||hasLineItems)?2:1);setShowComplete(true);};
  const logTimeAndContinue=async()=>{const h=parseFloat(cmpH);if(!h||h<=0||!cmpD.trim()){setSigErr("Enter hours and description first.");return;}if(cleanText(cmpD,"Description")===null)return;setSigErr("");setSaving(true);await onAddTime({wo_id:wo.id,hours:h,description:cmpD.trim(),logged_date:cmpDate});setSaving(false);if(!workPerformed)setWorkPerformed(cmpD.trim());setCompleteStep(2);msg("Time logged");};
  const markComplete=async()=>{if(saving)return;if(!compDate){setSigErr("Completion date required.");return;}if(!sigCanvas||!sigCanvas._getData||!sigCanvas._getData()){setSigErr("Signature required.");return;}if(workPerformed&&cleanText(workPerformed,"Work Performed")===null)return;setSigErr("");setSaving(true);await onUpdateWO({...wo,status:"completed",date_completed:compDate,signature:sigCanvas._getData(),work_performed:workPerformed.trim()||null});setSaving(false);setShowComplete(false);setShowFollowUp(true);msg("Completed & Signed");};
  const createFollowUp=async()=>{if(saving)return;if(cleanText(fuNotes,"Follow-up Notes")===null)return;setSaving(true);await onCreateWO({title:"Follow-up: "+wo.title,priority:wo.priority,assignee:wo.assignee,due_date:"TBD",notes:"Follow-up from "+wo.wo_id+".\n"+fuNotes.trim(),location:wo.location||"",wo_type:"CM",building:wo.building||"",customer:wo.customer||"",customer_wo:"",crew:wo.crew||[]});setSaving(false);setShowFollowUp(false);setFuNotes("");msg("Follow-up WO created");};
  const tryDelete=async()=>{const msg2=hasData?"This work order has data. Are you SURE you want to delete "+wo.wo_id+"? This cannot be undone.":"Delete "+wo.wo_id+"? This cannot be undone.";if(!window.confirm(msg2))return;setSaving(true);const{error}=await sb().from("work_orders").delete().eq("id",wo.id);if(error){console.error("delete error:",error);setSaving(false);return;}await loadData();setSaving(false);onBack();};

  const BIG={padding:"14px 18px",borderRadius:8,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:48,display:"flex",alignItems:"center",justifyContent:"center",gap:8,flex:"1 1 0"};
  const SEC={...BIG,background:B.surface,border:"1px solid "+B.border,color:B.textMuted};
  const Toggle=({label,count,open,setOpen})=><button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"12px 14px",background:B.surface,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom:open?0:8}}><span style={{fontSize:13,fontWeight:700,color:B.text}}>{label}{count>0&&<span style={{marginLeft:6,fontFamily:M,color:B.cyan,fontSize:12}}>({count})</span>}</span><span style={{color:B.textDim,fontSize:14}}>{open?"▾":"▸"}</span></button>;

  return(<div><Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14,fontFamily:F,padding:"8px 0"}}>← Back to Orders</button>

    {/* HEADER — WO ID, title, customer, status */}
    <Card style={{maxWidth:640,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:M,fontSize:12,color:B.textDim}}>{wo.wo_id}</span><select value={wo.priority} onChange={async e=>{await onUpdateWO({...wo,priority:e.target.value});}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid "+(PC[wo.priority]||B.border)+"44",background:(PC[wo.priority]||B.textDim)+"22",color:PC[wo.priority]||B.textDim,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F,textTransform:"uppercase",appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select value={wo.wo_type||"CM"} onChange={async e=>{await onUpdateWO({...wo,wo_type:e.target.value});}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid "+((wo.wo_type==="PM"?B.cyan:B.orange))+"44",background:(wo.wo_type==="PM"?B.cyan:B.orange)+"22",color:wo.wo_type==="PM"?B.cyan:B.orange,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F,textTransform:"uppercase",appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}><option value="PM">PM</option><option value="CM">CM</option></select></div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}><h2 style={{margin:0,fontSize:20,fontWeight:800,color:B.text}}>{wo.title}</h2>{isManager&&<button onClick={openEditWO} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",padding:2,flexShrink:0}} title="Edit work order">✏️</button>}</div>{wo.customer&&<div style={{fontSize:12,color:B.purple,marginTop:4}}>👤 {wo.customer}{wo.customer_wo&&<span style={{fontFamily:M,color:B.textMuted,marginLeft:6,fontSize:11}}>WO# {wo.customer_wo}</span>}</div>}</div>
        <DSBadge ok={woPhotos.length>0}/>
      </div>
      {/* Status bar — big, tappable */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>{[["pending","Pending"],["in_progress","In Progress"],["completed","Completed"]].map(([k,l])=><button key={k} onClick={()=>changeStatus(k)} style={{flex:1,padding:"10px 6px",borderRadius:6,border:wo.status===k?"2px solid "+SC[k]:"1px solid "+B.border,background:wo.status===k?SC[k]+"22":"transparent",color:wo.status===k?SC[k]:B.textDim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>DUE</span><br/><span style={{fontWeight:700,color:B.text}}>{wo.due_date}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>HOURS</span><br/><span style={{fontWeight:700,color:B.cyan,fontFamily:M}}>{woHrs.toFixed(1)}h</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>LOCATION</span><br/><span style={{fontWeight:600,color:B.text}}>{wo.location||"—"}{wo.building&&" · Bldg "+wo.building}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>ASSIGNED</span><br/><span style={{fontWeight:600,color:B.text}}>{[wo.assignee,...(wo.crew||[])].filter(Boolean).filter(n=>n!=="Unassigned").join(", ")||"Unassigned"}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6,gridColumn:"1 / -1"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>CUSTOMER WO#</span><button onClick={async()=>{await sb().from("work_orders").update({tms_entered:!wo.tms_entered}).eq("id",wo.id);await loadData();}} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:0}}><div style={{width:16,height:16,borderRadius:3,border:"2px solid "+(wo.tms_entered?B.green:B.border),background:wo.tms_entered?B.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{wo.tms_entered&&<span style={{color:"#fff",fontSize:10}}>✓</span>}</div><span style={{fontSize:10,color:wo.tms_entered?B.green:B.textDim}}>Entered in TMS</span></button></div><input value={localCustWO} onChange={e=>setLocalCustWO(e.target.value)} onBlur={async()=>{if(localCustWO!==(wo.customer_wo||"")){await sb().from("work_orders").update({customer_wo:localCustWO}).eq("id",wo.id);await loadData();}}} placeholder="Enter customer WO# from their TMS" style={{background:"transparent",border:"none",color:B.text,fontWeight:600,fontSize:12,fontFamily:M,padding:"4px 0 0",width:"100%",outline:"none"}}/></div>
      </div>
      {wo.date_completed&&<div style={{marginTop:8,padding:"8px 10px",background:B.greenGlow,borderRadius:6,fontSize:12}}><span style={{color:B.green,fontWeight:700}}>✓ Completed {wo.date_completed}</span></div>}
      {wo.status==="completed"&&woTime.length>0&&<div style={{marginTop:8,padding:"10px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><span style={LS}>Completion Notes</span>{woTime.sort((a,b)=>(a.logged_date||"").localeCompare(b.logged_date||"")).map((t,i)=><div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:i<woTime.length-1?"1px solid "+B.border:"none"}}><span style={{fontFamily:M,fontSize:11,color:B.textDim,minWidth:75}}>{t.logged_date}</span><span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.cyan,minWidth:30}}>{t.hours}h</span><span style={{fontSize:12,color:B.text}}>{t.description||"—"}</span></div>)}{wo.work_performed&&<div style={{marginTop:6,padding:"6px 0",borderTop:"1px solid "+B.border,fontSize:12,color:B.textMuted,fontStyle:"italic"}}>{wo.work_performed}</div>}</div>}
    </Card>

    {/* Equipment link */}
    {(()=>{const eq=wo.equipment_id&&(D_equipment||[]).find(e=>e.id===wo.equipment_id);return eq?<Card style={{marginBottom:12,borderLeft:"3px solid "+B.purple}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><span style={LS}>Linked Equipment</span>
          <div style={{marginTop:4}}><span style={{fontWeight:700,color:B.text,fontSize:13}}>{eq.model||"Unknown"}</span>
            {eq.manufacturer&&<span style={{color:B.textDim,fontSize:11}}> — {eq.manufacturer}</span>}
          </div>
          <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>
            {eq.serial_number&&<span>SN: <span style={{fontFamily:M}}>{eq.serial_number}</span> · </span>}
            {eq.asset_tag&&<span>Tag: <span style={{fontFamily:M,color:B.cyan}}>{eq.asset_tag}</span> · </span>}
            {eq.refrigerant_type&&<span>{eq.refrigerant_type} · </span>}
            <span>{EQ_LABELS[eq.equipment_type]||eq.equipment_type}</span>
          </div>
        </div>
        <Badge color={B.purple}>Equipment</Badge>
      </div>
    </Card>:null;})()}

    {/* BIG ACTION BUTTONS — the main things a tech does */}
    {canEdit&&wo.status!=="completed"&&<div style={{display:"flex",gap:8,marginBottom:12,maxWidth:640}}>
      <button onClick={()=>setShowTime(true)} style={{...BIG,background:B.cyan,color:B.bg}}>⏱ Log Time</button>
      <button onClick={()=>document.getElementById("cam-upload")?.click()} style={{...BIG,background:B.surface,border:"1px solid "+B.cyan,color:B.cyan}}>📷 Photo</button>
      <button onClick={openCompleteFlow} style={{...BIG,background:B.green,color:B.bg}}>✓ Done</button>
    </div>}

    {/* AI Diagnose button — always available */}
    <div style={{maxWidth:640,marginBottom:12}}>
      <button onClick={()=>setShowTroubleshoot(true)} style={{...SEC,width:"100%",color:B.purple,borderColor:B.purple+"44"}}>AI Diagnose</button>
    </div>

    {/* Job Intelligence Card */}
    {wo.customer&&<div style={{maxWidth:640,marginBottom:12}}>
      <Card style={{borderLeft:"3px solid "+B.cyan,cursor:"pointer"}} onClick={async()=>{
        if(jobIntel){setIntelOpen(!intelOpen);return;}
        setIntelOpen(true);setIntelLoading(true);
        try{const resp=await fetch(SUPABASE_URL+"/functions/v1/job-intelligence",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({customer_name:wo.customer,location:wo.location||"",building:wo.building||"",equipment_id:wo.equipment_id||null,wo_title:wo.title})});
          const data=await resp.json();if(data.success)setJobIntel(data.result);else console.warn("Intel error:",data.error);
        }catch(e){console.error("Intel fetch error:",e);}setIntelLoading(false);
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🧠</span><span style={{fontSize:13,fontWeight:700,color:B.text}}>AI Job Brief</span></div>
          <span style={{fontSize:11,color:B.textDim}}>{intelOpen?"▼":"▶"} {intelLoading?"Loading...":jobIntel?"Tap to "+(intelOpen?"collapse":"expand"):"Tap to generate"}</span>
        </div>
        {intelOpen&&jobIntel&&<div style={{marginTop:12,borderTop:"1px solid "+B.border,paddingTop:12}}>
          <div style={{fontSize:12,color:B.textMuted,marginBottom:8}}>{jobIntel.summary}</div>
          {jobIntel.common_issues&&jobIntel.common_issues.length>0&&<div style={{marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase"}}>Common Issues</span>{jobIntel.common_issues.map((issue,i)=><div key={i} style={{fontSize:11,color:B.orange,marginTop:2}}>• {issue}</div>)}</div>}
          {jobIntel.parts_used_previously&&jobIntel.parts_used_previously.length>0&&<div style={{marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase"}}>Parts Used Before</span>{jobIntel.parts_used_previously.map((p,i)=><div key={i} style={{fontSize:11,color:B.text,marginTop:2}}>• {p.name}{p.frequency>1?" (×"+p.frequency+")":""}</div>)}</div>}
          {jobIntel.avg_duration_hours>0&&<div style={{fontSize:11,color:B.cyan,marginBottom:4}}>⏱ Avg duration: {jobIntel.avg_duration_hours.toFixed(1)}h</div>}
          {jobIntel.suggested_approach&&<div style={{fontSize:11,color:B.green,fontStyle:"italic"}}>💡 {jobIntel.suggested_approach}</div>}
          {jobIntel.customer_notes&&<div style={{fontSize:11,color:B.purple,marginTop:4}}>📝 {jobIntel.customer_notes}</div>}
        </div>}
        {intelOpen&&intelLoading&&<div style={{marginTop:12,textAlign:"center",padding:12}}><span style={{fontSize:12,color:B.cyan}}>Analyzing customer history...</span></div>}
      </Card>
    </div>}

    {/* Smart Parts Prediction */}
    {wo.title&&<div style={{maxWidth:640,marginBottom:12}}>
      {!partsPred&&!partsLoading?<button onClick={async()=>{
        setPartsLoading(true);
        try{const eq=wo.equipment_id&&(D_equipment||[]).find(e=>e.id===wo.equipment_id);
          const resp=await fetch(SUPABASE_URL+"/functions/v1/predict-parts",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({wo_title:wo.title,wo_description:wo.notes||"",equipment_type:eq?.equipment_type||"",equipment_model:eq?.model||"",customer_name:wo.customer||""})});
          const data=await resp.json();if(data.success)setPartsPred(data.result);
        }catch(e){console.error("Parts predict error:",e);}setPartsLoading(false);
      }} style={{...SEC,width:"100%",color:B.orange,borderColor:B.orange+"44"}}>🔮 Suggest Parts</button>
      :partsLoading?<Card style={{textAlign:"center",padding:14}}><span style={{fontSize:12,color:B.orange}}>Predicting parts needed...</span></Card>
      :partsPred&&<Card style={{borderLeft:"3px solid "+B.orange}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:B.text}}>🔮 Predicted Parts</span>
          <button onClick={()=>setPartsPred(null)} style={{background:"none",border:"none",color:B.textDim,fontSize:10,cursor:"pointer"}}>Clear</button>
        </div>
        {partsPred.reasoning&&<div style={{fontSize:11,color:B.textMuted,marginBottom:10,fontStyle:"italic"}}>{partsPred.reasoning}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {(partsPred.predicted_parts||[]).map((p,i)=>{const confColor=p.confidence>=0.8?B.green:p.confidence>=0.5?B.orange:B.red;
            return<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:B.text}}>{p.name}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                  <div style={{width:60,height:4,background:B.border,borderRadius:2,overflow:"hidden"}}><div style={{width:(p.confidence*100)+"%",height:"100%",background:confColor,borderRadius:2}}/></div>
                  <span style={{fontSize:10,color:confColor,fontWeight:700}}>{Math.round(p.confidence*100)}%</span>
                  {p.estimated_cost>0&&<span style={{fontSize:10,color:B.textDim,fontFamily:M}}>~${p.estimated_cost.toFixed(0)}</span>}
                </div>
              </div>
              <button onClick={(e)=>{e.stopPropagation();setShowPO(true);}} style={{...BS,padding:"5px 10px",fontSize:10,whiteSpace:"nowrap"}}>+ PO</button>
            </div>;})}
        </div>
      </Card>}
    </div>}

    {/* Camera — hidden input triggered by Photo button, visible button below */}
    {canEdit&&<div style={{display:"none"}}><CameraUpload woId={wo.id} woName={wo.wo_id+" "+wo.title} userName={userName} onUploaded={loadData} inputId="cam-upload"/></div>}
    {canEdit&&<div style={{maxWidth:640,marginBottom:12}}><CameraUpload woId={wo.id} woName={wo.wo_id+" "+wo.title} userName={userName} onUploaded={loadData} showStageSelector/></div>}

    {/* FIELD NOTES — always visible, quick add */}
    <Card style={{maxWidth:640,marginBottom:12}}>
      <span style={LS}>Field Notes</span>
      {wo.field_notes?<p style={{margin:"4px 0 8px",color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.field_notes}</p>:<p style={{margin:"4px 0 8px",color:B.textDim,fontSize:12,fontStyle:"italic"}}>No field notes yet</p>}
      <div style={{display:"flex",gap:6}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Type a note..." style={{...IS,flex:1,fontSize:14,padding:"12px 14px"}} onKeyDown={e=>e.key==="Enter"&&addFieldNote()}/><button onClick={addFieldNote} disabled={saving} style={{...BP,padding:"12px 18px",fontSize:14}}>Add</button></div>
    </Card>

    {/* COLLAPSIBLE SECTIONS — tap to expand, keeps page clean */}
    <div style={{maxWidth:640,display:"flex",flexDirection:"column",gap:0}}>

      <Toggle label="Job Details" count={0} open={showDetails} setOpen={setShowDetails}/>
      {showDetails&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {isManager&&!editingDetails?<div><p style={{margin:0,color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.notes||"No details."}</p><button onClick={()=>{setDetailsText(wo.notes||"");setEditingDetails(true);}} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",marginTop:6}}>Edit Details</button></div>:editingDetails?<div><textarea value={detailsText} onChange={e=>setDetailsText(e.target.value)} rows={4} style={{...IS,resize:"vertical",lineHeight:1.5}}/><div style={{display:"flex",gap:6,marginTop:6}}><button onClick={()=>setEditingDetails(false)} style={{...BS,flex:1,padding:"8px"}}>Cancel</button><button onClick={saveDetails} disabled={saving} style={{...BP,flex:1,padding:"8px"}}>{saving?"Saving...":"Save"}</button></div></div>:<p style={{margin:0,color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.notes||"No details."}</p>}
      </Card>}

      <Toggle label="Time Entries" count={woTime.length} open={showTimeEntries} setOpen={setShowTimeEntries}/>
      {showTimeEntries&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woTime.length===0?<div style={{color:B.textDim,fontSize:12}}>No time logged yet</div>:woTime.map((te,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<woTime.length-1?"1px solid "+B.border:"none",fontSize:13,alignItems:"center"}}><span style={{fontFamily:M,color:B.textDim,minWidth:75}}>{te.logged_date}</span><span style={{fontFamily:M,color:B.cyan,minWidth:40,fontWeight:700}}>{te.hours}h</span><span style={{color:B.textMuted,flex:1}}>{te.description}</span>{canEditTime(te)&&<div style={{display:"flex",gap:6}}><button onClick={()=>setEditingTime({...te})} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",padding:"4px"}}>✏️</button><button onClick={()=>deleteTimeEntry(te)} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:"4px"}}>🗑</button></div>}</div>)}
        {canEdit&&<button onClick={()=>setShowTime(true)} style={{...BP,width:"100%",marginTop:10,padding:12}}>+ Log Time</button>}
      </Card>}

      {/* Line Items — only for project WOs */}
      {isProjectWO&&<>
        <Toggle label={"Line Items"+(lineItemsTotal>0?" ($"+lineItemsTotal.toLocaleString(undefined,{minimumFractionDigits:2})+")":"")} count={woLineItems.length} open={showLineItems} setOpen={setShowLineItems}/>
        {showLineItems&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
          {woLineItems.length===0&&!addingLI&&<div style={{color:B.textDim,fontSize:12}}>No line items yet. Add flat-rate charges for this project WO.</div>}
          {woLineItems.map(li=><div key={li.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+B.border}}>
            <span style={{fontSize:13,color:B.text,flex:1}}>{li.description}</span>
            <span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.green,marginRight:8}}>${parseFloat(li.amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            {isManager&&<button onClick={()=>deleteLineItem(li.id)} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:14}}>×</button>}
          </div>)}
          {woLineItems.length>0&&<div style={{display:"flex",justifyContent:"flex-end",padding:"8px 0",fontSize:14,fontWeight:800,color:B.green,fontFamily:M}}>Total: ${lineItemsTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</div>}
          {addingLI?<div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
            <input value={liDesc} onChange={e=>setLiDesc(e.target.value)} placeholder="e.g. Mobilization" style={{...IS,flex:1,padding:"8px 10px",fontSize:12}}/>
            <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:11,color:B.textDim}}>$</span><input value={liAmt} onChange={e=>setLiAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,width:80,padding:"8px",fontSize:12,fontFamily:M}}/></div>
            <button onClick={addLineItem} disabled={savingLI||!liDesc.trim()||!liAmt} style={{...BP,padding:"8px 12px",fontSize:11,opacity:(savingLI||!liDesc.trim()||!liAmt)?.5:1}}>{savingLI?"...":"Add"}</button>
            <button onClick={()=>{setAddingLI(false);setLiDesc("");setLiAmt("");}} style={{...BS,padding:"8px",fontSize:11}}>×</button>
          </div>:isManager&&<button onClick={()=>setAddingLI(true)} style={{...BP,width:"100%",marginTop:10,padding:12}}>+ Add Line Item</button>}
        </Card>}
      </>}

      <Toggle label="Photos" count={woPhotos.length} open={showPhotos} setOpen={setShowPhotos}/>
      {showPhotos&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woPhotos.length===0?<div style={{color:B.textDim,fontSize:12}}>No photos yet</div>:<>
          <PhotoTimeline photos={woPhotos}/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>{woPhotos.map((p,i)=><a key={i} href={(p.photo_url||"").replace("thumbnail?id=","file/d/").replace("&sz=w400","/view")} target="_blank" rel="noreferrer" style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border,display:"block"}}>{p.photo_url?<img src={p.photo_url} alt={p.filename} style={{width:100,height:100,objectFit:"cover",display:"block"}}/>:<div style={{width:100,height:100,display:"flex",alignItems:"center",justifyContent:"center",background:B.bg,fontSize:11,color:B.textDim}}>📷 {p.filename}</div>}</a>)}</div>
        </>}
      </Card>}

      <Toggle label="Purchase Orders" count={woPOs.length} open={showPOs} setOpen={setShowPOs}/>
      {showPOs&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woPOs.map(po=>{const canSeeAmt=isManager||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:12,marginLeft:8}}>{po.description}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}>{canSeeAmt&&<span style={{fontFamily:M,fontSize:12,color:B.text}}>{"$"+parseFloat(po.amount||0).toFixed(2)}</span>}<Badge color={PSC[po.status]}>{po.status}</Badge></div></div>})}
        {canEdit&&<div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>setShowPO(true)} style={{...BP,flex:1,padding:12}}>+ Request PO</button>
          <button onClick={()=>setShowReceipt(true)} style={{...BS,flex:1,padding:12}}>🧾 Scan Receipt</button>
        </div>}
      </Card>}

      {wo.signature&&<Card style={{marginBottom:8}}><span style={LS}>Completion Signature</span><div style={{marginTop:4}}><img src={wo.signature} alt="Sig" style={{maxWidth:280,height:"auto",display:"block",borderRadius:6}}/></div></Card>}

      {/* Crew section */}
      <Card style={{marginBottom:8}}>
        <span style={LS}>Crew</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{(wo.crew||[]).map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:6,background:B.purple+"22",color:B.purple,fontSize:12,fontWeight:600}}>{t}<button onClick={async()=>{const nc=(wo.crew||[]).filter(x=>x!==t);await onUpdateWO({...wo,crew:nc});}} style={{background:"none",border:"none",color:B.red,fontSize:13,cursor:"pointer",padding:0}}>×</button></span>)}{(wo.crew||[]).length===0&&<span style={{fontSize:12,color:B.textDim}}>No additional crew</span>}
        <select onChange={async e=>{if(!e.target.value)return;const nc=[...(wo.crew||[]),e.target.value];await onUpdateWO({...wo,crew:nc});e.target.value="";}} style={{...IS,width:"auto",padding:"6px 10px",fontSize:12,cursor:"pointer",marginLeft:6}}><option value="">+ Add</option>{(users||[]).filter(u=>u.active!==false&&u.name!==wo.assignee&&!(wo.crew||[]).includes(u.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
      </Card>

      {/* Activity Log */}
      <ActivityLog woId={wo.id}/>
      {/* Delete — small, at the bottom, not prominent */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={async()=>{if(!window.confirm("Duplicate "+wo.wo_id+"? This creates a new WO with the same details."))return;setSaving(true);await onCreateWO({title:wo.title,priority:wo.priority,assignee:wo.assignee||"Unassigned",due_date:"TBD",notes:wo.notes||"",location:wo.location||"",wo_type:wo.wo_type||"CM",building:wo.building||"",customer:wo.customer||"",customer_wo:"",crew:wo.crew||[]});setSaving(false);msg("Duplicated! Check your work orders.");}} disabled={saving} style={{flex:1,padding:"10px",borderRadius:6,border:"1px solid "+B.cyan+"33",background:"transparent",color:B.cyan+"88",fontSize:11,cursor:"pointer",fontFamily:F}}>📋 Duplicate WO</button>
        <button onClick={tryDelete} disabled={saving} style={{flex:1,padding:"10px",borderRadius:6,border:"1px solid "+B.red+"33",background:"transparent",color:B.red+"88",fontSize:11,cursor:"pointer",fontFamily:F}}>🗑 Delete WO</button>
      </div>
    </div>

    {/* MODALS */}
    {showTime&&<Modal title="Log Time" onClose={()=>setShowTime(false)}><div style={{display:"flex",flexDirection:"column",gap:14}}><div><label style={LS}>Date</label><input type="date" value={tDate} onChange={e=>setTDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div><div><label style={LS}>Hours</label><input value={tH} onChange={e=>setTH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div><div><label style={LS}>Description</label><input value={tD} onChange={e=>setTD(e.target.value)} placeholder="What was done?" style={{...IS,padding:14,fontSize:14}} onKeyDown={e=>e.key==="Enter"&&addTime()}/></div><div style={{display:"flex",gap:8}}><button onClick={()=>setShowTime(false)} style={{...SEC}}>Cancel</button><button onClick={addTime} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Log Time"}</button></div></div></Modal>}
    {showPO&&<POReqModal wo={wo} pos={pos} onCreatePO={onCreatePO} onClose={()=>setShowPO(false)} userName={userName} userRole={userRole}/>}
    {showReceipt&&<Modal title="Scan Receipt / Invoice" onClose={()=>{setShowReceipt(false);setReceiptData(null);}} wide>
      {!receiptData?<div style={{display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
        <div style={{fontSize:40,marginBottom:4}}>🧾</div>
        <div style={{fontSize:13,color:B.textMuted,textAlign:"center"}}>Take a photo of a vendor receipt or invoice. Claude will extract the vendor, amount, and line items automatically.</div>
        <input type="file" accept="image/*" capture="environment" onChange={async(e)=>{
          const file=e.target.files?.[0];if(!file)return;setScanningReceipt(true);
          try{const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
            const{data:{session}}=await sb().auth.getSession();const authToken=session?.access_token||SUPABASE_ANON_KEY;
            const resp=await fetch(SUPABASE_URL+"/functions/v1/scan-receipt",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},body:JSON.stringify({imageBase64:b64,mimeType:file.type,woId:wo.id})});
            const result=await resp.json();
            if(result.success)setReceiptData(result);else{msg("Scan failed: "+(result.error||"Unknown error"));}
          }catch(err){msg("Error: "+err.message);}setScanningReceipt(false);
        }} style={{display:"none"}} id="receipt-input"/>
        <button onClick={()=>document.getElementById("receipt-input")?.click()} disabled={scanningReceipt} style={{...BP,width:"100%",padding:16,fontSize:14}}>
          {scanningReceipt?"🔄 Scanning with Claude...":"📷 Take Photo / Choose Image"}
        </button>
        {scanningReceipt&&<div style={{fontSize:11,color:B.textDim}}>This may take a few seconds...</div>}
      </div>:<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:B.green+"15",border:"1px solid "+B.green+"33",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>✅</span><span style={{fontSize:13,fontWeight:600,color:B.green}}>Receipt scanned successfully</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Vendor</label><div style={{...IS,background:B.surfaceActive}}>{receiptData.extracted?.vendor_name||"—"}</div></div>
          <div><label style={LS}>Total Amount</label><div style={{...IS,background:B.surfaceActive,fontFamily:M,fontWeight:700}}>${(receiptData.extracted?.total_amount||0).toFixed(2)}</div></div>
          <div><label style={LS}>Date</label><div style={{...IS,background:B.surfaceActive}}>{receiptData.extracted?.date||"—"}</div></div>
          <div><label style={LS}>Receipt #</label><div style={{...IS,background:B.surfaceActive}}>{receiptData.extracted?.receipt_number||"—"}</div></div>
        </div>
        {receiptData.extracted?.line_items?.length>0&&<div>
          <label style={LS}>Line Items</label>
          {receiptData.extracted.line_items.map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+B.border,fontSize:12}}><span style={{color:B.text}}>{it.description}{it.quantity>1?" ×"+it.quantity:""}</span><span style={{fontFamily:M,color:B.cyan}}>${(it.amount||0).toFixed(2)}</span></div>)}
        </div>}
        {receiptData.matchedPO&&<div style={{background:B.cyan+"15",border:"1px solid "+B.cyan+"33",borderRadius:8,padding:"10px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:B.cyan}}>Matched to PO {receiptData.matchedPO.po_id}</div>
          <div style={{fontSize:11,color:B.textDim}}>{receiptData.matchedPO.description} — ${parseFloat(receiptData.matchedPO.amount||0).toFixed(2)}</div>
        </div>}
        {!receiptData.matchedPO&&<div style={{background:B.orange+"15",border:"1px solid "+B.orange+"33",borderRadius:8,padding:"10px 14px",fontSize:12,color:B.orange}}>No matching PO found. You can create one below.</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowReceipt(false);setReceiptData(null);}} style={{...BS,flex:1}}>Close</button>
          {!receiptData.matchedPO&&<button onClick={()=>{setShowReceipt(false);setShowPO(true);}} style={{...BP,flex:1}}>Create PO from Receipt</button>}
        </div>
      </div>}
    </Modal>}
    {showComplete&&<Modal title={completeStep===1?"Log Time":"Review & Sign"} onClose={()=>setShowComplete(false)} wide><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:B.bg,borderRadius:8,padding:14,border:"1px solid "+B.border}}><div style={{fontSize:14,fontWeight:700,color:B.text}}>{wo.wo_id} — {wo.title}</div></div>
      <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center"}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:completeStep>=1?B.cyan:B.border,color:completeStep>=1?B.bg:B.textDim}}>1</div><div style={{width:24,height:2,background:completeStep>=2?B.cyan:B.border}}/><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:completeStep>=2?B.cyan:B.border,color:completeStep>=2?B.bg:B.textDim}}>2</div></div>
      {completeStep===1&&<>
        <div style={{fontSize:13,color:B.orange,fontWeight:600,textAlign:"center"}}>No time has been logged for this job yet</div>
        <div><label style={LS}>Date</label><input type="date" value={cmpDate} onChange={e=>setCmpDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div>
        <div><label style={LS}>Hours</label><input value={cmpH} onChange={e=>setCmpH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div>
        <div><label style={LS}>What was done?</label><input value={cmpD} onChange={e=>setCmpD(e.target.value)} placeholder="Describe the work performed" style={{...IS,padding:14,fontSize:14}}/></div>
        {sigErr&&<div style={{color:B.red,fontSize:13,fontWeight:600,padding:"8px 12px",background:B.red+"11",borderRadius:6}}>{sigErr}</div>}
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...SEC}}>Cancel</button><button onClick={logTimeAndContinue} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Logging...":"Next →"}</button></div>
      </>}
      {completeStep===2&&<>
        <div style={{fontSize:12,color:B.textDim,textAlign:"center"}}>{woTime.length>0?"Review time entries — these become the completion notes":isProjectWO&&woLineItems.length>0?"Project line items — no time entries required":""}</div>
        {woTime.length>0&&<div style={{background:B.bg,borderRadius:8,padding:12,border:"1px solid "+B.border}}>
          {woTime.sort((a,b)=>(a.logged_date||"").localeCompare(b.logged_date||"")).map((t,i)=><div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:i<woTime.length-1?"1px solid "+B.border:"none",alignItems:"center"}}>
            <span style={{fontFamily:M,fontSize:11,color:B.textDim,minWidth:75}}>{t.logged_date}</span>
            <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:B.cyan,minWidth:35}}>{t.hours}h</span>
            <span style={{fontSize:12,color:B.text,flex:1}}>{t.description||"No description"}</span>
          </div>)}
        </div>}
        {woTime.length===0&&isProjectWO&&woLineItems.length>0&&<div style={{background:B.bg,borderRadius:8,padding:12,border:"1px solid "+B.purple+"40"}}>
          {woLineItems.map((li,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<woLineItems.length-1?"1px solid "+B.border:"none",alignItems:"center"}}>
            <span style={{fontSize:12,color:B.text}}>{li.description}</span>
            <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:B.purple}}>${parseFloat(li.amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
          </div>)}
          <div style={{display:"flex",justifyContent:"flex-end",paddingTop:6,fontSize:13,fontWeight:800,color:B.green,fontFamily:M}}>Total: ${lineItemsTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
        </div>}
        <div><label style={LS}>Additional Notes <span style={{color:B.textDim,fontWeight:400}}>(optional — added to completion record)</span></label><textarea value={workPerformed} onChange={e=>setWorkPerformed(e.target.value)} rows={2} placeholder="Any extra notes for the customer record..." style={{...IS,resize:"vertical",lineHeight:1.5,fontSize:13,padding:12}}/></div>
        <div><label style={LS}>Completion Date</label><input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div>
        <div><span style={LS}>Technician Signature <span style={{color:B.red}}>*</span></span><div style={{marginTop:4}}><SignaturePad onSign={setSigCanvas}/></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}><div style={{fontSize:11,color:B.textDim}}>Draw your signature above</div><button onClick={()=>{if(sigCanvas&&sigCanvas._clear)sigCanvas._clear();setSigErr("");}} style={{background:"none",border:"none",color:B.orange,fontSize:12,cursor:"pointer",fontFamily:F}}>Clear</button></div></div>
        {sigErr&&<div style={{color:B.red,fontSize:13,fontWeight:600,padding:"8px 12px",background:B.red+"11",borderRadius:6}}>{sigErr}</div>}
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...SEC}}>Cancel</button><button onClick={markComplete} disabled={saving} style={{...BIG,background:B.green,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Sign & Complete"}</button></div>
      </>}
    </div></Modal>}
    {editingTime&&<Modal title="Edit Time Entry" onClose={()=>setEditingTime(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={LS}>Date</label><input type="date" value={editingTime.logged_date||""} onChange={e=>setEditingTime({...editingTime,logged_date:e.target.value})} style={{...IS,padding:14,fontSize:14}}/></div>
        <div><label style={LS}>Hours</label><input type="number" step="0.25" value={editingTime.hours} onChange={e=>setEditingTime({...editingTime,hours:e.target.value})} style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div>
        <div><label style={LS}>Description</label><input value={editingTime.description||""} onChange={e=>setEditingTime({...editingTime,description:e.target.value})} style={{...IS,padding:14,fontSize:14}}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setEditingTime(null)} style={{...SEC}}>Cancel</button><button onClick={saveTimeEdit} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
      </div>
    </Modal>}
    {showFollowUp&&<Modal title="Job Complete! Need a Follow-up?" onClose={()=>setShowFollowUp(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{textAlign:"center",fontSize:32,marginBottom:4}}>✅</div>
        <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:B.green,marginBottom:4}}>{wo.wo_id} completed successfully</div>
        <div style={{fontSize:12,color:B.textMuted,textAlign:"center"}}>Does this job need a follow-up visit? Need to order parts? Any equipment to replace next time?</div>
        <textarea value={fuNotes} onChange={e=>setFuNotes(e.target.value)} rows={3} placeholder="Describe what needs to happen next..." style={{...IS,resize:"vertical",lineHeight:1.5,fontSize:14}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowFollowUp(false)} style={{...SEC}}>No Follow-up Needed</button>
          <button onClick={createFollowUp} disabled={saving||!fuNotes.trim()} style={{...BIG,background:B.cyan,color:B.bg,opacity:(saving||!fuNotes.trim())?.5:1}}>{saving?"Creating...":"Create Follow-up WO"}</button>
        </div>
      </div>
    </Modal>}
    {showTroubleshoot&&<TroubleshootAssistant wo={wo} onClose={()=>setShowTroubleshoot(false)}/>}
    {showEdit&&isManager&&<Modal title="Edit Work Order" onClose={()=>setShowEdit(false)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Title</label><input value={editWO.title} onChange={e=>setEditWO({...editWO,title:e.target.value})} style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Location</label><input value={editWO.location} onChange={e=>setEditWO({...editWO,location:e.target.value})} style={IS}/></div>
          <div><label style={LS}>Building</label><input value={editWO.building} onChange={e=>setEditWO({...editWO,building:e.target.value})} style={IS}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Due Date</label><input value={editWO.due_date} onChange={e=>setEditWO({...editWO,due_date:e.target.value})} type="date" style={IS}/></div>
          <div><label style={LS}>Assignee</label><select value={editWO.assignee} onChange={e=>setEditWO({...editWO,assignee:e.target.value})} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{(users||[]).filter(u=>u.role==="technician"||u.role==="manager").map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
        </div>
        <div><label style={LS}>Customer</label><input value={editWO.customer} onChange={e=>setEditWO({...editWO,customer:e.target.value})} style={IS}/></div>
        <div><label style={LS}>Crew</label><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{(editWO.crew||[]).map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:B.purple+"22",color:B.purple,fontSize:11,fontWeight:600}}>{t}<button onClick={()=>setEditWO({...editWO,crew:editWO.crew.filter(x=>x!==t)})} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:0}}>×</button></span>)}</div><select onChange={e=>{if(!e.target.value)return;setEditWO({...editWO,crew:[...(editWO.crew||[]),e.target.value]});e.target.value="";}} style={{...IS,cursor:"pointer"}}><option value="">+ Add crew member</option>{(users||[]).filter(u=>u.name!==editWO.assignee&&!(editWO.crew||[]).includes(u.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
        <div><label style={LS}>Details / Notes</label><textarea value={editWO.notes} onChange={e=>setEditWO({...editWO,notes:e.target.value})} rows={4} style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowEdit(false)} style={{...BS,flex:1}}>Cancel</button>
          <button onClick={saveEditWO} disabled={saving||!editWO.title.trim()} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save Changes"}</button>
        </div>
      </div>
    </Modal>}
  </div>);
}

function CreateWO({onSave,onCancel,users,customers,userName,userRole,allWos}){
  const isManager=userRole==="admin"||userRole==="manager";
  const assignable=users.filter(u=>u.active!==false);
  const techs=assignable.filter(u=>u.role==="technician");
  // Smart suggestion: tech with fewest active jobs
  const activeCounts={};(allWos||[]).filter(o=>o.status!=="completed").forEach(o=>{activeCounts[o.assignee]=(activeCounts[o.assignee]||0)+1;});
  const suggested=techs.length>0?techs.reduce((best,t)=>(activeCounts[t.name]||0)<(activeCounts[best.name]||0)?t:best,techs[0]):null;
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState(isManager?"Unassigned":userName),[due,setDue]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false),[loc,setLoc]=useState(""),[woType,setWoType]=useState("CM"),[bldg,setBldg]=useState(""),[cust,setCust]=useState(""),[custWO,setCustWO]=useState(""),[crew,setCrew]=useState([]);
  const[scanning,setScanning]=useState(false);const scanRef=useRef(null);
  const handleScanWO=async(e)=>{const file=e.target.files?.[0];if(!file)return;setScanning(true);try{const reader=new FileReader();reader.onload=async()=>{try{const base64=reader.result.split(",")[1];const resp=await fetch(SUPABASE_URL+"/functions/v1/scan-document",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({image:base64,documentType:"work_order"})});const result=await resp.json();if(result.title)setTitle(result.title);if(result.description)setNotes(result.description);if(result.customer)setCust(result.customer);if(result.location)setLoc(result.location);if(result.building)setBldg(result.building);if(result.priority)setPri(result.priority);if(result.customer_wo)setCustWO(result.customer_wo);if(result.due_date)setDue(result.due_date);}catch(err){console.error("Scan parse error:",err);alert("Could not read the scanned document. Please fill in fields manually.");}finally{setScanning(false);}};reader.readAsDataURL(file);}catch(err){console.error("Scan error:",err);setScanning(false);}if(scanRef.current)scanRef.current.value="";};
  const go=async()=>{const finalTitle=title.trim()||custWO.trim();if(!finalTitle||saving)return;if(cleanText(finalTitle,"Title")===null||cleanText(notes,"Notes")===null)return;setSaving(true);await onSave({title:finalTitle,priority:pri,assignee:assign,crew,due_date:due||"TBD",notes:notes.trim()||"No details.",location:loc.trim(),wo_type:woType,building:bldg.trim(),customer:cust,customer_wo:custWO.trim()||null});setSaving(false);};
  return(<div><button onClick={onCancel} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:580}}><h2 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:B.text}}>Create Work Order</h2><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><input ref={scanRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleScanWO}/><button onClick={()=>scanRef.current?.click()} disabled={scanning} type="button" style={{...BS,width:"100%",padding:"12px 16px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:scanning?.6:1}}>{scanning?"Scanning...":"📷 Scan Document"}</button>{scanning&&<div style={{fontSize:11,color:B.cyan,marginTop:4,textAlign:"center"}}>AI is reading the document...</div>}</div>
      <div><label style={LS}>Title {custWO&&<span style={{color:B.textDim,fontWeight:400}}>(optional — defaults to Customer WO#)</span>}</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={custWO?custWO:"Walk-in Cooler Repair — Store #14"} style={IS}/></div>
      <div><label style={LS}>Customer</label><select value={cust} onChange={e=>setCust(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select Customer —</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
      <div><label style={LS}>Customer WO# <span style={{color:B.textDim,fontWeight:400}}>(optional — from customer's TMS)</span></label><input value={custWO} onChange={e=>setCustWO(e.target.value)} placeholder="e.g. TMS-40291" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Location / Room</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Store #14, Room 3B" style={IS}/></div><div><label style={LS}>Building # <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={bldg} onChange={e=>setBldg(e.target.value)} placeholder="Building A" style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Type</label><select value={woType} onChange={e=>setWoType(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="PM">PM (Preventive)</option><option value="CM">CM (Corrective)</option></select></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Due</label><input value={due} onChange={e=>setDue(e.target.value)} type="date" style={IS}/></div><div><label style={LS}>Assignee</label>{isManager?<><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{assignable.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select>{suggested&&assign==="Unassigned"&&<button onClick={()=>setAssign(suggested.name)} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",marginTop:4,fontFamily:F}}>💡 Suggest: {suggested.name} ({(allWos||[]).filter(o=>o.assignee===suggested.name&&o.status!=="completed").length} active)</button>}</>:<div style={{...IS,background:B.surfaceActive,color:B.text}}>{userName}</div>}</div></div>
      <div><label style={LS}>Additional Crew <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{crew.map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:B.purple+"22",color:B.purple,fontSize:11,fontWeight:600}}>{t}<button onClick={()=>setCrew(crew.filter(x=>x!==t))} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:0}}>×</button></span>)}</div><select onChange={e=>{if(!e.target.value)return;setCrew([...crew,e.target.value]);e.target.value="";}} style={{...IS,cursor:"pointer"}}><option value="">+ Add technician to crew</option>{assignable.filter(u=>u.name!==assign&&!crew.includes(u.name)).map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
      <div><label style={LS}>Details</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe the work..." style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Creating...":"Create"}</button></div>
    </div></Card></div>);
}

function SwipeCard({wo,onStatusChange,children}){
  const ref=useRef(null);const[swipeX,setSwipeX]=useState(0);const[undoMsg,setUndoMsg]=useState(null);const startRef=useRef(null);const undoTimer=useRef(null);
  const nextStatus=wo.status==="pending"?"in_progress":wo.status==="in_progress"?"completed":null;
  const nextLabel=wo.status==="pending"?"→ Active":wo.status==="in_progress"?"→ Done":null;
  const nextColor=wo.status==="pending"?B.cyan:wo.status==="in_progress"?B.green:null;
  const ts=(e)=>{if(!nextStatus)return;startRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};};
  const tm=(e)=>{if(!startRef.current)return;const dx=e.touches[0].clientX-startRef.current.x;const dy=Math.abs(e.touches[0].clientY-startRef.current.y);if(dy>dx*0.7){startRef.current=null;setSwipeX(0);return;}if(dx>10)setSwipeX(Math.min(dx,150));};
  const te=()=>{if(swipeX>80&&nextStatus){haptic(30);const prevStatus=wo.status;onStatusChange(nextStatus);setUndoMsg({prev:prevStatus,next:nextStatus});clearTimeout(undoTimer.current);undoTimer.current=setTimeout(()=>setUndoMsg(null),5000);}setSwipeX(0);startRef.current=null;};
  const undo=()=>{if(undoMsg){onStatusChange(undoMsg.prev);setUndoMsg(null);clearTimeout(undoTimer.current);}};
  return(<div ref={ref} onTouchStart={ts} onTouchMove={tm} onTouchEnd={te} style={{position:"relative",overflow:"hidden",borderRadius:10}}>
    {nextStatus&&swipeX>10&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:swipeX,background:nextColor+"30",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"10px 0 0 10px",transition:swipeX===0?"width .2s":"none"}}><span style={{fontSize:12,fontWeight:700,color:nextColor,whiteSpace:"nowrap"}}>{nextLabel}</span></div>}
    <div style={{transform:"translateX("+swipeX+"px)",transition:swipeX===0?"transform .2s":"none"}}>{children}</div>
    {undoMsg&&<div style={{position:"absolute",bottom:4,right:4,background:B.surface,border:"1px solid "+B.border,borderRadius:6,padding:"6px 12px",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 12px rgba(0,0,0,0.3)",animation:"toastIn .2s ease-out",zIndex:10}}><span style={{fontSize:11,color:B.textMuted}}>Changed to {undoMsg.next}</span><button onClick={undo} style={{background:"none",border:"none",color:B.cyan,fontSize:11,fontWeight:700,cursor:"pointer"}}>Undo</button></div>}
  </div>);
}

function WOList({orders,canEdit,pos,onCreatePO,onUpdateWO,onDeleteWO,onCreateWO,timeEntries,photos,onAddTime,onUpdateTime,onDeleteTime,onAddPhoto,users,customers,equipment,lineItems,userName,userRole,loadData,navWOId,clearNavWO}){
  const PAGE_SIZE=50;
  const[sel,setSel]=useState(null),[filter,setFilter]=useState("all"),[creating,setCreating]=useState(false),[search,setSearch]=useState(""),[custFilter,setCustFilter]=useState(""),[bulkSel,setBulkSel]=useState([]),[bulkMode,setBulkMode]=useState(false),[visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  useEffect(()=>{if(navWOId){const wo=orders.find(o=>o.wo_id===navWOId||o.id===navWOId);if(wo){setSel(wo);if(clearNavWO)clearNavWO();}}},[navWOId]);
  const toggleBulk=(id)=>setBulkSel(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const bulkAction=async(action)=>{for(const id of bulkSel){const wo=orders.find(o=>o.id===id);if(!wo)continue;if(action==="complete")await onUpdateWO({...wo,status:"completed",date_completed:new Date().toISOString().slice(0,10)});else if(action==="active")await onUpdateWO({...wo,status:"in_progress"});else if(action==="pending")await onUpdateWO({...wo,status:"pending"});}setBulkSel([]);setBulkMode(false);};
  const custList=[...new Set(orders.map(o=>o.customer).filter(Boolean))].sort();
  const flt=orders.filter(o=>{if(filter!=="all"&&o.status!==filter)return false;if(custFilter&&o.customer!==custFilter)return false;if(search){const s=search.toLowerCase();return(o.title||"").toLowerCase().includes(s)||(o.wo_id||"").toLowerCase().includes(s)||(o.customer||"").toLowerCase().includes(s)||(o.customer_wo||"").toLowerCase().includes(s)||(o.location||"").toLowerCase().includes(s)||(o.assignee||"").toLowerCase().includes(s);}return true;});
  useEffect(()=>{setVisibleCount(PAGE_SIZE);},[flt.length]);
  if(creating&&canEdit)return <CreateWO onSave={async(nw)=>{await onCreateWO(nw);setCreating(false);}} onCancel={()=>setCreating(false)} users={users} customers={customers} userName={userName} userRole={userRole} allWos={orders}/>;
  if(sel){const fresh=orders.find(o=>o.id===sel.id);if(!fresh){setSel(null);return null;}return <WODetail wo={fresh} onBack={()=>setSel(null)} onUpdateWO={async u=>{await onUpdateWO(u);}} onDeleteWO={async id=>{await onDeleteWO(id);setSel(null);}} onCreateWO={onCreateWO} canEdit={canEdit} pos={pos} onCreatePO={onCreatePO} timeEntries={timeEntries} onAddTime={onAddTime} onUpdateTime={onUpdateTime} onDeleteTime={onDeleteTime} photos={photos} onAddPhoto={onAddPhoto} users={users} userName={userName} userRole={userRole} loadData={loadData} equipment={equipment} lineItems={lineItems}/>;}
  const today=new Date().toISOString().slice(0,10);
  const poByWO={},phByWO={};pos.forEach(p=>{if(!poByWO[p.wo_id])poByWO[p.wo_id]=[];poByWO[p.wo_id].push(p);});photos.forEach(p=>{if(!phByWO[p.wo_id])phByWO[p.wo_id]=[];phByWO[p.wo_id].push(p);});
  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
      {[["all","All"],["pending","Pending"],["in_progress","Active"],["completed","Done"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
      {canEdit&&<button onClick={()=>setCreating(true)} style={{...BP,marginLeft:"auto",padding:"7px 14px",fontSize:12}}>+ New Order</button>}
      {canEdit&&<button onClick={()=>{setBulkMode(!bulkMode);setBulkSel([]);}} style={{...BS,padding:"7px 10px",fontSize:11,color:bulkMode?B.cyan:B.textDim}}>{bulkMode?"Cancel":"☑ Bulk"}</button>}
    </div>
    {bulkMode&&bulkSel.length>0&&<div style={{display:"flex",gap:6,marginBottom:10,padding:"8px 12px",background:B.cyanGlow,borderRadius:6,alignItems:"center"}}>
      <span style={{fontSize:11,fontWeight:700,color:B.cyan}}>{bulkSel.length} selected</span>
      <button onClick={()=>bulkAction("active")} style={{...BS,padding:"4px 10px",fontSize:10}}>→ Active</button>
      <button onClick={()=>bulkAction("complete")} style={{...BS,padding:"4px 10px",fontSize:10,borderColor:B.green,color:B.green}}>✓ Complete</button>
      <button onClick={()=>bulkAction("pending")} style={{...BS,padding:"4px 10px",fontSize:10}}>→ Pending</button>
      <button onClick={()=>setBulkSel(flt.map(o=>o.id))} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",marginLeft:"auto"}}>Select All</button>
    </div>}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search WOs..." style={{...IS,flex:1,padding:"8px 12px",fontSize:12}}/>
      {custList.length>1&&<select value={custFilter} onChange={e=>setCustFilter(e.target.value)} style={{...IS,width:"auto",padding:"8px 10px",fontSize:11,cursor:"pointer"}}><option value="">All Customers</option>{custList.map(c=><option key={c} value={c}>{c}</option>)}</select>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {flt.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:20,marginBottom:6}}>{search?"🔍":"📭"}</div><div style={{fontSize:13}}>{search?"No results for \""+search+"\"":"No work orders"}</div>{canEdit&&!search&&<button onClick={()=>setCreating(true)} style={{...BP,marginTop:12,fontSize:12}}>+ Create First Order</button>}</Card>}
      {flt.slice(0,visibleCount).map(wo=>{const wp=poByWO[wo.id]||[];const wph=phByWO[wo.id]||[];const overdue=wo.due_date&&wo.due_date!=="TBD"&&wo.due_date<today&&wo.status!=="completed";const woHrs=calcWOHours(wo.id,timeEntries);const hasLI=wo.project_id&&(lineItems||[]).some(li=>li.wo_id===wo.id);const noTime=wo.status==="in_progress"&&woHrs===0&&!hasLI;return(
        <SwipeCard key={wo.id} wo={wo} onStatusChange={async(st)=>{const upd={...wo,status:st};if(st==="completed")upd.date_completed=new Date().toISOString().slice(0,10);await onUpdateWO(upd);}}><Card style={{padding:"14px 16px",marginBottom:6}}>
          <div style={{display:"flex",gap:12}}>
            {bulkMode&&<button onClick={e=>{e.stopPropagation();toggleBulk(wo.id);}} style={{width:22,height:22,borderRadius:4,border:"2px solid "+(bulkSel.includes(wo.id)?B.cyan:B.border),background:bulkSel.includes(wo.id)?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:2}}>{bulkSel.includes(wo.id)&&<span style={{color:B.bg,fontSize:12,fontWeight:800}}>✓</span>}</button>}
            <div style={{width:3,borderRadius:2,background:PC[wo.priority]||B.textDim,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setSel(wo)}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontFamily:M,fontSize:10,color:B.textDim}}>{wo.wo_id}</span>{wo.customer_wo&&<span style={{fontFamily:M,fontSize:10,color:B.purple}}>#{wo.customer_wo}</span>}<Badge color={SC[wo.status]||B.textDim}>{SL[wo.status]||wo.status}</Badge><Badge color={wo.wo_type==="PM"?B.cyan:B.orange}>{wo.wo_type||"CM"}</Badge>{wo.project_id&&<Badge color={B.purple}>Project</Badge>}</div>
              <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wo.title}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>{wo.customer&&<span>{"👤 "+wo.customer}</span>}{wo.location&&<span>{" · 📍 "+wo.location}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4,flexWrap:"wrap"}}>
                {woHrs>0&&<span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.cyan}}>{woHrs.toFixed(1)}h</span>}
                {noTime&&<span style={{fontSize:9,color:B.orange,fontWeight:600}}>⚠ No time logged</span>}
                {overdue&&<span style={{fontSize:9,color:B.red,fontWeight:600}}>⚠ Overdue {wo.due_date}</span>}
                {wo.date_completed&&<span style={{fontSize:10,color:B.green}}>{"Completed "+new Date(wo.date_completed).toLocaleDateString()}</span>}
                {wo.crew&&wo.crew.length>0&&<span style={{fontSize:10,color:B.textDim}}>{[wo.assignee,...wo.crew].filter(Boolean).filter(n=>n!=="Unassigned").join(", ")}</span>}
                {!wo.crew?.length&&wo.assignee&&wo.assignee!=="Unassigned"&&<span style={{fontSize:10,color:B.textDim}}>{wo.assignee}</span>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
              {wo.status!=="completed"&&<select value={wo.status} onChange={async e=>{e.stopPropagation();await onUpdateWO({...wo,status:e.target.value});}} onClick={e=>e.stopPropagation()} style={{padding:"3px 6px",borderRadius:4,border:"1px solid "+(SC[wo.status]||B.border),background:(SC[wo.status]||B.textDim)+"22",color:SC[wo.status]||B.textDim,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:F,appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 3px center"}}><option value="pending">Pending</option><option value="in_progress">Active</option></select>}
              {wo.status==="completed"&&<span style={{fontSize:10,color:B.green,fontWeight:600}}>✓ Done</span>}
              <button onClick={async e=>{e.stopPropagation();await onUpdateWO({...wo,tms_entered:!wo.tms_entered});}} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:6,border:"1px solid "+(wo.tms_entered?B.green:B.orange),background:wo.tms_entered?B.green+"18":B.orange+"18",color:wo.tms_entered?B.green:B.orange,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:36}}><span style={{width:18,height:18,borderRadius:4,border:"2px solid "+(wo.tms_entered?B.green:B.orange),background:wo.tms_entered?B.green:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{wo.tms_entered&&<span style={{color:"#fff",fontSize:11,lineHeight:1}}>✓</span>}</span>TMS</button>
            </div>
          </div>
        </Card></SwipeCard>);})}
      {visibleCount<flt.length&&<button onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)} style={{...BS,width:"100%",marginTop:8,textAlign:"center",fontSize:12}}>Show More ({visibleCount} of {flt.length})</button>}
    </div></div>);
}

function WOOverview({orders,wlp,pos,time}){
  const now=new Date();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);weekEnd.setHours(23,59,59,999);
  const getWODate=(wo)=>{const d=wo.date_completed||wo.created_at||wo.due_date;return d?new Date(d):new Date();};
  const active=orders.filter(o=>o.status!=="completed");
  const completedThisWeek=orders.filter(o=>o.status==="completed"&&getWODate(o)>=weekStart);
  const thisWeek=[...active,...completedThisWeek];
  const past=orders.filter(o=>o.status==="completed"&&getWODate(o)<weekStart);
  const[showArchive,setShowArchive]=useState(false);
  const[archiveMonth,setArchiveMonth]=useState(null);
  const[filter,setFilter]=useState("all");
  const tmsPending=orders.filter(o=>!o.tms_entered).length;

  const months={};past.forEach(wo=>{const d=getWODate(wo);const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");const label=d.toLocaleString("default",{month:"long",year:"numeric"});if(!months[key])months[key]={label,orders:[]};months[key].orders.push(wo);});
  const sortedMonths=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]));
  const weekLabel=weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" \u2014 "+weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const pendingPOs=pos.filter(p=>p.status==="pending").length;
  const thirtyDaysAgo=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const staleWOs=orders.filter(o=>o.status==="pending"&&o.created_at?.slice(0,10)<thirtyDaysAgo);
  const filteredWeek=filter==="all"?thisWeek:filter==="pending"?thisWeek.filter(o=>o.status==="pending"):filter==="active"?thisWeek.filter(o=>o.status==="in_progress"):filter==="done"?thisWeek.filter(o=>o.status==="completed"):filter==="tms"?thisWeek.filter(o=>!o.tms_entered):filter==="stale"?staleWOs:thisWeek;

  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Active" value={active.length} icon="📋" color={B.cyan}/>
      <StatCard label="Done This Week" value={completedThisWeek.length} icon="✓" color={B.green}/>
      <StatCard label="Hours" value={thisWeek.reduce((s,o)=>s+calcWOHours(o.id,time),0).toFixed(1)+"h"} icon="⏱" color={B.orange}/>
      <StatCard label="Pending POs" value={pendingPOs} icon="📄" color={B.purple}/>
      {tmsPending>0&&<StatCard label="TMS Needed" value={tmsPending} icon="⚠️" color={B.orange}/>}
      {staleWOs.length>0&&<div onClick={()=>setFilter("stale")} style={{cursor:"pointer"}}><StatCard label="Stale (30d+)" value={staleWOs.length} icon="🕐" color={B.red}/></div>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:800,color:B.text}}>This Week <span style={{fontWeight:400,fontSize:12,color:B.textDim,marginLeft:6}}>{weekLabel}</span></div>
      <span style={{fontFamily:M,fontSize:12,color:B.cyan}}>{thisWeek.length} orders</span>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["active","Active"],["done","Done"],["tms","TMS Needed"],["stale","Stale 30d+"]].map(([k,l])=>{const accent=k==="tms"?B.orange:k==="stale"?B.red:B.cyan;return<button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid "+(filter===k?accent:B.border),background:filter===k?accent+"22":"transparent",color:filter===k?accent:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="tms"&&tmsPending>0?" ("+tmsPending+")":""}{k==="stale"&&staleWOs.length>0?" ("+staleWOs.length+")":""}</button>})}</div>
    {filteredWeek.length===0?<Card style={{textAlign:"center",padding:24,marginBottom:16}}><div style={{fontSize:24,marginBottom:6}}>📭</div><div style={{fontSize:13,color:B.textDim}}>{filter==="tms"?"All customer WOs entered in TMS":"No work orders"}</div></Card>:<WOList orders={filteredWeek} {...wlp}/>}
    {past.length>0&&<div style={{marginTop:20}}>
      <button onClick={()=>setShowArchive(!showArchive)} style={{width:"100%",padding:"12px 16px",background:B.surface,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📁</span><span style={{fontSize:13,fontWeight:700,color:B.text}}>Past Work Orders</span><span style={{fontSize:11,color:B.textDim}}>({past.length} completed)</span></div>
        <span style={{color:B.textDim,fontSize:14}}>{showArchive?"\u25BE":"\u25B8"}</span>
      </button>
      {showArchive&&<div style={{border:"1px solid "+B.border,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
        {sortedMonths.map(([key,{label,orders:mos}])=><div key={key}>
          <button onClick={()=>setArchiveMonth(archiveMonth===key?null:key)} style={{width:"100%",padding:"10px 16px",background:archiveMonth===key?B.cyanGlow:B.bg,border:"none",borderBottom:"1px solid "+B.border,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
            <span style={{fontSize:12,fontWeight:600,color:archiveMonth===key?B.cyan:B.textMuted}}>{label}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{mos.length} orders</span>
              <span style={{fontFamily:M,fontSize:11,color:B.cyan}}>{mos.reduce((s,o)=>s+calcWOHours(o.id,time),0).toFixed(1)}h</span>
              <span style={{color:B.textDim,fontSize:12}}>{archiveMonth===key?"\u25BE":"\u25B8"}</span>
            </div>
          </button>
          {archiveMonth===key&&<div style={{padding:"8px 12px",background:B.bg}}><WOList orders={mos} {...wlp}/></div>}
        </div>)}
      </div>}
    </div>}
  </div>);
}

// Troubleshooting cache — avoids redundant Claude calls for similar symptoms
const _diagCache={};
function getDiagCacheKey(equipType,symptoms){return(equipType||"").toLowerCase().trim()+"|"+(symptoms||"").toLowerCase().trim().replace(/\s+/g," ").slice(0,100);}
function getCachedDiag(key){if(_diagCache[key])return _diagCache[key];try{const stored=localStorage.getItem("diag_cache_"+key);if(stored){const parsed=JSON.parse(stored);if(Date.now()-parsed.ts<7*86400000){_diagCache[key]=parsed.result;return parsed.result;}}}catch(e){}return null;}
function setCachedDiag(key,result){_diagCache[key]=result;try{localStorage.setItem("diag_cache_"+key,JSON.stringify({result,ts:Date.now()}));}catch(e){}}

function TroubleshootAssistant({wo,onClose}){
  const[symptoms,setSymptoms]=useState("");
  const[equipType,setEquipType]=useState("");
  const[imageB64,setImageB64]=useState(null);
  const[imageMime,setImageMime]=useState("image/jpeg");
  const[imagePreview,setImagePreview]=useState(null);
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState(null);
  const[error,setError]=useState("");
  const[fromCache,setFromCache]=useState(false);
  const fileRef=useRef(null);

  const EQUIP_TYPES=["walk-in cooler","reach-in freezer","blast chiller","ice machine","environmental chamber","condenser unit","other"];

  const handleImage=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setImageMime(file.type||"image/jpeg");
    const reader=new FileReader();
    reader.onload=()=>{
      setImagePreview(reader.result);
      setImageB64(reader.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    if(fileRef.current)fileRef.current.value="";
  };

  const diagnose=async()=>{
    if(!symptoms.trim()&&!imageB64){setError("Describe the symptoms or attach a photo.");return;}
    setError("");setLoading(true);setResult(null);setFromCache(false);
    // Check cache first (only for text-based queries, not photos)
    if(!imageB64&&symptoms.trim()){
      const cacheKey=getDiagCacheKey(equipType,symptoms);
      const cached=getCachedDiag(cacheKey);
      if(cached){setResult(cached);setFromCache(true);setLoading(false);return;}
    }
    try{
      const{data:{session}}=await sb().auth.getSession();
      const authToken=session?.access_token||SUPABASE_ANON_KEY;
      // Gather recent WO titles for this customer/location as context
      const woHistory=[];
      if(wo.customer||wo.location){
        // We don't have full WO list here, so we pass what we know from the current WO
        if(wo.title)woHistory.push(wo.title);
      }
      const body={
        symptoms:symptoms.trim(),
        equipment_type:equipType||undefined,
        customer:wo.customer||undefined,
        wo_history:woHistory.length?woHistory:undefined,
      };
      if(imageB64){body.image=imageB64;body.mimeType=imageMime;}
      const resp=await fetch(SUPABASE_URL+"/functions/v1/ai-troubleshoot",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},
        body:JSON.stringify(body),
      });
      const data=await resp.json();
      if(data.success){setResult(data.result);
        // Cache text-based results for 7 days
        if(!imageB64&&symptoms.trim()){const cacheKey=getDiagCacheKey(equipType,symptoms);setCachedDiag(cacheKey,data.result);}
      }else{setError(data.error||"Diagnosis failed. Try again.");}
    }catch(err){setError("Error: "+err.message);}
    setLoading(false);
  };

  const urgencyColors={critical:B.red,high:B.orange,medium:B.cyan,low:B.green};
  const confidenceLabel=(c)=>c>=0.8?"High":c>=0.5?"Medium":"Low";

  return(<Modal title={"AI Troubleshooting — "+(wo.wo_id||"Diagnostics")} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Equipment type */}
      <div>
        <label style={LS}>Equipment Type</label>
        <select value={equipType} onChange={e=>setEquipType(e.target.value)} style={{...IS,cursor:"pointer"}}>
          <option value="">-- Select --</option>
          {EQUIP_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
      </div>

      {/* Symptoms */}
      <div>
        <label style={LS}>Describe Symptoms</label>
        <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
          <textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} rows={3} placeholder="e.g. Unit not cooling, compressor running but warm air, ice buildup on evaporator coil..." style={{...IS,resize:"vertical",lineHeight:1.5,flex:1}}/>
          <VoiceInput onResult={t=>setSymptoms(prev=>prev?(prev+" "+t):t)} style={{minHeight:44,alignSelf:"flex-end"}}/>
        </div>
      </div>

      {/* Photo input */}
      <div>
        <label style={LS}>Photo (optional)</label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{display:"none"}} id="troubleshoot-photo"/>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>fileRef.current?.click()} type="button" style={{...BS,padding:"10px 16px",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            {imagePreview?"Change Photo":"Add Photo"}
          </button>
          {imagePreview&&<img src={imagePreview} alt="Preview" style={{width:48,height:48,objectFit:"cover",borderRadius:6,border:"1px solid "+B.border}}/>}
          {imagePreview&&<button onClick={()=>{setImageB64(null);setImagePreview(null);setImageMime("image/jpeg");}} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer"}}>Remove</button>}
        </div>
      </div>

      {/* Context info from WO */}
      {(wo.customer||wo.location)&&<div style={{padding:"8px 12px",background:B.bg,borderRadius:6,fontSize:11,color:B.textDim}}>
        Context: {wo.customer&&<span style={{color:B.purple}}>{wo.customer}</span>}{wo.customer&&wo.location&&" | "}{wo.location&&<span>{wo.location}{wo.building&&" Bldg "+wo.building}</span>}
      </div>}

      {error&&<div style={{color:B.red,fontSize:13,fontWeight:600,padding:"8px 12px",background:B.red+"11",borderRadius:6}}>{error}</div>}

      {/* Diagnose button */}
      {!result&&<button onClick={diagnose} disabled={loading} style={{...BP,width:"100%",padding:16,fontSize:15,opacity:loading?.6:1}}>
        {loading?"Analyzing with AI...":"Diagnose"}
      </button>}
      {loading&&<div style={{textAlign:"center",fontSize:11,color:B.textDim}}>This may take a few seconds...</div>}

      {/* RESULTS */}
      {result&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Diagnosis header */}
        <div style={{background:B.surface,border:"1px solid "+B.border,borderRadius:10,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:B.textDim}}>Diagnosis</span>
            <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:(urgencyColors[result.urgency]||B.cyan)+"22",color:urgencyColors[result.urgency]||B.cyan,textTransform:"uppercase"}}>{result.urgency} urgency</span>
          </div>
          <div style={{fontSize:15,fontWeight:700,color:B.text,lineHeight:1.4}}>{result.diagnosis}</div>
          <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:60,height:6,borderRadius:3,background:B.border,overflow:"hidden"}}>
              <div style={{width:(result.confidence*100)+"%",height:"100%",borderRadius:3,background:result.confidence>=0.7?B.green:result.confidence>=0.4?B.orange:B.red}}/>
            </div>
            <span style={{fontSize:10,color:B.textDim,fontFamily:M}}>{Math.round(result.confidence*100)}% — {confidenceLabel(result.confidence)} confidence</span>
          </div>
        </div>

        {/* Possible causes */}
        {result.possible_causes?.length>0&&<div style={{background:B.surface,border:"1px solid "+B.border,borderRadius:10,padding:"14px 16px"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:B.textDim,display:"block",marginBottom:8}}>Possible Causes</span>
          {result.possible_causes.map((c,i)=><div key={i} style={{display:"flex",gap:8,padding:"4px 0",fontSize:13,color:B.text}}>
            <span style={{color:B.cyan,fontFamily:M,fontWeight:700,minWidth:18}}>{i+1}.</span>{c}
          </div>)}
        </div>}

        {/* Recommended actions */}
        {result.recommended_actions?.length>0&&<div style={{background:B.surface,border:"1px solid "+B.border,borderRadius:10,padding:"14px 16px"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:B.textDim,display:"block",marginBottom:8}}>Recommended Actions</span>
          {result.recommended_actions.map((a,i)=><div key={i} style={{display:"flex",gap:8,padding:"5px 0",fontSize:13,color:B.text,borderBottom:i<result.recommended_actions.length-1?"1px solid "+B.border+"44":"none"}}>
            <span style={{color:B.green,fontSize:14,minWidth:20}}>{"[ ]"}</span><span style={{lineHeight:1.4}}>{a}</span>
          </div>)}
        </div>}

        {/* Parts likely needed */}
        {result.parts_likely_needed?.length>0&&<div style={{background:B.surface,border:"1px solid "+B.border,borderRadius:10,padding:"14px 16px"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:B.textDim,display:"block",marginBottom:8}}>Parts Likely Needed</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {result.parts_likely_needed.map((p,i)=><span key={i} style={{padding:"5px 10px",borderRadius:6,background:B.cyan+"18",color:B.cyan,fontSize:12,fontWeight:600}}>{p}</span>)}
          </div>
        </div>}

        {/* Safety warnings */}
        {result.safety_warnings?.length>0&&<div style={{background:B.red+"11",border:"2px solid "+B.red+"44",borderRadius:10,padding:"14px 16px"}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:B.red,display:"block",marginBottom:8}}>Safety Warnings</span>
          {result.safety_warnings.map((w,i)=><div key={i} style={{display:"flex",gap:8,padding:"4px 0",fontSize:13,color:B.red,fontWeight:600}}>
            <span>{"!!!"}</span>{w}
          </div>)}
        </div>}

        {/* Run again */}
        <button onClick={()=>{setResult(null);setError("");}} style={{...BS,width:"100%",padding:12}}>Run Another Diagnosis</button>
      </div>}
    </div>
  </Modal>);
}

export { WODetail, CreateWO, SwipeCard, WOList, WOOverview, TroubleshootAssistant };
