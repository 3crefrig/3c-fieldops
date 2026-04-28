import React, { useState, useEffect, useRef } from "react";
import { B, F, M, IS, LS, BP, BS, haptic } from "../shared";

export function Logo({size,onClick}){const h=size==="large"?56:32;return(<img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C Refrigeration" style={{height:h,display:"block",cursor:onClick?"pointer":"default",transition:"opacity .2s"}} onClick={onClick}/>);}
export function Badge({color,children}){return <span style={{display:"inline-block",padding:"4px 10px",borderRadius:20,background:color+"18",color,fontSize:11,fontWeight:700,textTransform:"uppercase",fontFamily:F,letterSpacing:0.3,border:"1px solid "+color+"30",animation:"badgePop .2s ease-out"}}>{children}</span>;}
export function Card({children,onClick,style}){return <div onClick={onClick} className={onClick?"card-hover":""} style={{background:B.surface,borderRadius:10,padding:18,border:"1px solid "+B.border,cursor:onClick?"pointer":"default",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",transition:"border-color .2s, box-shadow .2s, transform .15s",animation:"slideUp .25s ease-out",...style}} onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor=B.cyan+"60";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)";}}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.border;e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.08)";}}>{children}</div>;}
export function StatCard({label,value,icon,color}){return <Card style={{flex:"1 1 130px",minWidth:130,borderLeft:"3px solid "+color,position:"relative",overflow:"hidden",padding:"16px 18px"}}><div style={{position:"absolute",top:-4,right:-4,fontSize:36,opacity:.06,transform:"rotate(-12deg)"}}>{icon}</div><div style={{fontSize:9,color:B.textDim,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{label}</div><div style={{fontSize:30,fontWeight:900,color,fontFamily:M,lineHeight:1,letterSpacing:-0.5}}>{value}</div></Card>;}
export function Modal({title,onClose,children,wide}){return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",animation:"fadeIn .15s ease-out",padding:"max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))",boxSizing:"border-box"}}><div className="modal-card" style={{background:B.surface,borderRadius:14,padding:28,width:"92%",maxWidth:wide?620:440,overflowY:"auto",border:"1px solid "+B.border,boxShadow:"0 20px 60px rgba(0,0,0,0.4)",animation:"modalIn .2s ease-out"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{margin:0,fontSize:17,fontWeight:800,color:B.text,letterSpacing:-0.2}}>{title}</h3><button onClick={onClose} aria-label="Close" style={{background:B.bg,border:"1px solid "+B.border,color:B.textMuted,width:28,height:28,borderRadius:8,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=B.surfaceActive} onMouseLeave={e=>e.currentTarget.style.background=B.bg}>×</button></div>{children}</div></div>;}
export function Toast({msg}){useEffect(()=>{if(msg)haptic(30);},[msg]);if(!msg)return null;return <div style={{position:"fixed",top:16,right:16,zIndex:2000,background:B.cyan,color:B.bg,padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,212,245,0.3)",animation:"toastIn .25s ease-out"}}>✓ {msg}</div>;}
export function CustomSelect({value,onChange,options,placeholder,style:sx}){
  const[open,setOpen]=useState(false);const ref=useRef(null);const[search,setSearch]=useState("");
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};const k=e=>{if(e.key==="Escape")setOpen(false);};document.addEventListener("mousedown",h);document.addEventListener("keydown",k);return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("keydown",k);};},[]);
  const sel=options.find(o=>o.value===value);
  const filtered=search?options.filter(o=>(o.label||"").toLowerCase().includes(search.toLowerCase())):options;
  return(<div ref={ref} style={{position:"relative",...sx}}>
    <div onClick={()=>{setOpen(!open);setSearch("");}} style={{...IS,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",minHeight:38}}>
      <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
        {sel?<>{sel.badge&&<span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:sel.badge,flexShrink:0,boxShadow:"0 0 6px "+sel.badge+"80"}}/>}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13,color:B.text}}>{sel.label}</span></>:<span style={{color:B.textDim,fontSize:13}}>{placeholder||"— Select —"}</span>}
      </div>
      <span style={{color:B.textDim,fontSize:10,flexShrink:0,marginLeft:8}}>{open?"▲":"▼"}</span>
    </div>
    {open&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:B.surface,border:"1px solid "+B.border,borderRadius:8,marginTop:4,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",maxHeight:260,overflowY:"auto",animation:"fadeIn .12s ease-out"}}>
      {options.length>5&&<div style={{padding:"6px 8px",borderBottom:"1px solid "+B.border}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." autoFocus style={{...IS,padding:"6px 10px",fontSize:12,width:"100%",boxSizing:"border-box"}}/></div>}
      {filtered.length===0&&<div style={{padding:"12px 16px",fontSize:12,color:B.textDim,textAlign:"center"}}>No results</div>}
      {filtered.map(o=><div key={o.value} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",borderBottom:"1px solid "+B.border+"40",background:o.value===value?B.cyanGlow:"transparent",transition:"background .1s"}} onMouseEnter={e=>{if(o.value!==value)e.currentTarget.style.background=B.bg;}} onMouseLeave={e=>{e.currentTarget.style.background=o.value===value?B.cyanGlow:"transparent";}}>
        {o.badge&&<span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:o.badge,flexShrink:0,boxShadow:"0 0 6px "+o.badge+"80"}}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:o.value===value?700:500,color:o.value===value?B.cyan:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</div>
          {o.sub&&<div style={{fontSize:10,color:B.textDim,marginTop:1}}>{o.sub}</div>}
        </div>
        {o.tag&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:o.tagColor+"20",color:o.tagColor,border:"1px solid "+o.tagColor+"30",flexShrink:0}}>{o.tag}</span>}
      </div>)}
    </div>}
  </div>);
}
export function ConfirmDialog({message,onConfirm,onCancel,confirmLabel,danger}){return<Modal title="Confirm" onClose={onCancel}><div style={{textAlign:"center",padding:"8px 0"}}><div style={{fontSize:32,marginBottom:8}}>{danger?"⚠️":"❓"}</div><div style={{fontSize:13,color:B.text,marginBottom:16,lineHeight:1.5}}>{message}</div><div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={onConfirm} style={{...BP,flex:1,background:danger?B.red:B.cyan}}>{confirmLabel||"Confirm"}</button></div></div></Modal>;}
export function DSBadge({ok}){return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:ok?B.greenGlow:B.orangeGlow,color:ok?B.green:B.orange,fontSize:9,fontWeight:700,textTransform:"uppercase",border:"1px solid "+(ok?B.green:B.orange)+"25"}}><span style={{width:5,height:5,borderRadius:"50%",background:ok?B.green:B.orange}}/>{ok?"Synced":"Pending"}</span>;}
export function Spinner(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid "+B.border,borderTopColor:B.cyan,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>;}
export function SkeletonCard(){return <div style={{background:B.surface,borderRadius:10,padding:18,border:"1px solid "+B.border,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}><div style={{height:10,width:"40%",borderRadius:4,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /><div style={{height:18,width:"70%",borderRadius:4,marginTop:10,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /><div style={{height:10,width:"55%",borderRadius:4,marginTop:10,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /></div>;}
export function SkeletonLoader({count}){return <div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeIn .3s ease-out"}}>{Array.from({length:count||3}).map((_,i)=><SkeletonCard key={i}/>)}</div>;}
export function EmptyState({icon,title,subtitle}){return <div style={{textAlign:"center",padding:"48px 24px",animation:"fadeIn .3s ease-out"}}><div style={{fontSize:40,marginBottom:12,opacity:0.8}}>{icon||"📭"}</div><div style={{fontSize:16,fontWeight:700,color:B.text,marginBottom:6}}>{title||"Nothing here yet"}</div><div style={{fontSize:12,color:B.textDim,lineHeight:1.5,maxWidth:260,margin:"0 auto"}}>{subtitle||""}</div></div>;}
export function GlobalSearch({data,onNavigateWO,setTab}){
  const[q,setQ]=useState("");
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};const k=e=>{if(e.key==="Escape"){setOpen(false);setQ("");}if((e.key==="k"||e.key==="K")&&(e.metaKey||e.ctrlKey)){e.preventDefault();ref.current?.querySelector("input")?.focus();}};document.addEventListener("mousedown",h);document.addEventListener("keydown",k);return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("keydown",k);};},[]);
  const query=q.trim().toLowerCase();
  const results=!query?null:(()=>{
    const r=[];const cap=8;
    const matches=(...fields)=>fields.some(v=>v&&String(v).toLowerCase().includes(query));
    (data?.wos||[]).forEach(w=>{if(r.length>=cap*4)return;if(matches(w.wo_id,w.title,w.customer,w.customer_wo,w.location,w.assignee))r.push({kind:"wo",icon:"📋",title:w.wo_id+" — "+w.title,sub:[w.customer,w.status,w.assignee].filter(Boolean).join(" · "),color:w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange,onClick:()=>{if(onNavigateWO)onNavigateWO(w.id);setOpen(false);setQ("");}});});
    (data?.pos||[]).forEach(p=>{if(r.length>=cap*4)return;if(matches(p.po_id,p.description,p.requested_by))r.push({kind:"po",icon:"🧾",title:p.po_id+" — $"+parseFloat(p.amount||0).toFixed(0),sub:(p.description||"").slice(0,60)+" · "+p.status,color:p.status==="approved"?B.green:p.status==="rejected"?B.red:B.orange,onClick:()=>{setTab&&setTab("pos");setOpen(false);setQ("");}});});
    (data?.customers||[]).forEach(c=>{if(r.length>=cap*4)return;if(matches(c.name,c.contact_name,c.email,c.phone))r.push({kind:"customer",icon:"👤",title:c.name,sub:[c.contact_name,c.phone].filter(Boolean).join(" · "),color:B.purple,onClick:()=>{setTab&&setTab("customers");setOpen(false);setQ("");}});});
    (data?.equipment||[]).forEach(e=>{if(r.length>=cap*4)return;if(matches(e.model,e.manufacturer,e.serial_number,e.asset_tag,e.customer_name))r.push({kind:"equipment",icon:"🔧",title:(e.model||"Equipment")+(e.asset_tag?" · "+e.asset_tag:""),sub:[e.customer_name,e.manufacturer,e.serial_number].filter(Boolean).join(" · "),color:B.cyan,onClick:()=>{setTab&&setTab("equipment");setOpen(false);setQ("");}});});
    (data?.projects||[]).forEach(p=>{if(r.length>=cap*4)return;if(matches(p.name,p.customer,p.location))r.push({kind:"project",icon:"🏗️",title:p.name,sub:[p.customer,p.status].filter(Boolean).join(" · "),color:B.orange,onClick:()=>{setTab&&setTab("projects");setOpen(false);setQ("");}});});
    const order={wo:0,po:1,customer:2,equipment:3,project:4};
    return r.sort((a,b)=>(order[a.kind]||9)-(order[b.kind]||9)).slice(0,20);
  })();
  const grouped=results?results.reduce((acc,r)=>{(acc[r.kind]=acc[r.kind]||[]).push(r);return acc;},{}):null;
  const groupLabel={wo:"Work Orders",po:"Purchase Orders",customer:"Customers",equipment:"Equipment",project:"Projects"};
  return(<div ref={ref} style={{position:"relative",flex:"0 1 auto",minWidth:0}}>
    <div style={{display:"flex",alignItems:"center",gap:6,background:B.bg,border:"1px solid "+B.border,borderRadius:8,padding:"5px 10px",minWidth:180,maxWidth:280}}>
      <span style={{color:B.textDim,fontSize:12}}>🔍</span>
      <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>q&&setOpen(true)} placeholder="Search WO, PO, customer…" style={{background:"transparent",border:"none",outline:"none",color:B.text,fontSize:12,fontFamily:F,flex:1,minWidth:0,padding:0}}/>
      {q&&<button onClick={()=>{setQ("");setOpen(false);}} style={{background:"none",border:"none",color:B.textDim,fontSize:14,cursor:"pointer",padding:0,lineHeight:1}}>×</button>}
    </div>
    {open&&query&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,minWidth:320,maxWidth:420,background:B.surface,border:"1px solid "+B.border,borderRadius:10,boxShadow:"0 12px 40px rgba(0,0,0,0.4)",maxHeight:420,overflowY:"auto",zIndex:300}}>
      {results.length===0?<div style={{padding:"16px 14px",fontSize:12,color:B.textDim,textAlign:"center"}}>No matches for "{q}"</div>:
      Object.keys(grouped).map(k=><div key={k}>
        <div style={{padding:"8px 12px 4px",fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.5}}>{groupLabel[k]||k}</div>
        {grouped[k].map((r,i)=><div key={i} onClick={r.onClick} style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderLeft:"3px solid "+r.color,transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background=B.bg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span style={{fontSize:14,flexShrink:0}}>{r.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
            {r.sub&&<div style={{fontSize:10,color:B.textDim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>}
          </div>
        </div>)}
      </div>)}
    </div>}
  </div>);
}
export function VoiceInput({onResult,style}){
  const[listening,setListening]=useState(false);
  const start=()=>{
    if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){alert("Voice input not supported in this browser.");return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const rec=new SR();rec.continuous=false;rec.interimResults=false;rec.lang="en-US";
    rec.onresult=(e)=>{const t=e.results[0][0].transcript;if(onResult)onResult(t);setListening(false);};
    rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);
    rec.start();setListening(true);
  };
  return<button onClick={start} type="button" title={listening?"Listening...":"Voice input"} style={{background:listening?B.cyan+"22":"transparent",border:"1px solid "+(listening?B.cyan:B.border),borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:16,color:listening?B.cyan:B.textDim,transition:"all .15s",minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",...(style||{})}}>{listening?"🔴":"🎤"}</button>;
}
