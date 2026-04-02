import React, { useState } from "react";
import { B, F, M, IS, LS, BP, BS, PC, haptic } from "../shared";
import { Card, Badge, Modal } from "./ui";

function ServiceRequests({drafts,customers,users,onApprove,onReject}){
  const[sel,setSel]=useState(null);
  const[edits,setEdits]=useState({});
  const pending=(drafts||[]).filter(d=>d.status==="pending_review");
  const reviewed=(drafts||[]).filter(d=>d.status!=="pending_review");
  const[showReviewed,setShowReviewed]=useState(false);
  const[rejectId,setRejectId]=useState(null);
  const[rejectReason,setRejectReason]=useState("");

  const openDraft=(d)=>{setSel(d);setEdits({title:d.title||"",customer_name:d.customer_name||"",customer_wo:d.customer_wo||"",location:d.location||"",building:d.building||"",description:d.description||"",priority:d.priority||"medium",assignee:"Unassigned",due_date:""});};
  const closeDraft=()=>{setSel(null);setEdits({});};

  const confDot=(c)=>c>=0.8?B.green:c>=0.5?B.orange:B.red;

  if(pending.length===0&&!showReviewed)return(<div style={{textAlign:"center",padding:40,color:B.textDim}}>
    <div style={{fontSize:32,marginBottom:8}}>📬</div>
    <div style={{fontSize:14,fontWeight:600}}>No pending service requests</div>
    <div style={{fontSize:12,marginTop:4}}>New emails to service@3crefrigeration.com will appear here</div>
    {reviewed.length>0&&<button onClick={()=>setShowReviewed(true)} style={{...BS,marginTop:16,fontSize:11}}>View {reviewed.length} reviewed</button>}
  </div>);

  return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
    {/* Pending drafts */}
    {pending.map(d=><Card key={d.id} onClick={()=>openDraft(d)} style={{padding:"14px 18px",borderLeft:"3px solid "+B.orange}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <Badge color={PC[d.priority]||B.orange}>{d.priority}</Badge>
            {d.customer_wo&&<span style={{fontFamily:M,fontSize:10,color:B.textDim}}>WO# {d.customer_wo}</span>}
            <span style={{width:6,height:6,borderRadius:"50%",background:confDot(d.ai_confidence),display:"inline-block"}} title={"AI confidence: "+(d.ai_confidence*100).toFixed(0)+"%"}/>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title||d.email_subject}</div>
          <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{d.customer_name&&<span>{d.customer_name} · </span>}{d.building&&<span>{d.building} </span>}{d.location&&<span>— {d.location}</span>}</div>
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
          <span style={{width:8,height:8,borderRadius:"50%",background:confDot(sel.ai_confidence)}} title={"AI confidence: "+(sel.ai_confidence*100).toFixed(0)+"%"}/>
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

export { ServiceRequests };
