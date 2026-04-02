import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { B, F, M, IS, LS, BP, BS, ROLES, calcWOHours } from "../shared";
import { Card, StatCard } from "./ui";

function Reports({wos,pos,timeEntries,users,customers}){
  const[range,setRange]=useState("month");const[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState("");
  // Date range presets
  const now=new Date();const todayStr=now.toISOString().slice(0,10);
  const presets={week:new Date(now-7*86400000).toISOString().slice(0,10),month:new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),quarter:new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).toISOString().slice(0,10),year:now.getFullYear()+"-01-01",all:""};
  const from=range==="custom"?dateFrom:presets[range];const to=range==="custom"?dateTo:todayStr;
  // Filter data by range
  const inRange=(d)=>{if(!d)return!from;if(from&&d<from)return false;if(to&&d>to)return false;return true;};
  const fWOs=wos.filter(w=>inRange(w.date_completed||w.created_at?.slice(0,10)));
  const fTime=timeEntries.filter(t=>inRange(t.logged_date));
  const fPOs=pos.filter(p=>p.status==="approved"&&inRange(p.created_at?.slice(0,10)));
  const completed=fWOs.filter(o=>o.status==="completed");
  const techs=users.filter(u=>u.role==="technician"&&u.active!==false);
  const totalHours=fTime.reduce((s,e)=>s+parseFloat(e.hours||0),0);
  const totalPOSpend=fPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const pmCount=fWOs.filter(o=>o.wo_type==="PM").length;const cmCount=fWOs.filter(o=>o.wo_type==="CM").length;

  // KPIs
  const workdays=from?Math.max(1,Math.ceil((new Date(to)-new Date(from))/86400000*5/7)):1;
  const avgJobDuration=completed.length>0?(completed.reduce((s,w)=>s+calcWOHours(w.id,fTime),0)/completed.length):0;
  const avgResponseTime=completed.length>0?(completed.filter(w=>{const firstTime=fTime.filter(t=>t.wo_id===w.id).sort((a,b)=>(a.logged_date||"").localeCompare(b.logged_date||""))[0];return firstTime&&w.created_at;}).reduce((s,w)=>{const firstTime=fTime.filter(t=>t.wo_id===w.id).sort((a,b)=>(a.logged_date||"").localeCompare(b.logged_date||""))[0];return s+Math.max(0,(new Date(firstTime.logged_date)-new Date(w.created_at.slice(0,10)))/86400000);},0)/(completed.filter(w=>fTime.some(t=>t.wo_id===w.id)).length||1)):0;

  const exportCSV=()=>{const rows=[["WO ID","Title","Customer","Status","Assignee","Hours","PO Spend","Date Completed"]];completed.forEach(w=>{const hrs=calcWOHours(w.id,fTime);const poSpend=fPOs.filter(p=>p.wo_id===w.id).reduce((s,p)=>s+parseFloat(p.amount||0),0);rows.push([w.wo_id||"",w.title||"",w.customer||"",w.status||"",w.assignee||"",hrs.toFixed(1),"$"+poSpend.toFixed(2),w.date_completed||""]);});const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="3C_Report_"+from+"_to_"+to+".csv";a.click();URL.revokeObjectURL(url);};
  const exportPDF=()=>{const doc=new jsPDF();doc.setFontSize(18);doc.text("3C FieldOps Report",14,20);doc.setFontSize(10);doc.text("Period: "+(from||"All time")+" to "+(to||"Present"),14,28);doc.setFontSize(11);let y=38;doc.text("Completed WOs: "+completed.length,14,y);y+=7;doc.text("Total Hours: "+totalHours.toFixed(1)+"h",14,y);y+=7;doc.text("PO Spend: $"+totalPOSpend.toLocaleString(),14,y);y+=7;doc.text("Avg Job Duration: "+avgJobDuration.toFixed(1)+"h",14,y);y+=7;doc.text("PM / CM: "+pmCount+" / "+cmCount,14,y);y+=14;doc.setFontSize(12);doc.text("Technician Performance",14,y);y+=8;doc.setFontSize(9);techs.forEach(t=>{const h=fTime.filter(e=>e.technician===t.name).reduce((s,e)=>s+parseFloat(e.hours||0),0);const done=completed.filter(w=>w.assignee===t.name).length;if(y>270){doc.addPage();y=20;}doc.text(t.name+": "+h.toFixed(1)+"h, "+done+" WOs completed",18,y);y+=6;});y+=8;if(y>250){doc.addPage();y=20;}doc.setFontSize(12);doc.text("Completed Work Orders",14,y);y+=8;doc.setFontSize(8);completed.slice(0,40).forEach(w=>{const hrs=calcWOHours(w.id,fTime);if(y>275){doc.addPage();y=20;}doc.text((w.wo_id||"")+" - "+(w.title||"").slice(0,40)+" | "+(w.customer||"")+" | "+hrs.toFixed(1)+"h",18,y);y+=5;});doc.save("3C_Report_"+(from||"all")+"_to_"+(to||"now")+".pdf");};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Reports & KPIs</h3><button onClick={exportCSV} style={{...BS,padding:"4px 10px",fontSize:10}}>Export CSV</button><button onClick={exportPDF} style={{...BS,padding:"4px 10px",fontSize:10}}>Export PDF</button></div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{[["week","Week"],["month","Month"],["quarter","Quarter"],["year","Year"],["all","All"],["custom","Custom"]].map(([k,l])=><button key={k} onClick={()=>setRange(k)} style={{padding:"5px 12px",borderRadius:4,border:"1px solid "+(range===k?B.cyan:B.border),background:range===k?B.cyanGlow:"transparent",color:range===k?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    </div>
    {range==="custom"&&<div style={{display:"flex",gap:8,marginBottom:14}}><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...IS,flex:1,fontSize:11}}/><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...IS,flex:1,fontSize:11}}/></div>}

    {/* KPI Cards */}
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <StatCard label="Completed" value={completed.length} icon="✓" color={B.green}/>
      <StatCard label="Total Hours" value={totalHours.toFixed(1)+"h"} icon="⏱" color={B.cyan}/>
      <StatCard label="Avg Job Duration" value={avgJobDuration.toFixed(1)+"h"} icon="📐" color={B.orange}/>
      <StatCard label="Avg Response" value={avgResponseTime.toFixed(1)+"d"} icon="⚡" color={B.purple}/>
      <StatCard label="PO Spend" value={"$"+totalPOSpend.toLocaleString()} icon="💰" color={B.red}/>
      <StatCard label="PM / CM" value={pmCount+" / "+cmCount} icon="📊" color={B.orange}/>
    </div>

    {/* Tech Performance Table */}
    <Card style={{marginBottom:14,padding:16}}>
      <span style={LS}>Technician Performance</span>
      <div style={{marginTop:10,overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr repeat(4,auto)",gap:"8px 16px",fontSize:11,minWidth:400}}>
          <div style={{fontWeight:700,color:B.textDim,fontSize:9,letterSpacing:.5}}>TECHNICIAN</div>
          <div style={{fontWeight:700,color:B.textDim,fontSize:9,letterSpacing:.5,textAlign:"right"}}>HOURS</div>
          <div style={{fontWeight:700,color:B.textDim,fontSize:9,letterSpacing:.5,textAlign:"right"}}>UTILIZATION</div>
          <div style={{fontWeight:700,color:B.textDim,fontSize:9,letterSpacing:.5,textAlign:"right"}}>WOs DONE</div>
          <div style={{fontWeight:700,color:B.textDim,fontSize:9,letterSpacing:.5,textAlign:"right"}}>AVG HRS/JOB</div>
          {techs.map(t=>{
            const h=fTime.filter(e=>e.technician===t.name).reduce((s,e)=>s+parseFloat(e.hours||0),0);
            const util=Math.min(100,Math.round(h/(workdays*8)*100));
            const done=completed.filter(w=>w.assignee===t.name).length;
            const avg=done>0?h/done:0;
            const maxH=Math.max(...techs.map(t2=>fTime.filter(e=>e.technician===t2.name).reduce((s,e)=>s+parseFloat(e.hours||0),0)),1);
            return(<React.Fragment key={t.id}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:ROLES.technician.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9,fontWeight:800}}>{t.name.split(" ").map(n=>n[0]).join("")}</div>
                <span style={{fontWeight:600,color:B.text}}>{t.name}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}><div style={{width:60,height:6,background:B.bg,borderRadius:3,overflow:"hidden"}}><div style={{width:(h/maxH*100)+"%",height:"100%",background:B.cyan,borderRadius:3}}/></div><span style={{fontFamily:M,fontWeight:700,color:B.cyan}}>{h.toFixed(1)}h</span></div>
              </div>
              <div style={{textAlign:"right",fontFamily:M,fontWeight:700,color:util>=70?B.green:util>=40?B.orange:B.red}}>{util}%</div>
              <div style={{textAlign:"right",fontFamily:M,color:B.text}}>{done}</div>
              <div style={{textAlign:"right",fontFamily:M,color:B.textMuted}}>{avg.toFixed(1)}h</div>
            </React.Fragment>);
          })}
        </div>
      </div>
    </Card>

    {/* Jobs by Customer */}
    <Card style={{marginBottom:14,padding:16}}>
      <span style={LS}>Revenue by Customer</span>
      <div style={{marginTop:8}}>{[...new Set(fWOs.map(w=>w.customer).filter(Boolean))].map(c=>{
        const cWOs=fWOs.filter(w=>w.customer===c);const cTime=fTime.filter(t=>cWOs.some(w=>w.id===t.wo_id));const hrs=cTime.reduce((s,t)=>s+parseFloat(t.hours||0),0);
        const cust=(customers||[]).find(x=>x.name===c);const rate=cust?.billing_rate_override||120;const rev=hrs*rate;
        const cPOs=fPOs.filter(p=>cWOs.some(w=>w.id===p.wo_id));const poCost=cPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);const cmk=cust?.parts_markup!=null?parseFloat(cust.parts_markup):35;const poSpend=Math.round(poCost*(1+cmk/100)*100)/100;
        return(<div key={c} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+B.border}}>
          <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>{c}</div><div style={{fontSize:10,color:B.textDim}}>{cWOs.length} jobs · {hrs.toFixed(1)}h</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.green}}>${rev.toLocaleString()}</div>{poSpend>0&&<div style={{fontSize:9,color:B.textDim}}>+${poSpend.toFixed(0)} parts</div>}</div>
        </div>);
      })}</div>
    </Card>
  </div>);
}

export { Reports };
