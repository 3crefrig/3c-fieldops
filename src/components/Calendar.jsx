import React, { useState, useEffect } from "react";
import { sb, B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, Modal, Toast } from "./ui";

function CompanyCalendar({userRole,wos,userName}){
  const[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[month,setMonth]=useState(new Date());
  const[showForm,setShowForm]=useState(false),[title,setTitle]=useState(""),[desc,setDesc]=useState(""),[eDate,setEDate]=useState(""),[eType,setEType]=useState("event"),[saving,setSaving]=useState(false),[toast,setToast]=useState("");
  const isMgr=userRole==="admin"||userRole==="manager";
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const load=async()=>{const{data}=await sb().from("company_events").select("*").order("event_date");setEvents(data||[]);setLoading(false);};
  useEffect(()=>{load();},[]);

  const save=async()=>{if(!title.trim()||!eDate||saving)return;setSaving(true);try{await sb().from("company_events").insert({title:title.trim(),description:desc.trim(),event_date:eDate,event_type:eType});setSaving(false);setShowForm(false);setTitle("");setDesc("");setEDate("");load();msg("Event added");}catch(e){console.error(e);setSaving(false);}};
  const del=async(ev)=>{await sb().from("company_events").delete().eq("id",ev.id);load();msg("Deleted");};

  // Calendar grid
  const y=month.getFullYear(),m=month.getMonth();
  const firstDay=new Date(y,m,1).getDay();const daysInMonth=new Date(y,m+1,0).getDate();
  const days=[];for(let i=0;i<firstDay;i++)days.push(null);for(let d=1;d<=daysInMonth;d++)days.push(d);
  const today=new Date();const todayStr=today.toISOString().slice(0,10);
  const pad=d=>String(d).padStart(2,"0");
  const dateStr=d=>y+"-"+pad(m+1)+"-"+pad(d);
  // Merge events + WO due dates
  const getDateItems=(d)=>{if(!d)return[];const ds=dateStr(d);const evts=events.filter(e=>e.event_date===ds);const dues=(wos||[]).filter(w=>w.due_date===ds&&w.status!=="completed"&&(w.assignee===userName||(w.crew&&w.crew.includes(userName))));return[...evts.map(e=>({...e,kind:"event"})),...dues.map(w=>({id:w.id,title:w.wo_id+": "+w.title,event_type:"wo_due",kind:"wo"}))];};
  const typeColors={holiday:B.red,event:B.cyan,deadline:B.orange,meeting:B.purple,wo_due:B.green};

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setMonth(new Date(y,m-1))} style={{...BS,padding:"6px 12px",fontSize:14}}>←</button>
        <span style={{fontSize:16,fontWeight:800,color:B.text,fontFamily:F,minWidth:160,textAlign:"center"}}>{month.toLocaleString("default",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setMonth(new Date(y,m+1))} style={{...BS,padding:"6px 12px",fontSize:14}}>→</button>
      </div>
      {isMgr&&<button onClick={()=>setShowForm(true)} style={{...BP,fontSize:12}}>+ Add Event</button>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:B.textDim,padding:"6px 0",letterSpacing:.5}}>{d}</div>)}
      {days.map((d,i)=>{const items=getDateItems(d);const isToday=d&&dateStr(d)===todayStr;return<div key={i} style={{minHeight:70,padding:4,background:d?B.surface:B.bg,border:"1px solid "+(isToday?B.cyan:B.border),borderRadius:6,position:"relative"}}>
        {d&&<div style={{fontSize:11,fontWeight:isToday?800:500,color:isToday?B.cyan:B.text,marginBottom:2}}>{d}</div>}
        {items.slice(0,3).map(it=><div key={it.id} style={{fontSize:8,padding:"2px 4px",marginBottom:1,borderRadius:3,background:(typeColors[it.event_type]||B.cyan)+"22",color:typeColors[it.event_type]||B.cyan,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title}</div>)}
        {items.length>3&&<div style={{fontSize:7,color:B.textDim}}>+{items.length-3} more</div>}
      </div>})}
    </div>

    {/* Upcoming events list */}
    <div style={{marginTop:16}}><span style={{...LS,fontSize:10}}>UPCOMING</span>
      {events.filter(e=>e.event_date>=todayStr).slice(0,10).map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+B.border}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:typeColors[e.event_type]||B.cyan,flexShrink:0}}/>
          <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>{e.title}</div><div style={{fontSize:10,color:B.textDim}}>{new Date(e.event_date+"T12:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · <Badge color={typeColors[e.event_type]||B.cyan}>{e.event_type}</Badge></div></div>
        </div>
        {isMgr&&<button onClick={()=>del(e)} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:12}}>✕</button>}
      </div>)}
      {events.filter(e=>e.event_date>=todayStr).length===0&&<div style={{padding:20,textAlign:"center",color:B.textDim,fontSize:12}}>No upcoming events</div>}
    </div>

    {showForm&&<Modal title="Add Event" onClose={()=>setShowForm(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Company Holiday, Team Meeting..." style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Date</label><input value={eDate} onChange={e=>setEDate(e.target.value)} type="date" style={IS}/></div>
          <div><label style={LS}>Type</label><select value={eType} onChange={e=>setEType(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="event">Event</option><option value="holiday">Holiday</option><option value="deadline">Deadline</option><option value="meeting">Meeting</option></select></div>
        </div>
        <div><label style={LS}>Description (optional)</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Details..." style={IS}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={save} disabled={saving} style={{...BP,flex:1}}>{saving?"Saving...":"Add Event"}</button></div>
      </div>
    </Modal>}
  </div>);
}

export { CompanyCalendar };
