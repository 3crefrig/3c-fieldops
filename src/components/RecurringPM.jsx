import React, { useState } from "react";
import { sb, B, F, IS, LS, BP, BS } from "../shared";
import { Card, Modal, Toast } from "./ui";

function RecurringPM({templates,onAdd,onDelete,users}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState("Unassigned"),[loc,setLoc]=useState(""),[bldg,setBldg]=useState(""),[notes,setNotes]=useState(""),[freq,setFreq]=useState("monthly"),[nextDue,setNextDue]=useState(""),[cust,setCust]=useState(""),[saving,setSaving]=useState(false);
  const techs=users.filter(u=>u.role==="technician"&&u.active!==false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openEdit=(t)=>{setEditing(t);setTitle(t.title||"");setPri(t.priority||"medium");setAssign(t.assignee||"Unassigned");setLoc(t.location||"");setBldg(t.building||"");setNotes(t.notes||"");setFreq(t.frequency||"monthly");setNextDue(t.next_due||"");setCust(t.customer||"");setShowForm(true);};
  const openNew=()=>{setEditing(null);setTitle("");setPri("medium");setAssign("Unassigned");setLoc("");setBldg("");setNotes("");setFreq("monthly");setNextDue("");setCust("");setShowForm(true);};
  const go=async()=>{if(!title.trim()||saving)return;setSaving(true);const fields={title:title.trim(),priority:pri,assignee:assign,location:loc.trim(),building:bldg.trim(),notes:notes.trim(),customer:cust.trim(),frequency:freq,next_due:nextDue||null,active:true};if(editing){await sb().from("recurring_templates").update(fields).eq("id",editing.id);msg("Template updated");}else{await onAdd(fields);msg("Template created");}setShowForm(false);setEditing(null);setTitle("");setSaving(false);};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Recurring PM Templates</h3>
    <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ New Recurring PM</button>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {templates.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No recurring templates yet</div>}
      {templates.map(t=><Card key={t.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.cyan}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{t.title}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>{t.frequency} · {t.assignee} · {t.location||"No location"}{t.customer&&" · 👤 "+t.customer}</div>{t.next_due&&<div style={{fontSize:11,color:B.orange,marginTop:2}}>Next due: {t.next_due}</div>}</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>openEdit(t)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button>
            <button onClick={async()=>{if(!window.confirm("Delete recurring template '"+t.title+"'?"))return;await onDelete(t.id);msg("Deleted");}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button>
          </div>
        </div></Card>)}
    </div>
    {showForm&&<Modal title={editing?"Edit Recurring PM":"New Recurring PM"} onClose={()=>{setShowForm(false);setEditing(null);}} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Monthly Cooler Inspection" style={IS}/></div>
      <div><label style={LS}>Customer</label><input value={cust} onChange={e=>setCust(e.target.value)} placeholder="ABC Grocery" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Frequency</label><select value={freq} onChange={e=>setFreq(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="weekly">Weekly</option><option value="biweekly">Every 2 Weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div><div><label style={LS}>Next Due</label><input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)} style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Location</label><input value={loc} onChange={e=>setLoc(e.target.value)} style={IS}/></div><div><label style={LS}>Building</label><input value={bldg} onChange={e=>setBldg(e.target.value)} style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Assignee</label><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{techs.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div></div>
      <div><label style={LS}>Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{...IS,resize:"vertical"}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>{setShowForm(false);setEditing(null);}} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save Changes":"Create Template")}</button></div>
    </div></Modal>}
  </div>);
}

export { RecurringPM };
