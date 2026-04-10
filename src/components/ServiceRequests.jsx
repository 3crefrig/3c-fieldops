import React, { useState, useEffect, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PC, haptic } from "../shared";
import { Card, Badge, Modal, Spinner } from "./ui";

// ── Scan Inbox Button with 2hr cooldown ──────────────────────
function ScanInboxButton({onComplete}){
  const[scanning,setScanning]=useState(false);
  const[result,setResult]=useState(null);
  const[cooldownUntil,setCooldownUntil]=useState(null);
  const[checking,setChecking]=useState(true);

  // Check cooldown on mount
  const checkCooldown=useCallback(async()=>{
    try{
      const{data}=await sb().from("email_refresh_log").select("refreshed_at").order("refreshed_at",{ascending:false}).limit(1);
      if(data&&data.length>0){
        const lastRefresh=new Date(data[0].refreshed_at);
        const nextAllowed=new Date(lastRefresh.getTime()+2*60*60*1000);
        if(new Date()<nextAllowed)setCooldownUntil(nextAllowed);
        else setCooldownUntil(null);
      }
    }catch(e){}
    setChecking(false);
  },[]);

  useEffect(()=>{checkCooldown();},[checkCooldown]);

  // Countdown timer
  useEffect(()=>{
    if(!cooldownUntil)return;
    const iv=setInterval(()=>{
      if(new Date()>=cooldownUntil){setCooldownUntil(null);clearInterval(iv);}
    },30000);
    return()=>clearInterval(iv);
  },[cooldownUntil]);

  const scan=async()=>{
    if(scanning||cooldownUntil)return;
    setScanning(true);setResult(null);
    try{
      // Log this refresh
      const{data:{user}}=await sb().auth.getUser();
      if(user)await sb().from("email_refresh_log").insert({user_id:user.id});

      // Call process-inbox edge function
      const resp=await fetch(SUPABASE_URL+"/functions/v1/process-inbox",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},
        body:"{}"
      });
      const data=await resp.json();
      if(data.success){
        setResult({
          found:data.emails_found||0,
          created:data.drafts_created||0,
          skipped:data.skipped_non_service||0
        });
        // Set cooldown
        setCooldownUntil(new Date(Date.now()+2*60*60*1000));
        if(onComplete)onComplete();
      }else{
        setResult({error:data.error||"Scan failed"});
      }
    }catch(e){
      setResult({error:"Network error"});
    }
    setScanning(false);
  };

  const canScan=!scanning&&!cooldownUntil&&!checking;
  const cooldownText=cooldownUntil?(() => {
    const diff=cooldownUntil-new Date();
    const mins=Math.ceil(diff/60000);
    if(mins>=60)return Math.floor(mins/60)+"h "+((mins%60)||"")+"m";
    return mins+"m";
  })():"";

  return(<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
    <button onClick={scan} disabled={!canScan}
      style={{...BP,padding:"10px 20px",fontSize:13,display:"flex",alignItems:"center",gap:8,opacity:canScan?1:.5}}>
      {scanning?<><Spinner/> Scanning...</>:checking?"Checking...":"📬 Scan Inbox"}
    </button>
    {cooldownUntil&&<span style={{fontSize:11,color:B.textDim}}>Next scan in {cooldownText}</span>}
    {result&&!result.error&&<span style={{fontSize:11,color:B.green,fontWeight:600}}>
      Found {result.found} emails · {result.created} new request{result.created!==1?"s":""}
      {result.skipped>0&&<span style={{color:B.textDim}}> · {result.skipped} skipped</span>}
    </span>}
    {result&&result.error&&<span style={{fontSize:11,color:B.red}}>{result.error}</span>}
  </div>);
}

function ServiceRequests({drafts,customers,users,onApprove,onReject,onRefresh}){
  const[sel,setSel]=useState(null);
  const[edits,setEdits]=useState({});
  const pending=(drafts||[]).filter(d=>d.status==="pending_review");
  const reviewed=(drafts||[]).filter(d=>d.status!=="pending_review");
  const[showReviewed,setShowReviewed]=useState(false);
  const[rejectId,setRejectId]=useState(null);
  const[rejectReason,setRejectReason]=useState("");
  const[selected,setSelected]=useState([]);
  const[bulkApproving,setBulkApproving]=useState(false);
  const[bulkRejecting,setBulkRejecting]=useState(false);
  const[showBulkRejectConfirm,setShowBulkRejectConfirm]=useState(false);

  const openDraft=(d)=>{setSel(d);setEdits({title:d.title||"",customer_name:d.customer_name||"",customer_wo:d.customer_wo||"",location:d.location||"",building:d.building||"",description:d.description||"",priority:d.priority||"medium",assignee:"Unassigned",due_date:""});};
  const closeDraft=()=>{setSel(null);setEdits({});};

  const confColor=(c)=>c>=0.8?B.green:c>=0.5?B.orange:B.red;
  const confLabel=(c)=>(c*100).toFixed(0)+"%";

  const toggleSelect=(id,e)=>{e.stopPropagation();setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);};
  const selectAll=()=>{if(selected.length===pending.length)setSelected([]);else setSelected(pending.map(d=>d.id));};

  const bulkApprove=async()=>{
    if(bulkApproving||selected.length===0)return;
    setBulkApproving(true);
    for(const id of selected){
      const draft=pending.find(d=>d.id===id);
      if(draft){
        const defaultEdits={title:draft.title||"",customer_name:draft.customer_name||"",customer_wo:draft.customer_wo||"",location:draft.location||"",building:draft.building||"",description:draft.description||"",priority:draft.priority||"medium",assignee:"Unassigned",due_date:""};
        await onApprove(draft,defaultEdits);
      }
    }
    setSelected([]);setBulkApproving(false);haptic(50);
  };

  const bulkReject=async()=>{
    if(bulkRejecting||selected.length===0)return;
    setBulkRejecting(true);
    for(const id of selected){
      await onReject(id,"Bulk rejected");
    }
    setSelected([]);setBulkRejecting(false);setShowBulkRejectConfirm(false);haptic(50);
  };

  return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
    {/* Scan Inbox button */}
    <Card style={{padding:"12px 16px"}}>
      <ScanInboxButton onComplete={onRefresh}/>
      <div style={{fontSize:10,color:B.textDim,marginTop:6}}>Scans service@3crefrigeration.com for new service requests. 2-hour cooldown between scans.</div>
    </Card>

    {/* Bulk actions bar */}
    {pending.length>1&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:B.surface,borderRadius:8,border:"1px solid "+B.border}}>
      <div onClick={selectAll} style={{width:18,height:18,borderRadius:3,border:"2px solid "+(selected.length===pending.length?B.cyan:B.border),background:selected.length===pending.length?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
        {selected.length===pending.length&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
      </div>
      <span style={{fontSize:12,color:B.textMuted,flex:1}}>{selected.length>0?selected.length+" selected":"Select requests for bulk actions"}</span>
      {selected.length>0&&<><button onClick={()=>setShowBulkRejectConfirm(true)} disabled={bulkRejecting} style={{...BP,background:B.red,padding:"6px 14px",fontSize:12,opacity:bulkRejecting?.5:1}}>
        {bulkRejecting?"Rejecting...":"Reject "+selected.length}
      </button><button onClick={bulkApprove} disabled={bulkApproving} style={{...BP,background:B.green,padding:"6px 14px",fontSize:12,opacity:bulkApproving?.5:1}}>
        {bulkApproving?"Approving...":"Approve "+selected.length}
      </button></>}
    </div>}

    {/* Pending drafts */}
    {pending.length===0&&!showReviewed&&<div style={{textAlign:"center",padding:30,color:B.textDim}}>
      <div style={{fontSize:28,marginBottom:6}}>📬</div>
      <div style={{fontSize:13,fontWeight:600}}>No pending service requests</div>
      <div style={{fontSize:11,marginTop:4}}>Use the scan button above to check for new emails</div>
    </div>}

    {pending.map(d=><Card key={d.id} onClick={()=>openDraft(d)} style={{padding:"14px 18px",borderLeft:"3px solid "+B.orange}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{display:"flex",gap:10,flex:1,minWidth:0}}>
          {/* Checkbox for bulk select */}
          {pending.length>1&&<div onClick={(e)=>toggleSelect(d.id,e)} style={{width:18,height:18,borderRadius:3,border:"2px solid "+(selected.includes(d.id)?B.cyan:B.border),background:selected.includes(d.id)?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:2}}>
            {selected.includes(d.id)&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
          </div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <Badge color={PC[d.priority]||B.orange}>{d.priority}</Badge>
              {d.customer_wo&&<span style={{fontFamily:M,fontSize:10,color:B.textDim}}>WO# {d.customer_wo}</span>}
              <span style={{padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,fontFamily:M,background:confColor(d.ai_confidence)+"20",color:confColor(d.ai_confidence)}}>AI {confLabel(d.ai_confidence)}</span>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title||d.email_subject}</div>
            <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{d.customer_name&&<span>{d.customer_name} · </span>}{d.building&&<span>{d.building} </span>}{d.location&&<span>— {d.location}</span>}</div>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
          <div style={{fontSize:10,color:B.textDim}}>{d.email_from_name||d.email_from}</div>
          <div style={{fontSize:9,color:B.textDim,marginTop:2}}>{d.email_date?new Date(d.email_date).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):""}</div>
        </div>
      </div>
    </Card>)}

    {/* Reviewed toggle */}
    {reviewed.length>0&&<button onClick={()=>setShowReviewed(!showReviewed)} style={{...BS,fontSize:11,alignSelf:"center",marginTop:6}}>{showReviewed?"Hide":"Show"} {reviewed.length} reviewed</button>}
    {showReviewed&&reviewed.map(d=><Card key={d.id} style={{padding:"12px 16px",opacity:0.6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Badge color={d.status==="approved"?B.green:B.red}>{d.status}</Badge>
            {d.created_wo_id&&<span style={{fontFamily:M,fontSize:10,color:B.green}}>{d.created_wo_id}</span>}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:B.text,marginTop:2}}>{d.title||d.email_subject}</div>
        </div>
        <div style={{fontSize:10,color:B.textDim}}>{d.reviewed_at?new Date(d.reviewed_at).toLocaleDateString():""}</div>
      </div>
    </Card>)}

    {/* Review Modal */}
    {sel&&<Modal title="Review Service Request" onClose={closeDraft} wide>
      {/* Original email reference */}
      <div style={{background:B.bg,borderRadius:6,padding:12,marginBottom:16,border:"1px solid "+B.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.5}}>Original Email</div>
          <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:M,background:confColor(sel.ai_confidence)+"20",color:confColor(sel.ai_confidence)}}>AI Confidence: {confLabel(sel.ai_confidence)}</span>
        </div>
        <div style={{fontSize:12,color:B.text}}><strong>From:</strong> {sel.email_from_name} &lt;{sel.email_from}&gt;</div>
        <div style={{fontSize:12,color:B.text}}><strong>Subject:</strong> {sel.email_subject}</div>
        <div style={{fontSize:11,color:B.textMuted,marginTop:6,maxHeight:120,overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.4}}>{sel.email_body}</div>
        {sel.attachments&&sel.attachments.length>0&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{sel.attachments.map((a,i)=><a key={i} href={a.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:B.cyan,textDecoration:"none"}}>📎 {a.name}</a>)}</div>}
      </div>

      {/* Editable fields */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Title</label><input style={IS} value={edits.title} onChange={e=>setEdits({...edits,title:e.target.value})}/></div>
        <div><label style={LS}>Customer</label><select style={IS} value={edits.customer_name} onChange={e=>setEdits({...edits,customer_name:e.target.value})}><option value="">— Select —</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div><label style={LS}>Customer WO#</label><input style={IS} value={edits.customer_wo} onChange={e=>setEdits({...edits,customer_wo:e.target.value})}/></div>
        <div><label style={LS}>Building</label><input style={IS} value={edits.building} onChange={e=>setEdits({...edits,building:e.target.value})}/></div>
        <div><label style={LS}>Location / Room</label><input style={IS} value={edits.location} onChange={e=>setEdits({...edits,location:e.target.value})}/></div>
        <div><label style={LS}>Priority</label><select style={IS} value={edits.priority} onChange={e=>setEdits({...edits,priority:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        <div><label style={LS}>Assign To</label><select style={IS} value={edits.assignee} onChange={e=>setEdits({...edits,assignee:e.target.value})}><option value="Unassigned">Unassigned</option>{(users||[]).filter(u=>u.role==="technician"&&u.active!==false).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
        <div><label style={LS}>Due Date</label><input type="date" style={IS} value={edits.due_date} onChange={e=>setEdits({...edits,due_date:e.target.value})}/></div>
      </div>
      <div style={{marginTop:12}}><label style={LS}>Description</label><textarea style={{...IS,minHeight:80,resize:"vertical"}} value={edits.description} onChange={e=>setEdits({...edits,description:e.target.value})}/></div>

      {/* Actions */}
      <div style={{display:"flex",gap:10,marginTop:18,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <button onClick={()=>{setRejectId(sel.id);}} style={{...BS,color:B.red,borderColor:B.red+"40"}}>Reject</button>
        <button onClick={()=>{onApprove(sel,edits);closeDraft();haptic(50);}} style={{...BP,background:B.green}}>Approve & Create WO</button>
      </div>
    </Modal>}

    {/* Bulk reject confirmation modal */}
    {showBulkRejectConfirm&&<Modal title="Reject Service Requests" onClose={()=>setShowBulkRejectConfirm(false)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>Reject {selected.length} service request{selected.length>1?"s":""}?</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This cannot be undone. All selected requests will be rejected.</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowBulkRejectConfirm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={bulkReject} disabled={bulkRejecting} style={{...BP,flex:1,background:B.red,opacity:bulkRejecting?.5:1}}>{bulkRejecting?"Rejecting...":"Reject All"}</button></div>
      </div>
    </Modal>}

    {/* Reject reason modal */}
    {rejectId&&<Modal title="Reject Service Request" onClose={()=>{setRejectId(null);setRejectReason("");}}>
      <label style={LS}>Reason (optional)</label>
      <textarea style={{...IS,minHeight:60}} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Why is this being rejected?"/>
      <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"flex-end"}}>
        <button onClick={()=>{setRejectId(null);setRejectReason("");}} style={BS}>Cancel</button>
        <button onClick={()=>{onReject(rejectId,rejectReason);setRejectId(null);setRejectReason("");closeDraft();haptic(50);}} style={{...BP,background:B.red}}>Reject</button>
      </div>
    </Modal>}
  </div>);
}

export { ServiceRequests, ScanInboxButton };
