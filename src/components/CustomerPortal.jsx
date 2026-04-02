import React, { useState, useEffect } from "react";
import { sb, B, F, M, SC, SL } from "../shared";
import { Card, Badge, StatCard, Spinner } from "./ui";

function Logo({size,onClick}){const h=size==="large"?56:32;return(<img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C Refrigeration" style={{height:h,display:"block",cursor:onClick?"pointer":"default",transition:"opacity .2s"}} onClick={onClick}/>);}

function CustomerPortal({customerSlug}){
  const[data,setData]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{const load=async()=>{const client=sb();const name=decodeURIComponent(customerSlug);const{data:wos}=await client.from("work_orders").select("*").eq("customer",name).order("date_completed",{ascending:false});const{data:time}=await client.from("time_entries").select("*");setData({wos:wos||[],time:time||[],name});setLoading(false);};load();},[customerSlug]);
  if(loading)return <div style={{minHeight:"100vh",background:B.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
  if(!data||data.wos.length===0)return <div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,color:B.text}}><Logo/><div style={{marginTop:20,fontSize:14,color:B.textDim}}>No work orders found for this customer.</div></div>;
  const active=data.wos.filter(o=>o.status!=="completed");const done=data.wos.filter(o=>o.status==="completed");
  const totalHrs=data.wos.reduce((s,wo)=>s+data.time.filter(t=>t.wo_id===wo.id).reduce((ss,t)=>ss+parseFloat(t.hours||0),0),0);
  return(<div style={{minHeight:"100vh",background:B.bg,fontFamily:F,color:B.text}}>
    <div style={{background:B.surface,padding:"14px 20px",borderBottom:"1px solid "+B.border,display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo/><div style={{fontSize:12,color:B.textDim}}>Customer Portal</div></div>
    <div style={{maxWidth:900,margin:"0 auto",padding:20}}>
      <h2 style={{fontSize:20,fontWeight:800,marginBottom:4}}>{data.name}</h2>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Active" value={active.length} icon="🔧" color={B.cyan}/><StatCard label="Completed" value={done.length} icon="✓" color={B.green}/><StatCard label="Total Hours" value={totalHrs.toFixed(1)+"h"} icon="⏱" color={B.orange}/></div>
      {active.length>0&&<><h3 style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:8}}>Active Work Orders</h3>{active.map(wo=><Card key={wo.id} style={{padding:"12px 16px",marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.customer_wo||wo.wo_id}</span><Badge color={SC[wo.status]||B.textDim}>{SL[wo.status]||wo.status}</Badge><Badge color={wo.wo_type==="PM"?B.cyan:B.orange}>{wo.wo_type||"CM"}</Badge></div><div style={{fontSize:13,fontWeight:600,color:B.text,marginTop:2}}>{wo.title}</div>{wo.location&&<div style={{fontSize:11,color:B.textDim}}>📍 {wo.building} — {wo.location}</div>}</div><div style={{fontSize:11,color:B.textDim}}>Due: {wo.due_date}</div></div>
      </Card>)}</>}
      {done.length>0&&<><h3 style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:8,marginTop:16}}>Completed</h3>{done.slice(0,20).map(wo=>{const hrs=data.time.filter(t=>t.wo_id===wo.id).reduce((s,t)=>s+parseFloat(t.hours||0),0);return<Card key={wo.id} style={{padding:"12px 16px",marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.customer_wo||wo.wo_id}</span><span style={{fontSize:10,color:B.green}}>✓ {wo.date_completed}</span></div><div style={{fontSize:13,fontWeight:600,color:B.text,marginTop:2}}>{wo.title}</div>{wo.work_performed&&<div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{wo.work_performed}</div>}{wo.location&&<div style={{fontSize:11,color:B.textDim}}>📍 {wo.building} — {wo.location}</div>}</div><div style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.cyan}}>{hrs}h</div></div>
      </Card>;})}
      {done.length>20&&<div style={{textAlign:"center",fontSize:11,color:B.textDim,padding:10}}>Showing 20 of {done.length} completed orders</div>}</>}
    </div>
  </div>);
}

export { CustomerPortal };
