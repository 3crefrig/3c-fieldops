import React from "react";
import { useState, useEffect, useCallback } from "react";

/*
 * 3C Refrigeration FieldOps Pro
 * Google Sheets + Google Sign-In Edition
 * 
 * - Users sign in with their Gmail account
 * - Admin creates users in the app and assigns roles
 * - If your Gmail isn't in the Users sheet, you can't get in
 * - All data lives in Google Sheets
 */

// ═══════════════════════════════════════════
// CONFIG — Fill these in during setup
// ═══════════════════════════════════════════
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw2nEc-vo1BBdvil-x8Om4dKCM_ihBJXYuwiQfdoWXBEceVh39c6sF-i9FpYSBAKb28Zg/exec",
  GOOGLE_CLIENT_ID: "953685953148-o6pgbedpsasqi2aqmoiglqu433h0coue.apps.googleusercontent.com
  ",
};

// ═══════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════
const B = {
  bg:"#101214",surface:"#1A1D21",surfaceActive:"#2A2F35",
  border:"#2E3338",text:"#E8EAED",textMuted:"#8B929A",textDim:"#5E656E",
  cyan:"#00D4F5",cyanDark:"#00A5C0",cyanGlow:"rgba(0,212,245,0.12)",
  red:"#FF4757",orange:"#FFA040",green:"#26D9A2",purple:"#A78BFA",
  greenGlow:"rgba(38,217,162,0.15)",orangeGlow:"rgba(255,160,64,0.15)",
};
const F="'Barlow',sans-serif", M="'JetBrains Mono',monospace";
const ROLES={
  admin:{label:"Admin",color:B.red,grad:`linear-gradient(135deg,${B.red},#C0392B)`},
  manager:{label:"Manager",color:B.green,grad:`linear-gradient(135deg,${B.green},#1A9A73)`},
  technician:{label:"Technician",color:B.cyan,grad:`linear-gradient(135deg,${B.cyan},${B.cyanDark})`},
};
const PC={high:B.red,medium:B.orange,low:B.green};
const SC={pending:B.orange,in_progress:B.cyan,completed:B.green};
const SL={pending:"Pending",in_progress:"In Progress",completed:"Completed"};
const PSC={pending:B.orange,approved:B.green,rejected:B.red,revised:B.purple};
const PSL={pending:"Pending",approved:"Approved",rejected:"Rejected",revised:"Revised"};
const IS={width:"100%",padding:"10px 12px",borderRadius:6,border:"1px solid "+B.border,background:B.bg,color:B.text,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"};
const LS={fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:4,display:"block"};
const BP={padding:"10px 18px",borderRadius:6,border:"none",background:B.cyan,color:B.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F};
const BS={padding:"10px 18px",borderRadius:6,border:"1px solid "+B.border,background:B.bg,color:B.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F};

// ═══════════════════════════════════════════
// GOOGLE SIGN-IN HELPER
// ═══════════════════════════════════════════
function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ═══════════════════════════════════════════
// API LAYER
// ═══════════════════════════════════════════
const api = {
  async call(action, data = {}) {
    const resp = await fetch(CONFIG.SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...data }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    return json;
  },
  getAll: () => api.call("getAll"),
  addWorkOrder: (wo) => api.call("addWorkOrder", { wo }),
  updateWorkOrder: (wo) => api.call("updateWorkOrder", { wo }),
  addPO: (po) => api.call("addPO", { po }),
  updatePO: (po) => api.call("updatePO", { po }),
  addTimeEntry: (te) => api.call("addTimeEntry", { te }),
  addPhoto: (ph) => api.call("addPhoto", { ph }),
  addUser: (u) => api.call("addUser", { user: u }),
  updateUser: (u) => api.call("updateUser", { user: u }),
  deleteUser: (id) => api.call("deleteUser", { userId: id }),
};

function genPO(list){
  const n=new Date(),pfx=String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0");
  const mx=list.filter(p=>p.PO_ID&&p.PO_ID.startsWith(pfx)).reduce((m,p)=>{const s=parseInt(p.PO_ID.slice(4));return s>m?s:m;},0);
  return pfx+String(mx+1).padStart(2,"0");
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
function Logo({size}){
  const h=size==="large"?56:28,w=Math.round(240*(h/56));
  return(<svg width={w} height={h} viewBox="0 0 240 56" fill="none" style={{display:"block"}}>
    <text x="0" y="36" fontFamily="Barlow,sans-serif" fontWeight="900" fontSize="42" fill="#FFF" letterSpacing="-2">3C</text>
    <g transform="translate(62,6)"><line x1="14" y1="0" x2="14" y2="28" stroke={B.cyan} strokeWidth="2.4" strokeLinecap="round"/><line x1="0" y1="14" x2="28" y2="14" stroke={B.cyan} strokeWidth="2.4" strokeLinecap="round"/><line x1="4" y1="4" x2="24" y2="24" stroke={B.cyan} strokeWidth="1.6" strokeLinecap="round"/><line x1="24" y1="4" x2="4" y2="24" stroke={B.cyan} strokeWidth="1.6" strokeLinecap="round"/><circle cx="14" cy="14" r="3" fill={B.bg} stroke={B.cyan} strokeWidth="1.8"/></g>
    <rect x="94" y="16" width="142" height="20" rx="2" fill={B.cyan}/>
    <text x="100" y="30.5" fontFamily="Barlow,sans-serif" fontWeight="800" fontSize="11" fill={B.bg} letterSpacing="5">REFRIGERATION</text>
  </svg>);
}
function Badge({color,children}){return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,background:color+"22",color,fontSize:10,fontWeight:700,textTransform:"uppercase",fontFamily:F}}>{children}</span>;}
function Card({children,onClick,style}){return <div onClick={onClick} style={{background:B.surface,borderRadius:8,padding:18,border:"1px solid "+B.border,cursor:onClick?"pointer":"default",transition:"border-color .2s",...style}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=B.cyan+"60"}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.border}}>{children}</div>;}
function StatCard({label,value,icon,color}){return <Card style={{flex:"1 1 120px",minWidth:120,borderLeft:"3px solid "+color,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:8,right:10,fontSize:22,opacity:.12}}>{icon}</div><div style={{fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:28,fontWeight:900,color,marginTop:2,fontFamily:M}}>{value}</div></Card>;}
function Modal({title,onClose,children,wide}){return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}}><div style={{background:B.surface,borderRadius:12,padding:24,width:"90%",maxWidth:wide?560:420,maxHeight:"85vh",overflowY:"auto",border:"1px solid "+B.border}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><h3 style={{margin:0,fontSize:16,fontWeight:800,color:B.text}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:B.textDim,fontSize:20,cursor:"pointer"}}>×</button></div>{children}</div></div>;}
function Toast({msg}){if(!msg)return null;return <div style={{position:"fixed",top:16,right:16,zIndex:2000,background:B.cyan,color:B.bg,padding:"10px 18px",borderRadius:8,fontSize:13,fontWeight:700}}>✓ {msg}</div>;}
function DSBadge({ok}){return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 6px",borderRadius:4,background:ok?B.greenGlow:B.orangeGlow,color:ok?B.green:B.orange,fontSize:9,fontWeight:700,textTransform:"uppercase"}}><span style={{width:5,height:5,borderRadius:"50%",background:ok?B.green:B.orange}}/>{ok?"Synced":"Pending"}</span>;}
function Spinner(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid "+B.border,borderTopColor:B.cyan,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}

// ═══════════════════════════════════════════
// GOOGLE SIGN-IN SCREEN
// ═══════════════════════════════════════════
function LoginScreen({onLogin,users,onFirstAdmin}){
  const[status,setStatus]=useState("loading"); // loading, ready, denied, first_setup
  const[googleUser,setGoogleUser]=useState(null);
  const[err,setErr]=useState("");

  const btnRef=useCallback(node=>{
    if(!node||!window.google?.accounts)return;
    try{
      window.google.accounts.id.renderButton(
        node,
        {theme:"filled_black",size:"large",width:320,text:"signin_with",shape:"pill"}
      );
    }catch(e){console.error("renderButton error",e);}
  },[]);

  useEffect(()=>{
    loadGoogleScript().then(()=>{
      if(users.length===0){setStatus("first_setup");return;}
      window.google.accounts.id.initialize({
        client_id:CONFIG.GOOGLE_CLIENT_ID,
        callback:(resp)=>{
          const payload=JSON.parse(atob(resp.credential.split(".")[1]));
          const email=payload.email.toLowerCase();
          const name=payload.name||email;
          const picture=payload.picture||"";
          const match=users.find(u=>u.Email.toLowerCase()===email&&u.Active!=="FALSE");
          if(match){
            onLogin({...match,GoogleName:name,GooglePic:picture});
          }else{
            setGoogleUser({email,name,picture});
            setStatus("denied");
          }
        },
      });
      setStatus("ready");
    });
  },[users]);

  // First-time setup: no users exist, create the first admin
  const[setupEmail,setSetupEmail]=useState(""),[setupName,setSetupName]=useState(""),[saving,setSaving]=useState(false);
  const doSetup=async()=>{if(!setupEmail.trim()||!setupName.trim()||saving)return;setSaving(true);await onFirstAdmin({Name:setupName.trim(),Email:setupEmail.trim().toLowerCase()});setSaving(false);};

  return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:F}}>
    <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>
      <div style={{display:"inline-block",marginBottom:20}}><Logo size="large"/></div>
      <div style={{width:60,height:2,background:B.cyan,margin:"0 auto 14px",borderRadius:1}}/>
      <div style={{fontSize:11,color:B.textDim,fontWeight:600,letterSpacing:3,textTransform:"uppercase",marginBottom:30}}>Field Service Platform</div>

      {status==="loading"&&<Spinner/>}

      {status==="ready"&&<Card>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:16}}>Sign in with your Google account</div>
        <div ref={btnRef} style={{display:"flex",justifyContent:"center",minHeight:44}}/>
        <div style={{fontSize:11,color:B.textDim,marginTop:14}}>Your admin must add your Gmail to the system first.</div>
      </Card>}

      {status==="denied"&&<Card>
        <div style={{fontSize:40,marginBottom:10}}>🚫</div>
        <div style={{fontSize:16,fontWeight:800,color:B.red,marginBottom:8}}>Access Denied</div>
        <div style={{fontSize:13,color:B.textMuted,marginBottom:6}}>
          <span style={{fontFamily:M,color:B.text}}>{googleUser?.email}</span> is not registered in this system.
        </div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>Ask your admin to add your Gmail address and assign you a role.</div>
        <button onClick={()=>{setStatus("ready");setGoogleUser(null);setErr("");}} style={{...BS,width:"100%"}}>Try a different account</button>
      </Card>}

      {status==="first_setup"&&<Card>
        <div style={{fontSize:18,fontWeight:800,color:B.cyan,marginBottom:6}}>Welcome to FieldOps Pro</div>
        <div style={{fontSize:12,color:B.textMuted,marginBottom:18}}>No users exist yet. Set up your admin account to get started.</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,textAlign:"left"}}>
          <div><label style={LS}>Your Name</label><input value={setupName} onChange={e=>setSetupName(e.target.value)} placeholder="Sarah Chen" style={IS}/></div>
          <div><label style={LS}>Your Gmail Address</label><input value={setupEmail} onChange={e=>setSetupEmail(e.target.value)} placeholder="sarah@gmail.com" style={IS}/></div>
          <div style={{fontSize:11,color:B.textDim}}>This email will be the admin account. You'll sign in with Google after this.</div>
          <button onClick={doSetup} disabled={saving} style={{...BP,width:"100%",padding:12,background:ROLES.admin.grad,opacity:saving?.6:1}}>{saving?"Creating...":"Create Admin Account"}</button>
        </div>
      </Card>}
    </div></div>);
}

// ═══════════════════════════════════════════
// SHELL / NAV
// ═══════════════════════════════════════════
function Shell({user,onLogout,children,tab,setTab,tabs,syncing}){
  return(<div style={{minHeight:"100vh",background:B.bg,fontFamily:F,color:B.text,display:"flex",flexDirection:"column"}}>
    <div style={{background:B.surface,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+B.border}}>
      <Logo/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {syncing&&<span style={{fontSize:10,color:B.orange}}>syncing...</span>}
        <Badge color={ROLES[user.Role]?ROLES[user.Role].color:B.textDim}>{user.Role}</Badge>
        {user.GooglePic&&<img src={user.GooglePic} alt="" style={{width:24,height:24,borderRadius:"50%"}}/>}
        <span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>{user.Name}</span>
        <button onClick={onLogout} style={{...BS,padding:"5px 10px",fontSize:11}}>Sign Out</button>
      </div>
    </div>
    <div style={{background:B.surface,padding:"0 20px",display:"flex",gap:2,borderBottom:"1px solid "+B.border,overflowX:"auto"}}>{tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 14px",border:"none",background:"none",fontSize:12,fontWeight:600,color:tab===t.key?B.cyan:B.textDim,borderBottom:tab===t.key?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>)}</div>
    <div style={{flex:1,padding:20,overflowY:"auto"}}>{children}</div>
  </div>);
}

// ═══════════════════════════════════════════
// PO REQUEST MODAL
// ═══════════════════════════════════════════
function POReqModal({wo,pos,onCreatePO,onClose}){
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
  const existing=pos.filter(p=>p.WO_ID===wo.WO_ID);
  const go=async()=>{if(!desc.trim()||saving)return;setSaving(true);await onCreatePO({WO_ID:wo.WO_ID,Description:desc.trim(),Amount:parseFloat(amt)||0,Notes:notes.trim()});setSaving(false);onClose();};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}>
      <span style={LS}>Existing POs on {wo.WO_ID}</span>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=><div key={po.PO_ID} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.PO_ID}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.Description} · ${po.Amount}</span></div><Badge color={PSC[po.Status]}>{PSL[po.Status]}</Badge></div>)}</div>
      <div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Parts/Materials</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Compressor refrigerant R-404A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted}}>{wo.WO_ID}</div></div></div>
      <div><label style={LS}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Vendor, shipping, etc." style={IS}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Request New PO"}</button></div>
    </div></Modal>);
}

// ═══════════════════════════════════════════
// PO EDIT + MANAGEMENT
// ═══════════════════════════════════════════
function POEditForm({po,onSave,onClose}){
  const[desc,setDesc]=useState(po.Description),[amt,setAmt]=useState(String(po.Amount)),[notes,setNotes]=useState(po.Notes||""),[status,setStatus]=useState(po.Status),[saving,setSaving]=useState(false);
  const go=async()=>{if(saving)return;setSaving(true);await onSave({...po,Description:desc.trim(),Amount:parseFloat(amt)||0,Notes:notes.trim(),Status:status});setSaving(false);};
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
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const flt=pos.filter(p=>filter==="all"||p.Status===filter);
  const pc=pos.filter(p=>p.Status==="pending").length;
  const approve=async(po)=>{await onUpdatePO({...po,Status:"approved"});msg("PO "+po.PO_ID+" approved");};
  const reject=async(po)=>{await onUpdatePO({...po,Status:"rejected"});msg("PO "+po.PO_ID+" rejected");};
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total POs" value={pos.length} icon="📄" color={B.cyan}/><StatCard label="Pending" value={pc} icon="⏳" color={B.orange}/><StatCard label="Approved" value={pos.filter(p=>p.Status==="approved").length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+pos.filter(p=>p.Status==="approved").reduce((s,p)=>s+(parseFloat(p.Amount)||0),0).toLocaleString()} icon="💰" color={B.purple}/></div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No POs found</div>}
      {flt.map(po=>{const wo=wos.find(o=>o.WO_ID===po.WO_ID);return(
        <Card key={po.PO_ID} style={{padding:"14px 16px",borderLeft:"3px solid "+(PSC[po.Status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontFamily:M,fontWeight:800,fontSize:15,color:B.text}}>{po.PO_ID}</span><Badge color={PSC[po.Status]||B.textDim}>{PSL[po.Status]||po.Status}</Badge><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{po.WO_ID}</span></div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{po.Description}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>By {po.Requested_By} · {po.Created_Date} · <span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(po.Amount||0).toFixed(2)}</span>{wo&&<span> · {wo.Title}</span>}</div>
              {po.Notes&&<div style={{fontSize:11,color:B.orange,marginTop:4,fontStyle:"italic"}}>Note: {po.Notes}</div>}
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>setEditing(po)} style={{...BS,padding:"5px 10px",fontSize:11}}>Edit</button>
              {po.Status==="pending"&&<><button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Approve</button><button onClick={()=>reject(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.red}}>Reject</button></>}
              {po.Status==="rejected"&&<button onClick={()=>approve(po)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Re-approve</button>}
            </div></div></Card>);})}
    </div>
    {editing&&<Modal title={"Edit PO "+editing.PO_ID} onClose={()=>setEditing(null)}><POEditForm po={editing} onSave={async u=>{await onUpdatePO(u);setEditing(null);msg("PO "+u.PO_ID+" updated");}} onClose={()=>setEditing(null)}/></Modal>}
  </div>);
}

// ═══════════════════════════════════════════
// WORK ORDER DETAIL
// ═══════════════════════════════════════════
function SignaturePad({onSign}){
  const canvasRef=useCallback(canvas=>{
    if(!canvas)return;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=B.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=B.cyan;ctx.lineWidth=2;ctx.lineCap="round";ctx.lineJoin="round";
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

function WODetail({wo,onBack,onUpdateWO,canEdit,pos,onCreatePO,timeEntries,onAddTime,photos,onAddPhoto}){
  const[showTime,setShowTime]=useState(false),[showPhoto,setShowPhoto]=useState(false),[showPO,setShowPO]=useState(false),[showComplete,setShowComplete]=useState(false);
  const[tH,setTH]=useState(""),[tD,setTD]=useState(""),[pN,setPN]=useState(""),[note,setNote]=useState("");
  const[toast,setToast]=useState(""),[saving,setSaving]=useState(false);
  const[sigCanvas,setSigCanvas]=useState(null),[sigErr,setSigErr]=useState(""),[compDate,setCompDate]=useState(new Date().toISOString().slice(0,10));
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const woPOs=pos.filter(p=>p.WO_ID===wo.WO_ID);
  const woTime=timeEntries.filter(t=>t.WO_ID===wo.WO_ID);
  const woPhotos=photos.filter(p=>p.WO_ID===wo.WO_ID);
  const addTime=async()=>{const h=parseFloat(tH);if(!h||h<=0||!tD.trim()||saving)return;setSaving(true);await onAddTime({WO_ID:wo.WO_ID,Hours:h,Description:tD.trim()});await onUpdateWO({...wo,Hours_Total:parseFloat(wo.Hours_Total||0)+h});setSaving(false);setTH("");setTD("");setShowTime(false);msg("Logged "+h+"h");};
  const addPhoto=async()=>{if(!pN.trim()||saving)return;setSaving(true);await onAddPhoto({WO_ID:wo.WO_ID,Filename:pN.trim()});setSaving(false);setPN("");setShowPhoto(false);msg("Photo added");};
  const addNote=async()=>{if(!note.trim()||saving)return;setSaving(true);const ts=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});await onUpdateWO({...wo,Notes:(wo.Notes||"")+"\n["+ts+"] "+note.trim()});setSaving(false);setNote("");msg("Note added");};
  const markComplete=async()=>{if(saving)return;if(!compDate){setSigErr("Completion date is required.");return;}if(!sigCanvas||!sigCanvas._getData||!sigCanvas._getData()){setSigErr("Signature required to complete work order.");return;}setSigErr("");setSaving(true);const sig=sigCanvas._getData();await onUpdateWO({...wo,Status:"completed",Date_Completed:compDate,Signature:sig});setSaving(false);setShowComplete(false);msg("Completed & Signed");};
  return(<div><Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:600}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div><span style={{fontFamily:M,fontSize:11,color:B.textDim}}>{wo.WO_ID}</span><h2 style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:B.text}}>{wo.Title}</h2></div>
        <div style={{display:"flex",gap:6}}><Badge color={PC[wo.Priority]}>{wo.Priority}</Badge><DSBadge ok={woPhotos.length>0}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div><span style={LS}>Status</span><br/><Badge color={SC[wo.Status]}>{SL[wo.Status]}</Badge></div>
        <div><span style={LS}>Type</span><br/><Badge color={wo.WO_Type==="PM"?B.cyan:B.orange}>{wo.WO_Type||"—"}</Badge></div>
        <div><span style={LS}>Due</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.Due_Date}</span></div>
        <div><span style={LS}>Assigned</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.Assignee}</span></div>
        <div><span style={LS}>Location / Room</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.Location||"—"}</span></div>
        <div><span style={LS}>Building #</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.Building||"—"}</span></div>
        <div><span style={LS}>Hours</span><br/><span style={{fontSize:13,fontWeight:600,color:B.text}}>{wo.Hours_Total||0}h</span></div>
        {wo.Date_Completed&&<div><span style={LS}>Date Completed</span><br/><span style={{fontSize:13,fontWeight:600,color:B.green}}>{wo.Date_Completed}</span></div>}
      </div>
      {wo.Signature&&<div style={{marginBottom:14}}><span style={LS}>Completion Signature</span><div style={{marginTop:4,background:B.bg,borderRadius:6,border:"1px solid "+B.border,padding:8,display:"inline-block"}}><img src={wo.Signature} alt="Signature" style={{maxWidth:280,height:"auto",display:"block"}}/></div></div>}
      {woPOs.length>0&&<div style={{marginBottom:14}}><span style={LS}>Purchase Orders</span><div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>{woPOs.map(po=><div key={po.PO_ID} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:B.bg,borderRadius:4,border:"1px solid "+B.border}}><div><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:12}}>{po.PO_ID}</span><span style={{color:B.textDim,fontSize:11,marginLeft:6}}>{po.Description}</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:M,fontSize:11,color:B.text}}>${parseFloat(po.Amount||0).toFixed(2)}</span><Badge color={PSC[po.Status]}>{po.Status}</Badge></div></div>)}</div></div>}
      <div style={{background:B.bg,borderRadius:6,padding:14,border:"1px solid "+B.border,marginBottom:14}}><span style={LS}>Job Details</span><p style={{margin:"4px 0 0",color:B.textMuted,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{wo.Notes}</p></div>
      {woTime.length>0&&<div style={{marginBottom:14}}><span style={LS}>Time Entries</span>{woTime.map((te,i)=><div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid "+B.border,fontSize:12}}><span style={{fontFamily:M,color:B.textDim,minWidth:50}}>{te.Logged_Date}</span><span style={{fontFamily:M,color:B.cyan,minWidth:35}}>{te.Hours}h</span><span style={{color:B.textMuted,flex:1}}>{te.Description}</span></div>)}</div>}
      {woPhotos.length>0&&<div style={{marginBottom:14}}><span style={LS}>Photos ({woPhotos.length})</span><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>{woPhotos.map((p,i)=><div key={i} style={{padding:"5px 8px",borderRadius:4,background:B.bg,border:"1px solid "+B.border,fontSize:11,color:B.textMuted,display:"flex",alignItems:"center",gap:4}}>📷 {p.Filename} <DSBadge ok={true}/></div>)}</div></div>}
      {canEdit&&<div style={{display:"flex",gap:6,marginTop:16,flexWrap:"wrap"}}>
        {wo.Status!=="completed"&&<button onClick={()=>{setSigErr("");setShowComplete(true)}} disabled={saving} style={{...BP,flex:"1 1 auto",background:B.green,opacity:saving?.6:1}}>✓ Complete</button>}
        <button onClick={()=>setShowTime(true)} style={{...BS,flex:"1 1 auto"}}>⏱ Time</button>
        <button onClick={()=>setShowPhoto(true)} style={{...BS,flex:"1 1 auto"}}>📷 Photo</button>
        <button onClick={()=>setShowPO(true)} style={{...BS,flex:"1 1 auto"}}>📄 PO#</button>
      </div>}
      {canEdit&&<div style={{display:"flex",gap:6,marginTop:12}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add job note..." style={{...IS,flex:1}} onKeyDown={e=>e.key==="Enter"&&addNote()}/><button onClick={addNote} disabled={saving} style={BP}>Add</button></div>}
    </Card>
    {showTime&&<Modal title="Log Time" onClose={()=>setShowTime(false)}><div style={{display:"flex",flexDirection:"column",gap:12}}><div><label style={LS}>Hours</label><input value={tH} onChange={e=>setTH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Description</label><input value={tD} onChange={e=>setTD(e.target.value)} placeholder="What was done?" style={IS} onKeyDown={e=>e.key==="Enter"&&addTime()}/></div><div style={{display:"flex",gap:8}}><button onClick={()=>setShowTime(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={addTime} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Log"}</button></div></div></Modal>}
    {showPhoto&&<Modal title="Upload Photo" onClose={()=>setShowPhoto(false)}><div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{border:"2px dashed "+B.border,borderRadius:8,padding:30,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontSize:12,color:B.textMuted}}>Tap to capture or select</div></div><div><label style={LS}>Filename</label><input value={pN} onChange={e=>setPN(e.target.value)} placeholder="compressor.jpg" style={IS} onKeyDown={e=>e.key==="Enter"&&addPhoto()}/></div><div style={{display:"flex",gap:8}}><button onClick={()=>setShowPhoto(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={addPhoto} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Upload"}</button></div></div></Modal>}
    {showPO&&<POReqModal wo={wo} pos={pos} onCreatePO={onCreatePO} onClose={()=>setShowPO(false)}/>}
    {showComplete&&<Modal title="Complete Work Order" onClose={()=>setShowComplete(false)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:B.bg,borderRadius:6,padding:12,border:"1px solid "+B.border}}>
          <div style={{fontSize:13,fontWeight:700,color:B.text}}>{wo.WO_ID} — {wo.Title}</div>
        </div>
        <div><label style={LS}>Completion Date <span style={{color:B.red}}>*</span></label><input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)} style={IS}/></div>
        <div><span style={LS}>Technician Signature <span style={{color:B.red}}>*</span></span>
          <div style={{marginTop:4}}><SignaturePad onSign={setSigCanvas}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
            <div style={{fontSize:10,color:B.textDim}}>Draw your signature above</div>
            <button onClick={()=>{if(sigCanvas&&sigCanvas._clear)sigCanvas._clear();setSigErr("");}} style={{background:"none",border:"none",color:B.orange,fontSize:11,cursor:"pointer",fontFamily:F}}>Clear</button>
          </div>
        </div>
        {sigErr&&<div style={{color:B.red,fontSize:12,fontWeight:600}}>{sigErr}</div>}
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowComplete(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={markComplete} disabled={saving} style={{...BP,flex:1,background:B.green,opacity:saving?.6:1}}>{saving?"Saving...":"Sign & Complete"}</button></div>
      </div>
    </Modal>}
  </div>);
}

function CreateWO({onSave,onCancel,users}){
  const[title,setTitle]=useState(""),[pri,setPri]=useState("medium"),[assign,setAssign]=useState("Unassigned"),[due,setDue]=useState(""),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false),[loc,setLoc]=useState(""),[woType,setWoType]=useState("CM"),[bldg,setBldg]=useState("");
  const techs=users.filter(u=>u.Role==="technician"&&u.Active!=="FALSE");
  const go=async()=>{if(!title.trim()||saving)return;setSaving(true);await onSave({Title:title.trim(),Priority:pri,Assignee:assign,Due_Date:due||"TBD",Notes:notes.trim()||"No details.",Location:loc.trim(),WO_Type:woType,Building:bldg.trim()});setSaving(false);};
  return(<div><button onClick={onCancel} style={{background:"none",border:"none",color:B.cyan,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,fontFamily:F}}>← Back</button>
    <Card style={{maxWidth:580}}><h2 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:B.text}}>Create Work Order</h2><div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Walk-in Cooler Repair — Store #14" style={IS}/></div>
      <div><label style={LS}>Location / Room #</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Store #14, Room 3B" style={IS}/></div>
      <div><label style={LS}>Building # <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={bldg} onChange={e=>setBldg(e.target.value)} placeholder="Building A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Priority</label><select value={pri} onChange={e=>setPri(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label style={LS}>Type</label><select value={woType} onChange={e=>setWoType(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="PM">PM (Preventive)</option><option value="CM">CM (Corrective)</option></select></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Due</label><input value={due} onChange={e=>setDue(e.target.value)} type="date" style={IS}/></div><div><label style={LS}>Assignee</label><select value={assign} onChange={e=>setAssign(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Unassigned">Unassigned</option>{techs.map(t=><option key={t.User_ID} value={t.Name}>{t.Name}</option>)}</select></div></div>
      <div><label style={LS}>Details</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Describe the work..." style={{...IS,resize:"vertical",lineHeight:1.5}}/></div>
      <div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Creating...":"Create"}</button></div>
    </div></Card></div>);
}

function WOList({orders,canEdit,pos,onCreatePO,onUpdateWO,onCreateWO,timeEntries,photos,onAddTime,onAddPhoto,users}){
  const[sel,setSel]=useState(null),[filter,setFilter]=useState("all"),[creating,setCreating]=useState(false);
  const flt=orders.filter(o=>filter==="all"||o.Status===filter);
  if(creating&&canEdit)return <CreateWO onSave={async(nw)=>{await onCreateWO(nw);setCreating(false);}} onCancel={()=>setCreating(false)} users={users}/>;
  if(sel){const fresh=orders.find(o=>o.WO_ID===sel.WO_ID)||sel;return <WODetail wo={fresh} onBack={()=>setSel(null)} onUpdateWO={async u=>{await onUpdateWO(u);setSel(u);}} canEdit={canEdit} pos={pos} onCreatePO={onCreatePO} timeEntries={timeEntries} onAddTime={onAddTime} photos={photos} onAddPhoto={onAddPhoto}/>;}
  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
      {[["all","All"],["pending","Pending"],["in_progress","Active"],["completed","Done"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
      {canEdit&&<button onClick={()=>setCreating(true)} style={{...BP,marginLeft:"auto",padding:"7px 14px",fontSize:12}}>+ New Order</button>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No orders</div>}
      {flt.map(wo=>{const wp=pos.filter(p=>p.WO_ID===wo.WO_ID);const wph=photos.filter(p=>p.WO_ID===wo.WO_ID);return(
        <Card key={wo.WO_ID} onClick={()=>setSel(wo)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px"}}>
          <div style={{width:3,height:36,borderRadius:2,background:PC[wo.Priority]||B.textDim,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontFamily:M,fontSize:10,color:B.textDim}}>{wo.WO_ID}</span><Badge color={SC[wo.Status]||B.textDim}>{SL[wo.Status]||wo.Status}</Badge><Badge color={wo.WO_Type==="PM"?B.cyan:B.orange}>{wo.WO_Type||"CM"}</Badge>{wph.length>0&&<span style={{fontSize:10,color:B.textDim}}>📷{wph.length}</span>}{wp.length>0&&<span style={{fontSize:10,color:B.purple}}>📄{wp.length} PO</span>}</div>
            <div style={{fontSize:14,fontWeight:700,color:B.text,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wo.Title}</div>
            {wo.Location&&<div style={{fontSize:11,color:B.textDim,marginTop:1}}>📍 {wo.Location}</div>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:11,color:B.textDim}}>{wo.Assignee}</div><div style={{fontSize:11,fontWeight:600,color:B.textMuted}}>Due {wo.Due_Date}</div></div>
        </Card>);})}
    </div></div>);
}

function SchedView({schedule,userName}){
  const mine=schedule.filter(s=>s.Assigned_To===userName||s.Assigned_To==="All");
  return(<div><h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Today's Schedule</h3><div style={{display:"flex",flexDirection:"column",gap:6}}>{mine.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No schedule entries</div>}{mine.map((s,i)=><Card key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px"}}><span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.textDim,minWidth:50}}>{s.Time}</span><div><div style={{fontSize:13,fontWeight:700,color:B.textMuted}}>{s.Task}</div><div style={{fontSize:11,color:B.textDim}}>{s.Location}</div></div></Card>)}</div></div>);
}
function TimeLog({timeEntries,wos}){
  const tot=timeEntries.reduce((s,e)=>s+parseFloat(e.Hours||0),0);
  return(<div><div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Total" value={tot.toFixed(1)+"h"} icon="⏱" color={B.cyan}/><StatCard label="Entries" value={timeEntries.length} icon="📝" color={B.green}/></div>
    {timeEntries.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No entries yet</div>}
    {timeEntries.map((e,i)=>{const wo=wos.find(o=>o.WO_ID===e.WO_ID);return <Card key={i} style={{padding:"10px 14px",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:M,fontSize:11,color:B.textDim,minWidth:70}}>{e.Logged_Date}</span><span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.cyan,minWidth:35}}>{e.Hours}h</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.Description}</div><div style={{fontSize:10,color:B.textDim}}>{e.WO_ID}{wo&&" — "+wo.Title}</div></div></div></Card>;})}
  </div>);
}

function UserMgmt({users,onAddUser,onUpdateUser,onDeleteUser,cur}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[search,setSearch]=useState(""),[rf,setRf]=useState("all"),[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const save=async d=>{if(editing){await onUpdateUser({...editing,...d});msg("Updated "+d.Name);}else{await onAddUser(d);msg("Created "+d.Name);}setShowForm(false);setEditing(null);};
  const filtered=users.filter(u=>(rf==="all"||u.Role===rf)&&(u.Name.toLowerCase().includes(search.toLowerCase())||(u.Email||"").toLowerCase().includes(search.toLowerCase())));
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}><button onClick={()=>{setEditing(null);setShowForm(true)}} style={{...BP,padding:"8px 14px",fontSize:12}}>+ New User</button><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...IS,flex:1,minWidth:150,padding:"8px 12px",fontSize:12}}/>{[["all","All"],["admin","Admin"],["manager","Mgr"],["technician","Tech"]].map(([k,l])=><button key={k} onClick={()=>setRf(k)} style={{padding:"6px 10px",borderRadius:4,border:"1px solid "+(rf===k?B.cyan:B.border),background:rf===k?B.cyanGlow:"transparent",color:rf===k?B.cyan:B.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>{filtered.map(u=><Card key={u.User_ID} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:"3px solid "+(ROLES[u.Role]?ROLES[u.Role].color:B.textDim)}}><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{u.Name}</div><div style={{fontSize:11,color:B.textDim}}>{u.Email} · <Badge color={ROLES[u.Role]?ROLES[u.Role].color:B.textDim}>{u.Role}</Badge></div></div><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={()=>{setEditing(u);setShowForm(true)}} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button>{u.User_ID!==cur.User_ID&&<button onClick={async()=>{await onDeleteUser(u.User_ID);msg("Deleted "+u.Name)}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button>}</div></Card>)}</div>
    {showForm&&<UserForm user={editing} onSave={save} onClose={()=>{setShowForm(false);setEditing(null)}}/>}
  </div>);
}

function UserForm({user,onSave,onClose}){
  const[n,setN]=useState(user?.Name||""),[e,setE]=useState(user?.Email||""),[r,setR]=useState(user?.Role||"technician"),[saving,setSaving]=useState(false);
  const go=async()=>{if(!n.trim()||!e.trim()||saving)return;setSaving(true);await onSave({Name:n.trim(),Email:e.trim().toLowerCase(),Role:r,Active:"TRUE"});setSaving(false);};
  return(<Modal title={user?"Edit User":"Add New User"} onClose={onClose}><div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Full Name</label><input value={n} onChange={ev=>setN(ev.target.value)} placeholder="Mike Johnson" style={IS}/></div>
    <div><label style={LS}>Gmail Address</label><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="mike@gmail.com" style={IS}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>This must match their Google account email exactly.</div></div>
    <div><label style={LS}>Role</label><select value={r} onChange={ev=>setR(ev.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(user?"Save":"Add User")}</button></div>
  </div></Modal>);
}

function Settings(){return(<div><h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>System Settings</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>{[["🔔","Notifications"],["📱","Devices"],["🔐","Security"],["☁️","Drive Sync"],["📊","Reports"],["🏢","Company"],["📋","Templates"],["🔧","Integrations"]].map(([ic,lb])=><Card key={lb} style={{padding:"18px 14px",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:24,marginBottom:6}}>{ic}</div><div style={{fontSize:12,fontWeight:600,color:B.textMuted}}>{lb}</div></Card>)}</div></div>);}

// ═══════════════════════════════════════════
// DASHBOARDS — Tech, Manager, Admin
// ═══════════════════════════════════════════
function TechDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("orders");
  const my=D.wos.filter(o=>o.Assignee===user.Name);
  const myTime=D.time.filter(t=>t.Technician===user.Name);
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} tabs={[{key:"orders",label:"Work Orders",icon:"📋"},{key:"schedule",label:"Schedule",icon:"📅"},{key:"time",label:"Time Log",icon:"⏱"}]}>
    {tab==="orders"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Active" value={my.filter(o=>o.Status!=="completed").length} icon="📋" color={B.cyan}/><StatCard label="Hours" value={my.reduce((s,o)=>s+parseFloat(o.Hours_Total||0),0).toFixed(1)+"h"} icon="⏱" color={B.green}/><StatCard label="Done" value={my.filter(o=>o.Status==="completed").length} icon="✓" color={B.green}/></div><WOList orders={my} canEdit={true} pos={D.pos} onCreatePO={A.createPO} onUpdateWO={A.updateWO} onCreateWO={A.createWO} timeEntries={D.time} photos={D.photos} onAddTime={A.addTime} onAddPhoto={A.addPhoto} users={D.users}/></>}
    {tab==="schedule"&&<SchedView schedule={D.schedule} userName={user.Name}/>}
    {tab==="time"&&<TimeLog timeEntries={myTime} wos={D.wos}/>}
  </Shell>);
}

function MgrDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onAddPhoto:A.addPhoto,users:D.users};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"Work Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"team",label:"Team",icon:"👥"},{key:"users",label:"Users",icon:"👤"}]}>
    {tab==="overview"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Open" value={D.wos.filter(o=>o.Status!=="completed").length} icon="📋" color={B.red}/><StatCard label="Active" value={D.wos.filter(o=>o.Status==="in_progress").length} icon="🔄" color={B.orange}/><StatCard label="Pending POs" value={D.pos.filter(p=>p.Status==="pending").length} icon="📄" color={B.purple}/><StatCard label="Hours" value={D.wos.reduce((s,o)=>s+parseFloat(o.Hours_Total||0),0).toFixed(1)+"h"} icon="⏱" color={B.cyan}/></div><h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:B.text}}>High Priority</h3><WOList orders={D.wos.filter(o=>o.Priority==="high")} {...wlp}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{D.users.filter(u=>u.Role==="technician"&&u.Active!=="FALSE").map(t=>{const to=D.wos.filter(o=>o.Assignee===t.Name);return(<Card key={t.User_ID} style={{padding:"14px 18px"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:8,background:ROLES.technician.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800}}>{t.Name.split(" ").map(n=>n[0]).join("")}</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:B.text}}>{t.Name}</div><div style={{fontSize:11,color:B.textDim}}>{to.filter(o=>o.Status==="in_progress").length} active · {to.filter(o=>o.Status==="completed").length} done · {to.reduce((s,o)=>s+parseFloat(o.Hours_Total||0),0).toFixed(1)}h</div></div><Badge color={B.green}>On Duty</Badge></div></Card>);})}</div>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
  </Shell>);
}

function AdminDash({user,onLogout,D,A,syncing}){
  const[tab,setTab]=useState("overview");
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onAddPhoto:A.addPhoto,users:D.users};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"orders",label:"All Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"users",label:"Users",icon:"👤"},{key:"settings",label:"Settings",icon:"⚙️"}]}>
    {tab==="overview"&&<><div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}><StatCard label="Total" value={D.wos.length} icon="📋" color={B.cyan}/><StatCard label="Pending POs" value={D.pos.filter(p=>p.Status==="pending").length} icon="📄" color={B.purple}/><StatCard label="Urgent" value={D.wos.filter(o=>o.Priority==="high").length} icon="🔴" color={B.red}/><StatCard label="Done" value={D.wos.length>0?Math.round(D.wos.filter(o=>o.Status==="completed").length/D.wos.length*100)+"%":"0%"} icon="📈" color={B.green}/></div><WOList orders={D.wos} {...wlp}/></>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} wos={D.wos}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="settings"&&<Settings/>}
  </Shell>);
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App(){
  const[user,setUser]=useState(null);
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[syncing,setSyncing]=useState(false);

  const loadData=useCallback(async()=>{
    try{
      const resp=await api.getAll();
      setData({
        wos:resp.Work_Orders||[],
        pos:resp.Purchase_Orders||[],
        time:resp.Time_Entries||[],
        photos:resp.Photos||[],
        users:resp.Users||[],
        schedule:resp.Schedule||[],
      });
      setError(null);
    }catch(err){
      setError("Could not connect to Google Sheets. Check your Apps Script URL.");
      console.error(err);
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{loadData();},[loadData]);
  useEffect(()=>{if(!user)return;const iv=setInterval(()=>{loadData();},30000);return()=>clearInterval(iv);},[user,loadData]);

  const withSync=fn=>async(...args)=>{setSyncing(true);try{await fn(...args);await loadData();}finally{setSyncing(false);}};

  const actions={
    createWO:withSync(async(wo)=>{
      const nid=data.wos.length>0?Math.max(...data.wos.map(o=>parseInt(o.WO_ID.replace("WO-",""))||0))+1:1001;
      await api.addWorkOrder({...wo,WO_ID:"WO-"+nid,Status:"pending",Hours_Total:0,Date_Completed:"",Created_Date:new Date().toISOString().slice(0,10)});
    }),
    updateWO:withSync(async(wo)=>{await api.updateWorkOrder(wo);}),
    createPO:withSync(async(po)=>{
      const id=genPO(data.pos);
      await api.addPO({...po,PO_ID:id,Requested_By:user.Name,Status:"pending",Created_Date:new Date().toISOString().slice(0,10)});
    }),
    updatePO:withSync(async(po)=>{await api.updatePO(po);}),
    addTime:withSync(async(te)=>{
      const nid="TE-"+String(data.time.length+1).padStart(3,"0");
      await api.addTimeEntry({...te,Entry_ID:nid,Technician:user.Name,Logged_Date:new Date().toISOString().slice(0,10)});
    }),
    addPhoto:withSync(async(ph)=>{
      const nid="PH-"+String(data.photos.length+1).padStart(3,"0");
      await api.addPhoto({...ph,Photo_ID:nid,Uploaded_By:user.Name,Drive_Synced:"TRUE",Upload_Date:new Date().toISOString().slice(0,10)});
    }),
    addUser:withSync(async(u)=>{
      const nid="USR-"+String(data.users.length+1).padStart(3,"0");
      await api.addUser({...u,User_ID:nid});
    }),
    updateUser:withSync(async(u)=>{await api.updateUser(u);}),
    deleteUser:withSync(async(id)=>{await api.deleteUser(id);}),
  };

  // First-time admin setup
  const handleFirstAdmin=async({Name,Email})=>{
    setSyncing(true);
    try{
      await api.addUser({User_ID:"USR-001",Name,Email,Role:"admin",Active:"TRUE"});
      await loadData();
    }finally{setSyncing(false);}
  };

  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F}}>
    <Logo size="large"/><div style={{marginTop:20}}><Spinner/></div><div style={{color:B.textDim,fontSize:12,marginTop:10}}>Connecting to Google Sheets...</div></div>);

  if(error)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,padding:20}}>
    <Logo size="large"/><div style={{marginTop:20,color:B.red,fontSize:14,fontWeight:600,textAlign:"center",maxWidth:400}}>{error}</div>
    <button onClick={()=>{setLoading(true);setError(null);loadData();}} style={{...BP,marginTop:16}}>Retry</button></div>);

  if(!user)return <LoginScreen onLogin={setUser} users={data?.users||[]} onFirstAdmin={handleFirstAdmin}/>;

  const p={user,onLogout:()=>{setUser(null);window.google?.accounts?.id?.disableAutoSelect();},D:data,A:actions,syncing};
  if(user.Role==="admin")return <AdminDash {...p}/>;
  if(user.Role==="manager")return <MgrDash {...p}/>;
  return <TechDash {...p}/>;
}
