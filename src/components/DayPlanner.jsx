import React, { useState, useMemo } from "react";
import { B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, StatCard } from "./ui";

const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT_DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function DayPlanner({wos,templates,users,userName,userRole}){
  const isManager=userRole==="admin"||userRole==="manager";
  const techs=users.filter(u=>u.role==="technician"&&u.active!==false);
  const[selectedTech,setSelectedTech]=useState(isManager?"all":userName);
  const[weekOffset,setWeekOffset]=useState(0);

  // Calculate the week dates
  const weekDates=useMemo(()=>{
    const today=new Date();const startOfWeek=new Date(today);
    startOfWeek.setDate(today.getDate()-today.getDay()+1+(weekOffset*7)); // Monday
    return Array.from({length:5},(_,i)=>{const d=new Date(startOfWeek);d.setDate(startOfWeek.getDate()+i);return d;});
  },[weekOffset]);

  const weekStart=weekDates[0].toISOString().slice(0,10);
  const weekEnd=weekDates[4].toISOString().slice(0,10);
  const weekLabel=weekDates[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})+" — "+weekDates[4].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

  // Filter WOs for this week
  const weekWOs=useMemo(()=>{
    return wos.filter(w=>{
      if(w.status==="completed")return false;
      if(selectedTech!=="all"&&w.assignee!==selectedTech&&!(w.crew||[]).includes(selectedTech))return false;
      // Include if due this week or has no due date (pending)
      if(w.due_date&&w.due_date>="2020-01-01"){return w.due_date>=weekStart&&w.due_date<=weekEnd;}
      return false;
    });
  },[wos,weekStart,weekEnd,selectedTech]);

  // Also include overdue WOs
  const overdueWOs=useMemo(()=>{
    const today=new Date().toISOString().slice(0,10);
    return wos.filter(w=>{
      if(w.status==="completed")return false;
      if(selectedTech!=="all"&&w.assignee!==selectedTech&&!(w.crew||[]).includes(selectedTech))return false;
      return w.due_date&&w.due_date<today&&w.due_date>="2020-01-01";
    });
  },[wos,selectedTech]);

  // Group week WOs by day
  const byDay=useMemo(()=>{
    const map={};
    weekDates.forEach(d=>{map[d.toISOString().slice(0,10)]=[];});
    weekWOs.forEach(w=>{if(map[w.due_date])map[w.due_date].push(w);});
    return map;
  },[weekWOs,weekDates]);

  // Group by customer+location for route optimization hints
  const routeGroups=useMemo(()=>{
    const groups={};
    weekWOs.forEach(w=>{
      const key=(w.customer||"Unassigned")+" | "+(w.location||"No location");
      if(!groups[key])groups[key]={customer:w.customer,location:w.location,wos:[],dates:new Set()};
      groups[key].wos.push(w);
      if(w.due_date)groups[key].dates.add(w.due_date);
    });
    return Object.values(groups).filter(g=>g.wos.length>1).sort((a,b)=>b.wos.length-a.wos.length);
  },[weekWOs]);

  const pmCount=weekWOs.filter(w=>w.wo_type==="PM").length;
  const cmCount=weekWOs.filter(w=>w.wo_type==="CM"||!w.wo_type).length;
  const today=new Date().toISOString().slice(0,10);

  return(<div>
    {/* Stats */}
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="This Week" value={weekWOs.length} icon="📋" color={B.cyan}/>
      <StatCard label="PM Jobs" value={pmCount} icon="🔁" color={B.green}/>
      <StatCard label="CM Jobs" value={cmCount} icon="🔧" color={B.orange}/>
      {overdueWOs.length>0&&<StatCard label="Overdue" value={overdueWOs.length} icon="🚨" color={B.red}/>}
    </div>

    {/* Controls */}
    <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
      <button onClick={()=>setWeekOffset(w=>w-1)} style={{...BS,padding:"6px 12px",fontSize:12}}>← Prev</button>
      <button onClick={()=>setWeekOffset(0)} style={{...BS,padding:"6px 12px",fontSize:12,color:weekOffset===0?B.cyan:B.textDim}}>This Week</button>
      <button onClick={()=>setWeekOffset(w=>w+1)} style={{...BS,padding:"6px 12px",fontSize:12}}>Next →</button>
      <span style={{fontSize:13,fontWeight:700,color:B.text,flex:1,textAlign:"center"}}>{weekLabel}</span>
      {isManager&&<select value={selectedTech} onChange={e=>setSelectedTech(e.target.value)} style={{...IS,width:"auto",padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
        <option value="all">All Techs</option>
        {techs.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
      </select>}
    </div>

    {/* Overdue section */}
    {overdueWOs.length>0&&<Card style={{marginBottom:12,borderLeft:"3px solid "+B.red}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:14}}>🚨</span>
        <span style={{fontSize:13,fontWeight:800,color:B.red}}>Overdue ({overdueWOs.length})</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {overdueWOs.slice(0,10).map(w=><div key={w.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:B.red+"08",borderRadius:4,border:"1px solid "+B.red+"22"}}>
          <div><span style={{fontFamily:M,fontWeight:700,color:B.red,fontSize:11}}>{w.wo_id}</span><span style={{fontSize:11,color:B.textMuted,marginLeft:6}}>{w.title?.slice(0,40)}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,color:B.textDim}}>{w.assignee}</span><span style={{fontSize:10,color:B.red,fontWeight:600}}>Due {w.due_date}</span></div>
        </div>)}
      </div>
    </Card>}

    {/* Route optimization hints */}
    {routeGroups.length>0&&<Card style={{marginBottom:12,borderLeft:"3px solid "+B.purple}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:14}}>🗺</span>
        <span style={{fontSize:13,fontWeight:700,color:B.purple}}>Batch Opportunities</span>
        <span style={{fontSize:10,color:B.textDim}}>Jobs at the same location this week</span>
      </div>
      {routeGroups.slice(0,5).map((g,i)=><div key={i} style={{padding:"6px 10px",background:B.purple+"08",borderRadius:4,border:"1px solid "+B.purple+"22",marginBottom:4}}>
        <div style={{fontSize:12,fontWeight:600,color:B.text}}>{g.customer} — {g.location||"No location"}</div>
        <div style={{fontSize:10,color:B.textDim,marginTop:2}}>{g.wos.length} jobs · Spread across {g.dates.size} day{g.dates.size!==1?"s":""} — consider batching into one visit</div>
      </div>)}
    </Card>}

    {/* Day-by-day view */}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {weekDates.map(d=>{
        const dateStr=d.toISOString().slice(0,10);
        const dayWOs=byDay[dateStr]||[];
        const isToday=dateStr===today;
        const dayName=DAY_NAMES[d.getDay()];
        const shortDate=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});

        return(<Card key={dateStr} style={{padding:"12px 16px",borderLeft:"3px solid "+(isToday?B.cyan:dayWOs.length>0?B.green+"66":B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:dayWOs.length>0?8:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14,fontWeight:800,color:isToday?B.cyan:B.text}}>{dayName}</span>
              <span style={{fontSize:12,color:B.textDim}}>{shortDate}</span>
              {isToday&&<Badge color={B.cyan}>Today</Badge>}
            </div>
            <span style={{fontSize:12,fontFamily:M,fontWeight:700,color:dayWOs.length>0?B.green:B.textDim}}>{dayWOs.length} job{dayWOs.length!==1?"s":""}</span>
          </div>
          {dayWOs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4}}>
            {dayWOs.map(w=>{
              const priColor=w.priority==="high"?B.red:w.priority==="medium"?B.orange:B.green;
              return(<div key={w.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:11}}>{w.wo_id}</span>
                    <span style={{width:6,height:6,borderRadius:3,background:priColor,flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.title}</span>
                  </div>
                  <div style={{fontSize:10,color:B.textDim,marginTop:2}}>
                    {w.customer&&<span>{w.customer}</span>}
                    {w.location&&<span> · {w.location}</span>}
                    {w.assignee&&w.assignee!=="Unassigned"&&<span> · 👤 {w.assignee}</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                  <Badge color={w.wo_type==="PM"?B.green:B.orange}>{w.wo_type||"CM"}</Badge>
                  <Badge color={w.status==="in_progress"?B.cyan:B.orange}>{w.status==="in_progress"?"Active":"Pending"}</Badge>
                </div>
              </div>);
            })}
          </div>}
        </Card>);
      })}
    </div>
  </div>);
}

export { DayPlanner };
