import React, { useState } from "react";
import { B, F, IS, LS, BP, BS, sanitizeHTML } from "../shared";
import { Card, Modal, Toast } from "./ui";
import { WorkflowBuilder } from "./Workflows";

function Settings({emailTemplates,onAddTemplate,onUpdateTemplate,onDeleteTemplate,D,userName}){
  const[tab,setTab]=useState("templates"),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[tName,setTName]=useState(""),[tSubject,setTSubject]=useState(""),[tBody,setTBody]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openNew=()=>{setEditing(null);setTName("");setTSubject("3C Refrigeration \u2014 Timesheet");setTBody("<p>Hi,</p><p>Please find attached the timesheet.</p><p>If you have any questions, please reply to this email.</p>");setShowForm(true);};
  const openEdit=(t)=>{setEditing(t);setTName(t.name);setTSubject(t.subject);setTBody(t.body);setShowForm(true);};
  const go=async()=>{if(!tName.trim()||!tSubject.trim()||saving)return;setSaving(true);const obj={name:tName.trim(),subject:tSubject.trim(),body:tBody.trim()};if(editing){await onUpdateTemplate({...editing,...obj});}else{await onAddTemplate(obj);}setSaving(false);setShowForm(false);msg(editing?"Template updated":"Template created");};
  const del=async(t)=>{if(!window.confirm("Delete template '"+t.name+"'?"))return;await onDeleteTemplate(t.id);msg("Deleted");};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>System Settings</h3>
    <div style={{display:"flex",gap:6,marginBottom:16}}>{[["templates","📧 Email Templates"],["workflows","⚡ Workflows"],["other","⚙️ Other"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 14px",borderRadius:6,border:"1px solid "+(tab===k?B.cyan:B.border),background:tab===k?B.cyanGlow:"transparent",color:tab===k?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    {tab==="templates"&&<div>
      <div style={{fontSize:12,color:B.textMuted,marginBottom:12}}>Create email templates for sending timesheets. Templates set the subject line and body text. The timesheet table and Excel attachment are added automatically.</div>
      <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ New Email Template</button>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {(!emailTemplates||emailTemplates.length===0)&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:12}}>No templates yet. Click above to create one.</div></Card>}
        {(emailTemplates||[]).map(t=><Card key={t.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.purple}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>Subject: {t.subject}</div><div style={{fontSize:11,color:B.textDim,marginTop:2,maxHeight:40,overflow:"hidden"}} dangerouslySetInnerHTML={{__html:sanitizeHTML(t.body)}}/></div>
            <div style={{display:"flex",gap:6,flexShrink:0}}><button onClick={()=>openEdit(t)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button><button onClick={()=>del(t)} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button></div>
          </div></Card>)}
      </div>
      {showForm&&<Modal title={editing?"Edit Template":"New Email Template"} onClose={()=>setShowForm(false)} wide>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={LS}>Template Name</label><input value={tName} onChange={e=>setTName(e.target.value)} placeholder="e.g. Monthly Timesheet, Invoice Follow-up" style={IS}/></div>
          <div><label style={LS}>Email Subject</label><input value={tSubject} onChange={e=>setTSubject(e.target.value)} placeholder="3C Refrigeration — Timesheet" style={IS}/></div>
          <div><label style={LS}>Email Body <span style={{color:B.textDim,fontWeight:400}}>(timesheet table and your signature are added automatically below)</span></label><textarea value={tBody} onChange={e=>setTBody(e.target.value)} rows={6} placeholder="<p>Hi,</p><p>Please find attached...</p>" style={{...IS,resize:"vertical",lineHeight:1.5,fontFamily:M,fontSize:12}}/></div>
          <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border}}><span style={{fontSize:10,color:B.textDim}}>Preview:</span><div style={{marginTop:6,fontSize:12,color:B.textMuted}} dangerouslySetInnerHTML={{__html:sanitizeHTML(tBody||"<em>Empty</em>")}}/></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save":"Create Template")}</button></div>
        </div>
      </Modal>}
    </div>}
    {tab==="workflows"&&D&&<WorkflowBuilder D={D} userName={userName||"Admin"}/>}
    {tab==="other"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{[["🔔","Notifications"],["📱","Devices"],["🔐","Security"],["☁️","Storage"],["📊","Reports"],["🏢","Company"],["🔧","Integrations"]].map(([ic,lb])=><Card key={lb} style={{padding:"18px 14px",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:24,marginBottom:6}}>{ic}</div><div style={{fontSize:12,fontWeight:600,color:B.textMuted}}>{lb}</div></Card>)}</div>}
  </div>);
}

export { Settings };
