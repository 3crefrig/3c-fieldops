import React, { useState, useEffect, useRef } from "react";
import { B, BS, SUPABASE_URL, SUPABASE_ANON_KEY, sb } from "../shared";

const PHOTO_STAGES=[{key:"before",label:"Before",icon:"📸",color:"#FFA040"},{key:"during",label:"During",icon:"🔧",color:"#00D4F5"},{key:"after",label:"After",icon:"✅",color:"#26D9A2"},{key:"general",label:"General",icon:"📷",color:"#8B929A"}];

export function CameraUpload({woId,woName,onUploaded,userName,inputId,equipmentId,showStageSelector}){
  const fileRef=useRef(null);
  const[uploading,setUploading]=useState(false);
  const[stage,setStage]=useState("general");
  const handleFile=async(e)=>{
    const file=e.target.files?.[0];if(!file||uploading)return;
    setUploading(true);
    try{
      const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      let finalB64=b64;let finalMime=file.type;
      if(file.size>1024*1024&&file.type.startsWith("image/")){
        const img=new Image();const url=URL.createObjectURL(file);
        await new Promise(res=>{img.onload=res;img.src=url;});
        const canvas=document.createElement("canvas");const maxW=1200;const scale=Math.min(1,maxW/img.width);
        canvas.width=img.width*scale;canvas.height=img.height*scale;
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        finalB64=canvas.toDataURL("image/jpeg",0.8).split(",")[1];finalMime="image/jpeg";
        URL.revokeObjectURL(url);
      }
      const folderPath=equipmentId?"3C FieldOps/Equipment":"3C FieldOps/Work Orders/"+(woName||woId);
      const resp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64:finalB64,fileName:Date.now()+"_"+file.name,mimeType:finalMime,folderPath})});
      const result=await resp.json();
      if(result.success){
        const record={filename:file.name,photo_url:result.thumbnailUrl,uploaded_by:userName,drive_synced:true,photo_stage:stage};
        if(woId)record.wo_id=woId;
        if(equipmentId)record.equipment_id=equipmentId;
        await sb().from("photos").insert(record);
        if(onUploaded)onUploaded();
      }else{console.error("Drive upload error:",result.error);}
    }catch(err){console.error("Upload error:",err);}
    setUploading(false);
    if(fileRef.current)fileRef.current.value="";
  };
  return(<div>
    {showStageSelector&&<div style={{display:"flex",gap:4,marginBottom:8}}>
      {PHOTO_STAGES.map(s=><button key={s.key} onClick={()=>setStage(s.key)} style={{flex:1,padding:"6px 4px",borderRadius:4,border:"1px solid "+(stage===s.key?s.color:B.border),background:stage===s.key?s.color+"18":"transparent",color:stage===s.key?s.color:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'Barlow',sans-serif",textAlign:"center"}}>{s.icon} {s.label}</button>)}
    </div>}
    <input ref={fileRef} id={inputId} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
    <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...BS,width:"100%",padding:14,opacity:uploading?.6:1}}>
      <div style={{fontSize:24,marginBottom:4}}>📷</div>
      <div style={{fontSize:12}}>{uploading?"Uploading to Drive...":(showStageSelector?"Take "+PHOTO_STAGES.find(s=>s.key===stage)?.label+" Photo":"Tap to Take Photo or Choose from Gallery")}</div>
    </button>
  </div>);
}

// Photo Timeline component for WO detail
export function PhotoTimeline({photos}){
  if(!photos||photos.length===0)return null;
  const stages=["before","during","after","general"];
  const grouped={};stages.forEach(s=>{grouped[s]=photos.filter(p=>(p.photo_stage||"general")===s);});
  const hasStaged=grouped.before.length>0||grouped.during.length>0||grouped.after.length>0;
  if(!hasStaged)return null; // Don't show timeline if no staged photos
  const stageInfo={before:{label:"Before",color:"#FFA040",icon:"📸"},during:{label:"During",color:"#00D4F5",icon:"🔧"},after:{label:"After",color:"#26D9A2",icon:"✅"}};
  return(<div style={{marginTop:8}}>
    <div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",marginBottom:8}}>Photo Timeline</div>
    {["before","during","after"].map(s=>{const items=grouped[s];if(items.length===0)return null;const info=stageInfo[s];
      return<div key={s} style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:12}}>{info.icon}</span><span style={{fontSize:11,fontWeight:700,color:info.color}}>{info.label}</span><div style={{flex:1,height:1,background:info.color+"33"}}/></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingLeft:20}}>
          {items.map((p,i)=><a key={i} href={(p.photo_url||"").replace("thumbnail?id=","file/d/").replace("&sz=w400","/view")} target="_blank" rel="noreferrer" style={{borderRadius:6,overflow:"hidden",border:"2px solid "+info.color+"44"}}>
            {p.photo_url?<img src={p.photo_url} alt={p.filename} style={{width:80,height:80,objectFit:"cover",display:"block"}}/>:<div style={{width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center",background:B.bg,fontSize:10,color:B.textDim}}>{p.filename}</div>}
          </a>)}
        </div>
      </div>;})}
  </div>);
}

export function NotifBell({notifications,onMarkRead,onQuickApprovePO,onQuickRejectPO,userRole,onNavigate}){
  const[open,setOpen]=useState(false);const bellRef=useRef(null);
  useEffect(()=>{if(!open)return;const handler=(e)=>{if(bellRef.current&&!bellRef.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler);},[open]);
  const unread=notifications.filter(n=>!n.read).length;
  const isManager=userRole==="admin"||userRole==="manager";
  const tapNotif=(n)=>{const woMatch=n.message?.match(/WO-\d+/);if(woMatch&&onNavigate){onNavigate(woMatch[0]);setOpen(false);}};
  return(<div ref={bellRef} style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",position:"relative"}}>🔔{unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:B.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}</button>
    {open&&<div style={{position:"absolute",right:0,top:30,width:300,background:B.surface,border:"1px solid "+B.border,borderRadius:8,zIndex:999,maxHeight:350,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+B.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:B.text}}>Notifications</span>{unread>0&&<button onClick={async()=>{await onMarkRead();setOpen(false);}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer"}}>Mark all read</button>}</div>
      {notifications.length===0&&<div style={{padding:20,textAlign:"center",color:B.textDim,fontSize:11}}>No notifications</div>}
      {notifications.slice(0,20).map(n=><div key={n.id} onClick={()=>tapNotif(n)} style={{padding:"8px 14px",borderBottom:"1px solid "+B.border,background:n.read?"transparent":B.cyanGlow,cursor:n.message?.match(/WO-\d+/)?"pointer":"default"}}>
        <div style={{fontSize:11,fontWeight:700,color:n.read?B.textDim:B.text}}>{n.title}</div>
        <div style={{fontSize:10,color:B.textDim}}>{n.message}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}><span style={{fontSize:9,color:B.textDim}}>{new Date(n.created_at).toLocaleString()}</span>{n.message?.match(/WO-\d+/)&&<span style={{fontSize:9,color:B.cyan}}>Tap to view →</span>}</div>
        {isManager&&n.type==="po_requested"&&!n.read&&<div style={{display:"flex",gap:4,marginTop:6}}><button onClick={async(e)=>{e.stopPropagation();if(onQuickApprovePO)await onQuickApprovePO(n);}} style={{padding:"4px 10px",borderRadius:4,border:"none",background:B.green,color:B.bg,fontSize:10,fontWeight:700,cursor:"pointer"}}>Approve</button><button onClick={async(e)=>{e.stopPropagation();if(onQuickRejectPO)await onQuickRejectPO(n);}} style={{padding:"4px 10px",borderRadius:4,border:"none",background:B.red,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>Reject</button></div>}
      </div>)}
    </div>}
  </div>);
}
