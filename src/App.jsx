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

function CameraUpload({woId,onUploaded,userName}){
  const fileRef=useRef(null);
  const[uploading,setUploading]=useState(false);
  const handleFile=async(e)=>{
    const file=e.target.files?.[0];if(!file||uploading)return;
    setUploading(true);
    const ext=file.name.split(".").pop();
    const path=`${woId}/${Date.now()}.${ext}`;
    const{error}=await sb().storage.from("photos").upload(path,file);
    if(!error){
      const{data:{publicUrl}}=sb().storage.from("photos").getPublicUrl(path);
      await sb().from("photos").insert({wo_id:woId,filename:file.name,photo_url:publicUrl,uploaded_by:userName,drive_synced:true});
      if(onUploaded)onUploaded();
    }else{console.error("Upload error:",error);}
    setUploading(false);
    if(fileRef.current)fileRef.current.value="";
  };
  return(<div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
    <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...BS,width:"100%",padding:14,opacity:uploading?.6:1}}>
      <div style={{fontSize:24,marginBottom:4}}>📷</div>
      <div style={{fontSize:12}}>{uploading?"Uploading...":"Tap to Take Photo or Choose from Gallery"}</div>
    </button>
  </div>);
}

// ═══════════════════════════════════════════
// NOTIFICATION BELL
// ═══════════════════════════════════════════
function NotifBell({notifications,onMarkRead}){
  const[open,setOpen]=useState(false);
  const unread=notifications.filter(n=>!n.read).length;
  return(<div style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",position:"relative"}}>🔔{unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:B.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}</button>
    {open&&<div style={{position:"absolute",right:0,top:30,width:280,background:B.surface,border:"1px solid "+B.border,borderRadius:8,zIndex:999,maxHeight:300,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+B.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:B.text}}>Notifications</span>{unread>0&&<button onClick={async()=>{await onMarkRead();setOpen(false);}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer"}}>Mark all read</button>}</div>
      {notifications.length===0&&<div style={{padding:20,textAlign:"center",color:B.textDim,fontSize:11}}>No notifications</div>}
      {notifications.slice(0,20).map(n=><div key={n.id} style={{padding:"8px 14px",borderBottom:"1px solid "+B.border,background:n.read?"transparent":B.cyanGlow}}><div style={{fontSize:11,fontWeight:700,color:n.read?B.textDim:B.text}}>{n.title}</div><div style={{fontSize:10,color:B.textDim}}>{n.message}</div><div style={{fontSize:9,color:B.textDim,marginTop:2}}>{new Date(n.created_at).toLocaleString()}</div></div>)}
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

function Shell({user,onLogout,children,tab,setTab,tabs,syncing,notifications,onMarkRead}){
  return(<div style={{minHeight:"100vh",background:B.bg,fontFamily:F,color:B.text,display:"flex",flexDirection:"column"}}>
    <div style={{background:B.surface,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+B.border}}>
      <Logo/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {syncing&&<span style={{fontSize:10,color:B.orange}}>syncing...</span>}
        <NotifBell notifications={notifications||[]} onMarkRead={onMarkRead}/>
        <Badge color={ROLES[user.role]?ROLES[user.role].color:B.textDim}>{user.role}</Badge>
        <span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>{user.name}</span>
        <button onClick={onLogout} style={{...BS,padding:"5px 10px",fontSize:11}}>Sign Out</button>
      </div>
    </div>
    <div style={{background:B.surface,padding:"0 20px",display:"flex",gap:2,borderBottom:"1px solid "+B.border,overflowX:"auto"}}>{tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 14px",border:"none",background:"none",fontSize:12,fontWeight:600,color:tab===t.key?B.cyan:B.textDim,borderBottom:tab===t.key?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>)}</div>
    <div style={{flex:1,padding:20,overflowY:"auto"}}>{children}</div>
  </div>);
}

// ═══════════════════════════════════════════
// PO MODALS + MANAGEMENT (same as before)
// ═══════════════════════════════════════════
function POReqModal({wo,pos,onCreatePO,onClose}){
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
  const existing=pos.filter(p=>p.wo_id===wo.id);
  const go=async()=>{if(!desc.trim()||saving)return;setSaving(true);await onCreatePO({wo_id:wo.id,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim()});setSaving(false);onClose();};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}><span style={LS}>Existing POs on {wo.wo_id}</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=><div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.description} · ${po.amount}</span></div><Badge color={PSC[po.status]}>{PSL[po.status]}</Badge></div>)}</div><div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div></div>}
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
  const[filter,setFilter]=useState("all"),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};const flt=pos.filter(p=>filter==="all"||p.status===filter);const pc=pos.filter(p=>p.status==="pending").length;
  const approve=async(po)=>{await onUpdatePO({...po,status:"approved"});msg("PO "+po.po_id+" approved");};
  const reject=async(po)=>{await onUpdatePO({...po,status:"rejected"});msg("PO "+po.po_id+" rejected");};
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total POs" value={pos.length} icon="📄" color={B.cyan}/><StatCard label="Pending" value={pc} icon="⏳" color={B.orange}/><StatCard label="Approved" value={pos.filter(p=>p.status==="approved").length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+pos.filter(p=>p.status==="approved").reduce((s,p)=>s+(parseFloat(p.amount)||0),0).toLocaleString()} icon="💰" color={B.purple}/></div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
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
// WORK ORDER DETAIL — with real camera + customer field
// ═══════════════════════════════════════════
function WODetail({wo,onBack,onUpdateWO,onDeleteWO,canEdit,pos,onCreatePO,timeEntries,onAddTime,onUpdateTime,onDeleteTime,photos,onAddPhoto,userName,userRole,loadData}){
  const[showTime,setShowTime]=useState(false),[showPO,setShowPO]=useState(false),[showComplete,setShowComplete]=useState(false),[editingTime,setEditingTime]=useState(null);
  const[tH,setTH]=useState(""),[tD,setTD]=useState(""),[tDate,setTDate]=useState(new Date().toISOString().slice(0,10)),[note,setNote]=useState("");
  const[toast,setToast]=useState(""),[saving,setSaving]=useState(false);
  const[sigCanvas,setSigCanvas]=useState(null),[sigErr,setSigErr]=useState(""),[compDate,setCompDate]=useState(new Date().toISOString().slice(0,10));
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const woPOs=pos.filter(p=>p.wo_id===wo.id);const woTime=timeEntries.filter(t=>t.wo_id===wo.id);const woPhotos=photos.filter(p=>p.wo_id===wo.id);
  const hasData=woTime.length>0||woPOs.length>0||woPhotos.length>0||(wo.notes&&wo.notes.trim()&&wo.notes!=="No details.")||parseFloat(wo.hours_total||0)>0;
  const isManager=userRole==="admin"||userRole==="manager";
  const canEditTime=(te)=>isManager||te.technician===userName;
  const addTime=async()=>{const h=parseFloat(tH);if(!h||h<=0||!tD.trim()||saving)return;setSaving(true);await onAddTime({wo_id:wo.id,hours:h,description:tD.trim(),logged_date:tDate});await onUpdateWO({...wo,hours_total:parseFloat(wo.hours_total||0)+h});setSaving(false);setTH("");setTD("");setShowTime(false);msg("Logged "+h+"h");};
  const saveTimeEdit=async()=>{if(!editingTime||saving)return;const h=parseFloat(editingTime.hours);if(!h||h<=0)return;setSaving(true);const oldH=parseFloat(woTime.find(t=>t.id===editingTime.id)?.hours||0);await onUpdateTime(editingTime);await onUpdateWO({...wo,hours_total:parseFloat(wo.hours_total||0)-oldH+h});setSaving(false);setEditingTime(null);msg("Time entry updated");};
  const deleteTimeEntry=async(te)=>{if(saving)return;if(!window.confirm("Delete this time entry ("+te.hours+"h)?"))return;setSaving(true);await onDeleteTime(te.id);await onUpdateWO({...wo,hours_total:Math.max(0,parseFloat(wo.hours_total||0)-parseFloat(te.hours||0))});setSaving(false);msg("Time entry deleted");};
  const addFieldNote=async()=>{if(!note.trim()||saving)return;setSaving(true);const ts=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});const newNotes=(wo.field_notes||"")+"\n["+ts+" — "+userName+"] "+note.trim();const{error}=await sb().from("work_orders").update({field_notes:newNotes}).eq("id",wo.id);if(error)console.error("field note error:",error);await loadData();setSaving(false);setNote("");msg("Field note added");};
  const[editingDetails,setEditingDetails]=useState(false),[detailsText,setDetailsText]=useState(wo.notes||"");
  const saveDetails=async()=>{if(saving)return;setSaving(true);const{error}=await sb().from("work_orders").update({notes:detailsText}).eq("id",wo.id);if(error)console.error("save details error:",error);await loadData();setSaving(false);setEditingDetails(false);msg("Job details updated");};
  const changeStatus=async(newStatus)=>{if(saving)return;setSaving(true);await onUpdateWO({...wo,status:newStatus});setSaving(false);msg("Status changed to "+SL[newStatus]);};
  const markComplete=async()=>{if(saving)return;if(woTime.length===0){setSigErr("You must log at least one time entry before completing.");return;}if(!compDate){setSigErr("Completion date required.");return;}if(!sigCanvas||!sigCanvas._getData||!sigCanvas._getData()){setSigErr("Signature required.");return;}setSigErr("");setSaving(true);await onUpdateWO({...wo,status:"completed",date_completed:compDate,signature:sigCanvas._getData()});setSaving(false);setShowComplete(false);msg("Completed & Signed");};
  const tryDelete=async()=>{const msg2=hasData?"This work order has data. Are you SURE you want to delete "+wo.wo_id+"? This cannot be undone.":"Delete "+wo.wo_id+"? This cannot be undone.";if(!window.confirm(msg2))return;setSaving(true);const{error}=await sb().from("work_orders").delete().eq("id",wo.id);if(error){console.error("delete error:",error);setSaving(false);return;}await loadData();setSaving(false);onBack();};
  return(<div><Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:600}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.wo_id}</span><h2 style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:B.text}}>{wo.title}</h2>{wo.customer&&<div style={{fontSize:11,color:B.purple,marginTop:2}}>👤 {wo.customer}</div>}</div>
        <div style={{display:"flex",gap:6}}><Badge color={PC[wo.priority]}>{wo.priority}</Badge><DSBadge ok={woPhotos.length>0}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div><span style={LS}>Status</span><br/><select value={wo.status} onChange={e=>changeStatus(e.target.value)} style={{...IS,width:"auto",padding:"4px 8px",fontSize:12,cursor:"pointer",background:SC[wo.status]+"22",color:SC[wo.status],fontWeight:700,border:"1px solid "+SC[wo.status]+"44"}}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div>
        <div><span style={LS}>Type</span><br/><Badge color={wo.wo_type==="PM"?B.cyan:B.orange}>{wo.wo_type||"—"}</Badge></div>
        <div><span style={LS}>Due</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.due_date}</span></div>
        <div><span style={LS}>Assigned</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.assignee}</span></div>
        <div><span style={LS}>Location / Room</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.location||"—"}</span></div>
        <div><span style={LS}>Building #</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.building||"—"}</span></div>
        <div><span style={LS}>Hours</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.hours_total||0}h</span></div>
        {wo.date_completed&&<div><span style={LS}>Completed</span><br/><span style={{fontSize:13,fontWeight:600,color:B.green}}>{wo.date_completed}</span></div>}
      </div>
      {wo.signature&&<div style={{marginBottom:14}}><span style={LS}>Signature</span><div style={{marginTop:4,background:B.bg,borderRadius:6,border:"1px solid "+B.border,padding:8,display:"inline-block"}}><img src={wo.signature} alt="Sig" style={{maxWidth:280,height:"auto",display:"block"}}/></div></div>}
      {woPOs.length>0&&<div style={{marginBottom:14}}><span style={LS}>Purchase Orders</span><div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>{woPOs.map(po=><div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:B.bg,borderRadius:4,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:12}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:6}}>{po.description}</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:M,fontSize:11,color:B.text}}>${parseFloat(po.amount||0).toFixed(2)}</span><Badge color={PSC[po.status]}>{po.status}</Badge></div></div>)}</div></div>}
      <div style={{background:B.bg,borderRadius:6,padding:14,border:"1px solid "+B.border,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={LS}>Job Details</span>{isManager&&!editingDetails&&<button onClick={()=>{setDetailsText(wo.notes||"");setEditingDetails(true);}} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer"}}>Edit</button>}</div>
        {editingDetails?<div style={{marginTop:6}}><textarea value={detailsText} onChange={e=>setDetailsText(e.target.value)} rows={4} style={{...IS,resize:"vertical",lineHeight:1.5}}/><div style={{display:"flex",gap:6,marginTop:6}}><button onClick={()=>setEditingDetails(false)} style={{...BS,flex:1,padding:"6px 12px",fontSize:11}}>Cancel</button><button onClick={saveDetails} disabled={saving} style={{...BP,flex:1,padding:"6px 12px",fontSize:11,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div></div>:<p style={{margin:"4px 0 0",color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.notes||"No details."}</p>}
      </div>
      <div style={{background:B.bg,borderRadius:6,padding:14,border:"1px solid "+B.border,marginBottom:14}}>
        <span style={LS}>Field Notes</span>
        {wo.field_notes?<p style={{margin:"4px 0 0",color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.field_notes}</p>:<p style={{margin:"4px 0 0",color:B.textDim,fontSize:12,fontStyle:"italic"}}>No field notes yet</p>}
        <div style={{display:"flex",gap:6,marginTop:8}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add field note..." style={{...IS,flex:1}} onKeyDown={e=>e.key==="Enter"&&addFieldNote()}/><button onClick={addFieldNote} disabled={saving} style={BP}>Add</button></div>
      </div>
      {woTime.length>0&&<div style={{marginBottom:14}}><span style={LS}>Time Entries</span>{woTime.map((te,i)=><div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid "+B.border,fontSize:12,alignItems:"center"}}><span style={{fontFamily:M,color:B.textDim,minWidth:70}}>{te.logged_date}</span><span style={{fontFamily:M,color:B.cyan,minWidth:35}}>{te.hours}h</span><span style={{color:B.textMuted,flex:1}}>{te.description}</span>{canEditTime(te)&&<><button onClick={()=>setEditingTime({...te})} style={{background:"none",border:"none",color:B.cyan,fontSize:10,cursor:"pointer"}}>Edit</button><button onClick={()=>deleteTimeEntry(te)} style={{background:"none",border:"none",color:B.red,fontSize:10,cursor:"pointer"}}>×</button></>}</div>)}</div>}
      {woPhotos.length>0&&<div style={{marginBottom:14}}><span style={LS}>Photos ({woPhotos.length})</span><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{woPhotos.map((p,i)=><div key={i} style={{borderRadius:6,overflow:"hidden",border:"1px solid "+B.border}}>{p.photo_url?<img src={p.photo_url} alt={p.filename} style={{width:80,height:80,objectFit:"cover",display:"block"}}/>:<div style={{width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center",background:B.bg,fontSize:10,color:B.textDim}}>📷 {p.filename}</div>}</div>)}</div></div>}
      {canEdit&&<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
        <CameraUpload woId={wo.id} userName={userName} onUploaded={loadData}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {wo.status!=="completed"&&<button onClick={()=>{setSigErr("");setShowComplete(true)}} style={{...BP,flex:"1 1 auto",background:B.green}}>✓ Complete</button>}
          <button onClick={()=>setShowTime(true)} style={{...BS,flex:"1 1 auto"}}>⏱ Time</button>
          <button onClick={()=>setShowPO(true)} style={{...BS,flex:"1 1 auto"}}>📄 PO#</button>
        </div>
      </div>}
      <div style={{marginTop:canEdit?0:16}}><button onClick={tryDelete} disabled={saving} style={{...BS,width:"100%",color:B.red,borderColor:B.red+"44"}}>🗑 Delete Work Order</button></div>
    </Card>
    {showTime&&<Modal title="Log Time" onClose={()=>setShowTime(false)}><div style={{display:"flex",flexDirection:"column",gap:12}}><div><label style={LS}>Date</label><input type="date" value={tDate} onChange={e=>setTDate(e.target.value)} style={IS}/></div><div><label style={LS}>Hours</label><input value={tH} onChange={e=>setTH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Description</label><input value={tD} onChange={e=>setTD(e.target.value)} placeholder="What was done?" style={IS} onKeyDown={e=>e.key==="Enter"&&addTime()}/></div><div style={{display:"flex",gap:8}}><button onClick={()=>setShowTime(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={addTime} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Log"}</button></div></div></Modal>}
    {showPO&&<POReqModal wo={wo} pos={pos} onCreatePO={onCreatePO} onClose={()=>setShowPO(false)}/>}
    {showComplete&&<Modal title="Complete Work Order" onClose={()=>setShowComplete(false)} wide><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:B.bg,borderRadius:6,padding:12,border:"1px solid "+B.border}}><div style={{fontSize:13,fontWeight:700,color:B.text}}>{wo.wo_id} — {wo.title}</div></div>
      <div><label style={LS}>Completion Date <span style={{color:B.red}}>*</span></label><input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)} style={IS}/></div>
      <div><span style={LS}>Technician Signature <span style={{color:B.red}}>*</span></span><div style={{marginTop:4}}><SignaturePad onSign={setSigCanvas}/></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}><div style={{fontSize:10,color:B.textDim}}>Draw your signature above</div><button onClick={()=>{if(sigCanvas&&sigCanvas._clear)sigCanvas._clear();setSigErr("");}} style={{background:"none",border:"none",color:B.orange,fontSize:11,cursor:"pointer",fontFamily:F}}>Clear</button></div></div>
      {sigErr&&<div style={{color:B.red,fontSize:12,fontWeight:600}}>{sigErr}</div>}
      <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={markComplete} disabled={saving} style={{...BP,flex:1,background:B.green,opacity:saving?.6:1}}>{saving?"Saving...":"Sign & Complete"}</button></div>
    </div></Modal>}
    {editingTime&&<Modal title="Edit Time Entry" onClose={()=>setEditingTime(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Date</label><input type="date" value={editingTime.logged_date||""} onChange={e=>setEditingTime({...editingTime,logged_date:e.target.value})} style={IS}/></div>
        <div><label style={LS}>Hours</label><input type="number" step="0.25" value={editingTime.hours} onChange={e=>setEditingTime({...editingTime,hours:e.target.value})} style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Description</label><input value={editingTime.description||""} onChange={e=>setEditingTime({...editingTime,description:e.target.value})} style={IS}/></div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setEditingTime(null)} style={{...BS,flex:1}}>Cancel</button><button onClick={saveTimeEdit} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
      </div>
    </Modal>}
  </div>);
}

// ═══════════════════════════════════════════
// CREATE WO (with customer) + WO LIST
// ═══════════════════════════════════════════
function CreateWO({onSave,onCancel,users,customers}){
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState("Unassigned"),[due,setDue]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false),[loc,setLoc]=useState(""),[woType,setWoType]=useState("CM"),[bldg,setBldg]=useState(""),[cust,setCust]=useState("");
  const techs=users.filter(u=>u.role==="technician"&&u.active!==false);
  const go=async()=>{if(!title.trim()||saving)return;setSaving(true);await onSave({title:title.trim(),priority:pri,assignee:assign,due_date:due||"TBD",notes:notes.trim()||"No details.",location:loc.trim(),wo_type:woType,building:bldg.trim(),customer:cust});setSaving(false);};
  return(<div><button onClick={onCancel} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:580}}><h2 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:B.text}}>Create Work Order</h2><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Walk-in Cooler Repair — Store #14" style={IS}/></div>
      <div><label style={LS}>Customer</label><select value={cust} onChange={e=>setCust(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select Customer —</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Location / Room</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Store #14, Room 3B" style={IS}/></div><div><label style={LS}>Building # <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={bldg} onChange={e=>setBldg(e.target.value)} placeholder="Building A" style={IS}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Type</label><select value={woType} onChange={e=>setWoType(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="PM">PM (Preventive)</option><option value="CM">CM (Corrective)</option></select></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Due</label><input value={due} onChange={e=>setDue(e.target.value)} type="date" style={IS}/></div><div><label style={LS}>Assignee</label><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{techs.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div></div>
      <div><label style={LS}>Details</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe the work..." style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Creating...":"Create"}</button></div>
    </div></Card></div>);
}

function WOList({orders,canEdit,pos,onCreatePO,onUpdateWO,onDeleteWO,onCreateWO,timeEntries,photos,onAddTime,onUpdateTime,onDeleteTime,onAddPhoto,users,customers,userName,userRole,loadData}){
  const[sel,setSel]=useState(null),[filter,setFilter]=useState("all"),[creating,setCreating]=useState(false);
  const flt=orders.filter(o=>filter==="all"||o.status===filter);
  if(creating&&canEdit)return <CreateWO onSave={async(nw)=>{await onCreateWO(nw);setCreating(false);}} onCancel={()=>setCreating(false)} users={users} customers={customers}/>;
  if(sel){const fresh=orders.find(o=>o.id===sel.id);if(!fresh){setSel(null);return null;}return <WODetail wo={fresh} onBack={()=>setSel(null)} onUpdateWO={async u=>{await onUpdateWO(u);}} onDeleteWO={async id=>{await onDeleteWO(id);setSel(null);}} canEdit={canEdit} pos={pos} onCreatePO={onCreatePO} timeEntries={timeEntries} onAddTime={onAddTime} onUpdateTime={onUpdateTime} onDeleteTime={onDeleteTime} photos={photos} onAddPhoto={onAddPhoto} userName={userName} userRole={userRole} loadData={loadData}/>;}
  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
      {[["all","All"],["pending","Pending"],["in_progress","Active"],["completed","Done"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
      {canEdit&&<button onClick={()=>setCreating(true)} style={{...BP,marginLeft:"auto",padding:"7px 14px",fontSize:12}}>+ New Order</button>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No orders</div>}
      {flt.map(wo=>{const wp=pos.filter(p=>p.wo_id===wo.id);const wph=photos.filter(p=>p.wo_id===wo.id);return(
        <Card key={wo.id} onClick={()=>setSel(wo)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px"}}>
          <div style={{width:3,height:36,borderRadius:2,background:PC[wo.priority]||B.textDim,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontFamily:M,fontSize:10,color:B.textDim}}>{wo.wo_id}</span><Badge color={SC[wo.status]||B.textDim}>{SL[wo.status]||wo.status}</Badge><Badge color={wo.wo_type==="PM"?B.cyan:B.orange}>{wo.wo_type||"CM"}</Badge>{wph.length>0&&<span style={{fontSize:10,color:B.textDim}}>📷{wph.length}</span>}{wp.length>0&&<span style={{fontSize:10,color:B.purple}}>📄{wp.length} PO</span>}</div>
            <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wo.title}</div>
            <div style={{fontSize:11,color:B.textDim,marginTop:1}}>{wo.customer&&<span>👤 {wo.customer} · </span>}{wo.location&&<span>📍 {wo.location}</span>}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:11,color:B.textDim}}>{wo.assignee}</div><div style={{fontSize:11,fontWeight:600,color:B.textMuted}}>Due {wo.due_date}</div></div>
        </Card>);})}
    </div></div>);
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
    {showForm&&<UserForm user={editing} onSave={save} onClose={()=>{setShowForm(false);setEditing(null)}}/>}
  </div>);
}

function UserForm({user,onSave,onClose}){
  const[n,setN]=useState(user?.name||""),[e,setE]=useState(user?.email||""),[r,setR]=useState(user?.role||"technician"),[saving,setSaving]=useState(false);
  const go=async()=>{if(!n.trim()||!e.trim()||saving)return;setSaving(true);await onSave({name:n.trim(),email:e.trim().toLowerCase(),role:r,active:true});setSaving(false);};
  return(<Modal title={user?"Edit User":"Add New User"} onClose={onClose}><div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Full Name</label><input value={n} onChange={ev=>setN(ev.target.value)} placeholder="Mike Johnson" style={IS}/></div>
    <div><label style={LS}>Gmail Address</label><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="mike@gmail.com" style={IS}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Must match their Google account email exactly.</div></div>
    <div><label style={LS}>Role</label><select value={r} onChange={ev=>setR(ev.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
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
function BillingExport({wos,pos,timeEntries,customers}){
  const[toast,setToast]=useState(""),[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState(""),[custFilter,setCustFilter]=useState("");
  const allCols={wo_id:"WO#",date_completed:"Date",customer:"Customer",title:"Title",location:"Location",building:"Building",wo_type:"Type",hours:"Hours",po_total:"PO $"};
  const[cols,setCols]=useState(Object.keys(allCols));
  const toggleCol=k=>setCols(prev=>prev.includes(k)?prev.filter(c=>c!==k):[...prev,k]);
  const completed=wos.filter(o=>o.status==="completed"&&(!dateFrom||o.date_completed>=dateFrom)&&(!dateTo||o.date_completed<=dateTo)&&(!custFilter||o.customer===custFilter));
  const getData=wo=>{const h=timeEntries.filter(t=>t.wo_id===wo.id).reduce((s,t)=>s+parseFloat(t.hours||0),0);const p=pos.filter(p=>p.wo_id===wo.id&&p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);return{wo_id:wo.wo_id,date_completed:wo.date_completed||"",customer:wo.customer||"",title:wo.title,location:wo.location||"",building:wo.building||"",wo_type:wo.wo_type||"CM",hours:h+"h",po_total:"$"+p.toFixed(2)};};
  const copyToClip=()=>{const header=cols.map(c=>allCols[c]).join("\t")+"\n";const rows=completed.map(wo=>{const d=getData(wo);return cols.map(c=>d[c]).join("\t");}).join("\n");navigator.clipboard.writeText(header+rows).then(()=>{setToast("Copied! Paste into your spreadsheet.");setTimeout(()=>setToast(""),3000);});};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Customer Billing Export</h3>
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <div><label style={LS}>From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={IS}/></div>
      <div><label style={LS}>To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={IS}/></div>
      <div><label style={LS}>Customer</label><select value={custFilter} onChange={e=>setCustFilter(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">All Customers</option>{(customers||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
    </div>
    <div style={{marginBottom:10}}><span style={LS}>Columns to export</span><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{Object.entries(allCols).map(([k,v])=><button key={k} onClick={()=>toggleCol(k)} style={{padding:"4px 10px",borderRadius:4,border:"1px solid "+(cols.includes(k)?B.cyan:B.border),background:cols.includes(k)?B.cyanGlow:"transparent",color:cols.includes(k)?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{v}</button>)}</div></div>
    <div style={{marginBottom:14,fontSize:12,color:B.textMuted}}>{completed.length} completed orders{custFilter?" for "+custFilter:""}</div>
    <Card style={{overflowX:"auto",marginBottom:14}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:"2px solid "+B.border}}>{cols.map(c=><th key={c} style={{textAlign:"left",padding:"6px 8px",color:B.textDim,fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{allCols[c]}</th>)}</tr></thead><tbody>{completed.map(wo=>{const d=getData(wo);return(<tr key={wo.id} style={{borderBottom:"1px solid "+B.border}}>{cols.map(c=><td key={c} style={{padding:"6px 8px",fontFamily:c==="wo_id"||c==="hours"||c==="po_total"?M:F,color:c==="wo_id"?B.cyan:c==="hours"?B.cyan:B.text}}>{d[c]}</td>)}</tr>);})}</tbody></table></Card>
    <button onClick={copyToClip} style={{...BP,width:"100%"}}>📋 Copy {cols.length} Columns to Clipboard</button>
  </div>);
}

// ═══════════════════════════════════════════
// CUSTOMER MANAGEMENT (admin/manager only)
// ═══════════════════════════════════════════
function CustomerMgmt({customers,onAdd,onUpdate,onDelete}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[name,setName]=useState(""),[addr,setAddr]=useState(""),[contact,setContact]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openEdit=(c)=>{setEditing(c);setName(c.name);setAddr(c.address||"");setContact(c.contact_name||"");setPhone(c.phone||"");setEmail(c.email||"");setShowForm(true);};
  const openNew=()=>{setEditing(null);setName("");setAddr("");setContact("");setPhone("");setEmail("");setShowForm(true);};
  const go=async()=>{if(!name.trim()||saving)return;setSaving(true);const obj={name:name.trim(),address:addr.trim(),contact_name:contact.trim(),phone:phone.trim(),email:email.trim()};if(editing){await onUpdate({...editing,...obj});}else{await onAdd(obj);}setSaving(false);setShowForm(false);msg(editing?"Customer updated":"Customer added");};
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

function Settings(){return(<div><h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>System Settings</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{[["🔔","Notifications"],["📱","Devices"],["🔐","Security"],["☁️","Storage"],["📊","Reports"],["🏢","Company"],["📋","Templates"],["🔧","Integrations"]].map(([ic,lb])=><Card key={lb} style={{padding:"18px 14px",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:24,marginBottom:6}}>{ic}</div><div style={{fontSize:12,fontWeight:600,color:B.textMuted}}>{lb}</div></Card>)}</div></div>);}

// ═══════════════════════════════════════════
// DASHBOARDS — with new tabs
// ═══════════════════════════════════════════
function TechDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("orders");const my=D.wos.filter(o=>o.assignee===user.name);const myTime=D.time.filter(t=>t.technician===user.name);
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} tabs={[{key:"orders",label:"Work Orders",icon:"📋"},{key:"schedule",label:"Schedule",icon:"📅"},{key:"time",label:"Time Log",icon:"⏱"}]}>
    {tab==="orders"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Active" value={my.filter(o=>o.status!=="completed").length} icon="📋" color={B.cyan}/><StatCard label="Hours" value={my.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)+"h"} icon="⏱" color={B.green}/><StatCard label="Done" value={my.filter(o=>o.status==="completed").length} icon="✓" color={B.green}/></div><WOList orders={my} {...wlp}/></>}
    {tab==="schedule"&&<SchedView schedule={D.schedule} userName={user.name}/>}
    {tab==="time"&&<TimeLog timeEntries={myTime} wos={D.wos}/>}
  </Shell>);
}

function MgrDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"Work Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"team",label:"Team",icon:"👥"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"}]}>
    {tab==="overview"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Open" value={D.wos.filter(o=>o.status!=="completed").length} icon="📋" color={B.red}/><StatCard label="Active" value={D.wos.filter(o=>o.status==="in_progress").length} icon="🔄" color={B.orange}/><StatCard label="Pending POs" value={D.pos.filter(p=>p.status==="pending").length} icon="📄" color={B.purple}/><StatCard label="Hours" value={D.wos.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)+"h"} icon="⏱" color={B.cyan}/></div><h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:B.text}}>High Priority</h3><WOList orders={D.wos.filter(o=>o.priority==="high")} {...wlp}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers}/>}
    {tab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{D.users.filter(u=>u.role==="technician"&&u.active!==false).map(t=>{const to=D.wos.filter(o=>o.assignee===t.name);return(<Card key={t.id} style={{padding:"14px 18px"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:8,background:ROLES.technician.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800}}>{t.name.split(" ").map(n=>n[0]).join("")}</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim}}>{to.filter(o=>o.status==="in_progress").length} active · {to.filter(o=>o.status==="completed").length} done · {to.reduce((s,o)=>s+parseFloat(o.hours_total||0),0).toFixed(1)}h</div></div><Badge color={B.green}>On Duty</Badge></div></Card>);})}</div>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
  </Shell>);
}

function AdminDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,userName:user.name,userRole:user.role,loadData:A.loadData};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} notifications={D.notifs} onMarkRead={A.markRead} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"All Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"recurring",label:"PM Schedule",icon:"🔁"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"},{key:"settings",label:"Settings",icon:"⚙️"}]}>
    {tab==="overview"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total" value={D.wos.length} icon="📋" color={B.cyan}/><StatCard label="Pending POs" value={D.pos.filter(p=>p.status==="pending").length} icon="📄" color={B.purple}/><StatCard label="Urgent" value={D.wos.filter(o=>o.priority==="high").length} icon="🔴" color={B.red}/><StatCard label="Done" value={D.wos.length>0?Math.round(D.wos.filter(o=>o.status==="completed").length/D.wos.length*100)+"%":"0%"} icon="📈" color={B.green}/></div><WOList orders={D.wos} {...wlp}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers}/>}
    {tab==="recurring"&&<RecurringPM templates={D.templates} onAdd={A.addTemplate} onDelete={A.deleteTemplate} users={D.users}/>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="settings"&&<Settings/>}
  </Shell>);
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App(){
  const[authUser,setAuthUser]=useState(null);const[appUser,setAppUser]=useState(null);
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);const[syncing,setSyncing]=useState(false);

  useEffect(()=>{const client=sb();if(!client)return;
    client.auth.getSession().then(({data:{session}})=>{setAuthUser(session?.user||null);});
    const{data:{subscription}}=client.auth.onAuthStateChange((_,session)=>{setAuthUser(session?.user||null);});
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=useCallback(async()=>{const client=sb();if(!client)return;
    const[wos,pos,time,photos,users,schedule,templates,notifs,customers]=await Promise.all([
      client.from("work_orders").select("*").order("created_at",{ascending:false}),
      client.from("purchase_orders").select("*").order("created_at",{ascending:false}),
      client.from("time_entries").select("*").order("logged_date",{ascending:false}),
      client.from("photos").select("*").order("uploaded_at",{ascending:false}),
      client.from("users").select("*").order("name"),
      client.from("schedule").select("*").order("time"),
      client.from("recurring_templates").select("*").order("title"),
      client.from("notifications").select("*").order("created_at",{ascending:false}).limit(50),
      client.from("customers").select("*").order("name"),
    ]);
    setData({wos:wos.data||[],pos:pos.data||[],time:time.data||[],photos:photos.data||[],users:users.data||[],schedule:schedule.data||[],templates:templates.data||[],notifs:notifs.data||[],customers:customers.data||[]});
    setLoading(false);
  },[]);

  useEffect(()=>{if(authUser)loadData();},[authUser,loadData]);
  useEffect(()=>{if(!authUser){sb().from("users").select("*").then(({data:u})=>{setData(d=>({...(d||{wos:[],pos:[],time:[],photos:[],schedule:[],templates:[],notifs:[],customers:[]}),users:u||[]}));setLoading(false);});}},[authUser]);

  useEffect(()=>{if(!authUser||!data?.users)return;const match=data.users.find(u=>u.email?.toLowerCase()===authUser.email?.toLowerCase()&&u.active!==false);setAppUser(match||null);},[authUser,data?.users]);

  useEffect(()=>{if(!authUser)return;const client=sb();
    const chan=client.channel("fieldops-rt").on("postgres_changes",{event:"*",schema:"public",table:"work_orders"},()=>loadData()).on("postgres_changes",{event:"*",schema:"public",table:"purchase_orders"},()=>loadData()).on("postgres_changes",{event:"*",schema:"public",table:"time_entries"},()=>loadData()).on("postgres_changes",{event:"*",schema:"public",table:"users"},()=>loadData()).on("postgres_changes",{event:"*",schema:"public",table:"photos"},()=>loadData()).on("postgres_changes",{event:"*",schema:"public",table:"notifications"},()=>loadData()).subscribe();
    return()=>{client.removeChannel(chan);};
  },[authUser,loadData]);

  const withSync=fn=>async(...args)=>{setSyncing(true);try{await fn(...args);await loadData();}finally{setSyncing(false);}};
  const notify=async(type,title,message,forRole)=>{await sb().from("notifications").insert({type,title,message,for_role:forRole||null});};

  const actions={
    loadData,
    createWO:withSync(async(wo)=>{const{data:ex}=await sb().from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);const ln=ex&&ex[0]?parseInt(ex[0].wo_id.replace("WO-",""))||1000:1000;await sb().from("work_orders").insert({...wo,wo_id:"WO-"+(ln+1),status:"pending",hours_total:0});await notify("wo_created","New Work Order","WO-"+(ln+1)+": "+wo.title);}),
    updateWO:withSync(async(wo)=>{const{id,...rest}=wo;const{error}=await sb().from("work_orders").update(rest).eq("id",id);if(error)console.error("updateWO error:",error);if(rest.status==="completed")await notify("wo_completed","WO Completed",wo.wo_id+" completed","admin");}),
    deleteWO:withSync(async(id)=>{const{error}=await sb().from("work_orders").delete().eq("id",id);if(error)console.error("deleteWO error:",error);}),
    createPO:withSync(async(po)=>{const{data:all}=await sb().from("purchase_orders").select("po_id");const id=genPO(all||[]);await sb().from("purchase_orders").insert({...po,po_id:id,requested_by:appUser.name,status:"pending"});await notify("po_requested","PO Requested",id+" — $"+po.amount+" by "+appUser.name,"manager");}),
    updatePO:withSync(async(po)=>{const{id,...rest}=po;await sb().from("purchase_orders").update(rest).eq("id",id);}),
    addTime:withSync(async(te)=>{await sb().from("time_entries").insert({...te,technician:appUser.name,logged_date:te.logged_date||new Date().toISOString().slice(0,10)});}),
    updateTime:withSync(async(te)=>{const{id,...rest}=te;await sb().from("time_entries").update(rest).eq("id",id);}),
    deleteTime:withSync(async(id)=>{await sb().from("time_entries").delete().eq("id",id);}),
    addPhoto:withSync(async(ph)=>{await sb().from("photos").insert({...ph,uploaded_by:appUser.name,drive_synced:true});}),
    addUser:withSync(async(u)=>{await sb().from("users").insert(u);}),
    updateUser:withSync(async(u)=>{const{id,...rest}=u;await sb().from("users").update(rest).eq("id",id);}),
    deleteUser:withSync(async(id)=>{await sb().from("users").delete().eq("id",id);}),
    addTemplate:withSync(async(t)=>{await sb().from("recurring_templates").insert(t);}),
    deleteTemplate:withSync(async(id)=>{await sb().from("recurring_templates").delete().eq("id",id);}),
    addCustomer:withSync(async(c)=>{await sb().from("customers").insert(c);}),
    updateCustomer:withSync(async(c)=>{const{id,...rest}=c;await sb().from("customers").update(rest).eq("id",id);}),
    deleteCustomer:withSync(async(id)=>{await sb().from("customers").delete().eq("id",id);}),
    markRead:withSync(async()=>{await sb().from("notifications").update({read:true}).eq("read",false);}),
  };

  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F}}><Logo size="large"/><div style={{marginTop:20}}><Spinner/></div><div style={{color:B.textDim,fontSize:12,marginTop:10}}>Connecting...</div></div>);
  if(authUser&&data?.users?.length===0)return <FirstSetup authUser={authUser} onDone={loadData}/>;
  if(!appUser)return <LoginScreen authUser={authUser} loading={false}/>;
  const p={user:appUser,onLogout:async()=>{await sb().auth.signOut();setAppUser(null);setAuthUser(null);},D:data,A:actions,syncing};
  if(appUser.role==="admin")return <AdminDash {...p}/>;
  if(appUser.role==="manager")return <MgrDash {...p}/>;
  return <TechDash {...p}/>;
}
