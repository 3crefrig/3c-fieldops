import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, SkeletonLoader, EmptyState, CustomSelect } from "./ui";

function ActivityLog({woId}){
  const[log,setLog]=useState([]),[show,setShow]=useState(false),[loaded,setLoaded]=useState(false);
  const load=async()=>{const{data}=await sb().from("wo_activity").select("*").eq("wo_id",woId).order("created_at",{ascending:false}).limit(20);setLog(data||[]);setLoaded(true);};
  useEffect(()=>{if(show&&!loaded)load();},[show,woId]);
  return(<div style={{marginBottom:16}}>
    <button onClick={()=>setShow(!show)} style={{width:"100%",padding:"10px 14px",background:B.bg,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <span style={{fontSize:12,fontWeight:600,color:B.textDim}}>📝 Activity Log</span><span style={{color:B.textDim,fontSize:12}}>{show?"▾":"▸"}</span>
    </button>
    {show&&<div style={{border:"1px solid "+B.border,borderTop:"none",borderRadius:"0 0 8px 8px",padding:"8px 14px",background:B.surface}}>
      {log.length===0&&<div style={{padding:10,textAlign:"center",color:B.textDim,fontSize:11}}>No activity recorded yet</div>}
      {log.map(l=><div key={l.id} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid "+B.border}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:l.action==="created"?B.green:l.action==="completed"?B.green:B.cyan,marginTop:5,flexShrink:0}}/>
        <div style={{flex:1}}><div style={{fontSize:11,color:B.text}}>{l.details||l.action}</div><div style={{fontSize:9,color:B.textDim}}>{l.actor} · {new Date(l.created_at).toLocaleString()}</div></div>
      </div>)}
    </div>}
  </div>);
}

function GlobalActivityFeed(){
  const[feed,setFeed]=useState([]),[show,setShow]=useState(false),[loading,setLoading]=useState(false);
  const load=async()=>{setLoading(true);const{data}=await sb().from("wo_activity").select("*").order("created_at",{ascending:false}).limit(30);setFeed(data||[]);setLoading(false);};
  useEffect(()=>{if(show&&feed.length===0)load();},[show]);
  const timeAgo=(d)=>{const ms=Date.now()-new Date(d).getTime();const m=Math.floor(ms/60000);if(m<1)return"just now";if(m<60)return m+"m ago";const h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago";};
  const actionIcon=(a)=>a==="created"?"🆕":a==="completed"?"✅":a==="updated"?"✏️":"📝";
  return(<Card style={{marginBottom:16}}>
    <button onClick={()=>{setShow(!show);if(!show&&feed.length===0)load();}} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0}}>
      <span style={{fontSize:13,fontWeight:700,color:B.text}}>📡 Activity Feed</span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>{show&&<button onClick={e=>{e.stopPropagation();load();}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",fontWeight:600}}>Refresh</button>}<span style={{color:B.textDim,fontSize:12}}>{show?"▾":"▸"}</span></div>
    </button>
    {show&&<div style={{marginTop:12,maxHeight:300,overflowY:"auto"}}>
      {loading&&<div style={{textAlign:"center",padding:12,color:B.textDim,fontSize:11}}>Loading...</div>}
      {!loading&&feed.length===0&&<div style={{textAlign:"center",padding:12,color:B.textDim,fontSize:11}}>No activity yet</div>}
      {feed.map(a=><div key={a.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid "+B.border}}>
        <span style={{fontSize:14,flexShrink:0,marginTop:2}}>{actionIcon(a.action)}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:B.text}}>{a.details||a.action}</div>
          <div style={{fontSize:9,color:B.textDim,marginTop:2}}>{a.actor} · {timeAgo(a.created_at)}</div>
        </div>
      </div>)}
    </div>}
  </Card>);
}

export default ActivityLog;
export { ActivityLog, GlobalActivityFeed };
