import React, { useState, useEffect, useMemo } from "react";
import { sb, B, F, M, IS, LS, BP, BS, fmtHours, fmtDate, openWO } from "../shared";
import { Card, Badge, Modal, Toast } from "./ui";

/*
 * Company calendar — jobs due, hours logged, company events, and the crew
 * schedule on one month grid.
 *
 * Filtering (rebuilt 2026-08-03, Google-Calendar layer pattern):
 *  - LAYERS: Jobs / Hours / Events / Schedule are independently toggleable
 *    chips, persisted per device — hide the noise, keep what you're planning.
 *  - PEOPLE: managers filter by tech via color-coded chips; the filter applies
 *    to EVERY layer (the old dropdown only narrowed hours — jobs and events
 *    ignored it). Each tech keeps a stable color across the whole calendar.
 *  - "Today" jumps back to the current month.
 */

const LAYER_KEY="fieldops-cal-layers", TECH_KEY="fieldops-cal-tech";
const TECH_PALETTE=["#4DD6F0","#5AD48A","#F5A623","#A78BFA","#F472B6","#60A5FA"];

function CompanyCalendar({userRole,wos,userName,time,schedule,users}){
  const[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[month,setMonth]=useState(new Date());
  const[showForm,setShowForm]=useState(false),[title,setTitle]=useState(""),[desc,setDesc]=useState(""),[eDate,setEDate]=useState(""),[eType,setEType]=useState("event"),[saving,setSaving]=useState(false),[toast,setToast]=useState("");
  const[dayDetail,setDayDetail]=useState(null);
  const isMgr=userRole==="admin"||userRole==="manager";
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const load=async()=>{const{data}=await sb().from("company_events").select("*").order("event_date");setEvents(data||[]);setLoading(false);};
  useEffect(()=>{load();},[]);

  // Persisted layer + tech filters
  const[layers,setLayers]=useState(()=>{try{return{jobs:true,hours:true,events:true,sched:true,...JSON.parse(localStorage.getItem(LAYER_KEY)||"{}")};}catch(e){return{jobs:true,hours:true,events:true,sched:true};}});
  const toggleLayer=(k)=>setLayers(l=>{const n={...l,[k]:!l[k]};localStorage.setItem(LAYER_KEY,JSON.stringify(n));return n;});
  const[techFilter,setTechFilter]=useState(()=>localStorage.getItem(TECH_KEY)||"");
  const pickTech=(n)=>{setTechFilter(n);localStorage.setItem(TECH_KEY,n);};

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
  const isCurrentMonth=todayStr.slice(0,7)===monthPrefix;

  // Stable per-tech colors (sorted roster order → palette)
  const allTechs=useMemo(()=>{
    const fromTime=[...new Set((time||[]).map(t=>t.technician).filter(Boolean))];
    const fromUsers=(users||[]).filter(u=>u.active!==false).map(u=>u.name);
    return[...new Set([...fromUsers,...fromTime])].sort();
  },[time,users]);
  const techColor=useMemo(()=>{const map={};allTechs.forEach((n,i)=>{map[n]=TECH_PALETTE[i%TECH_PALETTE.length];});return map;},[allTechs]);

  // Hours — scoped by role, then by the (now universal) tech filter
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
  const isLongDay=hd=>!!hd&&Object.values(hd.byTech).some(v=>v.hours>12);

  // Jobs due — role-scoped AND tech-filtered (the old dropdown never reached these)
  const dueWOs=(ds)=>(wos||[]).filter(w=>{
    if(w.due_date!==ds||w.status==="completed")return false;
    if(!isMgr&&!(w.assignee===userName||(w.crew&&w.crew.includes(userName))))return false;
    if(techFilter&&!(w.assignee===techFilter||(w.crew&&w.crew.includes(techFilter))))return false;
    return true;
  });
  // Schedule entries — techs their own; managers everyone (tech filter applies)
  const daySched=(ds)=>(schedule||[]).filter(e=>{
    if(e.date!==ds)return false;
    if(!isMgr&&e.assigned_to!==userName)return false;
    if(techFilter&&e.assigned_to!==techFilter)return false;
    return true;
  }).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));

  const getDateItems=(d)=>{if(!d)return[];const ds=dateStr(d);
    const evts=layers.events?events.filter(e=>e.event_date===ds).map(e=>({...e,kind:"event"})):[];
    const jobs=layers.jobs?dueWOs(ds).map(w=>({id:w.id,title:w.wo_id+": "+w.title,event_type:"wo_due",kind:"wo",tech:w.assignee})):[];
    const sch=layers.sched?daySched(ds).map(e=>({id:"s-"+e.id,title:(e.time?e.time+" ":"")+e.task,event_type:"sched",kind:"sched",tech:e.assigned_to})):[];
    return[...sch,...jobs,...evts];
  };
  const typeColors={holiday:B.red,event:B.cyan,deadline:B.orange,meeting:B.cyan,wo_due:B.green,sched:B.purple};
  const itemColor=(it)=>it.tech&&techFilter===""&&isMgr?(techColor[it.tech]||typeColors[it.event_type]||B.cyan):(typeColors[it.event_type]||B.cyan);
  const woLabel=(id)=>{const w=(wos||[]).find(o=>o.id===id);return w?w.wo_id:"—";};

  const LAYERS=[["jobs","Jobs",B.green],["hours","Hours",B.cyan],["events","Events",B.orange],["sched","Schedule",B.purple]];

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setMonth(new Date(y,m-1))} style={{...BS,padding:"6px 12px",fontSize:14}}>←</button>
        <span style={{fontSize:16,fontWeight:700,color:B.text,fontFamily:F,minWidth:150,textAlign:"center"}}>{month.toLocaleString("default",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setMonth(new Date(y,m+1))} style={{...BS,padding:"6px 12px",fontSize:14}}>→</button>
        {!isCurrentMonth&&<button onClick={()=>setMonth(new Date())} style={{...BS,padding:"6px 12px",fontSize:12,color:B.cyan,borderColor:B.cyan+"55"}}>Today</button>}
      </div>
      {isMgr&&<button onClick={()=>setShowForm(true)} style={{...BP,fontSize:12}}>+ Add Event</button>}
    </div>

    {/* Layer + people chips — every chip filters EVERY layer */}
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      {LAYERS.map(([k,l,c])=><button key={k} data-tip={"Show or hide the "+l.toLowerCase()+" layer — your choice sticks on this device."} onClick={()=>toggleLayer(k)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:999,border:"1px solid "+(layers[k]?c+"66":B.border),background:layers[k]?c+"16":"transparent",color:layers[k]?c:B.textDim,fontSize:11.5,fontWeight:650,cursor:"pointer",fontFamily:F,opacity:layers[k]?1:0.7}}>
        <span style={{width:8,height:8,borderRadius:4,background:layers[k]?c:B.border}}/>{l}
      </button>)}
      {isMgr&&allTechs.length>0&&<>
        <span style={{width:1,height:18,background:B.border,margin:"0 4px"}}/>
        <button onClick={()=>pickTech("")} style={{padding:"5px 12px",borderRadius:999,border:"1px solid "+(techFilter===""?B.cyan:B.border),background:techFilter===""?B.cyanGlow:"transparent",color:techFilter===""?B.cyan:B.textDim,fontSize:11.5,fontWeight:650,cursor:"pointer",fontFamily:F}}>Everyone</button>
        {allTechs.map(n=><button key={n} onClick={()=>pickTech(techFilter===n?"":n)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:999,border:"1px solid "+(techFilter===n?(techColor[n]||B.cyan)+"88":B.border),background:techFilter===n?(techColor[n]||B.cyan)+"1c":"transparent",color:techFilter===n?(techColor[n]||B.cyan):B.textDim,fontSize:11.5,fontWeight:650,cursor:"pointer",fontFamily:F}}>
          <span style={{width:8,height:8,borderRadius:4,background:techColor[n]||B.cyan}}/>{n.split(" ")[0]}
        </button>)}
      </>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:B.textDim,padding:"6px 0",letterSpacing:.5}}>{d}</div>)}
      {days.map((d,i)=>{const items=getDateItems(d);const ds=d?dateStr(d):null;const isToday=ds===todayStr;const hd=layers.hours&&ds?hoursByDate[ds]:null;const hc=isLongDay(hd)?B.orange:B.green;
      return<div key={i} onClick={()=>{if(d)setDayDetail(ds);}} title={hd?Object.keys(hd.byTech).sort().map(n=>n+" "+fmtHours(hd.byTech[n].hours)).join("\n"):undefined} style={{minHeight:70,padding:4,background:d?B.surface:B.bg,border:"1px solid "+(isToday?B.cyan:B.border),borderRadius:6,position:"relative",cursor:d?"pointer":"default"}}>
        {d&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:2,marginBottom:2}}>
          <span style={{fontSize:11,fontWeight:isToday?700:500,color:isToday?B.cyan:B.text}}>{d}</span>
          {hd&&<span style={{fontFamily:M,fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:4,background:hc+"1E",color:hc,whiteSpace:"nowrap"}}>{fmtHours(hd.total)}</span>}
        </div>}
        {items.slice(0,3).map(it=>{const c=itemColor(it);return<div key={it.id} style={{fontSize:10,padding:"2px 4px",marginBottom:1,borderRadius:3,background:c+"22",color:c,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title}</div>;})}
        {items.length>3&&<div style={{fontSize:10,color:B.textDim}}>+{items.length-3} more</div>}
      </div>})}
    </div>

    {/* Month hours summary */}
    {layers.hours&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,padding:"8px 10px",background:B.surface,border:"1px solid "+B.border,borderRadius:8}}>
      <span style={{fontSize:11,color:B.textDim,fontWeight:600}}>{techFilter?techFilter:isMgr?"All technicians":"Your hours"} · {month.toLocaleString("default",{month:"long"})}</span>
      <span style={{fontSize:11,color:B.textDim}}>{monthStats.techs>1?monthStats.techs+" techs · ":""}<span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.green}}>{fmtHours(monthStats.total)}</span></span>
    </div>}

    {/* Upcoming events list */}
    {layers.events&&<div style={{marginTop:16}}><span style={{...LS,fontSize:10}}>UPCOMING</span>
      {events.filter(e=>e.event_date>=todayStr).slice(0,10).map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+B.border}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:typeColors[e.event_type]||B.cyan,flexShrink:0}}/>
          <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>{e.title}</div><div style={{fontSize:10,color:B.textDim}}>{new Date(e.event_date+"T12:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · <Badge color={typeColors[e.event_type]||B.cyan}>{e.event_type}</Badge></div></div>
        </div>
        {isMgr&&<button onClick={()=>del(e)} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:12}}>✕</button>}
      </div>)}
      {events.filter(e=>e.event_date>=todayStr).length===0&&<div style={{padding:20,textAlign:"center",color:B.textDim,fontSize:12}}>No upcoming events</div>}
    </div>}

    {dayDetail&&<Modal title={fmtDate(dayDetail,{weekday:"long",month:"long",day:"numeric"})} onClose={()=>setDayDetail(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {(()=>{const sch=daySched(dayDetail);
          if(!sch.length)return null;
          return<div><span style={{...LS,fontSize:10}}>SCHEDULE</span>
            {sch.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}>
              {e.time&&<span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.purple,flexShrink:0}}>{e.time}</span>}
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:B.text}}>{e.task}</div><div style={{fontSize:10,color:B.textDim}}>{[e.assigned_to,e.location].filter(Boolean).join(" · ")}</div></div>
            </div>)}
          </div>;})()}
        {(()=>{const hd=hoursByDate[dayDetail];
          if(!layers.hours)return null;
          if(!hd)return<div style={{fontSize:12,color:B.textDim,textAlign:"center",padding:"8px 0"}}>No hours logged this day.</div>;
          const names=Object.keys(hd.byTech).sort((a,b)=>hd.byTech[b].hours-hd.byTech[a].hours);
          return<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{...LS,fontSize:10}}>HOURS LOGGED</span>
              <span style={{fontFamily:M,fontSize:14,fontWeight:700,color:isLongDay(hd)?B.orange:B.green}}>{fmtHours(hd.total)}</span>
            </div>
            {names.map(n=>{const tb=hd.byTech[n];return<div key={n} style={{padding:"8px 0",borderTop:"1px solid "+B.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:techColor[n]||B.text}}>{n}</span>
                <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:tb.hours>12?B.orange:B.green}}>{fmtHours(tb.hours)}</span>
              </div>
              {tb.entries.map(t=><div key={t.id} onClick={()=>t.wo_id&&openWO(t.wo_id)} title="Open this work order" style={{display:"flex",gap:6,alignItems:"baseline",marginTop:4,cursor:t.wo_id?"pointer":"default"}}>
                <span style={{fontFamily:M,fontSize:10,color:B.cyan,flexShrink:0}}>{woLabel(t.wo_id)}</span>
                <span style={{fontSize:11,color:B.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description||"Work performed"}</span>
                <span style={{fontFamily:M,fontSize:10,color:B.textDim,marginLeft:"auto",flexShrink:0}}>{fmtHours(t.hours)}</span>
              </div>)}
            </div>;})}
          </div>;})()}
        {(()=>{const evts=layers.events?events.filter(e=>e.event_date===dayDetail):[];const dues=layers.jobs?dueWOs(dayDetail):[];
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
