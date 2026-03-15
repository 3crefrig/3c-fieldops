import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

/*
 * 3C Refrigeration FieldOps Pro — Full Feature Edition
 * Supabase backend, real camera, notifications, reports, recurring PMs,
 * customer billing export, invoice PDF, offline-ready
 */

const SUPABASE_URL = "https://gwwijjkahwieschfdfbq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3d2lqamthaHdpZXNjaGZkZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NzYsImV4cCI6MjA4ODIzODU3Nn0.c79jtEZv9CQ8P2CC6NXyrKqax510530tAMhLnNt75TI";

const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
function sb(){ return _sb; }

const B={bg:"#101214",surface:"#1A1D21",surfaceActive:"#2A2F35",border:"#2E3338",text:"#E8EAED",textMuted:"#8B929A",textDim:"#5E656E",cyan:"#00D4F5",cyanDark:"#00A5C0",cyanGlow:"rgba(0,212,245,0.12)",red:"#FF4757",orange:"#FFA040",green:"#26D9A2",purple:"#A78BFA",greenGlow:"rgba(38,217,162,0.15)",orangeGlow:"rgba(255,160,64,0.15)"};
const F="'Barlow',sans-serif",M="'JetBrains Mono',monospace";
const ROLES={admin:{label:"Admin",color:B.red,grad:`linear-gradient(135deg,${B.red},#C0392B)`},manager:{label:"Manager",color:B.green,grad:`linear-gradient(135deg,${B.green},#1A9A73)`},technician:{label:"Technician",color:B.cyan,grad:`linear-gradient(135deg,${B.cyan},${B.cyanDark})`}};
const _BW=["fuck","shit","ass","bitch","damn","dick","cock","pussy","cunt","bastard","slut","whore","nigger","nigga","faggot","fag","retard","retarded","spic","chink","kike","wetback","cracker","dyke","tranny","motherfucker","bullshit","asshole","dumbass","jackass","goddamn","piss","twat","wanker"];
const hasProfanity=(text)=>{if(!text)return false;const lower=text.toLowerCase().replace(/[^a-z\s]/g,"");return _BW.some(w=>{const re=new RegExp("\\b"+w+"\\b","i");return re.test(lower);});};
const cleanText=(text,fieldName)=>{if(hasProfanity(text)){alert("Inappropriate language detected in "+fieldName+". Please use professional language.");return null;}return text;};
const PC={high:B.red,medium:B.orange,low:B.green};
const SC={pending:B.orange,in_progress:B.cyan,completed:B.green};
const SL={pending:"Pending",in_progress:"In Progress",completed:"Completed"};
const PSC={pending:B.orange,approved:B.green,rejected:B.red,revised:B.purple};
const PSL={pending:"Pending",approved:"Approved",rejected:"Rejected",revised:"Revised"};
const IS={width:"100%",padding:"10px 12px",borderRadius:6,border:"1px solid "+B.border,background:B.bg,color:B.text,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"};
const LS={fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:4,display:"block"};
const BP={padding:"10px 18px",borderRadius:6,border:"none",background:B.cyan,color:B.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F};
const BS={padding:"10px 18px",borderRadius:6,border:"1px solid "+B.border,background:B.bg,color:B.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F};

function genPO(list){const n=new Date(),pfx=String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0");const mx=list.filter(p=>p.po_id&&p.po_id.startsWith(pfx)).reduce((m,p)=>{const s=parseInt(p.po_id.slice(4));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}

function Logo({size}){const h=size==="large"?56:28,w=Math.round(240*(h/56));return(<svg width={w} height={h} viewBox="0 0 240 56" fill="none" style={{display:"block"}}><text x="0" y="36" fontFamily="Barlow,sans-serif" fontWeight="900" fontSize="42" fill="#FFF" letterSpacing="-2">3C</text><g transform="translate(62,6)"><line x1="14" y1="0" x2="14" y2="28" stroke={B.cyan} strokeWidth="2.4" strokeLinecap="round"/><line x1="0" y1="14" x2="28" y2="14" stroke={B.cyan} strokeWidth="2.4" strokeLinecap="round"/><line x1="4" y1="4" x2="24" y2="24" stroke={B.cyan} strokeWidth="1.6" strokeLinecap="round"/><line x1="24" y1="4" x2="4" y2="24" stroke={B.cyan} strokeWidth="1.6" strokeLinecap="round"/><circle cx="14" cy="14" r="3" fill={B.bg} stroke={B.cyan} strokeWidth="1.8"/></g><rect x="94" y="16" width="142" height="20" rx="2" fill={B.cyan}/><text x="100" y="30.5" fontFamily="Barlow,sans-serif" fontWeight="800" fontSize="11" fill={B.bg} letterSpacing="5">REFRIGERATION</text></svg>);}
function Badge({color,children}){return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,background:color+"22",color,fontSize:10,fontWeight:700,textTransform:"uppercase",fontFamily:F}}>{children}</span>;}
function Card({children,onClick,style}){return <div onClick={onClick} style={{background:B.surface,borderRadius:8,padding:18,border:"1px solid "+B.border,cursor:onClick?"pointer":"default",transition:"border-color .2s",...style}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=B.cyan+"60"}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.border}}>{children}</div>;}
function StatCard({label,value,icon,color}){return <Card style={{flex:"1 1 120px",minWidth:120,borderLeft:"3px solid "+color,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:8,right:10,fontSize:22,opacity:.12}}>{icon}</div><div style={{fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:28,fontWeight:900,color,marginTop:2,fontFamily:M}}>{value}</div></Card>;}
function Modal({title,onClose,children,wide}){return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}}><div style={{background:B.surface,borderRadius:12,padding:24,width:"90%",maxWidth:wide?600:420,maxHeight:"85vh",overflowY:"auto",border:"1px solid "+B.border}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:B.text}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:B.textDim,fontSize:20,cursor:"pointer"}}>×</button></div>{children}</div></div>;}
function Toast({msg}){if(!msg)return null;return <div style={{position:"fixed",top:16,right:16,zIndex:2000,background:B.cyan,color:B.bg,padding:"10px 18px",borderRadius:8,fontSize:13,fontWeight:700}}>✓ {msg}</div>;}
function DSBadge({ok}){return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 6px",borderRadius:4,background:ok?B.greenGlow:B.orangeGlow,color:ok?B.green:B.orange,fontSize:9,fontWeight:700,textTransform:"uppercase"}}><span style={{width:5,height:5,borderRadius:"50%",background:ok?B.green:B.orange}}/>{ok?"Synced":"Pending"}</span>;}
function Spinner(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid "+B.border,borderTopColor:B.cyan,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}

// ═══════════════════════════════════════════
// SIGNATURE PAD + CAMERA UPLOAD
// ═══════════════════════════════════════════
function SignaturePad({onSign}){
  const canvasRef=useCallback(canvas=>{
    if(!canvas)return;const ctx=canvas.getContext("2d");ctx.fillStyle=B.bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=B.cyan;ctx.lineWidth=2;ctx.lineCap="round";ctx.lineJoin="round";
    let drawing=false,lastX=0,lastY=0;
    const getPos=(e)=>{const r=canvas.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return[t.clientX-r.left,t.clientY-r.top];};
    const start=(e)=>{e.preventDefault();drawing=true;[lastX,lastY]=getPos(e);};
    const move=(e)=>{if(!drawing)return;e.preventDefault();const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();lastX=x;lastY=y;canvas._hasSig=true;};
    const stop=()=>{drawing=false;};
    canvas.addEventListener("mousedown",start);canvas.addEventListener("mousemove",move);canvas.addEventListener("mouseup",stop);canvas.addEventListener("mouseleave",stop);
    canvas.addEventListener("touchstart",start,{passive:false});canvas.addEventListener("touchmove",move,{passive:false});canvas.addEventListener("touchend",stop);
    canvas._clear=()=>{ctx.fillStyle=B.bg;ctx.fillRect(0,0,canvas.width,canvas.height);canvas._hasSig=false;};
    canvas._getData=()=>canvas._hasSig?canvas.toDataURL("image/png"):null;
    if(onSign)onSign(canvas);
  },[]);
  return <canvas ref={canvasRef} width={320} height={140} style={{border:"1px solid "+B.border,borderRadius:6,touchAction:"none",cursor:"crosshair",width:"100%",maxWidth:320,height:140}}/>;
}

function CameraUpload({woId,woName,onUploaded,userName}){
  const fileRef=useRef(null);
  const[uploading,setUploading]=useState(false);
  const handleFile=async(e)=>{
    const file=e.target.files?.[0];if(!file||uploading)return;
    setUploading(true);
    try{
      // Convert to base64
      const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      // Compress if image is large (>1MB)
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
      const resp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64:finalB64,fileName:Date.now()+"_"+file.name,mimeType:finalMime,folderPath:"3C FieldOps/Work Orders/"+(woName||woId)})});
      const result=await resp.json();
      if(result.success){
        await sb().from("photos").insert({wo_id:woId,filename:file.name,photo_url:result.thumbnailUrl,uploaded_by:userName,drive_synced:true});
        if(onUploaded)onUploaded();
      }else{console.error("Drive upload error:",result.error);}
    }catch(err){console.error("Upload error:",err);}
    setUploading(false);
    if(fileRef.current)fileRef.current.value="";
  };
  return(<div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
    <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...BS,width:"100%",padding:14,opacity:uploading?.6:1}}>
      <div style={{fontSize:24,marginBottom:4}}>📷</div>
      <div style={{fontSize:12}}>{uploading?"Uploading to Drive...":"Tap to Take Photo or Choose from Gallery"}</div>
    </button>
  </div>);
}

// ═══════════════════════════════════════════
// NOTIFICATION BELL
// ═══════════════════════════════════════════
function NotifBell({notifications,onMarkRead,onQuickApprovePO,onQuickRejectPO,userRole}){
  const[open,setOpen]=useState(false);
  const unread=notifications.filter(n=>!n.read).length;
  const isManager=userRole==="admin"||userRole==="manager";
  return(<div style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",position:"relative"}}>🔔{unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:B.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}</button>
    {open&&<div style={{position:"absolute",right:0,top:30,width:300,background:B.surface,border:"1px solid "+B.border,borderRadius:8,zIndex:999,maxHeight:350,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+B.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:B.text}}>Notifications</span>{unread>0&&<button onClick={async()=>{await onMarkRead();setOpen(false);}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer"}}>Mark all read</button>}</div>
      {notifications.length===0&&<div style={{padding:20,textAlign:"center",color:B.textDim,fontSize:11}}>No notifications</div>}
      {notifications.slice(0,20).map(n=><div key={n.id} style={{padding:"8px 14px",borderBottom:"1px solid "+B.border,background:n.read?"transparent":B.cyanGlow}}>
        <div style={{fontSize:11,fontWeight:700,color:n.read?B.textDim:B.text}}>{n.title}</div>
        <div style={{fontSize:10,color:B.textDim}}>{n.message}</div>
        <div style={{fontSize:9,color:B.textDim,marginTop:2}}>{new Date(n.created_at).toLocaleString()}</div>
        {isManager&&n.type==="po_requested"&&!n.read&&<div style={{display:"flex",gap:4,marginTop:6}}><button onClick={async()=>{if(onQuickApprovePO)await onQuickApprovePO(n);}} style={{padding:"4px 10px",borderRadius:4,border:"none",background:B.green,color:B.bg,fontSize:10,fontWeight:700,cursor:"pointer"}}>Approve</button><button onClick={async()=>{if(onQuickRejectPO)await onQuickRejectPO(n);}} style={{padding:"4px 10px",borderRadius:4,border:"none",background:B.red,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>Reject</button></div>}
      </div>)}
    </div>}
  </div>);
}

// ═══════════════════════════════════════════
// LOGIN + FIRST SETUP + SHELL
// ═══════════════════════════════════════════
function LoginScreen({authUser,loading}){
  const signIn=async()=>{await sb().auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});};
  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F}}><Logo size="large"/><div style={{marginTop:20}}><Spinner/></div><div style={{color:B.textDim,fontSize:12,marginTop:10}}>Connecting...</div></div>);
  if(authUser)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:F}}><div style={{width:"100%",maxWidth:400,textAlign:"center"}}><div style={{display:"inline-block",marginBottom:20}}><Logo size="large"/></div><Card><div style={{fontSize:40,marginBottom:10}}>🚫</div><div style={{fontSize:16,fontWeight:800,color:B.red,marginBottom:8}}>Access Denied</div><div style={{fontSize:13,color:B.textMuted,marginBottom:6}}><span style={{fontFamily:M,color:B.text}}>{authUser.email}</span> is not registered.</div><div style={{fontSize:12,color:B.textDim,marginBottom:16}}>Ask your admin to add your Gmail and assign a role.</div><button onClick={async()=>{await sb().auth.signOut();}} style={{...BS,width:"100%"}}>Sign Out</button></Card></div></div>);
  return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:F}}><div style={{width:"100%",maxWidth:400,textAlign:"center"}}><div style={{display:"inline-block",marginBottom:20}}><Logo size="large"/></div><div style={{width:60,height:2,background:B.cyan,margin:"0 auto 14px",borderRadius:1}}/><div style={{fontSize:11,color:B.textDim,fontWeight:600,letterSpacing:3,textTransform:"uppercase",marginBottom:30}}>Field Service Platform</div><Card><div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:16}}>Sign in with your Google account</div><button onClick={signIn} style={{...BP,width:"100%",padding:14,background:"#fff",color:"#333",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 000 24c0 3.77.89 7.34 2.47 10.52l8.06-5.93z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Sign in with Google</button><div style={{fontSize:11,color:B.textDim,marginTop:14}}>Your admin must add your Gmail first.</div></Card></div></div>);
}

function FirstSetup({authUser,onDone}){
  const[saving,setSaving]=useState(false);
  const go=async()=>{if(saving)return;setSaving(true);await sb().from("users").insert({name:authUser.user_metadata?.full_name||authUser.email,email:authUser.email.toLowerCase(),role:"admin",active:true});await onDone();setSaving(false);};
  return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:F}}><div style={{width:"100%",maxWidth:400,textAlign:"center"}}><div style={{display:"inline-block",marginBottom:20}}><Logo size="large"/></div><Card><div style={{fontSize:18,fontWeight:800,color:B.cyan,marginBottom:6}}>Welcome to FieldOps Pro</div><div style={{fontSize:12,color:B.textMuted,marginBottom:14}}>No users exist yet. You're signed in as:</div><div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>{authUser.user_metadata?.full_name||"User"}</div><div style={{fontFamily:M,fontSize:12,color:B.textDim,marginBottom:18}}>{authUser.email}</div><button onClick={go} disabled={saving} style={{...BP,width:"100%",padding:12,background:ROLES.admin.grad,opacity:saving?.6:1}}>{saving?"Creating...":"Create My Admin Account"}</button></Card></div></div>);
}

function Shell({user,onLogout,children,tab,setTab,tabs,syncing,notifications,onMarkRead,onQuickApprovePO,onQuickRejectPO}){
  return(<div style={{minHeight:"100vh",background:B.bg,fontFamily:F,color:B.text,display:"flex",flexDirection:"column"}}>
    <div style={{background:B.surface,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+B.border,flexWrap:"wrap",gap:8}}>
      <Logo/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {syncing&&<span style={{fontSize:10,color:B.orange}}>syncing...</span>}
        <NotifBell notifications={notifications||[]} onMarkRead={onMarkRead} onQuickApprovePO={onQuickApprovePO} onQuickRejectPO={onQuickRejectPO} userRole={user.role}/>
        <Badge color={ROLES[user.role]?ROLES[user.role].color:B.textDim}>{user.role}</Badge>
        <span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>{user.name}</span>
        <button onClick={onLogout} style={{...BS,padding:"5px 10px",fontSize:11}}>Sign Out</button>
      </div>
    </div>
    <div style={{background:B.surface,padding:"0 20px",display:"flex",gap:2,borderBottom:"1px solid "+B.border,overflowX:"auto",position:"sticky",top:0,zIndex:100}}>{tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 14px",border:"none",background:"none",fontSize:12,fontWeight:600,color:tab===t.key?B.cyan:B.textDim,borderBottom:tab===t.key?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>)}</div>
    <div style={{flex:1,padding:"16px 12px",overflowY:"auto",maxWidth:1200,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>{children}</div>
  </div>);
}

// ═══════════════════════════════════════════
// PO MODALS + MANAGEMENT (same as before)
// ═══════════════════════════════════════════
function POReqModal({wo,pos,onCreatePO,onClose,userName,userRole}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
  const existing=pos.filter(p=>p.wo_id===wo.id);
  const go=async()=>{if(!desc.trim()||saving)return;if(cleanText(desc,"PO Description")===null||cleanText(notes,"PO Notes")===null)return;setSaving(true);await onCreatePO({wo_id:wo.id,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim()});setSaving(false);onClose();};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}><span style={LS}>Existing POs on {wo.wo_id}</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=>{const canSee=isMgr||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.description}{canSee?" · $"+po.amount:""}</span></div><Badge color={PSC[po.status]}>{PSL[po.status]}</Badge></div>})}</div><div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div></div>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Parts/Materials</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Compressor refrigerant R-404A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted}}>{wo.wo_id}</div></div></div>
      <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Vendor, shipping, etc." style={IS}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Request New PO"}</button></div>
    </div></Modal>);
}

function POEditForm({po,onSave,onClose}){
  const[desc,setDesc]=useState(po.description),[amt,setAmt]=useState(String(po.amount)),[notes,setNotes]=useState(po.notes||""),[status,setStatus]=useState(po.status),[saving,setSaving]=useState(false);
  const go=async()=>{if(saving)return;setSaving(true);await onSave({...po,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim(),status});setSaving(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Description</label><input value={desc} onChange={e=>setDesc(e.target.value)} style={IS}/></div>
    <div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
    <div><label style={LS}>Status</label><select value={status} onChange={e=>setStatus(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revised">Revised</option></select></div>
    <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} style={IS}/></div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
  </div>);
}

function POMgmt({pos,onUpdatePO,wos}){
  const[filter,setFilter]=useState("all"),[editing,setEditing]=useState(null),[toast,setToast]=useState(""),[search,setSearch]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};const flt=pos.filter(p=>{if(filter!=="all"&&p.status!==filter)return false;if(search){const s=search.toLowerCase();const wo=wos.find(o=>o.id===p.wo_id);return(p.po_id||"").toLowerCase().includes(s)||(p.description||"").toLowerCase().includes(s)||(p.requested_by||"").toLowerCase().includes(s)||(wo?.title||"").toLowerCase().includes(s)||(wo?.customer||"").toLowerCase().includes(s);}return true;});const pc=pos.filter(p=>p.status==="pending").length;
  const approve=async(po)=>{await onUpdatePO({...po,status:"approved"});msg("PO "+po.po_id+" approved");};
  const reject=async(po)=>{await onUpdatePO({...po,status:"rejected"});msg("PO "+po.po_id+" rejected");};
  const approved=pos.filter(p=>p.status==="approved");const approvedAmt=approved.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total POs" value={pos.length} icon="📄" color={B.cyan}/><StatCard label="Pending" value={pc} icon="⏳" color={B.orange}/><StatCard label="Approved" value={approved.length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+approvedAmt.toLocaleString()} icon="💰" color={B.purple}/></div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search POs by #, description, tech, customer..." style={{...IS,marginBottom:14,padding:"8px 12px",fontSize:12}}/>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No POs found</div>}
      {flt.map(po=>{const wo=wos.find(o=>o.id===po.wo_id);return(
        <Card key={po.id} style={{padding:"14px 16px",borderLeft:"3px solid "+(PSC[po.status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontFamily:M,fontWeight:800,fontSize:15,color:B.text}}>{po.po_id}</span><Badge color={PSC[po.status]||B.textDim}>{PSL[po.status]||po.status}</Badge>{wo&&<span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.wo_id}</span>}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{po.description}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>By {po.requested_by} · {po.created_at?.slice(0,10)} · <span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(po.amount||0).toFixed(2)}</span>{wo&&<span> · {wo.title}</span>}</div>
              {po.notes&&<div style={{fontSize:11,color:B.orange,marginTop:4,fontStyle:"italic"}}>Note: {po.notes}</div>}
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>setEditing(po)} style={{...BS,padding:"5px 10px",fontSize:11}}>Edit</button>
              {po.status==="pending"&&<><button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Approve</button><button onClick={()=>reject(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.red}}>Reject</button></>}
              {po.status==="rejected"&&<button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Re-approve</button>}
            </div></div></Card>);})}
    </div>
    {editing&&<Modal title={"Edit PO "+editing.po_id} onClose={()=>setEditing(null)}><POEditForm po={editing} onSave={async u=>{await onUpdatePO(u);setEditing(null);msg("PO "+u.po_id+" updated");}} onClose={()=>setEditing(null)}/></Modal>}
  </div>);
}

// ═══════════════════════════════════════════
// WORK ORDER DETAIL — Redesigned for field use
// ═══════════════════════════════════════════
function ActivityLog({woId}){
  const[log,setLog]=useState([]),[show,setShow]=useState(false);
  const load=async()=>{const{data}=await sb().from("wo_activity").select("*").eq("wo_id",woId).order("created_at",{ascending:false}).limit(20);setLog(data||[]);};
  useEffect(()=>{if(show&&log.length===0)load();},[show]);
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
function WODetail({wo,onBack,onUpdateWO,onDeleteWO,onCreateWO,canEdit,pos,onCreatePO,timeEntries,onAddTime,onUpdateTime,onDeleteTime,photos,onAddPhoto,users,userName,userRole,loadData}){
  const[showTime,setShowTime]=useState(false),[showPO,setShowPO]=useState(false),[showComplete,setShowComplete]=useState(false),[editingTime,setEditingTime]=useState(null),[completeStep,setCompleteStep]=useState(1);
  const[localCustWO,setLocalCustWO]=useState(wo.customer_wo||"");
  const[showFollowUp,setShowFollowUp]=useState(false),[fuNotes,setFuNotes]=useState("");
  const[tH,setTH]=useState(""),[tD,setTD]=useState(""),[tDate,setTDate]=useState(new Date().toISOString().slice(0,10)),[note,setNote]=useState("");
  const[cmpH,setCmpH]=useState(""),[cmpD,setCmpD]=useState(""),[cmpDate,setCmpDate]=useState(new Date().toISOString().slice(0,10));
  const[workPerformed,setWorkPerformed]=useState("");
  const[toast,setToast]=useState(""),[saving,setSaving]=useState(false);
  const[sigCanvas,setSigCanvas]=useState(null),[sigErr,setSigErr]=useState(""),[compDate,setCompDate]=useState(new Date().toISOString().slice(0,10));
  const[showDetails,setShowDetails]=useState(false),[showTimeEntries,setShowTimeEntries]=useState(false),[showPhotos,setShowPhotos]=useState(false),[showPOs,setShowPOs]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const woPOs=pos.filter(p=>p.wo_id===wo.id);const woTime=timeEntries.filter(t=>t.wo_id===wo.id);const woPhotos=photos.filter(p=>p.wo_id===wo.id);
  const hasData=woTime.length>0||woPOs.length>0||woPhotos.length>0||(wo.notes&&wo.notes.trim()&&wo.notes!=="No details.")||parseFloat(wo.hours_total||0)>0;
  const isManager=userRole==="admin"||userRole==="manager";
  const canEditTime=(te)=>isManager||te.technician===userName;
  const addTime=async()=>{const h=parseFloat(tH);if(!h||h<=0||!tD.trim()||saving)return;if(cleanText(tD,"Time Description")===null)return;setSaving(true);await onAddTime({wo_id:wo.id,hours:h,description:tD.trim(),logged_date:tDate});await onUpdateWO({...wo,hours_total:parseFloat(wo.hours_total||0)+h});setSaving(false);setTH("");setTD("");setShowTime(false);msg("Logged "+h+"h");};
  const saveTimeEdit=async()=>{if(!editingTime||saving)return;const h=parseFloat(editingTime.hours);if(!h||h<=0)return;setSaving(true);const oldH=parseFloat(woTime.find(t=>t.id===editingTime.id)?.hours||0);await onUpdateTime(editingTime);await onUpdateWO({...wo,hours_total:parseFloat(wo.hours_total||0)-oldH+h});setSaving(false);setEditingTime(null);msg("Time entry updated");};
  const deleteTimeEntry=async(te)=>{if(saving)return;if(!window.confirm("Delete this time entry ("+te.hours+"h)?"))return;setSaving(true);await onDeleteTime(te.id);await onUpdateWO({...wo,hours_total:Math.max(0,parseFloat(wo.hours_total||0)-parseFloat(te.hours||0))});setSaving(false);msg("Time entry deleted");};
  const addFieldNote=async()=>{if(!note.trim()||saving)return;if(cleanText(note,"Field Note")===null)return;setSaving(true);const ts=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});const newNotes=(wo.field_notes||"")+"\n["+ts+" — "+userName+"] "+note.trim();const{error}=await sb().from("work_orders").update({field_notes:newNotes}).eq("id",wo.id);if(error)console.error("field note error:",error);await loadData();setSaving(false);setNote("");msg("Field note added");};
  const[editingDetails,setEditingDetails]=useState(false),[detailsText,setDetailsText]=useState(wo.notes||"");
  const saveDetails=async()=>{if(saving)return;setSaving(true);const{error}=await sb().from("work_orders").update({notes:detailsText}).eq("id",wo.id);if(error)console.error("save details error:",error);await loadData();setSaving(false);setEditingDetails(false);msg("Job details updated");};
  const changeStatus=async(newStatus)=>{if(saving)return;if(newStatus==="completed"){openCompleteFlow();return;}setSaving(true);await onUpdateWO({...wo,status:newStatus});setSaving(false);msg("Status → "+SL[newStatus]);};
  const getAutoWorkPerformed=()=>{const descs=woTime.map(t=>t.description).filter(Boolean);const unique=[...new Set(descs)];return wo.work_performed||unique.join(". ")||"";};
  const openCompleteFlow=()=>{setSigErr("");setCmpH("");setCmpD("");setCmpDate(new Date().toISOString().slice(0,10));setCompDate(new Date().toISOString().slice(0,10));setWorkPerformed(getAutoWorkPerformed());setCompleteStep(woTime.length>0?2:1);setShowComplete(true);};
  const logTimeAndContinue=async()=>{const h=parseFloat(cmpH);if(!h||h<=0||!cmpD.trim()){setSigErr("Enter hours and description first.");return;}if(cleanText(cmpD,"Description")===null)return;setSigErr("");setSaving(true);await onAddTime({wo_id:wo.id,hours:h,description:cmpD.trim(),logged_date:cmpDate});await onUpdateWO({...wo,hours_total:parseFloat(wo.hours_total||0)+h});setSaving(false);if(!workPerformed)setWorkPerformed(cmpD.trim());setCompleteStep(2);msg("Time logged");};
  const markComplete=async()=>{if(saving)return;if(!compDate){setSigErr("Completion date required.");return;}if(!sigCanvas||!sigCanvas._getData||!sigCanvas._getData()){setSigErr("Signature required.");return;}if(workPerformed&&cleanText(workPerformed,"Work Performed")===null)return;setSigErr("");setSaving(true);await onUpdateWO({...wo,status:"completed",date_completed:compDate,signature:sigCanvas._getData(),work_performed:workPerformed.trim()||null});setSaving(false);setShowComplete(false);setShowFollowUp(true);msg("Completed & Signed");};
  const createFollowUp=async()=>{if(saving)return;if(cleanText(fuNotes,"Follow-up Notes")===null)return;setSaving(true);await onCreateWO({title:"Follow-up: "+wo.title,priority:wo.priority,assignee:wo.assignee,due_date:"TBD",notes:"Follow-up from "+wo.wo_id+".\n"+fuNotes.trim(),location:wo.location||"",wo_type:"CM",building:wo.building||"",customer:wo.customer||"",customer_wo:"",crew:wo.crew||[]});setSaving(false);setShowFollowUp(false);setFuNotes("");msg("Follow-up WO created");};
  const tryDelete=async()=>{const msg2=hasData?"This work order has data. Are you SURE you want to delete "+wo.wo_id+"? This cannot be undone.":"Delete "+wo.wo_id+"? This cannot be undone.";if(!window.confirm(msg2))return;setSaving(true);const{error}=await sb().from("work_orders").delete().eq("id",wo.id);if(error){console.error("delete error:",error);setSaving(false);return;}await loadData();setSaving(false);onBack();};

  const BIG={padding:"14px 18px",borderRadius:8,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:48,display:"flex",alignItems:"center",justifyContent:"center",gap:8,flex:"1 1 0"};
  const SEC={...BIG,background:B.surface,border:"1px solid "+B.border,color:B.textMuted};
  const Toggle=({label,count,open,setOpen})=><button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"12px 14px",background:B.surface,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom:open?0:8}}><span style={{fontSize:13,fontWeight:700,color:B.text}}>{label}{count>0&&<span style={{marginLeft:6,fontFamily:M,color:B.cyan,fontSize:12}}>({count})</span>}</span><span style={{color:B.textDim,fontSize:14}}>{open?"▾":"▸"}</span></button>;

  return(<div><Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14,fontFamily:F,padding:"8px 0"}}>← Back to Orders</button>

    {/* HEADER — WO ID, title, customer, status */}
    <Card style={{maxWidth:640,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:M,fontSize:12,color:B.textDim}}>{wo.wo_id}</span><select value={wo.priority} onChange={async e=>{await onUpdateWO({...wo,priority:e.target.value});}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid "+(PC[wo.priority]||B.border)+"44",background:(PC[wo.priority]||B.textDim)+"22",color:PC[wo.priority]||B.textDim,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F,textTransform:"uppercase",appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select value={wo.wo_type||"CM"} onChange={async e=>{await onUpdateWO({...wo,wo_type:e.target.value});}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid "+((wo.wo_type==="PM"?B.cyan:B.orange))+"44",background:(wo.wo_type==="PM"?B.cyan:B.orange)+"22",color:wo.wo_type==="PM"?B.cyan:B.orange,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F,textTransform:"uppercase",appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}><option value="PM">PM</option><option value="CM">CM</option></select></div><h2 style={{margin:"4px 0 0",fontSize:20,fontWeight:800,color:B.text}}>{wo.title}</h2>{wo.customer&&<div style={{fontSize:12,color:B.purple,marginTop:4}}>👤 {wo.customer}{wo.customer_wo&&<span style={{fontFamily:M,color:B.textMuted,marginLeft:6,fontSize:11}}>WO# {wo.customer_wo}</span>}</div>}</div>
        <DSBadge ok={woPhotos.length>0}/>
      </div>
      {/* Status bar — big, tappable */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>{[["pending","Pending"],["in_progress","In Progress"],["completed","Completed"]].map(([k,l])=><button key={k} onClick={()=>changeStatus(k)} style={{flex:1,padding:"10px 6px",borderRadius:6,border:wo.status===k?"2px solid "+SC[k]:"1px solid "+B.border,background:wo.status===k?SC[k]+"22":"transparent",color:wo.status===k?SC[k]:B.textDim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>DUE</span><br/><span style={{fontWeight:700,color:B.text}}>{wo.due_date}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>HOURS</span><br/><span style={{fontWeight:700,color:B.cyan,fontFamily:M}}>{wo.hours_total||0}h</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>LOCATION</span><br/><span style={{fontWeight:600,color:B.text}}>{wo.location||"—"}{wo.building&&" · Bldg "+wo.building}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>ASSIGNED</span><br/><span style={{fontWeight:600,color:B.text}}>{[wo.assignee,...(wo.crew||[])].filter(Boolean).filter(n=>n!=="Unassigned").join(", ")||"Unassigned"}</span></div>
        <div style={{padding:"8px 10px",background:B.bg,borderRadius:6,gridColumn:"1 / -1"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:B.textDim,fontSize:10,fontWeight:600}}>CUSTOMER WO#</span>{wo.customer_wo&&<button onClick={async()=>{await sb().from("work_orders").update({tms_entered:!wo.tms_entered}).eq("id",wo.id);await loadData();}} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:0}}><div style={{width:16,height:16,borderRadius:3,border:"2px solid "+(wo.tms_entered?B.green:B.border),background:wo.tms_entered?B.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{wo.tms_entered&&<span style={{color:"#fff",fontSize:10}}>✓</span>}</div><span style={{fontSize:10,color:wo.tms_entered?B.green:B.textDim}}>Entered in TMS</span></button>}</div><input value={localCustWO} onChange={e=>setLocalCustWO(e.target.value)} onBlur={async()=>{if(localCustWO!==(wo.customer_wo||"")){await sb().from("work_orders").update({customer_wo:localCustWO}).eq("id",wo.id);await loadData();}}} placeholder="Enter customer WO# from their TMS" style={{background:"transparent",border:"none",color:B.text,fontWeight:600,fontSize:12,fontFamily:M,padding:"4px 0 0",width:"100%",outline:"none"}}/></div>
      </div>
      {wo.date_completed&&<div style={{marginTop:8,padding:"8px 10px",background:B.greenGlow,borderRadius:6,fontSize:12}}><span style={{color:B.green,fontWeight:700}}>✓ Completed {wo.date_completed}</span></div>}
      {wo.work_performed&&<div style={{marginTop:8,padding:"10px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><span style={LS}>Work Performed</span><p style={{margin:"4px 0 0",color:B.text,fontSize:13,lineHeight:1.5}}>{wo.work_performed}</p></div>}
    </Card>

    {/* BIG ACTION BUTTONS — the main things a tech does */}
    {canEdit&&wo.status!=="completed"&&<div style={{display:"flex",gap:8,marginBottom:12,maxWidth:640}}>
      <button onClick={()=>setShowTime(true)} style={{...BIG,background:B.cyan,color:B.bg}}>⏱ Log Time</button>
      <button onClick={()=>document.getElementById("cam-upload")?.click()} style={{...BIG,background:B.surface,border:"1px solid "+B.cyan,color:B.cyan}}>📷 Photo</button>
      <button onClick={openCompleteFlow} style={{...BIG,background:B.green,color:B.bg}}>✓ Done</button>
    </div>}

    {/* Camera (hidden trigger, activated by Photo button above) */}
    {canEdit&&<div style={{display:"none"}}><CameraUpload woId={wo.id} woName={wo.wo_id+" "+wo.title} userName={userName} onUploaded={loadData}/></div>}
    {canEdit&&<div style={{maxWidth:640,marginBottom:12}}><CameraUpload woId={wo.id} woName={wo.wo_id+" "+wo.title} userName={userName} onUploaded={loadData}/></div>}

    {/* FIELD NOTES — always visible, quick add */}
    <Card style={{maxWidth:640,marginBottom:12}}>
      <span style={LS}>Field Notes</span>
      {wo.field_notes?<p style={{margin:"4px 0 8px",color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.field_notes}</p>:<p style={{margin:"4px 0 8px",color:B.textDim,fontSize:12,fontStyle:"italic"}}>No field notes yet</p>}
      <div style={{display:"flex",gap:6}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Type a note..." style={{...IS,flex:1,fontSize:14,padding:"12px 14px"}} onKeyDown={e=>e.key==="Enter"&&addFieldNote()}/><button onClick={addFieldNote} disabled={saving} style={{...BP,padding:"12px 18px",fontSize:14}}>Add</button></div>
    </Card>

    {/* COLLAPSIBLE SECTIONS — tap to expand, keeps page clean */}
    <div style={{maxWidth:640,display:"flex",flexDirection:"column",gap:0}}>

      <Toggle label="Job Details" count={0} open={showDetails} setOpen={setShowDetails}/>
      {showDetails&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {isManager&&!editingDetails?<div><p style={{margin:0,color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.notes||"No details."}</p><button onClick={()=>{setDetailsText(wo.notes||"");setEditingDetails(true);}} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",marginTop:6}}>Edit Details</button></div>:editingDetails?<div><textarea value={detailsText} onChange={e=>setDetailsText(e.target.value)} rows={4} style={{...IS,resize:"vertical",lineHeight:1.5}}/><div style={{display:"flex",gap:6,marginTop:6}}><button onClick={()=>setEditingDetails(false)} style={{...BS,flex:1,padding:"8px"}}>Cancel</button><button onClick={saveDetails} disabled={saving} style={{...BP,flex:1,padding:"8px"}}>{saving?"Saving...":"Save"}</button></div></div>:<p style={{margin:0,color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.notes||"No details."}</p>}
      </Card>}

      <Toggle label="Time Entries" count={woTime.length} open={showTimeEntries} setOpen={setShowTimeEntries}/>
      {showTimeEntries&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woTime.length===0?<div style={{color:B.textDim,fontSize:12}}>No time logged yet</div>:woTime.map((te,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<woTime.length-1?"1px solid "+B.border:"none",fontSize:13,alignItems:"center"}}><span style={{fontFamily:M,color:B.textDim,minWidth:75}}>{te.logged_date}</span><span style={{fontFamily:M,color:B.cyan,minWidth:40,fontWeight:700}}>{te.hours}h</span><span style={{color:B.textMuted,flex:1}}>{te.description}</span>{canEditTime(te)&&<div style={{display:"flex",gap:6}}><button onClick={()=>setEditingTime({...te})} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",padding:"4px"}}>✏️</button><button onClick={()=>deleteTimeEntry(te)} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:"4px"}}>🗑</button></div>}</div>)}
        {canEdit&&<button onClick={()=>setShowTime(true)} style={{...BP,width:"100%",marginTop:10,padding:12}}>+ Log Time</button>}
      </Card>}

      <Toggle label="Photos" count={woPhotos.length} open={showPhotos} setOpen={setShowPhotos}/>
      {showPhotos&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woPhotos.length===0?<div style={{color:B.textDim,fontSize:12}}>No photos yet</div>:<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{woPhotos.map((p,i)=><a key={i} href={(p.photo_url||"").replace("thumbnail?id=","file/d/").replace("&sz=w400","/view")} target="_blank" rel="noreferrer" style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border,display:"block"}}>{p.photo_url?<img src={p.photo_url} alt={p.filename} style={{width:100,height:100,objectFit:"cover",display:"block"}}/>:<div style={{width:100,height:100,display:"flex",alignItems:"center",justifyContent:"center",background:B.bg,fontSize:11,color:B.textDim}}>📷 {p.filename}</div>}</a>)}</div>}
      </Card>}

      <Toggle label="Purchase Orders" count={woPOs.length} open={showPOs} setOpen={setShowPOs}/>
      {showPOs&&<Card style={{marginBottom:8,borderTopLeftRadius:0,borderTopRightRadius:0}}>
        {woPOs.map(po=>{const canSeeAmt=isManager||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:12,marginLeft:8}}>{po.description}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}>{canSeeAmt&&<span style={{fontFamily:M,fontSize:12,color:B.text}}>{"$"+parseFloat(po.amount||0).toFixed(2)}</span>}<Badge color={PSC[po.status]}>{po.status}</Badge></div></div>})}
        {canEdit&&<button onClick={()=>setShowPO(true)} style={{...BP,width:"100%",marginTop:10,padding:12}}>+ Request PO</button>}
      </Card>}

      {wo.signature&&<Card style={{marginBottom:8}}><span style={LS}>Completion Signature</span><div style={{marginTop:4}}><img src={wo.signature} alt="Sig" style={{maxWidth:280,height:"auto",display:"block",borderRadius:6}}/></div></Card>}

      {/* Crew section */}
      <Card style={{marginBottom:8}}>
        <span style={LS}>Crew</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{(wo.crew||[]).map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:6,background:B.purple+"22",color:B.purple,fontSize:12,fontWeight:600}}>{t}<button onClick={async()=>{const nc=(wo.crew||[]).filter(x=>x!==t);await onUpdateWO({...wo,crew:nc});}} style={{background:"none",border:"none",color:B.red,fontSize:13,cursor:"pointer",padding:0}}>×</button></span>)}{(wo.crew||[]).length===0&&<span style={{fontSize:12,color:B.textDim}}>No additional crew</span>}
        <select onChange={async e=>{if(!e.target.value)return;const nc=[...(wo.crew||[]),e.target.value];await onUpdateWO({...wo,crew:nc});e.target.value="";}} style={{...IS,width:"auto",padding:"6px 10px",fontSize:12,cursor:"pointer",marginLeft:6}}><option value="">+ Add</option>{(users||[]).filter(u=>u.active!==false&&u.name!==wo.assignee&&!(wo.crew||[]).includes(u.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
      </Card>

      {/* Activity Log */}
      <ActivityLog woId={wo.id}/>
      {/* Delete — small, at the bottom, not prominent */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={async()=>{if(!window.confirm("Duplicate "+wo.wo_id+"? This creates a new WO with the same details."))return;setSaving(true);await onCreateWO({title:wo.title,priority:wo.priority,assignee:wo.assignee||"Unassigned",due_date:"TBD",notes:wo.notes||"",location:wo.location||"",wo_type:wo.wo_type||"CM",building:wo.building||"",customer:wo.customer||"",customer_wo:"",crew:wo.crew||[]});setSaving(false);msg("Duplicated! Check your work orders.");}} disabled={saving} style={{flex:1,padding:"10px",borderRadius:6,border:"1px solid "+B.cyan+"33",background:"transparent",color:B.cyan+"88",fontSize:11,cursor:"pointer",fontFamily:F}}>📋 Duplicate WO</button>
        <button onClick={tryDelete} disabled={saving} style={{flex:1,padding:"10px",borderRadius:6,border:"1px solid "+B.red+"33",background:"transparent",color:B.red+"88",fontSize:11,cursor:"pointer",fontFamily:F}}>🗑 Delete WO</button>
      </div>
    </div>

    {/* MODALS */}
    {showTime&&<Modal title="Log Time" onClose={()=>setShowTime(false)}><div style={{display:"flex",flexDirection:"column",gap:14}}><div><label style={LS}>Date</label><input type="date" value={tDate} onChange={e=>setTDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div><div><label style={LS}>Hours</label><input value={tH} onChange={e=>setTH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div><div><label style={LS}>Description</label><input value={tD} onChange={e=>setTD(e.target.value)} placeholder="What was done?" style={{...IS,padding:14,fontSize:14}} onKeyDown={e=>e.key==="Enter"&&addTime()}/></div><div style={{display:"flex",gap:8}}><button onClick={()=>setShowTime(false)} style={{...SEC}}>Cancel</button><button onClick={addTime} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Log Time"}</button></div></div></Modal>}
    {showPO&&<POReqModal wo={wo} pos={pos} onCreatePO={onCreatePO} onClose={()=>setShowPO(false)} userName={userName} userRole={userRole}/>}
    {showComplete&&<Modal title={completeStep===1?"Log Time":completeStep===2?"Work Performed":"Sign & Complete"} onClose={()=>setShowComplete(false)} wide><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:B.bg,borderRadius:8,padding:14,border:"1px solid "+B.border}}><div style={{fontSize:14,fontWeight:700,color:B.text}}>{wo.wo_id} — {wo.title}</div></div>
      {/* Step indicator */}
      <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center"}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:completeStep>=1?B.cyan:B.border,color:completeStep>=1?B.bg:B.textDim}}>1</div><div style={{width:24,height:2,background:completeStep>=2?B.cyan:B.border}}/><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:completeStep>=2?B.cyan:B.border,color:completeStep>=2?B.bg:B.textDim}}>2</div><div style={{width:24,height:2,background:completeStep>=3?B.cyan:B.border}}/><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,background:completeStep>=3?B.cyan:B.border,color:completeStep>=3?B.bg:B.textDim}}>3</div></div>
      {completeStep===1&&<>
        <div style={{fontSize:13,color:B.orange,fontWeight:600,textAlign:"center"}}>No time has been logged for this job yet</div>
        <div><label style={LS}>Date</label><input type="date" value={cmpDate} onChange={e=>setCmpDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div>
        <div><label style={LS}>Hours</label><input value={cmpH} onChange={e=>setCmpH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div>
        <div><label style={LS}>What was done?</label><input value={cmpD} onChange={e=>setCmpD(e.target.value)} placeholder="Describe the work performed" style={{...IS,padding:14,fontSize:14}}/></div>
        {sigErr&&<div style={{color:B.red,fontSize:13,fontWeight:600,padding:"8px 12px",background:B.red+"11",borderRadius:6}}>{sigErr}</div>}
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...SEC}}>Cancel</button><button onClick={logTimeAndContinue} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Logging...":"Next →"}</button></div>
      </>}
      {completeStep===2&&<>
        <div style={{fontSize:13,color:B.textMuted,textAlign:"center"}}>Describe the work performed for the customer's records</div>
        <div><label style={LS}>Work Performed <span style={{color:B.textDim,fontWeight:400}}>(this goes on the customer timesheet)</span></label><textarea value={workPerformed} onChange={e=>setWorkPerformed(e.target.value)} rows={4} placeholder="Replaced defrost timer, cleared drain line, verified refrigerant charge. Unit cycling normally." style={{...IS,resize:"vertical",lineHeight:1.5,fontSize:14,padding:14}}/></div>
        <div><label style={LS}>Completion Date</label><input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)} style={{...IS,padding:14,fontSize:14}}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...SEC}}>Cancel</button><button onClick={()=>{setSigErr("");setCompleteStep(3);}} style={{...BIG,background:B.cyan,color:B.bg}}>Next →</button></div>
      </>}
      {completeStep===3&&<>
        <div><span style={LS}>Technician Signature <span style={{color:B.red}}>*</span></span><div style={{marginTop:4}}><SignaturePad onSign={setSigCanvas}/></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}><div style={{fontSize:11,color:B.textDim}}>Draw your signature above</div><button onClick={()=>{if(sigCanvas&&sigCanvas._clear)sigCanvas._clear();setSigErr("");}} style={{background:"none",border:"none",color:B.orange,fontSize:12,cursor:"pointer",fontFamily:F}}>Clear</button></div></div>
        {sigErr&&<div style={{color:B.red,fontSize:13,fontWeight:600,padding:"8px 12px",background:B.red+"11",borderRadius:6}}>{sigErr}</div>}
        <div style={{display:"flex",gap:8}}><button onClick={()=>setCompleteStep(2)} style={{...SEC}}>← Back</button><button onClick={markComplete} disabled={saving} style={{...BIG,background:B.green,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Sign & Complete"}</button></div>
      </>}
    </div></Modal>}
    {editingTime&&<Modal title="Edit Time Entry" onClose={()=>setEditingTime(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={LS}>Date</label><input type="date" value={editingTime.logged_date||""} onChange={e=>setEditingTime({...editingTime,logged_date:e.target.value})} style={{...IS,padding:14,fontSize:14}}/></div>
        <div><label style={LS}>Hours</label><input type="number" step="0.25" value={editingTime.hours} onChange={e=>setEditingTime({...editingTime,hours:e.target.value})} style={{...IS,fontFamily:M,padding:14,fontSize:16}}/></div>
        <div><label style={LS}>Description</label><input value={editingTime.description||""} onChange={e=>setEditingTime({...editingTime,description:e.target.value})} style={{...IS,padding:14,fontSize:14}}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setEditingTime(null)} style={{...SEC}}>Cancel</button><button onClick={saveTimeEdit} disabled={saving} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
      </div>
    </Modal>}
    {showFollowUp&&<Modal title="Job Complete! Need a Follow-up?" onClose={()=>setShowFollowUp(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{textAlign:"center",fontSize:32,marginBottom:4}}>✅</div>
        <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:B.green,marginBottom:4}}>{wo.wo_id} completed successfully</div>
        <div style={{fontSize:12,color:B.textMuted,textAlign:"center"}}>Does this job need a follow-up visit? Need to order parts? Any equipment to replace next time?</div>
        <textarea value={fuNotes} onChange={e=>setFuNotes(e.target.value)} rows={3} placeholder="Describe what needs to happen next..." style={{...IS,resize:"vertical",lineHeight:1.5,fontSize:14}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowFollowUp(false)} style={{...SEC}}>No Follow-up Needed</button>
          <button onClick={createFollowUp} disabled={saving||!fuNotes.trim()} style={{...BIG,background:B.cyan,color:B.bg,opacity:saving||!fuNotes.trim()?.5:1}}>{saving?"Creating...":"Create Follow-up WO"}</button>
        </div>
      </div>
    </Modal>}
  </div>);
}

// ═══════════════════════════════════════════
// CREATE WO (with customer) + WO LIST
// ═══════════════════════════════════════════
function CreateWO({onSave,onCancel,users,customers,userName,userRole,allWos}){
  const isManager=userRole==="admin"||userRole==="manager";
  const assignable=users.filter(u=>u.active!==false);
  const techs=assignable.filter(u=>u.role==="technician");
  // Smart suggestion: tech with fewest active jobs
  const activeCounts={};(allWos||[]).filter(o=>o.status!=="completed").forEach(o=>{activeCounts[o.assignee]=(activeCounts[o.assignee]||0)+1;});
  const suggested=techs.length>0?techs.reduce((best,t)=>(activeCounts[t.name]||0)<(activeCounts[best.name]||0)?t:best,techs[0]):null;
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState(isManager?"Unassigned":userName),[due,setDue]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false),[loc,setLoc]=useState(""),[woType,setWoType]=useState("CM"),[bldg,setBldg]=useState(""),[cust,setCust]=useState(""),[custWO,setCustWO]=useState(""),[crew,setCrew]=useState([]);
  const go=async()=>{const finalTitle=title.trim()||custWO.trim();if(!finalTitle||saving)return;if(cleanText(finalTitle,"Title")===null||cleanText(notes,"Notes")===null)return;setSaving(true);await onSave({title:finalTitle,priority:pri,assignee:assign,crew,due_date:due||"TBD",notes:notes.trim()||"No details.",location:loc.trim(),wo_type:woType,building:bldg.trim(),customer:cust,customer_wo:custWO.trim()||null});setSaving(false);};
  return(<div><button onClick={onCancel} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:580}}><h2 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:B.text}}>Create Work Order</h2><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={LS}>Title {custWO&&<span style={{color:B.textDim,fontWeight:400}}>(optional — defaults to Customer WO#)</span>}</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={custWO?custWO:"Walk-in Cooler Repair — Store #14"} style={IS}/></div>
      <div><label style={LS}>Customer</label><select value={cust} onChange={e=>setCust(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select Customer —</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
      <div><label style={LS}>Customer WO# <span style={{color:B.textDim,fontWeight:400}}>(optional — from customer's TMS)</span></label><input value={custWO} onChange={e=>setCustWO(e.target.value)} placeholder="e.g. TMS-40291" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Location / Room</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Store #14, Room 3B" style={IS}/></div><div><label style={LS}>Building # <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={bldg} onChange={e=>setBldg(e.target.value)} placeholder="Building A" style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Type</label><select value={woType} onChange={e=>setWoType(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="PM">PM (Preventive)</option><option value="CM">CM (Corrective)</option></select></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Due</label><input value={due} onChange={e=>setDue(e.target.value)} type="date" style={IS}/></div><div><label style={LS}>Assignee</label>{isManager?<><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{assignable.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select>{suggested&&assign==="Unassigned"&&<button onClick={()=>setAssign(suggested.name)} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",marginTop:4,fontFamily:F}}>💡 Suggest: {suggested.name} ({(allWos||[]).filter(o=>o.assignee===suggested.name&&o.status!=="completed").length} active)</button>}</>:<div style={{...IS,background:B.surfaceActive,color:B.text}}>{userName}</div>}</div></div>
      <div><label style={LS}>Additional Crew <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{crew.map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:B.purple+"22",color:B.purple,fontSize:11,fontWeight:600}}>{t}<button onClick={()=>setCrew(crew.filter(x=>x!==t))} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:0}}>×</button></span>)}</div><select onChange={e=>{if(!e.target.value)return;setCrew([...crew,e.target.value]);e.target.value="";}} style={{...IS,cursor:"pointer"}}><option value="">+ Add technician to crew</option>{assignable.filter(u=>u.name!==assign&&!crew.includes(u.name)).map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
      <div><label style={LS}>Details</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe the work..." style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Creating...":"Create"}</button></div>
    </div></Card></div>);
}

function WOList({orders,canEdit,pos,onCreatePO,onUpdateWO,onDeleteWO,onCreateWO,timeEntries,photos,onAddTime,onUpdateTime,onDeleteTime,onAddPhoto,users,customers,userName,userRole,loadData}){
  const[sel,setSel]=useState(null),[filter,setFilter]=useState("all"),[creating,setCreating]=useState(false),[search,setSearch]=useState(""),[custFilter,setCustFilter]=useState(""),[bulkSel,setBulkSel]=useState([]),[bulkMode,setBulkMode]=useState(false);
  const toggleBulk=(id)=>setBulkSel(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const bulkAction=async(action)=>{for(const id of bulkSel){const wo=orders.find(o=>o.id===id);if(!wo)continue;if(action==="complete")await onUpdateWO({...wo,status:"completed",date_completed:new Date().toISOString().slice(0,10)});else if(action==="active")await onUpdateWO({...wo,status:"in_progress"});else if(action==="pending")await onUpdateWO({...wo,status:"pending"});}setBulkSel([]);setBulkMode(false);};
  const custList=[...new Set(orders.map(o=>o.customer).filter(Boolean))].sort();
  const flt=orders.filter(o=>{if(filter!=="all"&&o.status!==filter)return false;if(custFilter&&o.customer!==custFilter)return false;if(search){const s=search.toLowerCase();return(o.title||"").toLowerCase().includes(s)||(o.wo_id||"").toLowerCase().includes(s)||(o.customer||"").toLowerCase().includes(s)||(o.customer_wo||"").toLowerCase().includes(s)||(o.location||"").toLowerCase().includes(s)||(o.assignee||"").toLowerCase().includes(s);}return true;});
  if(creating&&canEdit)return <CreateWO onSave={async(nw)=>{await onCreateWO(nw);setCreating(false);}} onCancel={()=>setCreating(false)} users={users} customers={customers} userName={userName} userRole={userRole} allWos={orders}/>;
  if(sel){const fresh=orders.find(o=>o.id===sel.id);if(!fresh){setSel(null);return null;}return <WODetail wo={fresh} onBack={()=>setSel(null)} onUpdateWO={async u=>{await onUpdateWO(u);}} onDeleteWO={async id=>{await onDeleteWO(id);setSel(null);}} onCreateWO={onCreateWO} canEdit={canEdit} pos={pos} onCreatePO={onCreatePO} timeEntries={timeEntries} onAddTime={onAddTime} onUpdateTime={onUpdateTime} onDeleteTime={onDeleteTime} photos={photos} onAddPhoto={onAddPhoto} users={users} userName={userName} userRole={userRole} loadData={loadData}/>;}
  const today=new Date().toISOString().slice(0,10);
  const poByWO={},phByWO={};pos.forEach(p=>{if(!poByWO[p.wo_id])poByWO[p.wo_id]=[];poByWO[p.wo_id].push(p);});photos.forEach(p=>{if(!phByWO[p.wo_id])phByWO[p.wo_id]=[];phByWO[p.wo_id].push(p);});
  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
      {[["all","All"],["pending","Pending"],["in_progress","Active"],["completed","Done"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
      {canEdit&&<button onClick={()=>setCreating(true)} style={{...BP,marginLeft:"auto",padding:"7px 14px",fontSize:12}}>+ New Order</button>}
      {canEdit&&<button onClick={()=>{setBulkMode(!bulkMode);setBulkSel([]);}} style={{...BS,padding:"7px 10px",fontSize:11,color:bulkMode?B.cyan:B.textDim}}>{bulkMode?"Cancel":"☑ Bulk"}</button>}
    </div>
    {bulkMode&&bulkSel.length>0&&<div style={{display:"flex",gap:6,marginBottom:10,padding:"8px 12px",background:B.cyanGlow,borderRadius:6,alignItems:"center"}}>
      <span style={{fontSize:11,fontWeight:700,color:B.cyan}}>{bulkSel.length} selected</span>
      <button onClick={()=>bulkAction("active")} style={{...BS,padding:"4px 10px",fontSize:10}}>→ Active</button>
      <button onClick={()=>bulkAction("complete")} style={{...BS,padding:"4px 10px",fontSize:10,borderColor:B.green,color:B.green}}>✓ Complete</button>
      <button onClick={()=>bulkAction("pending")} style={{...BS,padding:"4px 10px",fontSize:10}}>→ Pending</button>
      <button onClick={()=>setBulkSel(flt.map(o=>o.id))} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",marginLeft:"auto"}}>Select All</button>
    </div>}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search WOs..." style={{...IS,flex:1,padding:"8px 12px",fontSize:12}}/>
      {custList.length>1&&<select value={custFilter} onChange={e=>setCustFilter(e.target.value)} style={{...IS,width:"auto",padding:"8px 10px",fontSize:11,cursor:"pointer"}}><option value="">All Customers</option>{custList.map(c=><option key={c} value={c}>{c}</option>)}</select>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {flt.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:20,marginBottom:6}}>{search?"🔍":"📭"}</div><div style={{fontSize:13}}>{search?"No results for \""+search+"\"":"No work orders"}</div>{canEdit&&!search&&<button onClick={()=>setCreating(true)} style={{...BP,marginTop:12,fontSize:12}}>+ Create First Order</button>}</Card>}
      {flt.map(wo=>{const wp=poByWO[wo.id]||[];const wph=phByWO[wo.id]||[];const overdue=wo.due_date&&wo.due_date!=="TBD"&&wo.due_date<today&&wo.status!=="completed";const noTime=wo.status==="in_progress"&&parseFloat(wo.hours_total||0)===0;return(
        <Card key={wo.id} style={{padding:"14px 16px",marginBottom:6}}>
          <div style={{display:"flex",gap:12}}>
            {bulkMode&&<button onClick={e=>{e.stopPropagation();toggleBulk(wo.id);}} style={{width:22,height:22,borderRadius:4,border:"2px solid "+(bulkSel.includes(wo.id)?B.cyan:B.border),background:bulkSel.includes(wo.id)?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:2}}>{bulkSel.includes(wo.id)&&<span style={{color:B.bg,fontSize:12,fontWeight:800}}>✓</span>}</button>}
            <div style={{width:3,borderRadius:2,background:PC[wo.priority]||B.textDim,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setSel(wo)}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontFamily:M,fontSize:10,color:B.textDim}}>{wo.wo_id}</span>{wo.customer_wo&&<span style={{fontFamily:M,fontSize:10,color:B.purple}}>#{wo.customer_wo}</span>}<Badge color={SC[wo.status]||B.textDim}>{SL[wo.status]||wo.status}</Badge><Badge color={wo.wo_type==="PM"?B.cyan:B.orange}>{wo.wo_type||"CM"}</Badge></div>
              <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wo.title}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>{wo.customer&&<span>{"👤 "+wo.customer}</span>}{wo.location&&<span>{" · 📍 "+wo.location}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4,flexWrap:"wrap"}}>
                {parseFloat(wo.hours_total||0)>0&&<span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.cyan}}>{parseFloat(wo.hours_total||0)}h</span>}
                {noTime&&<span style={{fontSize:9,color:B.orange,fontWeight:600}}>⚠ No time logged</span>}
                {overdue&&<span style={{fontSize:9,color:B.red,fontWeight:600}}>⚠ Overdue {wo.due_date}</span>}
                {wo.date_completed&&<span style={{fontSize:10,color:B.green}}>{"Completed "+new Date(wo.date_completed).toLocaleDateString()}</span>}
                {wo.crew&&wo.crew.length>0&&<span style={{fontSize:10,color:B.textDim}}>{[wo.assignee,...wo.crew].filter(Boolean).filter(n=>n!=="Unassigned").join(", ")}</span>}
                {!wo.crew?.length&&wo.assignee&&wo.assignee!=="Unassigned"&&<span style={{fontSize:10,color:B.textDim}}>{wo.assignee}</span>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
              {wo.status!=="completed"&&<select value={wo.status} onChange={async e=>{e.stopPropagation();await onUpdateWO({...wo,status:e.target.value});}} onClick={e=>e.stopPropagation()} style={{padding:"3px 6px",borderRadius:4,border:"1px solid "+(SC[wo.status]||B.border),background:(SC[wo.status]||B.textDim)+"22",color:SC[wo.status]||B.textDim,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:F,appearance:"none",WebkitAppearance:"none",paddingRight:14,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%235E656E' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 3px center"}}><option value="pending">Pending</option><option value="in_progress">Active</option></select>}
              {wo.status==="completed"&&<span style={{fontSize:10,color:B.green,fontWeight:600}}>✓ Done</span>}
              {wo.customer_wo&&<button onClick={async e=>{e.stopPropagation();await onUpdateWO({...wo,tms_entered:!wo.tms_entered});}} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:4,border:"1px solid "+(wo.tms_entered?B.green:B.orange),background:wo.tms_entered?B.green+"18":B.orange+"18",color:wo.tms_entered?B.green:B.orange,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F}}><span style={{width:14,height:14,borderRadius:3,border:"2px solid "+(wo.tms_entered?B.green:B.orange),background:wo.tms_entered?B.green:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{wo.tms_entered&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}</span>TMS</button>}
            </div>
          </div>
        </Card>);})}
    </div></div>);
}

function WOOverview({orders,wlp,pos,time}){
  const now=new Date();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);weekEnd.setHours(23,59,59,999);
  const getWODate=(wo)=>{const d=wo.date_completed||wo.created_at||wo.due_date;return d?new Date(d):new Date();};
  const active=orders.filter(o=>o.status!=="completed");
  const completedThisWeek=orders.filter(o=>o.status==="completed"&&getWODate(o)>=weekStart);
  const thisWeek=[...active,...completedThisWeek];
  const past=orders.filter(o=>o.status==="completed"&&getWODate(o)<weekStart);
  const[showArchive,setShowArchive]=useState(false);
  const[archiveMonth,setArchiveMonth]=useState(null);
  const[filter,setFilter]=useState("all");
  const tmsPending=orders.filter(o=>o.customer_wo&&!o.tms_entered).length;

  const months={};past.forEach(wo=>{const d=getWODate(wo);const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");const label=d.toLocaleString("default",{month:"long",year:"numeric"});if(!months[key])months[key]={label,orders:[]};months[key].orders.push(wo);});
  const sortedMonths=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]));
  const weekLabel=weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" \u2014 "+weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const pendingPOs=pos.filter(p=>p.status==="pending").length;
  const filteredWeek=filter==="all"?thisWeek:filter==="pending"?thisWeek.filter(o=>o.status==="pending"):filter==="active"?thisWeek.filter(o=>o.status==="in_progress"):filter==="done"?thisWeek.filter(o=>o.status==="completed"):filter==="tms"?thisWeek.filter(o=>o.customer_wo&&!o.tms_entered):thisWeek;

  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Active" value={active.length} icon="📋" color={B.cyan}/>
      <StatCard label="Done This Week" value={completedThisWeek.length} icon="✓" color={B.green}/>
      <StatCard label="Hours" value={thisWeek.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)+"h"} icon="⏱" color={B.orange}/>
      <StatCard label="Pending POs" value={pendingPOs} icon="📄" color={B.purple}/>
      {tmsPending>0&&<StatCard label="TMS Needed" value={tmsPending} icon="⚠️" color={B.orange}/>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:800,color:B.text}}>This Week <span style={{fontWeight:400,fontSize:12,color:B.textDim,marginLeft:6}}>{weekLabel}</span></div>
      <span style={{fontFamily:M,fontSize:12,color:B.cyan}}>{thisWeek.length} orders</span>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["active","Active"],["done","Done"],["tms","TMS Needed"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid "+(filter===k?k==="tms"?B.orange:B.cyan:B.border),background:filter===k?(k==="tms"?B.orange:B.cyan)+"22":"transparent",color:filter===k?(k==="tms"?B.orange:B.cyan):B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="tms"&&tmsPending>0?" ("+tmsPending+")":""}</button>)}</div>
    {filteredWeek.length===0?<Card style={{textAlign:"center",padding:24,marginBottom:16}}><div style={{fontSize:24,marginBottom:6}}>📭</div><div style={{fontSize:13,color:B.textDim}}>{filter==="tms"?"All customer WOs entered in TMS":"No work orders"}</div></Card>:<WOList orders={filteredWeek} {...wlp}/>}
    {past.length>0&&<div style={{marginTop:20}}>
      <button onClick={()=>setShowArchive(!showArchive)} style={{width:"100%",padding:"12px 16px",background:B.surface,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📁</span><span style={{fontSize:13,fontWeight:700,color:B.text}}>Past Work Orders</span><span style={{fontSize:11,color:B.textDim}}>({past.length} completed)</span></div>
        <span style={{color:B.textDim,fontSize:14}}>{showArchive?"\u25BE":"\u25B8"}</span>
      </button>
      {showArchive&&<div style={{border:"1px solid "+B.border,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
        {sortedMonths.map(([key,{label,orders:mos}])=><div key={key}>
          <button onClick={()=>setArchiveMonth(archiveMonth===key?null:key)} style={{width:"100%",padding:"10px 16px",background:archiveMonth===key?B.cyanGlow:B.bg,border:"none",borderBottom:"1px solid "+B.border,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
            <span style={{fontSize:12,fontWeight:600,color:archiveMonth===key?B.cyan:B.textMuted}}>{label}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{mos.length} orders</span>
              <span style={{fontFamily:M,fontSize:11,color:B.cyan}}>{mos.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)}h</span>
              <span style={{color:B.textDim,fontSize:12}}>{archiveMonth===key?"\u25BE":"\u25B8"}</span>
            </div>
          </button>
          {archiveMonth===key&&<div style={{padding:"8px 12px",background:B.bg}}><WOList orders={mos} {...wlp}/></div>}
        </div>)}
      </div>}
    </div>}
  </div>);
}

// ═══════════════════════════════════════════
// SCHEDULE, TIME LOG, USER MGMT, SETTINGS
// ═══════════════════════════════════════════
function SchedView({schedule,userName}){const mine=schedule.filter(s=>s.assigned_to===userName||s.assigned_to==="All");return(<div><h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Today's Schedule</h3><div style={{display:"flex",flexDirection:"column",gap:6}}>{mine.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No schedule entries</div>}{mine.map((s,i)=><Card key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px"}}><span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.textDim,minWidth:50}}>{s.time}</span><div><div style={{fontSize:13,fontWeight:700,color:B.textMuted}}>{s.task}</div><div style={{fontSize:11,color:B.textDim}}>{s.location}</div></div></Card>)}</div></div>);}

function TimeLog({timeEntries,wos}){const tot=timeEntries.reduce((s,e)=>s+parseFloat(e.hours||0),0);return(<div><div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Total" value={tot.toFixed(1)+"h"} icon="⏱" color={B.cyan}/><StatCard label="Entries" value={timeEntries.length} icon="📝" color={B.green}/></div>{timeEntries.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No entries yet</div>}{timeEntries.map((e,i)=>{const wo=wos.find(o=>o.id===e.wo_id);return <Card key={i} style={{padding:"10px 14px",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:M,fontSize:11,color:B.textDim,minWidth:70}}>{e.logged_date}</span><span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.cyan,minWidth:35}}>{e.hours}h</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description}</div>{wo&&<div style={{fontSize:10,color:B.textDim}}>{wo.wo_id} — {wo.title}</div>}</div></div></Card>;})}</div>);}

function UserMgmt({users,onAddUser,onUpdateUser,onDeleteUser,cur}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[search,setSearch]=useState(""),[rf,setRf]=useState("all"),[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const save=async d=>{if(editing){await onUpdateUser({...editing,...d});msg("Updated "+d.name);}else{await onAddUser(d);msg("Created "+d.name);}setShowForm(false);setEditing(null);};
  const filtered=users.filter(u=>(rf==="all"||u.role===rf)&&(u.name.toLowerCase().includes(search.toLowerCase())||(u.email||"").toLowerCase().includes(search.toLowerCase())));
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}><button onClick={()=>{setEditing(null);setShowForm(true)}} style={{...BP,padding:"8px 14px",fontSize:12}}>+ New User</button><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...IS,flex:1,minWidth:150,padding:"8px 12px",fontSize:12}}/>{[["all","All"],["admin","Admin"],["manager","Mgr"],["technician","Tech"]].map(([k,l])=><button key={k} onClick={()=>setRf(k)} style={{padding:"6px 10px",borderRadius:4,border:"1px solid "+(rf===k?B.cyan:B.border),background:rf===k?B.cyanGlow:"transparent",color:rf===k?B.cyan:B.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>{filtered.map(u=><Card key={u.id} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:"3px solid "+(ROLES[u.role]?ROLES[u.role].color:B.textDim)}}><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{u.name}</div><div style={{fontSize:11,color:B.textDim}}>{u.email} · <Badge color={ROLES[u.role]?ROLES[u.role].color:B.textDim}>{u.role}</Badge></div></div><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={()=>{setEditing(u);setShowForm(true)}} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button>{u.id!==cur.id&&<button onClick={async()=>{await onDeleteUser(u.id);msg("Deleted "+u.name)}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button>}</div></Card>)}</div>
    {showForm&&<UserForm user={editing} onSave={save} onClose={()=>{setShowForm(false);setEditing(null)}} curRole={cur?.role}/>}
  </div>);
}

function UserForm({user,onSave,onClose,curRole}){
  const isAdmin=curRole==="admin";
  const[n,setN]=useState(user?.name||""),[e,setE]=useState(user?.email||""),[r,setR]=useState(user?.role||"technician"),[saving,setSaving]=useState(false);
  const[title,setTitle]=useState(user?.title||""),[phone,setPhone]=useState(user?.phone||"");
  const[billingRate,setBillingRate]=useState(user?.billing_rate||""),[costRate,setCostRate]=useState(user?.cost_rate||"");
  const go=async()=>{if(!n.trim()||!e.trim()||saving)return;setSaving(true);await onSave({name:n.trim(),email:e.trim().toLowerCase(),role:r,title:title.trim(),phone:phone.trim(),billing_rate:parseFloat(billingRate)||0,cost_rate:parseFloat(costRate)||0,active:true});setSaving(false);};
  return(<Modal title={user?"Edit User":"Add New User"} onClose={onClose} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Full Name</label><input value={n} onChange={ev=>setN(ev.target.value)} placeholder="Mike Johnson" style={IS}/></div>
    <div><label style={LS}>Gmail Address</label><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="mike@gmail.com" style={IS}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Must match their Google account email exactly.</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div><label style={LS}>Role</label><select value={r} onChange={ev=>setR(ev.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      <div><label style={LS}>Job Title</label><input value={title} onChange={ev=>setTitle(ev.target.value)} placeholder="Manager, Lead Tech, etc." style={IS}/></div>
    </div>
    <div><label style={LS}>Phone</label><input value={phone} onChange={ev=>setPhone(ev.target.value)} placeholder="(336) 264-0935" style={IS}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {isAdmin&&<div><label style={LS}>Billing Rate ($/hr)</label><input value={billingRate} onChange={ev=>setBillingRate(ev.target.value)} type="number" step="5" placeholder="85" style={{...IS,fontFamily:M}}/></div>}
      {isAdmin&&<div><label style={LS}>Cost Rate ($/hr)</label><input value={costRate} onChange={ev=>setCostRate(ev.target.value)} type="number" step="5" placeholder="35" style={{...IS,fontFamily:M}}/></div>}
    </div>
    <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border}}>
      <span style={LS}>Email Signature Preview</span>
      <div style={{marginTop:6,fontSize:12,color:B.text,lineHeight:1.5}}><strong>{n||"Name"}</strong><br/>{title||"Title"}<br/>{phone||"Phone"}<br/><img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C" style={{width:100,height:"auto",marginTop:4}}/></div>
    </div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(user?"Save":"Add User")}</button></div>
  </div></Modal>);
}

// ═══════════════════════════════════════════
// REPORTS DASHBOARD
// ═══════════════════════════════════════════
function Reports({wos,pos,timeEntries,users}){
  const completed=wos.filter(o=>o.status==="completed");
  const techs=users.filter(u=>u.role==="technician");
  const totalHours=timeEntries.reduce((s,e)=>s+parseFloat(e.hours||0),0);
  const totalPOSpend=pos.filter(p=>p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const pmCount=wos.filter(o=>o.wo_type==="PM").length;const cmCount=wos.filter(o=>o.wo_type==="CM").length;
  return(<div>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Reports</h3>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Completed" value={completed.length} icon="✓" color={B.green}/><StatCard label="Total Hours" value={totalHours.toFixed(1)+"h"} icon="⏱" color={B.cyan}/><StatCard label="PO Spend" value={"$"+totalPOSpend.toLocaleString()} icon="💰" color={B.purple}/><StatCard label="PM / CM" value={pmCount+" / "+cmCount} icon="📊" color={B.orange}/></div>
    <Card style={{marginBottom:14}}><span style={LS}>Hours by Technician</span><div style={{marginTop:8}}>{techs.map(t=>{const h=timeEntries.filter(e=>e.technician===t.name).reduce((s,e)=>s+parseFloat(e.hours||0),0);const maxH=Math.max(...techs.map(t2=>timeEntries.filter(e=>e.technician===t2.name).reduce((s,e)=>s+parseFloat(e.hours||0),0)),1);return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{fontSize:12,color:B.text,minWidth:100,fontWeight:600}}>{t.name}</span><div style={{flex:1,height:20,background:B.bg,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:(h/maxH*100)+"%",background:ROLES.technician.grad,borderRadius:4,minWidth:h>0?20:0}}/></div><span style={{fontFamily:M,fontSize:12,color:B.cyan,minWidth:40,textAlign:"right"}}>{h.toFixed(1)}h</span></div>);})}</div></Card>
    <Card style={{marginBottom:14}}><span style={LS}>Jobs by Customer</span><div style={{marginTop:8}}>{[...new Set(wos.map(w=>w.customer).filter(Boolean))].map(c=>{const count=wos.filter(w=>w.customer===c).length;return(<div key={c} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+B.border}}><span style={{fontSize:12,color:B.text}}>{c}</span><span style={{fontFamily:M,fontSize:12,color:B.cyan}}>{count} jobs</span></div>);})}{wos.filter(w=>!w.customer).length>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:B.textDim}}>No customer</span><span style={{fontFamily:M,fontSize:12,color:B.textDim}}>{wos.filter(w=>!w.customer).length}</span></div>}</div></Card>
  </div>);
}

// ═══════════════════════════════════════════
// BILLING EXPORT — with customer filter + column toggles
// ═══════════════════════════════════════════
function BillingExport({wos,pos,timeEntries,customers,emailTemplates,currentUser}){
  const[toast,setToast]=useState(""),[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState(""),[custFilter,setCustFilter]=useState("");
  const[showEmail,setShowEmail]=useState(false),[emailTo,setEmailTo]=useState(""),[emailCC,setEmailCC]=useState(""),[sending,setSending]=useState(false);
  const[emailSubject,setEmailSubject]=useState("3C Refrigeration \u2014 Timesheet"),[emailBody,setEmailBody]=useState("<p>Hi,</p><p>Please find attached the timesheet.</p><p>If you have any questions, please reply to this email.</p>");
  const[contacts,setContacts]=useState([]),[suggestions,setSuggestions]=useState([]),[showSugTo,setShowSugTo]=useState(false),[showSugCC,setShowSugCC]=useState(false);
  const applyTemplate=(tpl)=>{if(!tpl){setEmailSubject("3C Refrigeration \u2014 Timesheet");setEmailBody("<p>Hi,</p><p>Please find attached the timesheet.</p><p>If you have any questions, please reply to this email.</p>");return;}setEmailSubject(tpl.subject);setEmailBody(tpl.body);};
  const allCols={wo_id:"WO#",customer_wo:"Customer WO#",date_completed:"Date",customer:"Customer",title:"Title",location:"Location",building:"Building",wo_type:"Type",hours:"Hours",po_total:"PO $",notes:"Job Details",field_notes:"Field Notes"};
  const[cols,setCols]=useState(["wo_id","customer_wo","date_completed","customer","title","location","building","wo_type","hours","po_total"]);
  const presets={basic:["wo_id","customer_wo","date_completed","customer","hours"],detailed:["wo_id","customer_wo","date_completed","customer","title","location","building","hours","po_total"],full:Object.keys(allCols)};
  const[showCustomCols,setShowCustomCols]=useState(false);
  const activePreset=Object.entries(presets).find(([k,v])=>v.length===cols.length&&v.every(c=>cols.includes(c)))?.[0]||"custom";
  const completed=wos.filter(o=>{if(o.status!=="completed")return false;if(custFilter&&o.customer!==custFilter)return false;if(!dateFrom&&!dateTo)return true;const woTime=timeEntries.filter(t=>t.wo_id===o.id);if(woTime.length===0)return(!dateFrom||o.date_completed>=dateFrom)&&(!dateTo||o.date_completed<=dateTo);return woTime.some(t=>{const d=t.logged_date||o.date_completed;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});});
  const getData=wo=>{const woTime=timeEntries.filter(t=>t.wo_id===wo.id);const filteredTime=woTime.filter(t=>{const d=t.logged_date||wo.date_completed;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});const h=filteredTime.reduce((s,t)=>s+parseFloat(t.hours||0),0);const p=pos.filter(p=>p.wo_id===wo.id&&p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);const cleanNotes=(wo.notes||"").replace(/\n/g," ").trim();const cleanField=(wo.field_notes||"").replace(/\n/g," ").trim();return{wo_id:wo.wo_id,customer_wo:wo.customer_wo||"",date_completed:wo.date_completed||"",customer:wo.customer||"",title:wo.title,location:wo.location||"",building:wo.building||"",wo_type:wo.wo_type||"CM",hours:h,hours_display:h+"h",po_total:"$"+p.toFixed(2),notes:cleanNotes,field_notes:cleanField};};
  // Load saved contacts
  useEffect(()=>{sb().from("email_contacts").select("*").order("last_used",{ascending:false}).then(({data})=>{if(data)setContacts(data);});},[]);
  const saveContact=async(email)=>{if(!email)return;const existing=contacts.find(c=>c.email.toLowerCase()===email.toLowerCase());if(existing){await sb().from("email_contacts").update({last_used:new Date().toISOString()}).eq("id",existing.id);}else{await sb().from("email_contacts").insert({email:email.toLowerCase()});}};
  const filterContacts=(val)=>contacts.filter(c=>c.email.toLowerCase().includes(val.toLowerCase())).slice(0,5);
  const copyToClip=()=>{const header=cols.map(c=>allCols[c]).join("\t")+"\n";const rows=completed.map(wo=>{const d=getData(wo);return cols.map(c=>c==="hours"?d.hours:d[c]).join("\t");}).join("\n");navigator.clipboard.writeText(header+rows).then(()=>{setToast("Copied!");setTimeout(()=>setToast(""),3000);});};
  const earliest=(a,b)=>{if(!a)return b||"";if(!b)return a;return a<b?a:b;};
  const getTimesheetRows=()=>{const rows=[];let totalHrs=0;completed.forEach(wo=>{const woNum=wo.customer_wo||wo.wo_id;const woTime=timeEntries.filter(t=>t.wo_id===wo.id);const woDesc=wo.work_performed||wo.notes&&wo.notes!=="No details."&&wo.notes||wo.title;if(woTime.length>0){const filtered=woTime.filter(t=>{const d=t.logged_date||wo.date_completed;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});filtered.forEach(te=>{const h=parseFloat(te.hours||0);const desc=wo.work_performed||te.description||woDesc;rows.push({date:earliest(te.logged_date,wo.date_completed),building:wo.building||"",room:wo.location||"",wo_num:woNum,hours:h,desc});totalHrs+=h;});}else{const h=0;rows.push({date:wo.date_completed||"",building:wo.building||"",room:wo.location||"",wo_num:woNum,hours:h,desc:woDesc});totalHrs+=h;}});rows.sort((a,b)=>(a.date||"").localeCompare(b.date||""));return{rows,totalHrs};};
  const buildXLSXBase64=()=>{const{rows,totalHrs}=getTimesheetRows();let xml='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Size="13" ss:FontName="Calibri"/><Interior ss:Color="#00B7E8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders></Style><Style ss:ID="data"><Font ss:Size="11" ss:FontName="Calibri"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/></Borders></Style><Style ss:ID="hrs"><Font ss:Size="11" ss:FontName="Calibri" ss:Bold="1"/><NumberFormat ss:Format="0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/></Borders></Style><Style ss:ID="total"><Font ss:Size="12" ss:FontName="Calibri" ss:Bold="1"/><Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/></Style></Styles>';xml+='<Worksheet ss:Name="'+(custFilter||"Timesheet")+(dateFrom?" "+dateFrom:"")+(dateTo?" to "+dateTo:"")+'" ss:Protected="1"><Table ss:DefaultRowHeight="20"><Column ss:Width="85"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="90"/><Column ss:Width="100"/><Column ss:Width="250"/>';xml+='<Row ss:Height="22">';["Date:","Building #","Room#","WO/Asset#","Personnel Hrs.","Description"].forEach(h=>{xml+='<Cell ss:StyleID="header"><Data ss:Type="String">'+h+'</Data></Cell>';});xml+='</Row>';rows.forEach(r=>{xml+='<Row><Cell ss:StyleID="data"><Data ss:Type="String">'+r.date+'</Data></Cell><Cell ss:StyleID="data"><Data ss:Type="String">'+r.building+'</Data></Cell><Cell ss:StyleID="data"><Data ss:Type="String">'+r.room+'</Data></Cell><Cell ss:StyleID="data"><Data ss:Type="String">'+r.wo_num+'</Data></Cell><Cell ss:StyleID="hrs"><Data ss:Type="Number">'+r.hours+'</Data></Cell><Cell ss:StyleID="data"><Data ss:Type="String">'+(r.desc||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")+'</Data></Cell></Row>';});xml+='<Row><Cell/><Cell/><Cell/><Cell ss:StyleID="total"><Data ss:Type="String">TOTAL:</Data></Cell><Cell ss:StyleID="total"><Data ss:Type="Number">'+totalHrs+'</Data></Cell><Cell/></Row></Table></Worksheet></Workbook>';return btoa(unescape(encodeURIComponent(xml)));};
  const generateXLSX=()=>{const b64=buildXLSXBase64();const blob=new Blob([atob(b64)],{type:"application/vnd.ms-excel"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="3C_Timesheet"+(custFilter?"_"+custFilter.replace(/\s/g,"_"):"")+(dateFrom&&dateTo?"_"+dateFrom+"_to_"+dateTo:dateFrom?"_"+dateFrom:"")+ ".xls";a.click();URL.revokeObjectURL(url);setToast("Downloaded");setTimeout(()=>setToast(""),3000);};
  const LOGO_URL="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
  const buildSig=()=>{const u=currentUser;if(!u)return"";return '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;font-family:Calibri,sans-serif;font-size:13px;color:#333;"><strong>'+u.name+'</strong><br/>'+(u.title?u.title+'<br/>':'')+(u.phone?u.phone+'<br/>':'')+'<img src="'+LOGO_URL+'" alt="3C Refrigeration" style="width:120px;height:auto;margin-top:6px;display:block;"/></div>';};
  const sendTimesheet=async()=>{if(!emailTo.trim()||sending)return;setSending(true);const fname="3C_Timesheet"+(custFilter?"_"+custFilter.replace(/\s/g,"_"):"")+(dateFrom&&dateTo?"_"+dateFrom+"_to_"+dateTo:dateFrom?"_"+dateFrom:"")+".xls";const xlsB64=buildXLSXBase64();const{rows,totalHrs}=getTimesheetRows();let tbl='<table style="border-collapse:collapse;width:100%;margin:16px 0;"><tr style="background:#00B7E8;color:#fff;">';["Date","Building #","Room#","WO/Asset#","Hrs.","Description"].forEach(c=>{tbl+='<th style="padding:8px 12px;text-align:left;border:1px solid #ddd;">'+c+'</th>';});tbl+='</tr>';rows.forEach((r,i)=>{tbl+='<tr style="background:'+(i%2===0?'#f9f9f9':'#fff')+';"><td style="padding:6px 12px;border:1px solid #ddd;">'+r.date+'</td><td style="padding:6px 12px;border:1px solid #ddd;">'+r.building+'</td><td style="padding:6px 12px;border:1px solid #ddd;">'+r.room+'</td><td style="padding:6px 12px;border:1px solid #ddd;">'+r.wo_num+'</td><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold;">'+r.hours+'</td><td style="padding:6px 12px;border:1px solid #ddd;">'+r.desc+'</td></tr>';});tbl+='<tr style="background:#E8F5E9;font-weight:bold;"><td colspan="4" style="padding:8px 12px;border:1px solid #ddd;text-align:right;">TOTAL:</td><td style="padding:8px 12px;border:1px solid #ddd;">'+totalHrs.toFixed(1)+'</td><td></td></tr></table>';const fullBody='<div style="font-family:Calibri,sans-serif;">'+emailBody+tbl+buildSig()+'</div>';try{const emails=emailTo.split(",").map(e=>e.trim()).filter(Boolean);for(const em of emails){await saveContact(em);}if(emailCC){emailCC.split(",").map(e=>e.trim()).filter(Boolean).forEach(em=>saveContact(em));}const resp=await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({to:emailTo.trim(),cc:emailCC.trim(),subject:emailSubject+(custFilter?" for "+custFilter:"")+(dateFrom&&dateTo?" ("+dateFrom+" to "+dateTo+")":dateFrom?" ("+dateFrom+")":""),body:fullBody,attachment:{name:fname,content:xlsB64,type:"application/vnd.ms-excel"}})});const result=await resp.json();if(result.success){setToast("Email sent!");setShowEmail(false);setEmailTo("");setEmailCC("");sb().from("email_contacts").select("*").order("last_used",{ascending:false}).then(({data})=>{if(data)setContacts(data);});}else{setToast("Error: "+(result.error||"Failed"));console.error(result);}}catch(err){setToast("Error sending");console.error(err);}setSending(false);setTimeout(()=>setToast(""),4000);};
  const SugBox=({items,onPick,show})=>{if(!show||items.length===0)return null;return <div style={{position:"absolute",top:"100%",left:0,right:0,background:B.surface,border:"1px solid "+B.border,borderRadius:6,zIndex:100,maxHeight:150,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.4)"}}>{items.map(c=><div key={c.id} onClick={()=>onPick(c.email)} style={{padding:"8px 12px",fontSize:13,color:B.text,cursor:"pointer",borderBottom:"1px solid "+B.border}} onMouseEnter={e=>e.currentTarget.style.background=B.cyanGlow} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{c.email}</div>)}</div>;};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Customer Billing Export</h3>
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <div><label style={LS}>From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={IS}/></div>
      <div><label style={LS}>To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={IS}/></div>
      <div><label style={LS}>Customer</label><select value={custFilter} onChange={e=>setCustFilter(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">All Customers</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
    </div>
    <div style={{marginBottom:10}}>
      <span style={LS}>Export Columns</span>
      <div style={{display:"flex",gap:6,marginTop:6}}>
        {[["basic","Basic","WO#, Date, Customer, Hours"],["detailed","Detailed","+ Title, Location, Building, POs"],["full","Full","All columns"]].map(([k,label,desc])=><button key={k} onClick={()=>setCols(presets[k])} style={{flex:1,padding:"10px 8px",borderRadius:6,border:"2px solid "+(activePreset===k?B.cyan:B.border),background:activePreset===k?B.cyanGlow:"transparent",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:activePreset===k?B.cyan:B.text}}>{label}</div><div style={{fontSize:9,color:B.textDim,marginTop:2}}>{desc}</div></button>)}
      </div>
      <button onClick={()=>setShowCustomCols(!showCustomCols)} style={{background:"none",border:"none",color:B.textDim,fontSize:10,cursor:"pointer",marginTop:6,fontFamily:F}}>{showCustomCols?"▾ Hide custom":"▸ Customize columns"}</button>
      {showCustomCols&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{Object.entries(allCols).map(([k,v])=><button key={k} onClick={()=>setCols(prev=>prev.includes(k)?prev.filter(c=>c!==k):[...prev,k])} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(cols.includes(k)?B.cyan:B.border),background:cols.includes(k)?B.cyanGlow:"transparent",color:cols.includes(k)?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{v}</button>)}</div>}
    </div>
    {/* Billing Stats */}
    {(()=>{const totalHrs=completed.reduce((s,wo)=>{const ft=timeEntries.filter(t=>t.wo_id===wo.id).filter(t=>{const d=t.logged_date||wo.date_completed;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});return s+ft.reduce((ss,t)=>ss+parseFloat(t.hours||0),0);},0);const totalPOs=completed.reduce((s,wo)=>s+pos.filter(p=>p.wo_id===wo.id&&p.status==="approved").reduce((ss,p)=>ss+parseFloat(p.amount||0),0),0);const pendingPOs=completed.reduce((s,wo)=>s+pos.filter(p=>p.wo_id===wo.id&&p.status==="pending").length,0);const avgHrs=completed.length>0?(totalHrs/completed.length).toFixed(1):0;return(<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Work Orders" value={completed.length} icon="📋" color={B.cyan}/><StatCard label="Total Hours" value={totalHrs.toFixed(1)+"h"} icon="⏱" color={B.orange}/><StatCard label="Avg Hrs/WO" value={avgHrs+"h"} icon="📊" color={B.green}/><StatCard label="PO Total" value={"$"+totalPOs.toFixed(2)} icon="💰" color={B.purple}/>{pendingPOs>0&&<StatCard label="Pending POs" value={pendingPOs} icon="⏳" color={B.red}/>}</div>);})()}
    <Card style={{overflowX:"auto",marginBottom:14}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid "+B.border}}>{cols.map(c=><th key={c} style={{textAlign:"left",padding:"6px 8px",color:B.textDim,fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{allCols[c]}</th>)}</tr></thead><tbody>{completed.map(wo=>{const d=getData(wo);return(<tr key={wo.id} style={{borderBottom:"1px solid "+B.border}}>{cols.map(c=><td key={c} style={{padding:"6px 8px",fontFamily:c==="wo_id"||c==="hours"||c==="po_total"?M:F,color:c==="wo_id"?B.cyan:c==="hours"?B.cyan:B.text}}>{c==="hours"?d.hours_display:d[c]}</td>)}</tr>);})}</tbody></table></Card>
    <div style={{display:"flex",gap:8}}>
      <button onClick={copyToClip} style={{...BP,flex:1}}>📋 Copy</button>
      <button onClick={generateXLSX} style={{...BP,flex:1,background:B.green}}>📄 Download</button>
      <button onClick={()=>setShowEmail(true)} style={{...BP,flex:1,background:B.purple}}>📧 Email</button>
    </div>
    {showEmail&&<Modal title="Send Timesheet via Email" onClose={()=>setShowEmail(false)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border,fontSize:12,color:B.textMuted}}>Attaching 3C Timesheet (.xls) with {completed.length} entries{custFilter?" for "+custFilter:""} from <span style={{color:B.cyan}}>service@3crefrigeration.com</span></div>
        {(()=>{const warnings=[];const zeroHrs=completed.filter(wo=>{const ft=timeEntries.filter(t=>t.wo_id===wo.id).filter(t=>{const d=t.logged_date||wo.date_completed;return(!dateFrom||d>=dateFrom)&&(!dateTo||d<=dateTo);});return ft.reduce((s,t)=>s+parseFloat(t.hours||0),0)===0;});const noDesc=completed.filter(wo=>!wo.work_performed&&!wo.notes||wo.notes==="No details.");const noDate=completed.filter(wo=>!wo.date_completed);if(zeroHrs.length>0)warnings.push({icon:"⏱",msg:zeroHrs.length+" WO"+(zeroHrs.length>1?"s have":" has")+" 0 hours logged: "+zeroHrs.map(w=>w.wo_id).join(", ")});if(noDesc.length>0)warnings.push({icon:"📝",msg:noDesc.length+" WO"+(noDesc.length>1?"s have":" has")+" no work description: "+noDesc.map(w=>w.wo_id).join(", ")});if(noDate.length>0)warnings.push({icon:"📅",msg:noDate.length+" WO"+(noDate.length>1?"s have":" has")+" no completion date"});return warnings.length>0?<div style={{display:"flex",flexDirection:"column",gap:4}}>{warnings.map((w,i)=><div key={i} style={{background:B.orange+"15",border:"1px solid "+B.orange+"33",borderRadius:6,padding:"8px 12px",fontSize:11,color:B.orange,display:"flex",alignItems:"center",gap:8}}><span>{w.icon}</span><span>{w.msg}</span></div>)}</div>:null;})()}
        <div><label style={LS}>Email Template</label><select onChange={e=>{const t=(emailTemplates||[]).find(x=>x.id===e.target.value);applyTemplate(t);}} style={{...IS,cursor:"pointer"}}><option value="">— Default —</option>{(emailTemplates||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div style={{position:"relative"}}><label style={LS}>To <span style={{color:B.red}}>*</span></label><input value={emailTo} onChange={e=>{setEmailTo(e.target.value);setSuggestions(filterContacts(e.target.value));setShowSugTo(true);}} onFocus={()=>{setSuggestions(filterContacts(emailTo));setShowSugTo(true);}} onBlur={()=>setTimeout(()=>setShowSugTo(false),200)} placeholder="customer@example.com" style={{...IS,fontSize:14,padding:12}}/><SugBox items={suggestions} show={showSugTo} onPick={e=>{setEmailTo(e);setShowSugTo(false);}}/></div>
        <div style={{position:"relative"}}><label style={LS}>CC <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={emailCC} onChange={e=>{setEmailCC(e.target.value);setSuggestions(filterContacts(e.target.value.split(",").pop().trim()));setShowSugCC(true);}} onFocus={()=>{setSuggestions(filterContacts(emailCC.split(",").pop().trim()));setShowSugCC(true);}} onBlur={()=>setTimeout(()=>setShowSugCC(false),200)} placeholder="boss@example.com" style={{...IS,fontSize:14,padding:12}}/><SugBox items={suggestions} show={showSugCC} onPick={e=>{const parts=emailCC.split(",").map(s=>s.trim()).filter(Boolean);parts.pop();parts.push(e);setEmailCC(parts.join(", "));setShowSugCC(false);}}/></div>
        <div><label style={LS}>Subject</label><input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{...IS,fontSize:14,padding:12}}/></div>
        <div><label style={LS}>Message <span style={{color:B.textDim,fontWeight:400}}>(timesheet table added automatically below)</span></label><textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} rows={4} style={{...IS,resize:"vertical",lineHeight:1.5,fontSize:12}}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowEmail(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={sendTimesheet} disabled={sending} style={{...BP,flex:1,background:B.purple,opacity:sending?.6:1}}>{sending?"Sending...":"📧 Send"}</button></div>
      </div>
    </Modal>}
  </div>);
}
function CustomerMgmt({customers,onAdd,onUpdate,onDelete}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[name,setName]=useState(""),[addr,setAddr]=useState(""),[contact,setContact]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[billingOverride,setBillingOverride]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openEdit=(c)=>{setEditing(c);setName(c.name);setAddr(c.address||"");setContact(c.contact_name||"");setPhone(c.phone||"");setEmail(c.email||"");setBillingOverride(c.billing_rate_override||"");setShowForm(true);};
  const openNew=()=>{setEditing(null);setName("");setAddr("");setContact("");setPhone("");setEmail("");setBillingOverride("");setShowForm(true);};
  const go=async()=>{if(!name.trim()||saving)return;setSaving(true);const obj={name:name.trim(),address:addr.trim(),contact_name:contact.trim(),phone:phone.trim(),email:email.trim(),billing_rate_override:parseFloat(billingOverride)||null};if(editing){await onUpdate({...editing,...obj});}else{await onAdd(obj);}setSaving(false);setShowForm(false);msg(editing?"Customer updated":"Customer added");};
  const del=async(c)=>{if(!window.confirm("Delete customer "+c.name+"?"))return;await onDelete(c.id);msg("Deleted "+c.name);};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Customers</h3>
    <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ Add Customer</button>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {(customers||[]).length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No customers yet</div>}
      {(customers||[]).map(c=><Card key={c.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.purple}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{c.name}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>{[c.contact_name,c.phone,c.email,c.address].filter(Boolean).join(" · ")||"No details"}</div></div>
          <div style={{display:"flex",gap:6}}><button onClick={()=>openEdit(c)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button><button onClick={()=>del(c)} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button></div>
        </div></Card>)}
    </div>
    {showForm&&<Modal title={editing?"Edit Customer":"Add Customer"} onClose={()=>setShowForm(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Company Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="ABC Grocery" style={IS}/></div>
        <div><label style={LS}>Contact Name</label><input value={contact} onChange={e=>setContact(e.target.value)} placeholder="John Smith" style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="555-123-4567" style={IS}/></div><div><label style={LS}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="john@abc.com" style={IS}/></div></div>
        <div><label style={LS}>Address</label><input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="123 Main St, City, NC" style={IS}/></div>
        <div><label style={LS}>Billing Rate Override ($/hr) <span style={{color:B.textDim,fontWeight:400}}>— leave blank to use tech's default rate</span></label><input value={billingOverride} onChange={e=>setBillingOverride(e.target.value)} type="number" step="5" placeholder="e.g. 95" style={{...IS,fontFamily:M}}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save":"Add Customer")}</button></div>
      </div>
    </Modal>}
  </div>);
}

// ═══════════════════════════════════════════
// RECURRING PM TEMPLATES
// ═══════════════════════════════════════════
function RecurringPM({templates,onAdd,onDelete,users}){
  const[showForm,setShowForm]=useState(false),[toast,setToast]=useState("");
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState("Unassigned"),[loc,setLoc]=useState(""),[bldg,setBldg]=useState(""),[notes,setNotes]=useState(""),[freq,setFreq]=useState("monthly"),[nextDue,setNextDue]=useState(""),[cust,setCust]=useState(""),[saving,setSaving]=useState(false);
  const techs=users.filter(u=>u.role==="technician"&&u.active!==false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const go=async()=>{if(!title.trim()||saving)return;setSaving(true);await onAdd({title:title.trim(),priority:pri,assignee:assign,location:loc.trim(),building:bldg.trim(),notes:notes.trim(),customer:cust.trim(),frequency:freq,next_due:nextDue||null,active:true});setShowForm(false);setTitle("");msg("Template created");setSaving(false);};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Recurring PM Templates</h3>
    <button onClick={()=>setShowForm(true)} style={{...BP,marginBottom:14,fontSize:12}}>+ New Recurring PM</button>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {templates.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No recurring templates yet</div>}
      {templates.map(t=><Card key={t.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.cyan}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{t.title}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>{t.frequency} · {t.assignee} · {t.location||"No location"}{t.customer&&" · 👤 "+t.customer}</div>{t.next_due&&<div style={{fontSize:11,color:B.orange,marginTop:2}}>Next due: {t.next_due}</div>}</div>
          <button onClick={async()=>{await onDelete(t.id);msg("Deleted");}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button>
        </div></Card>)}
    </div>
    {showForm&&<Modal title="New Recurring PM" onClose={()=>setShowForm(false)} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Monthly Cooler Inspection" style={IS}/></div>
      <div><label style={LS}>Customer</label><input value={cust} onChange={e=>setCust(e.target.value)} placeholder="ABC Grocery" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Frequency</label><select value={freq} onChange={e=>setFreq(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="weekly">Weekly</option><option value="biweekly">Every 2 Weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div><div><label style={LS}>Next Due</label><input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)} style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Location</label><input value={loc} onChange={e=>setLoc(e.target.value)} style={IS}/></div><div><label style={LS}>Building</label><input value={bldg} onChange={e=>setBldg(e.target.value)} style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Assignee</label><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{techs.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div></div>
      <div><label style={LS}>Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{...IS,resize:"vertical"}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Create Template"}</button></div>
    </div></Modal>}
  </div>);
}

function Settings({emailTemplates,onAddTemplate,onUpdateTemplate,onDeleteTemplate}){
  const[tab,setTab]=useState("templates"),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[tName,setTName]=useState(""),[tSubject,setTSubject]=useState(""),[tBody,setTBody]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openNew=()=>{setEditing(null);setTName("");setTSubject("3C Refrigeration \u2014 Timesheet");setTBody("<p>Hi,</p><p>Please find attached the timesheet.</p><p>If you have any questions, please reply to this email.</p>");setShowForm(true);};
  const openEdit=(t)=>{setEditing(t);setTName(t.name);setTSubject(t.subject);setTBody(t.body);setShowForm(true);};
  const go=async()=>{if(!tName.trim()||!tSubject.trim()||saving)return;setSaving(true);const obj={name:tName.trim(),subject:tSubject.trim(),body:tBody.trim()};if(editing){await onUpdateTemplate({...editing,...obj});}else{await onAddTemplate(obj);}setSaving(false);setShowForm(false);msg(editing?"Template updated":"Template created");};
  const del=async(t)=>{if(!window.confirm("Delete template '"+t.name+"'?"))return;await onDeleteTemplate(t.id);msg("Deleted");};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>System Settings</h3>
    <div style={{display:"flex",gap:6,marginBottom:16}}>{[["templates","📧 Email Templates"],["other","⚙️ Other Settings"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 14px",borderRadius:6,border:"1px solid "+(tab===k?B.cyan:B.border),background:tab===k?B.cyanGlow:"transparent",color:tab===k?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    {tab==="templates"&&<div>
      <div style={{fontSize:12,color:B.textMuted,marginBottom:12}}>Create email templates for sending timesheets. Templates set the subject line and body text. The timesheet table and Excel attachment are added automatically.</div>
      <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ New Email Template</button>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {(!emailTemplates||emailTemplates.length===0)&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:12}}>No templates yet. Click above to create one.</div></Card>}
        {(emailTemplates||[]).map(t=><Card key={t.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.purple}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>Subject: {t.subject}</div><div style={{fontSize:11,color:B.textDim,marginTop:2,maxHeight:40,overflow:"hidden"}} dangerouslySetInnerHTML={{__html:t.body}}/></div>
            <div style={{display:"flex",gap:6,flexShrink:0}}><button onClick={()=>openEdit(t)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button><button onClick={()=>del(t)} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button></div>
          </div></Card>)}
      </div>
      {showForm&&<Modal title={editing?"Edit Template":"New Email Template"} onClose={()=>setShowForm(false)} wide>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={LS}>Template Name</label><input value={tName} onChange={e=>setTName(e.target.value)} placeholder="e.g. Monthly Timesheet, Invoice Follow-up" style={IS}/></div>
          <div><label style={LS}>Email Subject</label><input value={tSubject} onChange={e=>setTSubject(e.target.value)} placeholder="3C Refrigeration — Timesheet" style={IS}/></div>
          <div><label style={LS}>Email Body <span style={{color:B.textDim,fontWeight:400}}>(timesheet table and your signature are added automatically below)</span></label><textarea value={tBody} onChange={e=>setTBody(e.target.value)} rows={6} placeholder="<p>Hi,</p><p>Please find attached...</p>" style={{...IS,resize:"vertical",lineHeight:1.5,fontFamily:M,fontSize:12}}/></div>
          <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border}}><span style={{fontSize:10,color:B.textDim}}>Preview:</span><div style={{marginTop:6,fontSize:12,color:B.textMuted}} dangerouslySetInnerHTML={{__html:tBody||"<em>Empty</em>"}}/></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save":"Create Template")}</button></div>
        </div>
      </Modal>}
    </div>}
    {tab==="other"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{[["🔔","Notifications"],["📱","Devices"],["🔐","Security"],["☁️","Storage"],["📊","Reports"],["🏢","Company"],["🔧","Integrations"]].map(([ic,lb])=><Card key={lb} style={{padding:"18px 14px",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:24,marginBottom:6}}>{ic}</div><div style={{fontSize:12,fontWeight:600,color:B.textMuted}}>{lb}</div></Card>)}</div>}
  </div>);
}

// ═══════════════════════════════════════════
// DASHBOARD ANALYTICS
// ═══════════════════════════════════════════
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
  return(<Card style={{padding:16,marginBottom:16}}>
    <div style={{fontSize:13,fontWeight:800,color:B.text,marginBottom:12}}>4-Week Trend</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div><div style={{fontSize:10,color:B.textDim,fontWeight:600,marginBottom:8}}>HOURS WORKED</div><div style={{display:"flex",alignItems:"flex-end",gap:6,height:60}}>{weeks.map((w,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:9,fontFamily:M,color:B.cyan}}>{w.hrs.toFixed(0)}</span><div style={{width:"100%",background:B.cyan,borderRadius:3,height:Math.max(4,w.hrs/maxHrs*50)+"px",transition:"height .3s"}}/><span style={{fontSize:8,color:B.textDim}}>{w.label}</span></div>)}</div></div>
      <div><div style={{fontSize:10,color:B.textDim,fontWeight:600,marginBottom:8}}>WOs COMPLETED</div><div style={{display:"flex",alignItems:"flex-end",gap:6,height:60}}>{weeks.map((w,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:9,fontFamily:M,color:B.green}}>{w.completed}</span><div style={{width:"100%",background:B.green,borderRadius:3,height:Math.max(4,w.completed/maxCompleted*50)+"px",transition:"height .3s"}}/><span style={{fontSize:8,color:B.textDim}}>{w.label}</span></div>)}</div></div>
    </div>
    <div style={{display:"flex",justifyContent:"space-around",marginTop:14,padding:"10px 0",borderTop:"1px solid "+B.border}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,fontFamily:M,color:B.cyan}}>{weeks.reduce((s,w)=>s+w.hrs,0).toFixed(0)}h</div><div style={{fontSize:9,color:B.textDim}}>Total Hours</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,fontFamily:M,color:B.green}}>{weeks.reduce((s,w)=>s+w.completed,0)}</div><div style={{fontSize:9,color:B.textDim}}>Completed</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,fontFamily:M,color:B.purple}}>{"$"+weeks.reduce((s,w)=>s+w.poAmt,0).toLocaleString()}</div><div style={{fontSize:9,color:B.textDim}}>PO Spend</div></div>
    </div>
  </Card>);
}
// ═══════════════════════════════════════════
// PROJECTS MODULE — with Chambers, Budget, WO Integration
// ═══════════════════════════════════════════
function ProjectList({projects,onSelect,onCreate,users,customers,userRole}){
  const[showCreate,setShowCreate]=useState(false),[name,setName]=useState(""),[desc,setDesc]=useState(""),[cust,setCust]=useState(""),[loc,setLoc]=useState(""),[budget,setBudget]=useState(""),[saving,setSaving]=useState(false);
  const isMgr=userRole==="admin"||userRole==="manager";const active=projects.filter(p=>p.status==="active");const archived=projects.filter(p=>p.status==="archived");
  const[showArchived,setShowArchived]=useState(false);
  const go=async()=>{if(!name.trim()||saving)return;if(cleanText(name,"Project Name")===null||cleanText(desc,"Description")===null)return;setSaving(true);await onCreate({name:name.trim(),description:desc.trim(),customer:cust,location:loc.trim(),budget:parseFloat(budget)||0,status:"active",assigned_techs:[]});setSaving(false);setShowCreate(false);setName("");setDesc("");setCust("");setLoc("");setBudget("");};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Projects</h3>{isMgr&&<button onClick={()=>setShowCreate(true)} style={{...BP,fontSize:12}}>+ New Project</button>}</div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Active" value={active.length} icon="🏗️" color={B.cyan}/><StatCard label="Archived" value={archived.length} icon="📁" color={B.textDim}/></div>
    {active.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:24,marginBottom:6}}>🏗️</div><div style={{fontSize:13}}>No active projects.</div></Card>}
    {active.map(p=><Card key={p.id} onClick={()=>onSelect(p)} style={{padding:"14px 16px",marginBottom:8,cursor:"pointer",borderLeft:"3px solid "+B.cyan}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{p.name}</div>{p.customer&&<div style={{fontSize:11,color:B.purple,marginTop:2}}>👤 {p.customer}</div>}</div><div style={{textAlign:"right"}}>{p.budget>0&&<div style={{fontSize:11,fontFamily:M,color:B.green}}>{"$"+p.budget.toLocaleString()}</div>}{p.assigned_techs&&p.assigned_techs.length>0&&<div style={{fontSize:11,color:B.textDim}}>{p.assigned_techs.length} techs</div>}</div></div></Card>)}
    {archived.length>0&&<><button onClick={()=>setShowArchived(!showArchived)} style={{width:"100%",padding:"10px 16px",background:B.surface,border:"1px solid "+B.border,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginTop:16}}><span style={{fontSize:12,fontWeight:600,color:B.textDim}}>📁 Archived ({archived.length})</span><span style={{color:B.textDim}}>{showArchived?"▾":"▸"}</span></button>{showArchived&&archived.map(p=><Card key={p.id} onClick={()=>onSelect(p)} style={{padding:"12px 16px",marginTop:6,cursor:"pointer",opacity:.6}}><div style={{fontSize:13,fontWeight:600,color:B.textMuted}}>{p.name}</div></Card>)}</>}
    {showCreate&&<Modal title="New Project" onClose={()=>setShowCreate(false)} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Project Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Building 7513 Chiller Replacement" style={IS}/></div>
      <div><label style={LS}>Description</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Scope of work..." style={{...IS,resize:"vertical"}}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Customer</label><select value={cust} onChange={e=>setCust(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select —</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>{isMgr&&<div><label style={LS}>Budget ($)</label><input value={budget} onChange={e=>setBudget(e.target.value)} type="number" placeholder="15000" style={{...IS,fontFamily:M}}/></div>}</div>
      <div><label style={LS}>Location</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Building, site" style={IS}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setShowCreate(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Creating...":"Create Project"}</button></div>
    </div></Modal>}
  </div>);
}
function ProjectDetail({project,onBack,onUpdate,onDelete,users,userName,userRole,allWOs,onCreateWO,allPOs,allTime,customers}){
  const[tab,setTab]=useState("overview"),[toast,setToast]=useState(""),[saving,setSaving]=useState(false);
  const[editBudget,setEditBudget]=useState(false),[localBudget,setLocalBudget]=useState(project.budget||0);
  const[chambers,setChambers]=useState([]),[milestones,setMilestones]=useState([]),[parts,setParts]=useState([]),[notes,setNotes]=useState([]),[photos,setPhotos]=useState([]),[drawings,setDrawings]=useState([]);
  const[newChamber,setNewChamber]=useState(""),[selChamber,setSelChamber]=useState(null);
  const[newMilestone,setNewMilestone]=useState(""),[newPart,setNewPart]=useState(""),[newPartQty,setNewPartQty]=useState(1),[newNote,setNewNote]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const loadPD=async()=>{const c=sb();const[ch,m,p,n,ph,d]=await Promise.all([c.from("project_chambers").select("*").eq("project_id",project.id).order("sort_order"),c.from("project_milestones").select("*").eq("project_id",project.id).order("sort_order"),c.from("project_parts").select("*").eq("project_id",project.id).order("created_at"),c.from("project_notes").select("*").eq("project_id",project.id).order("created_at",{ascending:false}),c.from("project_photos").select("*").eq("project_id",project.id).order("uploaded_at",{ascending:false}),c.from("project_drawings").select("*").eq("project_id",project.id).order("uploaded_at",{ascending:false})]);setChambers(ch.data||[]);setMilestones(m.data||[]);setParts(p.data||[]);setNotes(n.data||[]);setPhotos(ph.data||[]);setDrawings(d.data||[]);};
  useEffect(()=>{loadPD();},[project.id]);
  const addChamber=async()=>{if(!newChamber.trim())return;if(cleanText(newChamber,"Chamber")===null)return;await sb().from("project_chambers").insert({project_id:project.id,name:newChamber.trim(),sort_order:chambers.length});setNewChamber("");await loadPD();msg("Chamber added");};
  const deleteChamber=async(id)=>{if(!window.confirm("Delete chamber and all its data?"))return;await sb().from("project_chambers").delete().eq("id",id);if(selChamber===id)setSelChamber(null);await loadPD();};
  const chM=selChamber?milestones.filter(m=>m.chamber_id===selChamber):milestones;
  const chP=selChamber?parts.filter(p=>p.chamber_id===selChamber):parts;
  const[addMode,setAddMode]=useState("all");
  const addMilestone=async()=>{if(!newMilestone.trim()||!isMgr)return;if(cleanText(newMilestone,"Milestone")===null)return;if(!selChamber&&chambers.length>0&&addMode==="all"){for(const ch of chambers){await sb().from("project_milestones").insert({project_id:project.id,chamber_id:ch.id,title:newMilestone.trim(),sort_order:milestones.length});}}else{await sb().from("project_milestones").insert({project_id:project.id,chamber_id:selChamber||null,title:newMilestone.trim(),sort_order:chM.length});}setNewMilestone("");await loadPD();msg(selChamber?"Milestone added":addMode==="all"?"Added to all chambers":"Added to project");};
  const toggleMilestone=async(m)=>{await sb().from("project_milestones").update({completed:!m.completed,completed_at:!m.completed?new Date().toISOString():null}).eq("id",m.id);await loadPD();};
  const updateMilestoneDue=async(m,date)=>{await sb().from("project_milestones").update({due_date:date||null}).eq("id",m.id);await loadPD();};
  const delMilestone=async(id)=>{if(!isMgr)return;await sb().from("project_milestones").delete().eq("id",id);await loadPD();};
  const addPart=async()=>{if(!newPart.trim()||!isMgr)return;if(cleanText(newPart,"Part")===null)return;if(!selChamber&&chambers.length>0&&addMode==="all"){for(const ch of chambers){await sb().from("project_parts").insert({project_id:project.id,chamber_id:ch.id,name:newPart.trim(),quantity:newPartQty||1});}}else{await sb().from("project_parts").insert({project_id:project.id,chamber_id:selChamber||null,name:newPart.trim(),quantity:newPartQty||1});}setNewPart("");setNewPartQty(1);await loadPD();msg(selChamber?"Part added":addMode==="all"?"Added to all chambers":"Added to project");};
  const togglePart=async(p)=>{await sb().from("project_parts").update({received:!p.received,received_at:!p.received?new Date().toISOString():null}).eq("id",p.id);await loadPD();};
  const delPart=async(id)=>{await sb().from("project_parts").delete().eq("id",id);await loadPD();};
  const addNote=async()=>{if(!newNote.trim())return;if(cleanText(newNote,"Note")===null)return;await sb().from("project_notes").insert({project_id:project.id,note:newNote.trim(),author:userName});setNewNote("");await loadPD();msg("Note added");};
  const upPhoto=async(file)=>{if(!file)return;setSaving(true);try{const b64=await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.onerror=j;f.readAsDataURL(file);});let fb=b64,fm=file.type;if(file.size>1048576&&file.type.startsWith("image/")){const img=new Image();const u=URL.createObjectURL(file);await new Promise(r=>{img.onload=r;img.src=u;});const cv=document.createElement("canvas");const s=Math.min(1,1200/img.width);cv.width=img.width*s;cv.height=img.height*s;cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);fb=cv.toDataURL("image/jpeg",0.8).split(",")[1];fm="image/jpeg";URL.revokeObjectURL(u);}const rp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64:fb,fileName:Date.now()+"_"+file.name,mimeType:fm,folderPath:"3C FieldOps/Projects/"+project.name+"/Photos"})});const rs=await rp.json();if(rs.success){await sb().from("project_photos").insert({project_id:project.id,chamber_id:selChamber||null,photo_url:rs.thumbnailUrl,uploaded_by:userName});await loadPD();msg("Photo uploaded");}else msg("Failed");}catch(e){msg("Error");}setSaving(false);};
  const upDraw=async(file)=>{if(!file)return;setSaving(true);try{const b64=await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.onerror=j;f.readAsDataURL(file);});const rp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64:b64,fileName:file.name,mimeType:file.type||"application/pdf",folderPath:"3C FieldOps/Projects/"+project.name+"/Drawings"})});const rs=await rp.json();if(rs.success){await sb().from("project_drawings").insert({project_id:project.id,file_url:rs.webViewLink,name:file.name,uploaded_by:userName});await loadPD();msg("Drawing uploaded");}else msg("Failed");}catch(e){msg("Error");}setSaving(false);};
  const toggleTech=async(t)=>{const c=project.assigned_techs||[];await onUpdate({...project,assigned_techs:c.includes(t)?c.filter(x=>x!==t):[...c,t]});};
  const isMgr=userRole==="admin"||userRole==="manager";
  const isAdmin=userRole==="admin";
  const mDone=milestones.filter(m=>m.completed).length,mTot=milestones.length;
  const pDone=parts.filter(p=>p.received).length,pTot=parts.length;
  const pWOs=(allWOs||[]).filter(w=>w.project_id===project.id);
  const pHrs=pWOs.reduce((s,w)=>s+parseFloat(w.hours_total||0),0);
  const materialSpend=(allPOs||[]).filter(p=>pWOs.some(w=>w.id===p.wo_id)&&p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);
  // Calculate labor costs from time entries
  const getRate=(techName,type)=>{const u=(users||[]).find(x=>x.name===techName);const custOverride=(allWOs||[]).find(w=>w.project_id===project.id)?.customer;const cust=custOverride?(customers||[]).find(c=>c.name===custOverride):null;if(type==="billing"&&cust?.billing_rate_override)return cust.billing_rate_override;return u?u[type==="billing"?"billing_rate":"cost_rate"]||0:0;};
  const projectTimeEntries=pWOs.flatMap(w=>(allTime||[]).filter(t=>t.wo_id===w.id));
  const laborCost=projectTimeEntries.reduce((s,t)=>s+parseFloat(t.hours||0)*getRate(t.technician,"cost"),0);
  const laborBilling=projectTimeEntries.reduce((s,t)=>s+parseFloat(t.hours||0)*getRate(t.technician,"billing"),0);
  const totalCost=materialSpend+laborCost;
  const totalBilling=materialSpend+laborBilling;
  const profit=totalBilling-totalCost;
  const bLeft=(project.budget||0)-totalCost;
  return(<div><Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",fontFamily:F,marginBottom:10}}>← Back</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><h2 style={{margin:0,fontSize:20,fontWeight:800,color:B.text}}>{project.name}</h2>{project.customer&&<div style={{fontSize:12,color:B.purple,marginTop:2}}>👤 {project.customer}</div>}{project.location&&<div style={{fontSize:11,color:B.textDim}}>📍 {project.location}</div>}</div><select value={project.status} onChange={async e=>{await onUpdate({...project,status:e.target.value});}} style={{padding:"6px 10px",borderRadius:6,border:"1px solid "+B.border,background:B.surface,color:B.text,fontSize:11,cursor:"pointer",fontFamily:F}}><option value="active">Active</option><option value="archived">Archived</option></select></div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Milestones" value={mDone+"/"+mTot} icon="🎯" color={mTot>0&&mDone===mTot?B.green:B.cyan}/><StatCard label="Parts" value={pDone+"/"+pTot} icon="🔩" color={pTot>0&&pDone===pTot?B.green:B.orange}/><StatCard label="WOs" value={pWOs.length} icon="📋" color={B.cyan}/><StatCard label="Hours" value={pHrs.toFixed(1)+"h"} icon="⏱" color={B.orange}/>{isMgr&&project.budget>0&&<StatCard label="Budget Left" value={"$"+bLeft.toLocaleString()} icon="💰" color={bLeft<0?B.red:B.green}/>}</div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",overflowX:"auto"}}>{[["overview","Overview"],["chambers","Chambers"],["milestones","Milestones"],["parts","Parts"],["workorders","Work Orders"],["photos","Photos"],["drawings","Drawings"],["notes","Notes"],["team","Team"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 12px",borderRadius:6,border:"1px solid "+(tab===k?B.cyan:B.border),background:tab===k?B.cyanGlow:"transparent",color:tab===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>{l}</button>)}</div>
    {(tab==="milestones"||tab==="parts"||tab==="photos")&&chambers.length>0&&<div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}><button onClick={()=>setSelChamber(null)} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(selChamber===null?B.cyan:B.border),background:selChamber===null?B.cyanGlow:"transparent",color:selChamber===null?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>All</button>{chambers.map(c=><button key={c.id} onClick={()=>setSelChamber(c.id)} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(selChamber===c.id?B.cyan:B.border),background:selChamber===c.id?B.cyanGlow:"transparent",color:selChamber===c.id?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{c.name}</button>)}</div>}
    {tab==="overview"&&<div>
      {project.description&&<Card style={{padding:14,marginBottom:12}}><span style={LS}>Description</span><p style={{margin:"4px 0 0",color:B.text,fontSize:13,lineHeight:1.5}}>{project.description}</p></Card>}
      {isMgr&&<Card style={{padding:14,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={LS}>Budget & Financials</span>{!editBudget?<button onClick={()=>{setLocalBudget(project.budget||"");setEditBudget(true);}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer",fontFamily:F}}>Edit Budget</button>:<div style={{display:"flex",gap:4}}><input value={localBudget} onChange={e=>setLocalBudget(e.target.value)} type="number" placeholder="15000" style={{...IS,width:100,padding:"4px 8px",fontSize:12,fontFamily:M}}/><button onClick={async()=>{await onUpdate({...project,budget:parseFloat(localBudget)||0});setEditBudget(false);msg("Budget updated");}} style={{background:"none",border:"none",color:B.green,fontSize:11,cursor:"pointer",fontFamily:F}}>Save</button></div>}</div>
        {(project.budget||0)>0&&<div><div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12}}><span>Budget: <strong style={{fontFamily:M}}>{"$"+(project.budget||0).toLocaleString()}</strong></span><span>Cost: <strong style={{color:B.orange,fontFamily:M}}>{"$"+totalCost.toLocaleString()}</strong></span><span style={{color:bLeft<0?B.red:B.green}}>Left: <strong style={{fontFamily:M}}>{"$"+bLeft.toLocaleString()}</strong></span></div><div style={{marginTop:8,background:B.bg,borderRadius:4,height:10,overflow:"hidden"}}><div style={{width:Math.min(100,project.budget>0?totalCost/project.budget*100:0)+"%",height:"100%",background:bLeft<0?B.red:B.orange,borderRadius:4}}/></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
          <div style={{background:B.bg,borderRadius:6,padding:10}}><div style={{fontSize:10,color:B.textDim,fontWeight:600}}>MATERIALS</div><div style={{fontSize:16,fontWeight:800,fontFamily:M,color:B.orange,marginTop:2}}>{"$"+materialSpend.toLocaleString()}</div><div style={{fontSize:9,color:B.textDim}}>Approved POs</div></div>
          <div style={{background:B.bg,borderRadius:6,padding:10}}><div style={{fontSize:10,color:B.textDim,fontWeight:600}}>BILLING</div><div style={{fontSize:16,fontWeight:800,fontFamily:M,color:B.green,marginTop:2}}>{"$"+totalBilling.toLocaleString()}</div><div style={{fontSize:9,color:B.textDim}}>{pHrs.toFixed(1)}h billed</div></div>
          {isAdmin&&<div style={{background:B.bg,borderRadius:6,padding:10}}><div style={{fontSize:10,color:B.textDim,fontWeight:600}}>LABOR COST</div><div style={{fontSize:16,fontWeight:800,fontFamily:M,color:B.cyan,marginTop:2}}>{"$"+laborCost.toLocaleString()}</div><div style={{fontSize:9,color:B.textDim}}>{pHrs.toFixed(1)}h × cost rates</div></div>}
          {isAdmin&&<div style={{background:B.bg,borderRadius:6,padding:10}}><div style={{fontSize:10,color:B.textDim,fontWeight:600}}>PROFIT</div><div style={{fontSize:16,fontWeight:800,fontFamily:M,color:profit>=0?B.green:B.red,marginTop:2}}>{"$"+profit.toLocaleString()}</div><div style={{fontSize:9,color:B.textDim}}>{totalBilling>0?Math.round(profit/totalBilling*100):0}% margin</div></div>}
        </div>
        {isAdmin&&chambers.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:600,color:B.textDim,marginBottom:6}}>Cost by Chamber</div>{chambers.map(ch=>{const chWOs=pWOs.filter(w=>w.chamber_id===ch.id);const chMat=(allPOs||[]).filter(p=>chWOs.some(w=>w.id===p.wo_id)&&p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);const chTime=chWOs.flatMap(w=>(allTime||[]).filter(t=>t.wo_id===w.id));const chLabor=chTime.reduce((s,t)=>s+parseFloat(t.hours||0)*getRate(t.technician,"cost"),0);const chTotal=chMat+chLabor;const chBudget=ch.budget||project.budget||0;const chPct=chBudget>0?chTotal/chBudget*100:0;return<div key={ch.id} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.textMuted}}><span>{ch.name}{ch.budget>0&&<span style={{fontFamily:M,color:B.textDim}}>{" (budget: $"+ch.budget.toLocaleString()+")"}</span>}</span><span style={{fontFamily:M,color:chBudget>0&&chTotal>chBudget?B.red:B.textMuted}}>{"$"+chTotal.toLocaleString()+(chBudget>0?" ("+chPct.toFixed(0)+"%)":"")}</span></div><div style={{background:B.bg,borderRadius:3,height:6,marginTop:2,overflow:"hidden"}}><div style={{width:Math.min(100,chPct)+"%",height:"100%",background:chBudget>0&&chTotal>chBudget?B.red:B.cyan,borderRadius:3}}/></div></div>})}</div>}
        {(project.budget||0)===0&&<div style={{marginTop:8,fontSize:12,color:B.textDim}}>No budget set. Click Edit Budget to add one.</div>}
      </Card>}
      {mTot>0&&<Card style={{padding:14,marginBottom:12}}><span style={LS}>Milestones ({mDone}/{mTot})</span><div style={{marginTop:8,background:B.bg,borderRadius:4,height:8,overflow:"hidden"}}><div style={{width:(mDone/mTot*100)+"%",height:"100%",background:B.cyan,borderRadius:4}}/></div>{chambers.length>0&&<div style={{marginTop:8}}>{chambers.map(c=>{const cm=milestones.filter(m=>m.chamber_id===c.id);const d=cm.filter(m=>m.completed).length;return cm.length>0?<div key={c.id} style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.textMuted}}><span>{c.name}</span><span>{d}/{cm.length}</span></div><div style={{background:B.bg,borderRadius:3,height:4,marginTop:2,overflow:"hidden"}}><div style={{width:(d/cm.length*100)+"%",height:"100%",background:d===cm.length?B.green:B.cyan,borderRadius:3}}/></div></div>:null})}</div>}</Card>}
      {pTot>0&&<Card style={{padding:14,marginBottom:12}}><span style={LS}>Parts ({pDone}/{pTot})</span><div style={{marginTop:8,background:B.bg,borderRadius:4,height:8,overflow:"hidden"}}><div style={{width:(pDone/pTot*100)+"%",height:"100%",background:B.orange,borderRadius:4}}/></div>{chambers.length>0&&<div style={{marginTop:8}}>{chambers.map(c=>{const cp=parts.filter(p=>p.chamber_id===c.id);const d=cp.filter(p=>p.received).length;return cp.length>0?<div key={c.id} style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.textMuted}}><span>{c.name}</span><span>{d}/{cp.length}</span></div><div style={{background:B.bg,borderRadius:3,height:4,marginTop:2,overflow:"hidden"}}><div style={{width:(d/cp.length*100)+"%",height:"100%",background:d===cp.length?B.green:B.orange,borderRadius:3}}/></div></div>:null})}</div>}</Card>}
      {pWOs.length>0&&<Card style={{padding:14,marginBottom:12}}><span style={LS}>Hours by Work Order</span><div style={{marginTop:8}}>{pWOs.map(w=>{const h=parseFloat(w.hours_total||0);const mx=Math.max(...pWOs.map(x=>parseFloat(x.hours_total||0)),1);return<div key={w.id} style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.textMuted}}><span>{w.wo_id}</span><span style={{fontFamily:M}}>{h}h</span></div><div style={{background:B.bg,borderRadius:3,height:6,marginTop:2,overflow:"hidden"}}><div style={{width:(h/mx*100)+"%",height:"100%",background:B.cyan,borderRadius:3}}/></div></div>})}</div></Card>}
      {chambers.length>0&&<Card style={{padding:14,marginBottom:12}}><span style={LS}>Chambers ({chambers.length})</span>{chambers.map(c=>{const cm=milestones.filter(m=>m.chamber_id===c.id);const cp=parts.filter(p=>p.chamber_id===c.id);return<div key={c.id} onClick={()=>{setSelChamber(c.id);setTab("milestones");}} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+B.border,cursor:"pointer"}}><span style={{fontSize:12,fontWeight:600,color:B.text}}>{c.name}</span><div style={{display:"flex",gap:12}}>{cm.length>0&&<span style={{fontSize:10,color:cm.filter(m=>m.completed).length===cm.length?B.green:B.textDim}}>{"🎯 "+cm.filter(m=>m.completed).length+"/"+cm.length}</span>}{cp.length>0&&<span style={{fontSize:10,color:cp.filter(p=>p.received).length===cp.length?B.green:B.textDim}}>{"🔩 "+cp.filter(p=>p.received).length+"/"+cp.length}</span>}</div></div>})}</Card>}
    </div>}
    {tab==="chambers"&&<div>{isMgr&&<div style={{display:"flex",gap:6,marginBottom:12}}><input value={newChamber} onChange={e=>setNewChamber(e.target.value)} placeholder="e.g. 338 CR, 377 WR" style={{...IS,flex:1,padding:12}} onKeyDown={e=>e.key==="Enter"&&addChamber()}/><button onClick={addChamber} style={{...BP,padding:"12px 18px"}}>Add</button></div>}{chambers.map(c=>{const cm=milestones.filter(m=>m.chamber_id===c.id);const cp=parts.filter(p=>p.chamber_id===c.id);return<Card key={c.id} style={{padding:"12px 16px",marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div onClick={()=>{setSelChamber(c.id);setTab("milestones");}} style={{cursor:"pointer",flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:B.text}}>{c.name}</div>
          <div style={{display:"flex",gap:12,marginTop:4}}>
            {cm.length>0&&<span style={{fontSize:10,color:B.textDim}}>{"🎯 "+cm.filter(m=>m.completed).length+"/"+cm.length}</span>}
            {cp.length>0&&<span style={{fontSize:10,color:B.textDim}}>{"🔩 "+cp.filter(p=>p.received).length+"/"+cp.length}</span>}
            {isMgr&&c.budget>0&&<span style={{fontSize:10,fontFamily:M,color:B.green}}>{"💰 $"+c.budget.toLocaleString()}</span>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isMgr&&<input defaultValue={c.budget||""} onBlur={async e=>{const v=parseFloat(e.target.value)||0;if(v!==(c.budget||0)){await sb().from("project_chambers").update({budget:v}).eq("id",c.id);await loadPD();}}} placeholder="$" type="number" style={{width:70,padding:"4px 6px",borderRadius:4,border:"1px solid "+B.border,background:B.bg,color:B.text,fontSize:10,fontFamily:M,textAlign:"right"}} onClick={e=>e.stopPropagation()}/>}
          {isMgr&&<button onClick={()=>deleteChamber(c.id)} style={{background:"none",border:"none",color:B.red+"66",fontSize:14,cursor:"pointer"}}>×</button>}
        </div>
      </div>
    </Card>})}{chambers.length===0&&<div style={{textAlign:"center",padding:30,color:B.textDim,fontSize:12}}>No chambers. Add for multi-unit projects.</div>}</div>}
    {tab==="milestones"&&<div>{isMgr&&<><div style={{display:"flex",gap:6,marginBottom:8}}><input value={newMilestone} onChange={e=>setNewMilestone(e.target.value)} placeholder={selChamber?"Add milestone...":"Add milestone..."} style={{...IS,flex:1,padding:12}} onKeyDown={e=>e.key==="Enter"&&addMilestone()}/><button onClick={addMilestone} style={{...BP,padding:"12px 18px"}}>Add</button></div>{!selChamber&&chambers.length>0&&<div style={{display:"flex",gap:6,marginBottom:12}}><button onClick={()=>setAddMode("all")} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(addMode==="all"?B.cyan:B.border),background:addMode==="all"?B.cyanGlow:"transparent",color:addMode==="all"?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Apply to all chambers</button><button onClick={()=>setAddMode("project")} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(addMode==="project"?B.purple:B.border),background:addMode==="project"?B.purple+"22":"transparent",color:addMode==="project"?B.purple:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Project-level only</button></div>}</>}{chM.map(m=>{const chName=!selChamber&&m.chamber_id?chambers.find(c=>c.id===m.chamber_id)?.name:null;return<Card key={m.id} style={{padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,opacity:m.completed?.6:1}}><button onClick={()=>toggleMilestone(m)} style={{width:24,height:24,borderRadius:6,border:"2px solid "+(m.completed?B.green:B.border),background:m.completed?B.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>{m.completed&&<span style={{color:"#fff",fontSize:14}}>✓</span>}</button><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:B.text,textDecoration:m.completed?"line-through":"none"}}>{m.title}</span>{chName&&<span style={{fontSize:9,color:B.purple,background:B.purple+"22",padding:"1px 6px",borderRadius:3}}>{chName}</span>}{!m.chamber_id&&!selChamber&&<span style={{fontSize:9,color:B.orange,background:B.orange+"22",padding:"1px 6px",borderRadius:3}}>Project</span>}</div>{m.completed_at&&<div style={{fontSize:10,color:B.green}}>✓ Done {new Date(m.completed_at).toLocaleDateString()}</div>}{m.due_date&&!m.completed&&<div style={{fontSize:10,color:new Date(m.due_date)<new Date()?B.red:B.textDim}}>Due: {m.due_date}</div>}{isMgr&&!m.completed&&<input type="date" value={m.due_date||""} onChange={e=>updateMilestoneDue(m,e.target.value)} style={{background:"transparent",border:"none",color:B.cyan,fontSize:10,fontFamily:M,padding:"2px 0",cursor:"pointer"}} title="Set due date"/>}</div>{isMgr&&<button onClick={()=>delMilestone(m.id)} style={{background:"none",border:"none",color:B.red+"66",fontSize:14,cursor:"pointer"}}>×</button>}</Card>})}{chM.length===0&&<div style={{textAlign:"center",padding:20,color:B.textDim,fontSize:12}}>No milestones{selChamber?" for this chamber":""}</div>}</div>}
    {tab==="parts"&&<div>{isMgr&&<><div style={{display:"flex",gap:6,marginBottom:8}}><input value={newPart} onChange={e=>setNewPart(e.target.value)} placeholder="Part name..." style={{...IS,flex:1,padding:12}} onKeyDown={e=>e.key==="Enter"&&addPart()}/><input value={newPartQty} onChange={e=>setNewPartQty(parseInt(e.target.value)||1)} type="number" min="1" style={{...IS,width:60,padding:12,fontFamily:M,textAlign:"center"}}/><button onClick={addPart} style={{...BP,padding:"12px 18px"}}>Add</button></div>{!selChamber&&chambers.length>0&&<div style={{display:"flex",gap:6,marginBottom:12}}><button onClick={()=>setAddMode("all")} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(addMode==="all"?B.cyan:B.border),background:addMode==="all"?B.cyanGlow:"transparent",color:addMode==="all"?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Apply to all chambers</button><button onClick={()=>setAddMode("project")} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(addMode==="project"?B.purple:B.border),background:addMode==="project"?B.purple+"22":"transparent",color:addMode==="project"?B.purple:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Project-level only</button></div>}</>}{chP.map(p=>{const chName=!selChamber&&p.chamber_id?chambers.find(c=>c.id===p.chamber_id)?.name:null;return<Card key={p.id} style={{padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}><button onClick={()=>togglePart(p)} style={{width:24,height:24,borderRadius:6,border:"2px solid "+(p.received?B.green:B.orange),background:p.received?B.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>{p.received&&<span style={{color:"#fff",fontSize:14}}>✓</span>}</button><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:B.text,textDecoration:p.received?"line-through":"none"}}>{p.name}</span><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>×{p.quantity}</span>{chName&&<span style={{fontSize:9,color:B.purple,background:B.purple+"22",padding:"1px 6px",borderRadius:3}}>{chName}</span>}{!p.chamber_id&&!selChamber&&<span style={{fontSize:9,color:B.orange,background:B.orange+"22",padding:"1px 6px",borderRadius:3}}>Project</span>}</div>{p.received_at&&<div style={{fontSize:10,color:B.green}}>Received {new Date(p.received_at).toLocaleDateString()}</div>}</div>{isMgr&&<button onClick={()=>delPart(p.id)} style={{background:"none",border:"none",color:B.red+"66",fontSize:14,cursor:"pointer"}}>×</button>}</Card>})}{chP.length===0&&<div style={{textAlign:"center",padding:20,color:B.textDim,fontSize:12}}>No parts{selChamber?" for this chamber":""}</div>}</div>}
    {tab==="workorders"&&<div>
      {isMgr&&<div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
        <select id="woChamberId" style={{...IS,flex:1,cursor:"pointer"}}><option value="">Entire Project</option>{chambers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={async()=>{const chId=document.getElementById("woChamberId").value||null;const ch=chId?chambers.find(c=>c.id===chId):null;await onCreateWO({title:ch?ch.name+" — "+project.name:project.name,priority:"medium",assignee:"Unassigned",due_date:"TBD",notes:"Project: "+project.name+(ch?" | Chamber: "+ch.name:""),location:ch?ch.name:project.location||"",wo_type:"CM",building:ch?ch.name:"",customer:project.customer||"",customer_wo:"",crew:project.assigned_techs||[],project_id:project.id,chamber_id:chId});msg("WO created"+(ch?" for "+ch.name:""));}} style={{...BP,fontSize:12,whiteSpace:"nowrap"}}>+ Create WO</button>
      </div>}
      {pWOs.length===0&&<div style={{textAlign:"center",padding:30,color:B.textDim,fontSize:12}}>No linked work orders</div>}
      {pWOs.map(wo=>{const chName=wo.chamber_id?chambers.find(c=>c.id===wo.chamber_id)?.name:null;return<Card key={wo.id} style={{padding:"12px 16px",marginBottom:6,borderLeft:"3px solid "+(SC[wo.status]||B.border)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.wo_id}</span><Badge color={SC[wo.status]||B.textDim}>{SL[wo.status]||wo.status}</Badge>{chName&&<span style={{fontSize:9,color:B.purple,background:B.purple+"22",padding:"1px 6px",borderRadius:3}}>{chName}</span>}</div><div style={{fontSize:13,fontWeight:600,color:B.text,marginTop:2}}>{wo.title}</div></div>
          <span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.cyan}}>{parseFloat(wo.hours_total||0)}h</span>
        </div>
      </Card>})}
    </div>}
    {tab==="photos"&&<div><label style={{...BP,display:"inline-block",cursor:"pointer",marginBottom:12,fontSize:12}}>{saving?"Uploading...":"📷 Upload Photo"}<input type="file" accept="image/*" capture="environment" onChange={e=>upPhoto(e.target.files[0])} style={{display:"none"}}/></label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{(selChamber?photos.filter(p=>p.chamber_id===selChamber):photos).map(p=><div key={p.id} style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border}}><img src={p.photo_url} alt="" style={{width:"100%",height:120,objectFit:"cover"}}/><div style={{padding:"6px 8px",background:B.surface,fontSize:10,color:B.textDim}}>{p.uploaded_by}</div></div>)}</div>{photos.length===0&&<div style={{textAlign:"center",padding:30,color:B.textDim,fontSize:12}}>No photos</div>}</div>}
    {tab==="drawings"&&<div><label style={{...BP,display:"inline-block",cursor:"pointer",marginBottom:12,fontSize:12}}>{saving?"Uploading...":"📐 Upload Drawing"}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" onChange={e=>upDraw(e.target.files[0])} style={{display:"none"}}/></label>{drawings.map(d=><Card key={d.id} style={{padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>📐</span><div style={{flex:1}}><a href={d.file_url} target="_blank" rel="noreferrer" style={{fontSize:13,fontWeight:600,color:B.cyan,textDecoration:"none"}}>{d.name}</a><div style={{fontSize:10,color:B.textDim}}>{d.uploaded_by}</div></div></Card>)}{drawings.length===0&&<div style={{textAlign:"center",padding:30,color:B.textDim,fontSize:12}}>No drawings</div>}</div>}
    {tab==="notes"&&<div><div style={{display:"flex",gap:6,marginBottom:12}}><input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Add note..." style={{...IS,flex:1,padding:12,fontSize:14}} onKeyDown={e=>e.key==="Enter"&&addNote()}/><button onClick={addNote} style={{...BP,padding:"12px 18px"}}>Add</button></div>{notes.map(n=><Card key={n.id} style={{padding:"10px 14px",marginBottom:6}}><div style={{fontSize:13,color:B.text,lineHeight:1.5}}>{n.note}</div><div style={{fontSize:10,color:B.textDim,marginTop:4}}>— {n.author}, {new Date(n.created_at).toLocaleString()}</div></Card>)}</div>}
    {tab==="team"&&<div><span style={LS}>Assign technicians</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>{(users||[]).filter(u=>u.active!==false).map(u=>{const a=(project.assigned_techs||[]).includes(u.name);return<Card key={u.id} onClick={()=>toggleTech(u.name)} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",border:a?"2px solid "+B.cyan:"1px solid "+B.border}}><div style={{width:24,height:24,borderRadius:6,border:"2px solid "+(a?B.cyan:B.border),background:a?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{a&&<span style={{color:B.bg,fontSize:14,fontWeight:800}}>✓</span>}</div><div><div style={{fontSize:13,fontWeight:600,color:B.text}}>{u.name}</div><div style={{fontSize:10,color:B.textDim}}>{u.role}</div></div></Card>;})}</div></div>}
    {isMgr&&<div style={{marginTop:20}}><button onClick={async()=>{if(!window.confirm("Delete project?"))return;await onDelete(project.id);onBack();}} style={{width:"100%",padding:"10px",borderRadius:6,border:"1px solid "+B.red+"33",background:"transparent",color:B.red+"88",fontSize:11,cursor:"pointer",fontFamily:F}}>🗑 Delete Project</button></div>}
  </div>);
}
function Projects({projects,users,customers,userName,userRole,onAdd,onUpdate,onDelete,allWOs,onCreateWO,allPOs,allTime}){
  const[sel,setSel]=useState(null);
  if(sel){const f=projects.find(p=>p.id===sel.id);if(!f){setSel(null);return null;}return<ProjectDetail project={f} onBack={()=>setSel(null)} onUpdate={onUpdate} onDelete={async id=>{await onDelete(id);setSel(null);}} users={users} userName={userName} userRole={userRole} allWOs={allWOs} onCreateWO={onCreateWO} allPOs={allPOs} allTime={allTime} customers={customers}/>;}
  return<ProjectList projects={projects} onSelect={setSel} onCreate={onAdd} users={users} customers={customers} userRole={userRole}/>;
}
// ═══════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════
function KnowledgeBase({userName,userRole}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[articles,setArticles]=useState([]),[loading,setLoading]=useState(true);
  const[tab,setTab]=useState("all"),[search,setSearch]=useState(""),[showCreate,setShowCreate]=useState(false),[selArticle,setSelArticle]=useState(null);
  const[title,setTitle]=useState(""),[category,setCategory]=useState("guide"),[content,setContent]=useState(""),[symptoms,setSymptoms]=useState(""),[fixSteps,setFixSteps]=useState(""),[partNum,setPartNum]=useState(""),[supplier,setSupplier]=useState(""),[tags,setTags]=useState(""),[saving,setSaving]=useState(false),[toast,setToast]=useState("");
  const[articleFiles,setArticleFiles]=useState([]);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const load=async()=>{const{data}=await sb().from("kb_articles").select("*").order("created_at",{ascending:false});setArticles(data||[]);setLoading(false);};
  useEffect(()=>{load();},[]);
  const cats={guide:"📖 Troubleshooting",manual:"📄 Manuals & Specs",tip:"💡 Tips & Tricks",parts:"🔩 Parts Reference"};
  const catColors={guide:B.cyan,manual:B.purple,tip:B.green,parts:B.orange};
  const filtered=articles.filter(a=>{if(!isMgr&&a.status!=="approved")return false;if(tab!=="all"&&tab!=="pending"&&a.category!==tab)return false;if(tab==="pending"&&a.status!=="pending")return false;if(search){const s=search.toLowerCase();return a.title.toLowerCase().includes(s)||a.content?.toLowerCase().includes(s)||a.symptoms?.toLowerCase().includes(s)||a.tags?.some(t=>t.toLowerCase().includes(s))||(a.part_number||"").toLowerCase().includes(s);}return true;});
  const pendingCount=articles.filter(a=>a.status==="pending").length;
  const resetForm=()=>{setTitle("");setCategory("guide");setContent("");setSymptoms("");setFixSteps("");setPartNum("");setSupplier("");setTags("");};
  const openEdit=(a)=>{setTitle(a.title);setCategory(a.category);setContent(a.content||"");setSymptoms(a.symptoms||"");setFixSteps(a.fix_steps||"");setPartNum(a.part_number||"");setSupplier(a.supplier||"");setTags((a.tags||[]).join(", "));setSelArticle(a);setShowCreate(true);};
  const save=async()=>{if(!title.trim()||saving)return;if(cleanText(title,"Title")===null||cleanText(content,"Content")===null)return;setSaving(true);const obj={title:title.trim(),category,content:content.trim(),symptoms:symptoms.trim(),fix_steps:fixSteps.trim(),part_number:partNum.trim(),supplier:supplier.trim(),tags:tags.split(",").map(t=>t.trim()).filter(Boolean),status:isMgr?"approved":"pending",author:userName};if(selArticle){await sb().from("kb_articles").update({...obj,updated_at:new Date().toISOString()}).eq("id",selArticle.id);}else{await sb().from("kb_articles").insert(obj);}setSaving(false);setShowCreate(false);resetForm();setSelArticle(null);await load();msg(selArticle?"Updated":isMgr?"Published":"Submitted for approval");};
  const approve=async(id)=>{await sb().from("kb_articles").update({status:"approved",approved_by:userName,approved_at:new Date().toISOString()}).eq("id",id);await load();msg("Approved");};
  const reject=async(id)=>{if(!window.confirm("Reject this article?"))return;await sb().from("kb_articles").delete().eq("id",id);await load();msg("Removed");};
  const del=async(id)=>{if(!window.confirm("Delete this article?"))return;await sb().from("kb_articles").delete().eq("id",id);await load();msg("Deleted");};
  const loadFiles=async(aid)=>{const{data}=await sb().from("kb_files").select("*").eq("article_id",aid).order("uploaded_at",{ascending:false});setArticleFiles(data||[]);};
  const uploadFile=async(file,articleId,isPhoto)=>{if(!file)return;setSaving(true);try{const b64=await new Promise((r,j)=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.onerror=j;f.readAsDataURL(file);});let fb=b64,fm=file.type;if(isPhoto&&file.size>1048576&&file.type.startsWith("image/")){const img=new Image();const u=URL.createObjectURL(file);await new Promise(r=>{img.onload=r;img.src=u;});const cv=document.createElement("canvas");const s=Math.min(1,1200/img.width);cv.width=img.width*s;cv.height=img.height*s;cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);fb=cv.toDataURL("image/jpeg",0.8).split(",")[1];fm="image/jpeg";URL.revokeObjectURL(u);}const resp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64:fb,fileName:Date.now()+"_"+file.name,mimeType:fm,folderPath:"3C FieldOps/Knowledge Base/"+(isPhoto?"Photos":"Files")})});const result=await resp.json();if(result.success){await sb().from("kb_files").insert({article_id:articleId,file_url:result.webViewLink,thumbnail_url:isPhoto?result.thumbnailUrl:null,file_name:file.name,file_type:isPhoto?"photo":"file",uploaded_by:userName});await loadFiles(articleId);msg((isPhoto?"Photo":"File")+" uploaded");}else msg("Upload failed");}catch(e){msg("Upload error");}setSaving(false);};
  const deleteFile=async(fid,aid)=>{await sb().from("kb_files").delete().eq("id",fid);await loadFiles(aid);msg("Removed");};

  if(selArticle&&!showCreate){const a=articles.find(x=>x.id===selArticle.id);if(!a){setSelArticle(null);return null;}
  if(articleFiles.length===0||articleFiles[0]?.article_id!==a.id)loadFiles(a.id);
  const aPhotos=articleFiles.filter(f=>f.file_type==="photo");const aDocs=articleFiles.filter(f=>f.file_type!=="photo");
  return(<div><Toast msg={toast}/>
    <button onClick={()=>{setSelArticle(null);setArticleFiles([]);}} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",fontFamily:F,marginBottom:10}}>← Back</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
      <div><Badge color={catColors[a.category]}>{cats[a.category]}</Badge><h2 style={{margin:"6px 0 0",fontSize:20,fontWeight:800,color:B.text}}>{a.title}</h2><div style={{fontSize:11,color:B.textDim,marginTop:4}}>By {a.author} · {new Date(a.created_at).toLocaleDateString()}{a.status==="pending"&&<span style={{color:B.orange,marginLeft:8}}>⏳ Pending approval</span>}</div></div>
      <div style={{display:"flex",gap:6}}>{isMgr&&<button onClick={()=>openEdit(a)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button>}{isMgr&&<button onClick={()=>{del(a.id);setSelArticle(null);}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>Delete</button>}</div>
    </div>
    {a.tags&&a.tags.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12}}>{a.tags.map(t=><span key={t} style={{padding:"2px 8px",borderRadius:4,background:B.cyanGlow,color:B.cyan,fontSize:10,fontWeight:600}}>{t}</span>)}</div>}
    {a.symptoms&&<Card style={{padding:14,marginBottom:12,borderLeft:"3px solid "+B.orange}}><span style={{fontSize:10,fontWeight:700,color:B.orange,textTransform:"uppercase"}}>Symptoms</span><p style={{margin:"6px 0 0",color:B.text,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.symptoms}</p></Card>}
    {a.fix_steps&&<Card style={{padding:14,marginBottom:12,borderLeft:"3px solid "+B.green}}><span style={{fontSize:10,fontWeight:700,color:B.green,textTransform:"uppercase"}}>Fix / Steps</span><p style={{margin:"6px 0 0",color:B.text,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.fix_steps}</p></Card>}
    {a.content&&<Card style={{padding:14,marginBottom:12}}><p style={{margin:0,color:B.text,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.content}</p></Card>}
    {(a.part_number||a.supplier)&&<Card style={{padding:14,marginBottom:12,borderLeft:"3px solid "+B.purple}}><span style={{fontSize:10,fontWeight:700,color:B.purple,textTransform:"uppercase"}}>Parts Info</span>{a.part_number&&<div style={{marginTop:6,fontSize:13,color:B.text}}>Part #: <strong style={{fontFamily:M}}>{a.part_number}</strong></div>}{a.supplier&&<div style={{fontSize:13,color:B.text}}>Supplier: <strong>{a.supplier}</strong></div>}</Card>}
    {aPhotos.length>0&&<Card style={{padding:14,marginBottom:12}}><span style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase"}}>Photos</span><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginTop:8}}>{aPhotos.map(f=><div key={f.id} style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border,position:"relative"}}><a href={f.file_url} target="_blank" rel="noreferrer"><img src={f.thumbnail_url||f.file_url} alt="" style={{width:"100%",height:100,objectFit:"cover"}}/></a><div style={{padding:"4px 6px",background:B.surface,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:9,color:B.textDim}}>{f.uploaded_by}</span>{isMgr&&<button onClick={()=>deleteFile(f.id,a.id)} style={{background:"none",border:"none",color:B.red+"66",fontSize:12,cursor:"pointer"}}>×</button>}</div></div>)}</div></Card>}
    {aDocs.length>0&&<Card style={{padding:14,marginBottom:12}}><span style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase"}}>Files & Documents</span>{aDocs.map(f=><div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid "+B.border}}><span style={{fontSize:16}}>📄</span><a href={f.file_url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,fontWeight:600,color:B.cyan,textDecoration:"none"}}>{f.file_name}</a><span style={{fontSize:9,color:B.textDim}}>{f.uploaded_by}</span>{isMgr&&<button onClick={()=>deleteFile(f.id,a.id)} style={{background:"none",border:"none",color:B.red+"66",fontSize:12,cursor:"pointer"}}>×</button>}</div>)}</Card>}
    {a.file_url&&<Card style={{padding:14,marginBottom:12}}><a href={a.file_url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,color:B.cyan,textDecoration:"none"}}><span style={{fontSize:20}}>📄</span><div><div style={{fontSize:13,fontWeight:600}}>{a.file_name||"Attached File"}</div><div style={{fontSize:10,color:B.textDim}}>Tap to view/download</div></div></a></Card>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <label style={{...BS,display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11}}>{saving?"Uploading...":"📷 Add Photo"}<input type="file" accept="image/*" capture="environment" onChange={e=>uploadFile(e.target.files[0],a.id,true)} style={{display:"none"}}/></label>
      <label style={{...BS,display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11}}>{saving?"Uploading...":"📎 Add File"}<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e=>uploadFile(e.target.files[0],a.id,false)} style={{display:"none"}}/></label>
    </div>
    {isMgr&&a.status==="pending"&&<div style={{display:"flex",gap:8,marginTop:16}}><button onClick={()=>approve(a.id)} style={{...BP,flex:1,background:B.green}}>✓ Approve</button><button onClick={()=>{reject(a.id);setSelArticle(null);}} style={{...BP,flex:1,background:B.red}}>✗ Reject</button></div>}
  </div>);}

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Knowledge Base</h3>
      <button onClick={()=>{resetForm();setSelArticle(null);setShowCreate(true);}} style={{...BP,fontSize:12}}>+ New Article</button>
    </div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles, symptoms, parts..." style={{...IS,marginBottom:12,padding:12,fontSize:14}}/>
    <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap",overflowX:"auto"}}>
      <button onClick={()=>setTab("all")} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(tab==="all"?B.cyan:B.border),background:tab==="all"?B.cyanGlow:"transparent",color:tab==="all"?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>All ({articles.filter(a=>isMgr||a.status==="approved").length})</button>
      {Object.entries(cats).map(([k,v])=><button key={k} onClick={()=>setTab(k)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(tab===k?catColors[k]:B.border),background:tab===k?catColors[k]+"22":"transparent",color:tab===k?catColors[k]:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>{v}</button>)}
      {isMgr&&pendingCount>0&&<button onClick={()=>setTab("pending")} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+B.orange,background:tab==="pending"?B.orange+"22":"transparent",color:B.orange,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{"⏳ Pending ("+pendingCount+")"}</button>}
    </div>
    {loading&&<div style={{textAlign:"center",padding:40}}><Spinner/></div>}
    {!loading&&filtered.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:24,marginBottom:6}}>📖</div><div style={{fontSize:13}}>{search?"No results for \""+search+"\"":"No articles yet. Add one to get started."}</div></Card>}
    {filtered.map(a=><Card key={a.id} onClick={()=>setSelArticle(a)} style={{padding:"14px 16px",marginBottom:8,cursor:"pointer",borderLeft:"3px solid "+catColors[a.category]}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><Badge color={catColors[a.category]}>{cats[a.category]?.split(" ")[1]||a.category}</Badge>{a.status==="pending"&&<Badge color={B.orange}>Pending</Badge>}{a.tags&&a.tags.slice(0,3).map(t=><span key={t} style={{fontSize:9,color:B.textDim,background:B.bg,padding:"1px 6px",borderRadius:3}}>{t}</span>)}</div>
          <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:4}}>{a.title}</div>
          <div style={{fontSize:11,color:B.textDim,marginTop:2}}>{a.author} · {new Date(a.created_at).toLocaleDateString()}</div>
        </div>
        {a.file_url&&<span style={{fontSize:16,flexShrink:0}}>📎</span>}
      </div>
    </Card>)}
    {showCreate&&<Modal title={selArticle?"Edit Article":"New Knowledge Base Article"} onClose={()=>{setShowCreate(false);setSelArticle(null);}} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Walk-in cooler not defrosting" style={IS}/></div>
        <div><label style={LS}>Category</label><select value={category} onChange={e=>setCategory(e.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(cats).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        {(category==="guide")&&<>
          <div><label style={LS}>Symptoms <span style={{color:B.textDim,fontWeight:400}}>(what the tech sees)</span></label><textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} rows={3} placeholder={"Ice buildup on evaporator coils\nBox temp rising above setpoint\nDefrost timer not advancing"} style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
          <div><label style={LS}>Fix / Steps</label><textarea value={fixSteps} onChange={e=>setFixSteps(e.target.value)} rows={4} placeholder={"1. Check defrost timer — rotate to defrost cycle\n2. Verify heaters are energizing (amp check)\n3. Check defrost termination switch\n4. Inspect drain line for blockage"} style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
        </>}
        {category==="parts"&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>Part Number</label><input value={partNum} onChange={e=>setPartNum(e.target.value)} placeholder="PN-12345" style={{...IS,fontFamily:M}}/></div>
            <div><label style={LS}>Supplier</label><input value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Carrier, Emerson, etc." style={IS}/></div>
          </div>
        </>}
        <div><label style={LS}>{category==="guide"?"Additional Notes":category==="tip"?"Tip Details":"Description"}</label><textarea value={content} onChange={e=>setContent(e.target.value)} rows={4} placeholder="Enter details..." style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
        <div><label style={LS}>Tags <span style={{color:B.textDim,fontWeight:400}}>(comma-separated)</span></label><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="defrost, walk-in, cooler, Heatcraft" style={IS}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>{setShowCreate(false);setSelArticle(null);}} style={{...BS,flex:1}}>Cancel</button><button onClick={save} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(isMgr?(selArticle?"Save":"Publish"):"Submit for Approval")}</button></div>
      </div>
    </Modal>}
  </div>);
}
// ═══════════════════════════════════════════
// INVOICE GENERATOR
// ═══════════════════════════════════════════
function InvoiceGenerator({wos,pos,time,users,customers}){
  const[cust,setCust]=useState(""),[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState(""),[invoiceNum,setInvoiceNum]=useState(""),[step,setStep]=useState(1);
  const[tierAssign,setTierAssign]=useState({}),[includeNotes,setIncludeNotes]=useState(true),[includeParts,setIncludeParts]=useState(true),[includeBreakdown,setIncludeBreakdown]=useState(false);
  const[poNum,setPoNum]=useState(""),[jobDesc,setJobDesc]=useState(""),[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const customer=customers.find(c=>c.name===cust);
  // Filter completed WOs for customer in date range
  const filteredWOs=wos.filter(w=>{if(w.customer!==cust||w.status!=="completed")return false;const d=w.date_completed||w.created_at?.slice(0,10);if(!d)return false;if(dateFrom&&d<dateFrom)return false;if(dateTo&&d>dateTo)return false;return true;});
  // Get time entries for filtered WOs
  const filteredTime=time.filter(t=>filteredWOs.some(w=>w.id===t.wo_id));
  // Group hours by technician
  const techHours={};filteredTime.forEach(t=>{if(!techHours[t.technician])techHours[t.technician]=0;techHours[t.technician]+=parseFloat(t.hours||0);});
  // POs for filtered WOs
  const filteredPOs=pos.filter(p=>filteredWOs.some(w=>w.id===p.wo_id)&&p.status==="approved");
  const partsTotal=filteredPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);
  // PM/CM counts
  const pmCount=filteredWOs.filter(w=>w.wo_type==="PM").length;
  const cmCount=filteredWOs.filter(w=>w.wo_type==="CM").length;
  // Default tiers based on customer
  const defaultTiers=cust.includes("DUMC")||cust.includes("Medical")?[{name:"Journeyman Mechanic",rate:60},{name:"Senior Technician",rate:75},{name:"Licensed Technician",rate:90}]:[{name:"Senior Technician",rate:120},{name:"Licensed Technician",rate:135}];
  const[tiers,setTiers]=useState(defaultTiers);
  useEffect(()=>{if(customer?.billing_rate_override){setTiers(prev=>prev.map(t=>({...t,rate:customer.billing_rate_override})));}else{setTiers(cust.includes("DUMC")||cust.includes("Medical")?[{name:"Journeyman Mechanic",rate:60},{name:"Senior Technician",rate:75},{name:"Licensed Technician",rate:90}]:[{name:"Senior Technician",rate:120},{name:"Licensed Technician",rate:135}]);}},[cust]);
  // Auto-generate invoice number
  useEffect(()=>{if(!invoiceNum){const now=new Date();setInvoiceNum(String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0")+"01");}},[]);

  const generateXLSX=async()=>{
    const tierHours={};tiers.forEach(t=>{tierHours[t.name]=0;});
    Object.entries(tierAssign).forEach(([tech,tier])=>{if(tier&&tierHours[tier]!==undefined)tierHours[tier]+=(techHours[tech]||0);});
    const notes=includeNotes?filteredWOs.map(w=>((w.customer_wo?"["+w.customer_wo+"] ":"")+w.title+" — "+(w.work_performed||w.notes||"")).trim()).filter(Boolean).join("\n"):"";
    const tiersData=tiers.map(t=>({name:t.name,rate:t.rate,hours:tierHours[t.name]||0})).filter(t=>t.hours>0||tiers.length<=3);
    const partsDetailData=filteredPOs.map(p=>({desc:p.description+(p.po_id?" ("+p.po_id+")":""),amount:parseFloat(p.amount||0)}));
    const body={invoiceNum,date:new Date().toLocaleDateString(),customerId:customer?.name?.substring(0,10)||cust,customerName:customer?.contact_name||"Accounts Payable",customerAddress:customer?.address||"",customerAddress2:"",poNumber:poNum,jobDesc:jobDesc||"Repairs",paymentTerms:customer?.payment_terms||"Net 30",dueDate:"",tiers:tiersData,description:notes,partsTotal,partsDetail:includeParts?partsDetailData:null,includeNotes,includeBreakdown,pmCount,cmCount};
    try{
      const resp=await fetch(SUPABASE_URL+"/functions/v1/generate-invoice",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify(body)});
      if(!resp.ok){msg("Invoice generation failed");return;}
      const blob=await resp.blob();
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download="3C_Invoice_"+(customer?.name||cust).replace(/[^a-zA-Z0-9]/g,"_")+"_"+invoiceNum+".xls";
      a.click();URL.revokeObjectURL(url);
      msg("Invoice downloaded!");
    }catch(e){msg("Error: "+e.message);}
  };


  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Invoice Generator</h3>

    {step===1&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:14}}>Step 1: Select Customer & Date Range</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Customer</label><select value={cust} onChange={e=>{setCust(e.target.value);setTierAssign({});}} style={{...IS,cursor:"pointer"}}><option value="">— Select —</option>{customers.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>From</label><input value={dateFrom} onChange={e=>setDateFrom(e.target.value)} type="date" style={IS}/></div>
          <div><label style={LS}>To</label><input value={dateTo} onChange={e=>setDateTo(e.target.value)} type="date" style={IS}/></div>
        </div>
        {cust&&<div style={{padding:12,background:B.bg,borderRadius:6}}>
          <div style={{fontSize:12,color:B.textDim}}>Found <strong style={{color:B.cyan}}>{filteredWOs.length}</strong> completed WOs · <strong style={{color:B.cyan}}>{Object.keys(techHours).length}</strong> techs · <strong style={{color:B.cyan}}>{Object.values(techHours).reduce((s,h)=>s+h,0).toFixed(1)}h</strong> total</div>
          {filteredPOs.length>0&&<div style={{fontSize:12,color:B.textDim,marginTop:4}}>{"$"+partsTotal.toLocaleString()} in approved POs</div>}
        </div>}
        <button onClick={()=>{if(!cust){msg("Select a customer");return;}if(filteredWOs.length===0){msg("No completed WOs found");return;}setStep(2);}} style={{...BP}} disabled={!cust||filteredWOs.length===0}>Next: Assign Labor Tiers</button>
      </div>
    </Card>}

    {step===2&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:6}}>Step 2: Assign Labor Tiers</div>
      <div style={{fontSize:11,color:B.textDim,marginBottom:14}}>Assign each tech's hours to a billing tier</div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:8}}>LABOR TIERS (editable)</div>
        {tiers.map((t,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
          <input value={t.name} onChange={e=>{const n=[...tiers];n[i].name=e.target.value;setTiers(n);}} style={{...IS,flex:1,padding:"6px 10px",fontSize:12}}/>
          <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:11,color:B.textDim}}>$</span><input value={t.rate} onChange={e=>{const n=[...tiers];n[i].rate=parseFloat(e.target.value)||0;setTiers(n);}} type="number" style={{...IS,width:60,padding:"6px 8px",fontSize:12,fontFamily:M}}/><span style={{fontSize:11,color:B.textDim}}>/hr</span></div>
          {tiers.length>1&&<button onClick={()=>setTiers(tiers.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer"}}>×</button>}
        </div>)}
        <button onClick={()=>setTiers([...tiers,{name:"New Tier",rate:0}])} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",fontFamily:F}}>+ Add Tier</button>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:8}}>ASSIGN TECHS</div>
      {Object.entries(techHours).map(([tech,hrs])=><div key={tech} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+B.border}}>
        <div><div style={{fontSize:13,fontWeight:600,color:B.text}}>{tech}</div><div style={{fontSize:11,fontFamily:M,color:B.cyan}}>{hrs.toFixed(1)}h</div></div>
        <select value={tierAssign[tech]||""} onChange={e=>setTierAssign({...tierAssign,[tech]:e.target.value})} style={{...IS,width:"auto",padding:"6px 10px",fontSize:11,cursor:"pointer"}}>
          <option value="">— Select Tier —</option>{tiers.map(t=><option key={t.name} value={t.name}>{t.name} ({"$"+t.rate}/hr)</option>)}
        </select>
      </div>)}
      {Object.keys(techHours).length>0&&Object.values(tierAssign).filter(Boolean).length<Object.keys(techHours).length&&<div style={{marginTop:8,padding:8,background:B.orange+"15",borderRadius:6,fontSize:11,color:B.orange}}>⚠ Assign all techs to a tier before generating</div>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={()=>setStep(1)} style={{...BS,flex:1}}>Back</button>
        <button onClick={()=>{if(Object.values(tierAssign).filter(Boolean).length<Object.keys(techHours).length){msg("Assign all techs first");return;}setStep(3);}} style={{...BP,flex:1}}>Next: Options</button>
      </div>
    </Card>}

    {step===3&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:14}}>Step 3: Invoice Details</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Invoice # (YYMM##)</label><input value={invoiceNum} onChange={e=>setInvoiceNum(e.target.value)} placeholder="250301" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>PO Number</label><input value={poNum} onChange={e=>setPoNum(e.target.value)} placeholder="e.g. 4605021670" style={{...IS,fontFamily:M}}/></div>
        </div>
        <div><label style={LS}>Job Description</label><input value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder="Repairs, PMs, etc." style={IS}/></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeNotes(!includeNotes)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeNotes?B.cyan:B.border),background:includeNotes?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeNotes&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include completion notes / work descriptions</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeParts(!includeParts)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeParts?B.cyan:B.border),background:includeParts?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeParts&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include parts / materials ({"$"+partsTotal.toLocaleString()})</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeBreakdown(!includeBreakdown)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeBreakdown?B.cyan:B.border),background:includeBreakdown?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeBreakdown&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include PM/CM breakdown ({pmCount} PM, {cmCount} CM)</span>
          </label>
        </div>
        {/* Preview */}
        <div style={{background:B.bg,borderRadius:8,padding:14,marginTop:4}}>
          <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:8}}>PREVIEW</div>
          {tiers.map(t=>{const hrs=Object.entries(tierAssign).filter(([_,tier])=>tier===t.name).reduce((s,[tech])=>s+(techHours[tech]||0),0);return hrs>0?<div key={t.name} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.text,padding:"3px 0"}}><span>{t.name}: {hrs.toFixed(1)}h × {"$"+t.rate}</span><span style={{fontFamily:M}}>{"$"+(hrs*t.rate).toFixed(2)}</span></div>:null;})}
          {includeParts&&partsTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.text,padding:"3px 0"}}><span>Parts / Materials</span><span style={{fontFamily:M}}>{"$"+partsTotal.toFixed(2)}</span></div>}
          <div style={{borderTop:"1px solid "+B.border,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,color:B.green}}><span>Total</span><span style={{fontFamily:M}}>{"$"+(tiers.reduce((s,t)=>{const hrs=Object.entries(tierAssign).filter(([_,tier])=>tier===t.name).reduce((s2,[tech])=>s2+(techHours[tech]||0),0);return s+hrs*t.rate;},0)+(includeParts?partsTotal:0)).toFixed(2)}</span></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setStep(2)} style={{...BS,flex:1}}>Back</button>
          <button onClick={generateXLSX} style={{...BP,flex:1}}>📄 Download Invoice</button>
        </div>
      </div>
    </Card>}
  </div>);
}

// ═══════════════════════════════════════════
// DASHBOARDS — with new tabs
// ═══════════════════════════════════════════
function TechDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("today");
  const my=D.wos.filter(o=>o.assignee===user.name||(o.crew&&o.crew.includes(user.name)));
  const myActive=my.filter(o=>o.status!=="completed");
  const myCompleted=my.filter(o=>o.status==="completed");
  const myTime=D.time.filter(t=>t.technician===user.name);
  const todayStr=new Date().toISOString().slice(0,10);
  const todayHours=myTime.filter(t=>t.logged_date===todayStr).reduce((s,t)=>s+parseFloat(t.hours||0),0);
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} tabs={[{key:"today",label:"My Day",icon:"📍"},{key:"orders",label:"All Orders",icon:"📋"},{key:"time",label:"Hours",icon:"⏱"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="today"&&<>
      {/* Smart Time Reminder */}
      {myActive.filter(o=>{if(o.status!=="in_progress")return false;const lastTime=D.time.filter(t=>t.wo_id===o.id).sort((a,b)=>(b.logged_date||"").localeCompare(a.logged_date||""))[0];if(!lastTime)return true;const last=new Date(lastTime.logged_date);const hrs=(Date.now()-last.getTime())/3600000;return hrs>8;}).map(wo=><div key={wo.id+"reminder"} style={{background:B.orange+"15",border:"1px solid "+B.orange+"33",borderRadius:8,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>⏰</span>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:B.orange}}>Time reminder</div><div style={{fontSize:11,color:B.textMuted}}>Still working on <strong>{wo.wo_id}</strong>? Don't forget to log your hours.</div></div>
      </div>)}
      {/* Today's summary - big, clear */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <StatCard label="Active Jobs" value={myActive.length} icon="🔧" color={B.cyan}/>
        <StatCard label="Today's Hours" value={todayHours.toFixed(1)+"h"} icon="⏱" color={B.green}/>
        <StatCard label="Completed" value={myCompleted.length} icon="✓" color={B.green}/>
      </div>
      {/* Active jobs first - these are what matter */}
      {myActive.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:800,color:B.text,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Active Jobs</div>
        <WOList orders={myActive} {...wlp}/>
      </div>}
      {myActive.length===0&&<Card style={{textAlign:"center",padding:30,marginBottom:16}}>
        <div style={{fontSize:28,marginBottom:8}}>✅</div>
        <div style={{fontSize:16,fontWeight:700,color:B.green}}>All caught up!</div>
        <div style={{fontSize:12,color:B.textDim,marginTop:4}}>No active work orders right now.</div>
      </Card>}
      {/* Quick access to recent completed */}
      {myCompleted.length>0&&<div>
        <div style={{fontSize:13,fontWeight:800,color:B.textDim,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Recently Completed</div>
        <WOList orders={myCompleted.slice(0,3)} {...wlp}/>
      </div>}
    </>}
    {tab==="orders"&&<WOList orders={my} {...wlp}/>}
    {tab==="time"&&<TimeLog timeEntries={myTime} wos={D.wos}/>}
    {tab==="projects"&&<Projects projects={(D.projects||[]).filter(p=>(p.assigned_techs||[]).includes(user.name)||p.status==="active")} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

function MgrDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"Work Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"team",label:"Team",icon:"👥"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="overview"&&<><DashAnalytics wos={D.wos} time={D.time} pos={D.pos}/><WOOverview orders={D.wos} wlp={wlp} pos={D.pos} time={D.time}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers} emailTemplates={D.emailTemplates} currentUser={user}/>}
    {tab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{D.users.filter(u=>u.role==="technician"&&u.active!==false).map(t=>{const to=D.wos.filter(o=>o.assignee===t.name);return(<Card key={t.id} style={{padding:"14px 18px"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:8,background:ROLES.technician.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800}}>{t.name.split(" ").map(n=>n[0]).join("")}</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim}}>{to.filter(o=>o.status==="in_progress").length} active · {to.filter(o=>o.status==="completed").length} done · {to.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)}h</div></div><Badge color={B.green}>On Duty</Badge></div></Card>);})}</div>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="projects"&&<Projects projects={D.projects||[]} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

function AdminDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"All Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"invoices",label:"Invoices",icon:"📝"},{key:"recurring",label:"PM Schedule",icon:"🔁"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"},{key:"settings",label:"Settings",icon:"⚙️"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="overview"&&<><DashAnalytics wos={D.wos} time={D.time} pos={D.pos}/><WOOverview orders={D.wos} wlp={wlp} pos={D.pos} time={D.time}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers} emailTemplates={D.emailTemplates} currentUser={user}/>}
    {tab==="invoices"&&<InvoiceGenerator wos={D.wos} pos={D.pos} time={D.time} users={D.users} customers={D.customers}/>}
    {tab==="recurring"&&<RecurringPM templates={D.templates} onAdd={A.addTemplate} onDelete={A.deleteTemplate} users={D.users}/>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="settings"&&<Settings emailTemplates={D.emailTemplates} onAddTemplate={A.addEmailTemplate} onUpdateTemplate={A.updateEmailTemplate} onDeleteTemplate={A.deleteEmailTemplate}/>}
    {tab==="projects"&&<Projects projects={D.projects||[]} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
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

export default function App(){
  // Check for customer portal route
  const hash=window.location.hash;
  const portalMatch=hash.match(/#\/portal\/(.+)/);
  if(portalMatch)return <CustomerPortal customerSlug={portalMatch[1]}/>;

  const[authUser,setAuthUser]=useState(null);const[appUser,setAppUser]=useState(null);
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);const[syncing,setSyncing]=useState(false);

  useEffect(()=>{const client=sb();if(!client)return;
    client.auth.getSession().then(({data:{session}})=>{setAuthUser(session?.user||null);});
    const{data:{subscription}}=client.auth.onAuthStateChange((_,session)=>{setAuthUser(session?.user||null);});
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=useCallback(async()=>{const client=sb();if(!client)return;
    const[wos,pos,time,photos,users,schedule,templates,notifs,customers,emailTemplates,projects]=await Promise.all([
      client.from("work_orders").select("*").order("created_at",{ascending:false}),
      client.from("purchase_orders").select("*").order("created_at",{ascending:false}),
      client.from("time_entries").select("*").order("logged_date",{ascending:false}),
      client.from("photos").select("*").order("uploaded_at",{ascending:false}),
      client.from("users").select("*").order("name"),
      client.from("schedule").select("*").order("time"),
      client.from("recurring_templates").select("*").order("title"),
      client.from("notifications").select("*").order("created_at",{ascending:false}).limit(50),
      client.from("customers").select("*").order("name"),
      client.from("email_templates").select("*").order("name"),
      client.from("projects").select("*").order("created_at",{ascending:false}),
    ]);
    setData({wos:wos.data||[],pos:pos.data||[],time:time.data||[],photos:photos.data||[],users:users.data||[],schedule:schedule.data||[],templates:templates.data||[],notifs:notifs.data||[],customers:customers.data||[],emailTemplates:emailTemplates.data||[],projects:projects.data||[]});
    setLoading(false);
  },[]);
  const tableMap={work_orders:{key:"wos",order:"created_at",asc:false},purchase_orders:{key:"pos",order:"created_at",asc:false},time_entries:{key:"time",order:"logged_date",asc:false},photos:{key:"photos",order:"uploaded_at",asc:false},users:{key:"users",order:"name",asc:true},schedule:{key:"schedule",order:"time",asc:true},recurring_templates:{key:"templates",order:"title",asc:true},notifications:{key:"notifs",order:"created_at",asc:false,limit:50},customers:{key:"customers",order:"name",asc:true},email_templates:{key:"emailTemplates",order:"name",asc:true},projects:{key:"projects",order:"created_at",asc:false}};
  const reloadTable=useCallback(async(table)=>{const client=sb();if(!client)return;const m=tableMap[table];if(!m)return;let q=client.from(table).select("*").order(m.order,{ascending:m.asc});if(m.limit)q=q.limit(m.limit);const{data:d}=await q;setData(prev=>({...prev,[m.key]:d||[]}));},[]);

  useEffect(()=>{if(authUser)loadData();},[authUser,loadData]);
  useEffect(()=>{if(!authUser){sb().from("users").select("*").then(({data:u})=>{setData(d=>({...(d||{wos:[],pos:[],time:[],photos:[],schedule:[],templates:[],notifs:[],customers:[],emailTemplates:[],projects:[]}),users:u||[]}));setLoading(false);});}},[authUser]);

  useEffect(()=>{if(!authUser||!data?.users)return;const match=data.users.find(u=>u.email?.toLowerCase()===authUser.email?.toLowerCase()&&u.active!==false);setAppUser(match||null);},[authUser,data?.users]);

  useEffect(()=>{if(!authUser)return;const client=sb();
    const chan=client.channel("fieldops-rt").on("postgres_changes",{event:"*",schema:"public",table:"work_orders"},()=>reloadTable("work_orders")).on("postgres_changes",{event:"*",schema:"public",table:"purchase_orders"},()=>reloadTable("purchase_orders")).on("postgres_changes",{event:"*",schema:"public",table:"time_entries"},()=>reloadTable("time_entries")).on("postgres_changes",{event:"*",schema:"public",table:"users"},()=>reloadTable("users")).on("postgres_changes",{event:"*",schema:"public",table:"photos"},()=>reloadTable("photos")).on("postgres_changes",{event:"*",schema:"public",table:"notifications"},()=>reloadTable("notifications")).on("postgres_changes",{event:"*",schema:"public",table:"customers"},()=>reloadTable("customers")).subscribe();
    const poll=setInterval(()=>loadData(),30000);
    // Smart Recurring PM: auto-generate WOs from templates with past-due dates
    const checkRecurringPMs=async()=>{
      const{data:tpls}=await client.from("recurring_templates").select("*").eq("active",true);
      if(!tpls||tpls.length===0)return;
      const today=new Date().toISOString().slice(0,10);
      for(const t of tpls){
        if(!t.next_due||t.next_due>today)continue;
        // Check if WO already exists for this template+date
        const{data:existing}=await client.from("work_orders").select("wo_id").ilike("title","PM: "+t.title+"%").eq("due_date",t.next_due);
        if(existing&&existing.length>0)continue;
        // Auto-create WO
        const{data:lastWO}=await client.from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);
        const ln=lastWO&&lastWO[0]?parseInt(lastWO[0].wo_id.replace("WO-",""))||1000:1000;
        await client.from("work_orders").insert({wo_id:"WO-"+(ln+1),title:"PM: "+t.title,priority:t.priority||"medium",status:"pending",assignee:t.assignee||"Unassigned",due_date:t.next_due,hours_total:0,notes:t.notes||"Auto-generated from recurring PM template.",location:t.location||"",building:t.building||"",wo_type:"PM",customer:t.customer||""});
        // Bump next_due
        const d=new Date(t.next_due);
        const freq=t.frequency||"monthly";
        if(freq==="weekly")d.setDate(d.getDate()+7);
        else if(freq==="biweekly")d.setDate(d.getDate()+14);
        else if(freq==="monthly")d.setMonth(d.getMonth()+1);
        else if(freq==="quarterly")d.setMonth(d.getMonth()+3);
        else if(freq==="yearly")d.setFullYear(d.getFullYear()+1);
        await client.from("recurring_templates").update({next_due:d.toISOString().slice(0,10)}).eq("id",t.id);
        await client.from("notifications").insert({type:"pm_generated",title:"PM Auto-Generated",message:"WO-"+(ln+1)+": "+t.title,for_role:null});
      }
    };
    checkRecurringPMs();
    return()=>{client.removeChannel(chan);clearInterval(poll);};
  },[authUser,loadData]);

  const withSync=fn=>async(...args)=>{setSyncing(true);try{await fn(...args);await loadData();}finally{setSyncing(false);}};
  const withTableSync=(table,fn)=>async(...args)=>{setSyncing(true);try{await fn(...args);await reloadTable(table);}finally{setSyncing(false);}};
  const notify=async(type,title,message,forRole)=>{await sb().from("notifications").insert({type,title,message,for_role:forRole||null});};

  const actions={
    loadData,
    logActivity:async(woId,action,details)=>{try{await sb().from("wo_activity").insert({wo_id:woId,action,details,actor:appUser?.name||"System"});}catch(e){}},
    createWO:withSync(async(wo)=>{const{data:ex}=await sb().from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);const ln=ex&&ex[0]?parseInt(ex[0].wo_id.replace("WO-",""))||1000:1000;const newId="WO-"+(ln+1);const{data:inserted}=await sb().from("work_orders").insert({...wo,wo_id:newId,status:"pending",hours_total:0}).select("id").single();await notify("wo_created","New Work Order",newId+": "+wo.title);if(inserted)await sb().from("wo_activity").insert({wo_id:inserted.id,action:"created",details:"Work order created",actor:appUser?.name||"System"});}),
    updateWO:withTableSync("work_orders",async(wo)=>{const{id,...rest}=wo;const old=data.wos.find(w=>w.id===id);const{error}=await sb().from("work_orders").update(rest).eq("id",id);if(error)console.error("updateWO error:",error);const changes=[];if(old){if(rest.status&&rest.status!==old.status)changes.push("Status → "+rest.status);if(rest.assignee&&rest.assignee!==old.assignee)changes.push("Assigned → "+rest.assignee);if(rest.priority&&rest.priority!==old.priority)changes.push("Priority → "+rest.priority);if(rest.tms_entered!==undefined&&rest.tms_entered!==old.tms_entered)changes.push(rest.tms_entered?"TMS marked complete":"TMS unmarked");}if(changes.length>0)await sb().from("wo_activity").insert({wo_id:id,action:"updated",details:changes.join(", "),actor:appUser?.name||"System"});if(rest.status==="completed"&&old?.status!=="completed")await notify("wo_completed","WO Completed",(old?.wo_id||"")+" completed","admin");}),
    deleteWO:withTableSync("work_orders",async(id)=>{const{error}=await sb().from("work_orders").delete().eq("id",id);if(error)console.error("deleteWO error:",error);}),
    createPO:withSync(async(po)=>{const{data:all}=await sb().from("purchase_orders").select("po_id");const id=genPO(all||[]);await sb().from("purchase_orders").insert({...po,po_id:id,requested_by:appUser.name,status:"pending"});await notify("po_requested","PO Requested",id+" — $"+po.amount+" by "+appUser.name,"manager");}),
    updatePO:withTableSync("purchase_orders",async(po)=>{const{id,...rest}=po;await sb().from("purchase_orders").update(rest).eq("id",id);}),
    addTime:withTableSync("time_entries",async(te)=>{await sb().from("time_entries").insert({...te,technician:appUser.name,logged_date:te.logged_date||new Date().toISOString().slice(0,10)});}),
    updateTime:withTableSync("time_entries",async(te)=>{const{id,...rest}=te;await sb().from("time_entries").update(rest).eq("id",id);}),
    deleteTime:withTableSync("time_entries",async(id)=>{await sb().from("time_entries").delete().eq("id",id);}),
    addPhoto:withTableSync("photos",async(ph)=>{await sb().from("photos").insert({...ph,uploaded_by:appUser.name,drive_synced:true});}),
    addUser:withTableSync("users",async(u)=>{await sb().from("users").insert(u);}),
    updateUser:withTableSync("users",async(u)=>{const{id,...rest}=u;await sb().from("users").update(rest).eq("id",id);}),
    deleteUser:withTableSync("users",async(id)=>{await sb().from("users").delete().eq("id",id);}),
    addTemplate:withTableSync("recurring_templates",async(t)=>{await sb().from("recurring_templates").insert(t);}),
    deleteTemplate:withTableSync("recurring_templates",async(id)=>{await sb().from("recurring_templates").delete().eq("id",id);}),
    addCustomer:withTableSync("customers",async(c)=>{await sb().from("customers").insert(c);}),
    updateCustomer:withTableSync("customers",async(c)=>{const{id,...rest}=c;await sb().from("customers").update(rest).eq("id",id);}),
    deleteCustomer:withTableSync("customers",async(id)=>{await sb().from("customers").delete().eq("id",id);}),
    addEmailTemplate:withTableSync("email_templates",async(t)=>{await sb().from("email_templates").insert(t);}),
    updateEmailTemplate:withTableSync("email_templates",async(t)=>{const{id,...rest}=t;await sb().from("email_templates").update(rest).eq("id",id);}),
    deleteEmailTemplate:withTableSync("email_templates",async(id)=>{await sb().from("email_templates").delete().eq("id",id);}),
    addProject:withTableSync("projects",async(p)=>{await sb().from("projects").insert(p);}),
    updateProject:withTableSync("projects",async(p)=>{const{id,...rest}=p;await sb().from("projects").update(rest).eq("id",id);}),
    deleteProject:withTableSync("projects",async(id)=>{await sb().from("projects").delete().eq("id",id);}),
    markRead:withTableSync("notifications",async()=>{await sb().from("notifications").update({read:true}).eq("read",false);}),
    quickApprovePO:async(notif)=>{const poId=notif.message?.match(/^(\d{6})/)?.[1];if(!poId)return;const{data:po}=await sb().from("purchase_orders").select("*").eq("po_id",poId).limit(1);if(po&&po[0]){await sb().from("purchase_orders").update({status:"approved"}).eq("id",po[0].id);await sb().from("notifications").update({read:true}).eq("id",notif.id);await sb().from("notifications").insert({type:"po_approved",title:"PO Approved",message:poId+" has been approved",for_role:null});await loadData();}},
    quickRejectPO:async(notif)=>{const poId=notif.message?.match(/^(\d{6})/)?.[1];if(!poId)return;const{data:po}=await sb().from("purchase_orders").select("*").eq("po_id",poId).limit(1);if(po&&po[0]){await sb().from("purchase_orders").update({status:"rejected"}).eq("id",po[0].id);await sb().from("notifications").update({read:true}).eq("id",notif.id);await sb().from("notifications").insert({type:"po_rejected",title:"PO Rejected",message:poId+" has been rejected",for_role:null});await loadData();}},
  };

  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F}}><Logo size="large"/><div style={{marginTop:20}}><Spinner/></div><div style={{color:B.textDim,fontSize:12,marginTop:10}}>Connecting...</div></div>);
  if(authUser&&data?.users?.length===0)return <FirstSetup authUser={authUser} onDone={loadData}/>;
  if(!appUser)return <LoginScreen authUser={authUser} loading={false}/>;
  const p={user:appUser,onLogout:async()=>{await sb().auth.signOut();setAppUser(null);setAuthUser(null);},D:data,A:actions,syncing};
  if(appUser.role==="admin")return <AdminDash {...p}/>;
  if(appUser.role==="manager")return <MgrDash {...p}/>;
  return <TechDash {...p}/>;
}
