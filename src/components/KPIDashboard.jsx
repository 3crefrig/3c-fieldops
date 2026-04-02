import React, { useState } from "react";
import { B, F, M, IS, LS } from "../shared";
import { Card, Badge, StatCard, Modal } from "./ui";

function Sparkline({data=[],color=B.cyan,width=120,height=36,showDots=false}){
  if(!data.length||data.every(v=>v===0))return <div style={{width,height,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,color:B.textDim}}>No data</span></div>;
  const max=Math.max(...data,1);const min=Math.min(...data,0);const range=max-min||1;
  const pad=4;const w=width-pad*2;const h=height-pad*2;
  const pts=data.map((v,i)=>({x:pad+(i/(data.length-1||1))*w,y:pad+h-(((v-min)/range)*h)}));
  const d=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const fillD=d+` L${pts[pts.length-1].x},${height} L${pts[0].x},${height} Z`;
  return(<svg width={width} height={height} style={{display:"block"}}>
    <defs><linearGradient id={"sg-"+color.replace("#","")} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
    <path d={fillD} fill={`url(#sg-${color.replace("#","")})`}/>
    <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {showDots&&pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color}/>)}
  </svg>);
}

// ═══════════════════════════════════════════
// KPI DASHBOARD — Replaces Overview tab
// ═══════════════════════════════════════════
function KPIDashboard({D,A,userRole,userName}){
  const isAdmin=userRole==="admin";const isMgr=userRole==="admin"||userRole==="manager";
  const[range,setRange]=useState("month");const[drillDown,setDrillDown]=useState(null);
  const now=new Date();
  const getRangeStart=()=>{const d=new Date(now);if(range==="week"){d.setDate(d.getDate()-d.getDay());d.setHours(0,0,0,0);}else if(range==="month"){d.setDate(1);d.setHours(0,0,0,0);}else if(range==="quarter"){d.setMonth(d.getMonth()-3);d.setHours(0,0,0,0);}else if(range==="year"){d.setMonth(0,1);d.setHours(0,0,0,0);}else{d.setFullYear(2000);}return d;};
  const rangeStart=getRangeStart();
  const inRange=(dateStr)=>{if(!dateStr)return false;return new Date(dateStr)>=rangeStart;};

  // ── KPI Calculations ──
  const completedWOs=D.wos.filter(o=>o.status==="completed"&&inRange(o.date_completed));
  const allWOsRange=D.wos.filter(o=>inRange(o.created_at));

  // First-Time Fix Rate: completed WOs without a follow-up WO for same customer+location within 30d
  const ftfr=(()=>{if(completedWOs.length===0)return 0;
    let fixed=0;completedWOs.forEach(wo=>{const dc=new Date(wo.date_completed);const followUp=D.wos.find(o=>o.id!==wo.id&&o.customer===wo.customer&&o.location===wo.location&&o.status!=="completed"&&o.created_at&&new Date(o.created_at)>dc&&new Date(o.created_at)<new Date(dc.getTime()+30*86400000));
    if(!followUp)fixed++;});return Math.round((fixed/completedWOs.length)*100);})();

  // Technician Utilization
  const techs=(D.users||[]).filter(u=>u.role==="technician"&&u.active!==false);
  const weeksInRange=Math.max(1,Math.round((now-rangeStart)/(7*86400000)));
  const techUtil=(()=>{if(techs.length===0)return 0;
    const totalAvail=techs.reduce((s,t)=>(s+(parseFloat(t.available_hours_week)||40)*weeksInRange),0);
    const totalLogged=D.time.filter(t=>inRange(t.logged_date)&&techs.some(u=>u.name===t.technician)).reduce((s,t)=>s+parseFloat(t.hours||0),0);
    return totalAvail>0?Math.round((totalLogged/totalAvail)*100):0;})();

  // Revenue Per Tech (admin only)
  const paidInvoices=(D.invoices||[]).filter(i=>i.status==="paid"&&inRange(i.date_paid));
  const totalRevenue=paidInvoices.reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const revPerTech=techs.length>0?Math.round(totalRevenue/techs.length):0;

  // Invoice-to-Payment Time
  const paidWithDates=(D.invoices||[]).filter(i=>i.status==="paid"&&i.date_sent&&i.date_paid);
  const avgPayDays=paidWithDates.length>0?Math.round(paidWithDates.reduce((s,i)=>s+Math.max(0,Math.floor((new Date(i.date_paid)-new Date(i.date_sent))/86400000)),0)/paidWithDates.length):0;

  // Outstanding AR
  const outstandingInv=(D.invoices||[]).filter(i=>i.status==="sent"||i.status==="draft");
  const totalAR=outstandingInv.reduce((s,i)=>s+parseFloat(i.amount||0),0);

  // Overdue Invoices
  const overdueInv=(D.invoices||[]).filter(i=>{if(i.status!=="sent")return false;const days=Math.floor((now-new Date(i.date_issued))/86400000);return days>30;});
  const overdueAmt=overdueInv.reduce((s,i)=>s+parseFloat(i.amount||0),0);

  // Completion Rate
  const compRate=allWOsRange.length>0?Math.round((completedWOs.length/allWOsRange.length)*100):0;

  // Total hours in range
  const totalHours=D.time.filter(t=>inRange(t.logged_date)).reduce((s,t)=>s+parseFloat(t.hours||0),0);

  // Weekly sparkline data (8 weeks)
  const sparkWeeks=(()=>{const weeks=[];for(let i=7;i>=0;i--){const ws=new Date(now);ws.setDate(now.getDate()-now.getDay()-(i*7));ws.setHours(0,0,0,0);const we=new Date(ws);we.setDate(ws.getDate()+6);we.setHours(23,59,59,999);
    const hrs=D.time.filter(t=>{const d=new Date(t.logged_date);return d>=ws&&d<=we;}).reduce((s,t)=>s+parseFloat(t.hours||0),0);
    const comp=D.wos.filter(o=>o.status==="completed"&&o.date_completed&&new Date(o.date_completed)>=ws&&new Date(o.date_completed)<=we).length;
    const rev=(D.invoices||[]).filter(i=>i.status==="paid"&&i.date_paid&&new Date(i.date_paid)>=ws&&new Date(i.date_paid)<=we).reduce((s,i)=>s+parseFloat(i.amount||0),0);
    weeks.push({hrs,comp,rev});}return weeks;})();

  // Top customers by WO count
  const custStats=(()=>{const map={};D.wos.filter(o=>inRange(o.created_at)).forEach(o=>{const c=o.customer||"Unknown";if(!map[c])map[c]={total:0,done:0,hours:0};map[c].total++;if(o.status==="completed")map[c].done++;});
    D.time.filter(t=>inRange(t.logged_date)).forEach(t=>{const wo=D.wos.find(w=>w.id===t.wo_id);if(wo){const c=wo.customer||"Unknown";if(map[c])map[c].hours+=parseFloat(t.hours||0);}});
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,6);})();

  // Drill-down modals
  const drillContent=drillDown==="overdue"?overdueInv:drillDown==="outstanding"?outstandingInv:drillDown==="completed"?completedWOs:null;

  const ranges=[["week","This Week"],["month","This Month"],["quarter","Quarter"],["year","This Year"],["all","All Time"]];

  return(<div>
    {/* Date Range Pills */}
    <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
      {ranges.map(([k,l])=><button key={k} onClick={()=>setRange(k)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid "+(range===k?B.cyan:B.border),background:range===k?B.cyanGlow:"transparent",color:range===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
    </div>

    {/* Primary KPI Cards Row 1 */}
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 130px",minWidth:130,cursor:"pointer"}} onClick={()=>setDrillDown("completed")}>
        <StatCard label="First-Time Fix" value={ftfr+"%"} icon="🎯" color={ftfr>=85?B.green:ftfr>=70?B.orange:B.red}/>
      </div>
      <StatCard label="Tech Utilization" value={techUtil+"%"} icon="⚡" color={techUtil>=80?B.green:techUtil>=60?B.orange:B.red}/>
      <StatCard label="WOs Completed" value={completedWOs.length} icon="✓" color={B.green}/>
      <StatCard label="Hours Logged" value={totalHours.toFixed(0)+"h"} icon="⏱" color={B.cyan}/>
    </div>

    {/* Primary KPI Cards Row 2 — Financial (admin/manager) */}
    {isMgr&&<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      {isAdmin&&<StatCard label="Revenue/Tech" value={"$"+revPerTech.toLocaleString()} icon="💰" color={B.green}/>}
      <StatCard label="Avg Days to Pay" value={avgPayDays+"d"} icon="📊" color={avgPayDays<=15?B.green:avgPayDays<=30?B.orange:B.red}/>
      <div style={{flex:"1 1 130px",minWidth:130,cursor:"pointer"}} onClick={()=>setDrillDown("outstanding")}>
        <StatCard label="Outstanding AR" value={"$"+totalAR.toLocaleString(undefined,{minimumFractionDigits:0})} icon="📋" color={B.cyan}/>
      </div>
      <div style={{flex:"1 1 130px",minWidth:130,cursor:overdueInv.length>0?"pointer":"default"}} onClick={()=>overdueInv.length>0&&setDrillDown("overdue")}>
        <StatCard label={"Overdue ("+overdueInv.length+")"} value={"$"+overdueAmt.toLocaleString(undefined,{minimumFractionDigits:0})} icon="⚠️" color={B.red}/>
      </div>
    </div>}

    {/* Sparkline Trend Widgets */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
      <Card style={{padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8}}>Hours (8 wk)</span>
          <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:B.cyan}}>{sparkWeeks[sparkWeeks.length-1].hrs.toFixed(0)}h</span>
        </div>
        <Sparkline data={sparkWeeks.map(w=>w.hrs)} color={B.cyan} width={200} height={40}/>
      </Card>
      <Card style={{padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8}}>Completions (8 wk)</span>
          <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:B.green}}>{sparkWeeks[sparkWeeks.length-1].comp}</span>
        </div>
        <Sparkline data={sparkWeeks.map(w=>w.comp)} color={B.green} width={200} height={40}/>
      </Card>
      {isAdmin&&<Card style={{padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8}}>Revenue (8 wk)</span>
          <span style={{fontFamily:M,fontSize:12,fontWeight:700,color:B.purple}}>{"$"+sparkWeeks[sparkWeeks.length-1].rev.toLocaleString()}</span>
        </div>
        <Sparkline data={sparkWeeks.map(w=>w.rev)} color={B.purple} width={200} height={40}/>
      </Card>}
    </div>

    {/* Customer Breakdown */}
    {isMgr&&custStats.length>0&&<Card style={{padding:"16px 18px",marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Top Accounts</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {custStats.map(([name,s])=>{const pct=s.total>0?Math.round((s.done/s.total)*100):0;return(
          <div key={name} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:12,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                <span style={{fontSize:10,fontFamily:M,color:B.textDim,flexShrink:0}}>{s.done}/{s.total} WOs · {s.hours.toFixed(0)}h</span>
              </div>
              <div style={{height:4,borderRadius:2,background:B.border,overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",borderRadius:2,background:pct>=80?B.green:pct>=50?B.cyan:B.orange,transition:"width .4s ease-out"}}/>
              </div>
            </div>
            <span style={{fontSize:11,fontFamily:M,fontWeight:700,color:pct>=80?B.green:pct>=50?B.cyan:B.orange,width:36,textAlign:"right"}}>{pct}%</span>
          </div>);})}
      </div>
    </Card>}

    {/* Drill-Down Modal */}
    {drillDown&&drillContent&&<Modal title={drillDown==="overdue"?"Overdue Invoices":drillDown==="outstanding"?"Outstanding Invoices":"Completed Work Orders"} onClose={()=>setDrillDown(null)} wide>
      {drillDown==="overdue"||drillDown==="outstanding"?<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {drillContent.map(inv=><Card key={inv.id} style={{padding:"12px 14px",borderLeft:"3px solid "+(drillDown==="overdue"?B.red:B.cyan)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontFamily:M,fontWeight:800,fontSize:13,color:B.text}}>INV-{inv.invoice_num}</span>
              <span style={{fontSize:12,color:B.textMuted,marginLeft:8}}>{inv.customer}</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:M,fontWeight:700,fontSize:14,color:B.text}}>${parseFloat(inv.amount||0).toFixed(2)}</div>
              <div style={{fontSize:10,color:B.textDim}}>{inv.date_issued&&Math.floor((now-new Date(inv.date_issued))/86400000)+"d ago"}</div>
            </div>
          </div>
        </Card>)}
        {drillContent.length===0&&<div style={{textAlign:"center",padding:20,color:B.textDim,fontSize:13}}>None</div>}
      </div>:<div style={{display:"flex",flexDirection:"column",gap:4}}>
        {drillContent.slice(0,20).map(wo=><Card key={wo.id} style={{padding:"10px 14px",borderLeft:"3px solid "+B.green}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.wo_id}</span><span style={{fontSize:12,fontWeight:600,color:B.text,marginLeft:8}}>{wo.title}</span></div>
            <span style={{fontSize:10,color:B.textDim}}>{wo.date_completed}</span>
          </div>
        </Card>)}
        {drillContent.length>20&&<div style={{textAlign:"center",padding:8,color:B.textDim,fontSize:11}}>+{drillContent.length-20} more</div>}
      </div>}
    </Modal>}
  </div>);
}

function DashAnalytics({wos,time,pos}){
  const weeks=[];const now=new Date();
  for(let i=3;i>=0;i--){const ws=new Date(now);ws.setDate(now.getDate()-now.getDay()-(i*7));ws.setHours(0,0,0,0);const we=new Date(ws);we.setDate(ws.getDate()+6);we.setHours(23,59,59,999);
    const wkWos=wos.filter(o=>{const d=o.date_completed?new Date(o.date_completed):o.created_at?new Date(o.created_at):null;return d&&d>=ws&&d<=we;});
    const completed=wkWos.filter(o=>o.status==="completed").length;
    const hrs=time.filter(t=>{const d=new Date(t.logged_date);return d>=ws&&d<=we;}).reduce((s,t)=>s+parseFloat(t.hours||0),0);
    const poAmt=pos.filter(p=>{const d=new Date(p.created_at);return d>=ws&&d<=we&&p.status==="approved";}).reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const label=ws.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    weeks.push({label,completed,hrs,poAmt});
  }
  const maxHrs=Math.max(...weeks.map(w=>w.hrs),1);
  const maxCompleted=Math.max(...weeks.map(w=>w.completed),1);
  return(<Card style={{padding:20,marginBottom:16}}>
    <div style={{fontSize:14,fontWeight:800,color:B.text,marginBottom:16,letterSpacing:-0.2}}>4-Week Trend</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div><div style={{fontSize:9,color:B.textDim,fontWeight:700,marginBottom:10,letterSpacing:0.8,textTransform:"uppercase"}}>Hours Worked</div><div style={{display:"flex",alignItems:"flex-end",gap:8,height:70}}>{weeks.map((w,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:10,fontFamily:M,color:B.cyan,fontWeight:700}}>{w.hrs.toFixed(0)}</span><div style={{width:"100%",background:`linear-gradient(180deg,${B.cyan},${B.cyanDark})`,borderRadius:4,height:Math.max(6,w.hrs/maxHrs*55)+"px",transition:"height .4s ease-out",boxShadow:"0 2px 8px "+B.cyan+"30"}}/><span style={{fontSize:8,color:B.textDim,fontWeight:500}}>{w.label}</span></div>)}</div></div>
      <div><div style={{fontSize:9,color:B.textDim,fontWeight:700,marginBottom:10,letterSpacing:0.8,textTransform:"uppercase"}}>WOs Completed</div><div style={{display:"flex",alignItems:"flex-end",gap:8,height:70}}>{weeks.map((w,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:10,fontFamily:M,color:B.green,fontWeight:700}}>{w.completed}</span><div style={{width:"100%",background:`linear-gradient(180deg,${B.green},#1A9A73)`,borderRadius:4,height:Math.max(6,w.completed/maxCompleted*55)+"px",transition:"height .4s ease-out",boxShadow:"0 2px 8px "+B.green+"30"}}/><span style={{fontSize:8,color:B.textDim,fontWeight:500}}>{w.label}</span></div>)}</div></div>
    </div>
    <div style={{display:"flex",justifyContent:"space-around",marginTop:18,padding:"14px 0",borderTop:"1px solid "+B.border,borderRadius:"0 0 10px 10px"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,fontFamily:M,color:B.cyan,letterSpacing:-0.5}}>{weeks.reduce((s,w)=>s+w.hrs,0).toFixed(0)}h</div><div style={{fontSize:9,color:B.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>Total Hours</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,fontFamily:M,color:B.green,letterSpacing:-0.5}}>{weeks.reduce((s,w)=>s+w.completed,0)}</div><div style={{fontSize:9,color:B.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>Completed</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,fontFamily:M,color:B.purple,letterSpacing:-0.5}}>{"$"+weeks.reduce((s,w)=>s+w.poAmt,0).toLocaleString()}</div><div style={{fontSize:9,color:B.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>PO Spend</div></div>
    </div>
  </Card>);
}

export { Sparkline, KPIDashboard, DashAnalytics };
