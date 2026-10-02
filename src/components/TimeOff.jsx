import React, { useState, useMemo } from "react";
import { B, M, IS, LS, BP, BS, todayLocal, localDateStr, fmtDateRange, TIME_OFF_TYPES, isTimeOff, schedEnd } from "../shared";
import { Modal } from "./ui";

/*
 * Post time off (vacation / PTO / sick) — shared by the Calendar and Week Plan.
 * Everyone posts their own (techs, managers, admins); managers can also post for
 * anyone else. It is a post, not a
 * request: saving puts it straight on the calendar and tells the office.
 * Saves through the same addSchedule action as schedule tasks (kind "time_off").
 */

const isDay=(s)=>/^\d{4}-\d{2}-\d{2}$/.test(s||"");
const MAX_DAYS=120;

function TimeOffModal({date,users,userName,canAssignOthers,wos,schedule,onSave,onClose}){
  const[who,setWho]=useState(userName);
  const[type,setType]=useState(TIME_OFF_TYPES[0]);
  const[start,setStart]=useState(isDay(date)?date:todayLocal());
  const[end,setEnd]=useState(isDay(date)?date:todayLocal());
  const[note,setNote]=useState("");
  const[saving,setSaving]=useState(false);
  const names=useMemo(()=>[...new Set((users||[]).filter(u=>u.active!==false).map(u=>u.name).filter(Boolean))].sort(),[users]);
  const person=canAssignOthers?who:userName;
  const pickStart=(v)=>{setStart(v);if(isDay(v)&&(!isDay(end)||end<v))setEnd(v);};

  // Calendar days and Mon–Fri working days in the range (local dates, no UTC drift).
  const span=useMemo(()=>{
    if(!isDay(start)||!isDay(end)||end<start)return null;
    const[y,m,d]=start.split("-").map(Number);let total=0,work=0;
    for(let i=0;i<=MAX_DAYS;i++){const dt=new Date(y,m-1,d+i);const ds=localDateStr(dt);if(ds>end)break;total++;const wd=dt.getDay();if(wd!==0&&wd!==6)work++;}
    return{total,work,tooLong:total>MAX_DAYS};
  },[start,end]);
  // Already off in this window — block the duplicate rather than stack two rows.
  const overlap=useMemo(()=>span?(schedule||[]).find(e=>isTimeOff(e)&&e.assigned_to===person&&e.date<=end&&schedEnd(e)>=start):null,[schedule,person,start,end,span]);
  // Open jobs due while they're out — worth knowing before the day arrives.
  const jobs=useMemo(()=>span?(wos||[]).filter(w=>w.status!=="completed"&&isDay(w.due_date)&&w.due_date>=start&&w.due_date<=end&&(w.assignee===person||(w.crew||[]).includes(person))):[],[wos,person,start,end,span]);
  const error=!span?"Last day can't be before the first day.":span.tooLong?"That's more than "+MAX_DAYS+" days — split it into shorter stretches.":overlap?(person===userName?"You're":person.split(" ")[0]+" is")+" already off "+fmtDateRange(overlap.date,schedEnd(overlap))+".":"";

  const save=async()=>{
    if(error||saving)return;setSaving(true);
    try{await onSave({kind:"time_off",date:start,end_date:end>start?end:null,task:type,note:note.trim(),assigned_to:person});onClose();}
    catch(e){setSaving(false);}
  };

  return(<Modal title="Post time off" onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {canAssignOthers&&<div><label style={LS}>Who</label><select value={who} onChange={e=>setWho(e.target.value)} style={{...IS,cursor:"pointer"}}>{names.map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
      <div><label style={LS}>Type</label><select value={type} onChange={e=>setType(e.target.value)} style={{...IS,cursor:"pointer"}}>{TIME_OFF_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{minWidth:0}}><label style={LS}>First day off</label><input value={start} onChange={e=>pickStart(e.target.value)} type="date" style={IS}/></div>
        <div style={{minWidth:0}}><label style={LS}>Last day off</label><input value={end} min={start} onChange={e=>setEnd(e.target.value)} type="date" style={IS}/></div>
      </div>
      <div><label style={LS}>Note <span style={{color:B.textDim,fontWeight:400}}>(optional — only you and managers see it)</span></label><input value={note} onChange={e=>setNote(e.target.value)} maxLength={140} placeholder="Back Monday, reachable by phone…" style={IS}/></div>
      {error
        ?<div style={{fontSize:12,color:B.red,fontWeight:600}}>{error}</div>
        :<div style={{fontSize:12,color:B.textMuted}}>
          <span style={{fontFamily:M,fontWeight:700,color:B.text}}>{fmtDateRange(start,end)}</span> · {span.work} working day{span.work!==1?"s":""}{span.total!==span.work?" ("+span.total+" with weekends)":""}
        </div>}
      {!error&&jobs.length>0&&<div style={{fontSize:12,color:B.orange,lineHeight:1.45}}>
        {jobs.length} open job{jobs.length!==1?"s":""} due in that window: <span style={{fontFamily:M}}>{jobs.slice(0,4).map(w=>w.wo_id).join(", ")}{jobs.length>4?" +"+(jobs.length-4):""}</span>. {canAssignOthers?"Reassign or move them.":"Your manager will be told."}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{...BS,flex:1}}>Cancel</button>
        <button onClick={save} disabled={saving||!!error} style={{...BP,flex:1,opacity:saving||error?0.6:1}}>{saving?"Saving…":"Post time off"}</button>
      </div>
    </div>
  </Modal>);
}

export { TimeOffModal };
