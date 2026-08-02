import React, { useState, useEffect, useMemo } from "react";
import { sb, B, F, M, IS, LS, BP, BS, fmtHours, fmtDate , openWO} from "../shared";
import { Card, Badge, Modal, Toast } from "./ui";

function CompanyCalendar({userRole,wos,userName,time}){
  const[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[month,setMonth]=useState(new Date());
  const[showForm,setShowForm]=useState(false),[title,setTitle]=useState(""),[desc,setDesc]=useState(""),[eDate,setEDate]=useState(""),[eType,setEType]=useState("event"),[saving,setSaving]=useState(false),[toast,setToast]=useState("");
  const[techFilter,setTechFilter]=useState(""),[dayDetail,setDayDetail]=useState(null);
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
  const pad=d=>String(d).padStart(2,"0");
  // Local date, not UTC — toISOString() rolls over to tomorrow after ~8pm ET and mis-highlights "today".
  const today=new Date();const todayStr=today.getFullYear()+"-"+pad(today.getMonth()+1)+"-"+pad(today.getDate());
  const dateStr=d=>y+"-"+pad(m+1)+"-"+pad(d);
  const monthPrefix=y+"-"+pad(m+1);

  // Technician hours. Techs see only their own; managers/admins see the whole company
  // (optionally narrowed to one tech). Totals are exactly what was entered against each
  // logged_date — no spreading of crew or multi-day hours across other dates.
  const allTechs=useMemo(()=>[...new Set((time||[]).map(t=>t.technician).filter(Boolean))].sort(),[time]);
  const scopedTime=useMemo(()=>{
    const base=isMgr?(time||[]):(time||[]).filter(t=>t.technician===userName);
    return techFilter?base.filter(t=>t.technician===techFilter):base;
  },[time,isMgr,userName,techFilter]);
  const hoursByDate=useMemo(()=>{
    const map={};
    scopedTime.forEach(t=>{const ds=t.logged_date;if(!ds)return;const h=parseFloat(t.hours||0)||0;
      if(!map[ds])map[ds]={total:0,byTech:{}};
      map[ds].total+=h;
      const who=t.technician||"Unassigned";
      if(!map[ds].byTech[who])map[ds].byTech[who]={hours:0,entries:[]};
      map[ds].byTech[who].hours+=h;map[ds].byTech[who].entries.push(t);
    });
    return map;
  },[scopedTime]);
  const monthStats=useMemo(()=>{let total=0;const techs=new Set();
    Object.keys(hoursByDate).forEach(ds=>{if(ds.slice(0,7)!==monthPrefix)return;total+=hoursByDate[ds].total;Object.keys(hoursByDate[ds].byTech).forEach(n=>techs.add(n));});
    return{total,techs:techs.size};
  },[hoursByDate,monthPrefix]);
  // A single tech over 12h in one day is unusual (crew hours or multi-day work booked to the
  // entry date). Tint it only — the number always shows exactly as entered.
  const isLongDay=hd=>!!hd&&Object.values(hd.byTech).some(v=>v.hours>12);

  // Merge events + WO due dates. Managers/admins get the whole company; techs get their own.
  const dueWOs=(ds)=>(wos||[]).filter(w=>w.due_date===ds&&w.status!=="completed"&&(isMgr||w.assignee===userName||(w.crew&&w.crew.includes(userName))));
  const getDateItems=(d)=>{if(!d)return[];const ds=dateStr(d);const evts=events.filter(e=>e.event_date===ds);return[...evts.map(e=>({...e,kind:"event"})),...dueWOs(ds).map(w=>({id:w.id,title:w.wo_id+": "+w.title,event_type:"wo_due",kind:"wo"}))];};
  const typeColors={holiday:B.red,event:B.cyan,deadline:B.orange,meeting:B.cyan,wo_due:B.green};
  const woLabel=(id)=>{const w=(wos||[]).find(o=>o.id===id);return w?w.wo_id:"—";};

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setMonth(new Date(y,m-1))} style={{...BS,padding:"6px 12px",fontSize:14}}>←</button>
        <span style={{fontSize:16,fontWeight:700,color:B.text,fontFamily:F,minWidth:160,textAlign:"center"}}>{month.toLocaleString("default",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setMonth(new Date(y,m+1))} style={{...BS,padding:"6px 12px",fontSize:14}}>→</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {isMgr&&allTechs.length>0&&<select value={techFilter} onChange={e=>setTechFilter(e.target.value)} style={{...IS,cursor:"pointer",padding:"6px 10px",fontSize:12,minHeight:0,width:"auto"}}><option value="">All technicians</option>{allTechs.map(n=><option key={n} value={n}>{n}</option>)}</select>}
        {isMgr&&<button onClick={()=>setShowForm(true)} style={{...BP,fontSize:12}}>+ Add Event</button>}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:B.textDim,padding:"6px 0",letterSpacing:.5}}>{d}</div>)}
      {days.map((d,i)=>{const items=getDateItems(d);const ds=d?dateStr(d):null;const isToday=ds===todayStr;const hd=ds?hoursByDate[ds]:null;const hc=isLongDay(hd)?B.orange:B.green;
      return<div key={i} onClick={()=>{if(d)setDayDetail(ds);}} title={hd?Object.keys(hd.byTech).sort().map(n=>n+" "+fmtHours(hd.byTech[n].hours)).join("\n"):undefined} style={{minHeight:70,padding:4,background:d?B.surface:B.bg,border:"1px solid "+(isToday?B.cyan:B.border),borderRadius:6,position:"relative",cursor:d?"pointer":"default"}}>
        {d&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:2,marginBottom:2}}>
          <span style={{fontSize:11,fontWeight:isToday?700:500,color:isToday?B.cyan:B.text}}>{d}</span>
          {hd&&<span style={{fontFamily:M,fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:4,background:hc+"1E",color:hc,whiteSpace:"nowrap"}}>{fmtHours(hd.total)}</span>}
        </div>}
        {items.slice(0,3).map(it=><div key={it.id} style={{fontSize:10,padding:"2px 4px",marginBottom:1,borderRadius:3,background:(typeColors[it.event_type]||B.cyan)+"22",color:typeColors[it.event_type]||B.cyan,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title}</div>)}
        {items.length>3&&<div style={{fontSize:10,color:B.textDim}}>+{items.length-3} more</div>}
      </div>})}
    </div>

    {/* Month hours summary */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,padding:"8px 10px",background:B.surface,border:"1px solid "+B.border,borderRadius:8}}>
      <span style={{fontSize:11,color:B.textDim,fontWeight:600}}>{techFilter?techFilter:isMgr?"All technicians":"Your hours"} · {month.toLocaleString("default",{month:"long"})}</span>
      <span style={{fontSize:11,color:B.textDim}}>{monthStats.techs>1?monthStats.techs+" techs · ":""}<span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.green}}>{fmtHours(monthStats.total)}</span></span>
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

    {dayDetail&&<Modal title={fmtDate(dayDetail,{weekday:"long",month:"long",day:"numeric"})} onClose={()=>setDayDetail(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {(()=>{const hd=hoursByDate[dayDetail];
          if(!hd)return<div style={{fontSize:12,color:B.textDim,textAlign:"center",padding:"8px 0"}}>No hours logged this day.</div>;
          const names=Object.keys(hd.byTech).sort((a,b)=>hd.byTech[b].hours-hd.byTech[a].hours);
          return<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{...LS,fontSize:10}}>HOURS LOGGED</span>
              <span style={{fontFamily:M,fontSize:14,fontWeight:700,color:isLongDay(hd)?B.orange:B.green}}>{fmtHours(hd.total)}</span>
            </div>
            {names.map(n=>{const tb=hd.byTech[n];return<div key={n} style={{padding:"8px 0",borderTop:"1px solid "+B.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:B.text}}>{n}</span>
                <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:tb.hours>12?B.orange:B.green}}>{fmtHours(tb.hours)}</span>
              </div>
              {tb.entries.map(t=><div key={t.id} onClick={()=>t.wo_id&&openWO(t.wo_id)} title="Open this work order" style={{display:"flex",gap:6,alignItems:"baseline",marginTop:4,cursor:t.wo_id?"pointer":"default"}}>
                <span style={{fontFamily:M,fontSize:10,color:B.cyan,flexShrink:0}}>{woLabel(t.wo_id)}</span>
                <span style={{fontSize:11,color:B.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description||"Work performed"}</span>
                <span style={{fontFamily:M,fontSize:10,color:B.textDim,marginLeft:"auto",flexShrink:0}}>{fmtHours(t.hours)}</span>
              </div>)}
            </div>;})}
          </div>;})()}
        {(()=>{const evts=events.filter(e=>e.event_date===dayDetail);const dues=dueWOs(dayDetail);
          if(!evts.length&&!dues.length)return null;
          return<div><span style={{...LS,fontSize:10}}>ON THIS DAY</span>
            {evts.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:typeColors[e.event_type]||B.cyan,flexShrink:0}}/>
              <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>{e.title}</div>{e.description&&<div style={{fontSize:10,color:B.textDim}}>{e.description}</div>}</div>
            </div>)}
            {dues.map(w=><div key={w.id} onClick={()=>openWO(w.wo_id||w.id)} title="Open this work order" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:B.green,flexShrink:0}}/>
              <div><div style={{fontSize:12,fontWeight:600,color:B.text}}><span style={{fontFamily:M,color:B.cyan}}>{w.wo_id}</span> {w.title}</div><div style={{fontSize:10,color:B.textDim}}>Due · {w.assignee||"Unassigned"}</div></div>
            </div>)}
          </div>;})()}
      </div>
    </Modal>}

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
