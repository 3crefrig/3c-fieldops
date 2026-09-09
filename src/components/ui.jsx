import React, { useState, useEffect, useRef } from "react";
import { B, F, M, IS, LS, BP, BS, haptic, getTheme , openPO, openEquipment} from "../shared";

// Theme-aware logo: the dark theme uses the dark-background brand lockup
// (white 3C + cyan banner, transparent bg); light theme keeps the original.
const LOGO_LIGHT="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
const LOGO_DARK="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/logo-dark.png";               // full lockup w/ NC outline — login screen
const LOGO_DARK_COMPACT="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/logo-dark-compact.png"; // tight 3C+banner crop — header
export function Logo({size,onClick}){const dark=getTheme()==="dark";const h=size==="large"?(dark?128:56):size==="compact"?(dark?28:24):(dark?38:32);const src=dark?(size==="large"?LOGO_DARK:LOGO_DARK_COMPACT):LOGO_LIGHT;return(<img src={src} alt="3C Refrigeration" style={{height:h,display:"block",cursor:onClick?"pointer":"default",transition:"opacity .2s"}} onClick={onClick}/>);}

// Minimal inline SVG icon set (Lucide-style strokes) — used by the mobile bottom
// bar instead of emoji. currentColor themes automatically.
export function Icon({name,size=20,color="currentColor",strokeWidth=2}){
  const P={
    home:[<path key="a" d="M3 10.5L12 3l9 7.5"/>,<path key="b" d="M5 9.5V21h14V9.5"/>],
    activity:[<polyline key="a" points="22 12 18 12 15 21 9 3 6 12 2 12"/>],
    inbox:[<polyline key="a" points="22 13 16 13 14 16 10 16 8 13 2 13"/>,<path key="b" d="M5.5 4h13L22 13v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z"/>],
    clipboard:[<rect key="a" x="5" y="4" width="14" height="17" rx="2"/>,<path key="b" d="M9 4V2h6v2"/>,<path key="c" d="M9 11h6M9 15h6"/>],
    calendar:[<rect key="a" x="3" y="5" width="18" height="16" rx="2"/>,<path key="b" d="M3 9h18M8 3v4M16 3v4"/>],
    clock:[<circle key="a" cx="12" cy="12" r="9"/>,<path key="b" d="M12 7v5l3 2"/>],
    book:[<path key="a" d="M4 4a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2z"/>,<path key="b" d="M20 16H6a2 2 0 0 0-2 2"/>],
    wrench:[<path key="a" d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/>],
    dot:[<circle key="a" cx="12" cy="12" r="3"/>],
    search:[<circle key="a" cx="11" cy="11" r="7"/>,<path key="b" d="M20 20l-3.5-3.5"/>],
    bell:[<path key="a" d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/>,<path key="b" d="M10 20a2 2 0 0 0 4 0"/>],
    sun:[<circle key="a" cx="12" cy="12" r="4"/>,<path key="b" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>],
    moon:[<path key="a" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>],
    user:[<circle key="a" cx="12" cy="8" r="4"/>,<path key="b" d="M4 21a8 8 0 0 1 16 0"/>],
    pin:[<path key="a" d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/>,<circle key="b" cx="12" cy="10" r="2.2"/>],
    alert:[<path key="a" d="M12 3l10 18H2z"/>,<path key="b" d="M12 10v4M12 17.5v.5"/>],
    logout:[<path key="a" d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/>,<path key="b" d="M14 8l4 4-4 4M18 12H9"/>],
    plus:[<path key="a" d="M12 5v14M5 12h14"/>],
    x:[<path key="a" d="M6 6l12 12M18 6L6 18"/>],
    chevron:[<path key="a" d="M6 9l6 6 6-6"/>],
    checksquare:[<rect key="a" x="4" y="4" width="16" height="16" rx="3"/>,<path key="b" d="M8 12l3 3 5-6"/>],
    check:[<path key="a" d="M5 12l4 4 10-10"/>],
    repeat:[<path key="a" d="M17 2l4 4-4 4"/>,<path key="b" d="M3 11V9a4 4 0 0 1 4-4h14"/>,<path key="c" d="M7 22l-4-4 4-4"/>,<path key="d" d="M21 13v2a4 4 0 0 1-4 4H3"/>],
    map:[<path key="a" d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/>,<path key="b" d="M9 4v14M15 6v14"/>],
    receipt:[<path key="a" d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/>,<path key="b" d="M9 8h6M9 12h6"/>],
    building:[<rect key="a" x="4" y="3" width="16" height="18" rx="1"/>,<path key="b" d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>],
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0}}>{P[name]||P.dot}</svg>;
}
// Inline icon + text for card meta lines ("customer", "location", "overdue") — replaces
// the emoji glyphs that rendered differently on every phone.
export function IconText({name,children,color,size=11,style}){return <span style={{display:"inline-flex",alignItems:"center",gap:4,color,verticalAlign:"middle",...style}}><Icon name={name} size={size}/>{children}</span>;}
// 32px square icon button used across the header (theme, bell, sign out on phones).
export function IconButton({name,onClick,label,active,size=16,style,children}){return <button type="button" onClick={onClick} aria-label={label} title={label} style={{width:34,height:34,display:"inline-flex",alignItems:"center",justifyContent:"center",background:active?B.cyanGlow:B.bg,border:"1px solid "+(active?B.cyan+"66":B.border),borderRadius:6,color:active?B.cyan:B.textMuted,cursor:"pointer",padding:0,position:"relative",flexShrink:0,...style}}><Icon name={name} size={size}/>{children}</button>;}


// Paste-to-scan: lets desktop users hit Win+Shift+S / Cmd+Shift+4 and press
// Ctrl/Cmd+V straight into an open scan dialog instead of saving a file first.
export function usePasteImage(enabled,onFile){
  const cb=useRef(onFile);
  useEffect(()=>{cb.current=onFile;},[onFile]);
  useEffect(()=>{
    if(!enabled)return;
    const h=(e)=>{
      const items=(e.clipboardData&&e.clipboardData.items)||[];
      for(let i=0;i<items.length;i++){
        const it=items[i];
        if(it.type&&it.type.indexOf("image/")===0){
          const f=it.getAsFile();
          if(f){e.preventDefault();cb.current&&cb.current(f);return;}
        }
      }
    };
    document.addEventListener("paste",h);
    return()=>document.removeEventListener("paste",h);
  },[enabled]);
}

// ── PDF preview ───────────────────────────────────────────────
// Inline PDF viewer so finished documents can be checked without downloading.
// Lives here (not Invoices.jsx) so every module can use it — Invoices already
// imports from PurchaseOrders, so the reverse would be a circular import.
//
// iOS Safari won't reliably render a blob: PDF inside an iframe, so on phones we
// hand off to a new tab instead of showing an empty frame.
export function previewPdfDoc(doc,title,setPreview){
  const url=doc.output("bloburl");
  const filename=(title||"document").replace(/[^a-zA-Z0-9._-]/g,"_")+(/\.pdf$/i.test(title||"")?"":".pdf");
  if(typeof window!=="undefined"&&window.innerWidth<768){
    const w=window.open(url,"_blank");
    if(!w){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();a.remove();}
    return;
  }
  setPreview({url,downloadUrl:url,title,filename});
}
export function PdfPreviewModal({url,downloadUrl,title,filename,onClose}){
  useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose&&onClose();};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k);},[onClose]);
  return(<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1100,display:"flex",flexDirection:"column",background:"rgba(0,0,0,.85)",backdropFilter:"blur(4px)",padding:"max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom))",boxSizing:"border-box",animation:"fadeIn .15s ease-out"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:B.surface,borderRadius:14,border:"1px solid "+B.border,flex:1,display:"flex",flexDirection:"column",overflow:"hidden",maxWidth:1000,width:"100%",margin:"0 auto",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 16px",borderBottom:"1px solid "+B.border}}>
        <span style={{fontSize:14,fontWeight:700,color:B.text,fontFamily:M,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title||"Preview"}</span>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <a href={downloadUrl||url} download={filename||undefined} style={{...BS,textDecoration:"none",padding:"6px 12px",fontSize:12}}>Download</a>
          <a href={downloadUrl||url} target="_blank" rel="noreferrer" style={{...BS,textDecoration:"none",padding:"6px 12px",fontSize:12}}>New tab ↗</a>
          <button onClick={onClose} style={{...BP,padding:"6px 12px",fontSize:12}}>Close</button>
        </div>
      </div>
      <iframe title="PDF preview" src={url} style={{flex:1,width:"100%",border:"none",background:"#fff"}}/>
    </div>
  </div>);
}

// Shopify-style: pills with soft tinted fill and NO outline; cards with modest 12px
// radius, hairline edge, and a 1px under-shadow; stat values neutral (color lives in
// the delta/pill, not the number — the Shopify restraint that makes it read premium).
// Tag: dot + word in a 5px-radius box. Reads as a state label, not a decorative pill.
export function Badge({color,children}){return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 7px",borderRadius:5,background:color+"16",color,fontSize:11,fontWeight:600,fontFamily:F,letterSpacing:0.1,lineHeight:"16px",whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:3,background:color,flexShrink:0}}/>{children}</span>;}
export function Card({children,onClick,style}){return <div onClick={onClick} className={onClick?"card-hover":""} style={{background:B.surface,borderRadius:8,padding:16,border:"1px solid "+B.border,cursor:onClick?"pointer":"default",transition:"border-color .15s",...style}}>{children}</div>;}
export function StatCard({label,value,icon,color,delta}){return <div className="stat-card" style={{flex:"1 1 130px",minWidth:130,padding:"14px 16px",background:B.surface,borderRadius:8,border:"1px solid "+B.border,boxSizing:"border-box"}}><div className="stat-label" style={{fontSize:11,color:B.textMuted,fontWeight:600,letterSpacing:0.3,textTransform:"uppercase",marginBottom:6}}>{label}</div><div className="stat-value" style={{fontSize:22,fontWeight:600,color:B.text,fontFamily:F,lineHeight:1,letterSpacing:-0.3,fontVariantNumeric:"tabular-nums"}}>{value}</div>{delta!=null&&<div style={{fontSize:10.5,fontWeight:650,marginTop:6,color:delta>=0?B.green:B.red}}>{delta>=0?"▲":"▼"} {Math.abs(delta)}% <span style={{color:B.textDim,fontWeight:400}}>vs prior</span></div>}</div>;}
export function Modal({title,onClose,children,wide}){return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",animation:"fadeIn .15s ease-out",padding:"max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))",boxSizing:"border-box"}}><div className="modal-card" style={{background:B.surface,borderRadius:10,padding:24,width:"92%",maxWidth:wide?620:440,overflowY:"auto",border:"1px solid "+B.border,boxShadow:"0 20px 60px rgba(0,0,0,0.4)",animation:"modalIn .2s ease-out"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:B.text,letterSpacing:-0.2}}>{title}</h3><button onClick={onClose} aria-label="Close" style={{background:B.bg,border:"1px solid "+B.border,color:B.textMuted,width:28,height:28,borderRadius:8,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=B.surfaceActive} onMouseLeave={e=>e.currentTarget.style.background=B.bg}>×</button></div>{children}</div></div>;}
export function Toast({msg}){useEffect(()=>{if(msg)haptic(30);},[msg]);if(!msg)return null;return <div style={{position:"fixed",top:16,right:16,zIndex:2000,background:B.text,color:B.bg,padding:"9px 14px",borderRadius:6,fontSize:13,fontWeight:600,fontFamily:F,display:"flex",alignItems:"center",gap:8,boxShadow:"0 6px 20px rgba(0,0,0,0.25)",animation:"toastIn .25s ease-out"}}><span style={{color:B.green,display:"inline-flex"}}><Icon name="check" size={14}/></span>{msg}</div>;}
export function CustomSelect({value,onChange,options,placeholder,style:sx}){
  const[open,setOpen]=useState(false);const ref=useRef(null);const[search,setSearch]=useState("");
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};const k=e=>{if(e.key==="Escape")setOpen(false);};document.addEventListener("mousedown",h);document.addEventListener("keydown",k);return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("keydown",k);};},[]);
  const sel=options.find(o=>o.value===value);
  const filtered=search?options.filter(o=>(o.label||"").toLowerCase().includes(search.toLowerCase())):options;
  return(<div ref={ref} style={{position:"relative",...sx}}>
    <div onClick={()=>{setOpen(!open);setSearch("");}} style={{...IS,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",minHeight:38}}>
      <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
        {sel?<>{sel.badge&&<span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:sel.badge,flexShrink:0}}/>}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13,color:B.text}}>{sel.label}</span></>:<span style={{color:B.textDim,fontSize:13}}>{placeholder||"— Select —"}</span>}
      </div>
      <span style={{color:B.textDim,fontSize:10,flexShrink:0,marginLeft:8}}>{open?"▲":"▼"}</span>
    </div>
    {open&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:B.surface,border:"1px solid "+B.border,borderRadius:8,marginTop:4,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",maxHeight:260,overflowY:"auto",animation:"fadeIn .12s ease-out"}}>
      {options.length>5&&<div style={{padding:"6px 8px",borderBottom:"1px solid "+B.border}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." autoFocus style={{...IS,padding:"6px 10px",fontSize:12,width:"100%",boxSizing:"border-box"}}/></div>}
      {filtered.length===0&&<div style={{padding:"12px 16px",fontSize:12,color:B.textDim,textAlign:"center"}}>No results</div>}
      {filtered.map(o=><div key={o.value} onClick={()=>{onChange(o.value);setOpen(false);setSearch("");}} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",borderBottom:"1px solid "+B.border+"40",background:o.value===value?B.cyanGlow:"transparent",transition:"background .1s"}} onMouseEnter={e=>{if(o.value!==value)e.currentTarget.style.background=B.bg;}} onMouseLeave={e=>{e.currentTarget.style.background=o.value===value?B.cyanGlow:"transparent";}}>
        {o.badge&&<span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:o.badge,flexShrink:0}}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:o.value===value?700:500,color:o.value===value?B.cyan:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</div>
          {o.sub&&<div style={{fontSize:10,color:B.textDim,marginTop:1}}>{o.sub}</div>}
        </div>
        {o.tag&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:o.tagColor+"20",color:o.tagColor,border:"1px solid "+o.tagColor+"30",flexShrink:0}}>{o.tag}</span>}
      </div>)}
    </div>}
  </div>);
}
export function ConfirmDialog({message,onConfirm,onCancel,confirmLabel,danger}){return<Modal title="Confirm" onClose={onCancel}><div style={{textAlign:"center",padding:"8px 0"}}><div style={{fontSize:13,color:B.text,marginBottom:16,lineHeight:1.5}}>{message}</div><div style={{display:"flex",gap:8}}><button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button><button onClick={onConfirm} style={{...BP,flex:1,background:danger?B.red:B.cyan}}>{confirmLabel||"Confirm"}</button></div></div></Modal>;}
export function DSBadge({ok}){return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:999,background:ok?B.greenGlow:B.orangeGlow,color:ok?B.green:B.orange,fontSize:10,fontWeight:700,textTransform:"uppercase",border:"1px solid "+(ok?B.green:B.orange)+"25"}}><span style={{width:5,height:5,borderRadius:"50%",background:ok?B.green:B.orange}}/>{ok?"Synced":"Pending"}</span>;}
export function Spinner(){return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid "+B.border,borderTopColor:B.cyan,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>;}
export function SkeletonCard(){return <div style={{background:B.surface,borderRadius:8,padding:16,border:"1px solid "+B.border}}><div style={{height:10,width:"40%",borderRadius:4,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /><div style={{height:18,width:"70%",borderRadius:4,marginTop:10,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /><div style={{height:10,width:"55%",borderRadius:4,marginTop:10,background:`linear-gradient(90deg,${B.border},${B.surfaceActive},${B.border})`,backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} /></div>;}
export function SkeletonLoader({count}){return <div style={{display:"flex",flexDirection:"column",gap:10,animation:"fadeIn .3s ease-out"}}>{Array.from({length:count||3}).map((_,i)=><SkeletonCard key={i}/>)}</div>;}
export function EmptyState({icon,title,subtitle}){return <div style={{textAlign:"center",padding:"48px 24px",animation:"fadeIn .3s ease-out"}}>{icon&&<div style={{fontSize:40,marginBottom:12,opacity:0.8}}>{icon}</div>}<div style={{fontSize:16,fontWeight:700,color:B.text,marginBottom:6}}>{title||"Nothing here yet"}</div><div style={{fontSize:12,color:B.textDim,lineHeight:1.5,maxWidth:260,margin:"0 auto"}}>{subtitle||""}</div></div>;}
export function GlobalSearch({data,onNavigateWO,setTab}){
  const[q,setQ]=useState("");
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};const k=e=>{if(e.key==="Escape"){setOpen(false);setQ("");}if((e.key==="k"||e.key==="K")&&(e.metaKey||e.ctrlKey)){e.preventDefault();ref.current?.querySelector("input")?.focus();}};document.addEventListener("mousedown",h);document.addEventListener("keydown",k);return()=>{document.removeEventListener("mousedown",h);document.removeEventListener("keydown",k);};},[]);
  const query=q.trim().toLowerCase();
  const results=!query?null:(()=>{
    const r=[];const cap=8;
    const matches=(...fields)=>fields.some(v=>v&&String(v).toLowerCase().includes(query));
    (data?.wos||[]).forEach(w=>{if(r.length>=cap*4)return;if(matches(w.wo_id,w.title,w.customer,w.customer_wo,w.location,w.assignee))r.push({kind:"wo",icon:"clipboard",title:w.wo_id+" — "+w.title,sub:[w.customer,w.status,w.assignee].filter(Boolean).join(" · "),color:w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange,onClick:()=>{if(onNavigateWO)onNavigateWO(w.id);setOpen(false);setQ("");}});});
    (data?.pos||[]).forEach(p=>{if(r.length>=cap*4)return;if(matches(p.po_id,p.description,p.requested_by))r.push({kind:"po",icon:"receipt",title:p.po_id+" — $"+parseFloat(p.amount||0).toFixed(0),sub:(p.description||"").slice(0,60)+" · "+p.status,color:p.status==="approved"?B.green:p.status==="rejected"?B.red:B.orange,onClick:()=>{openPO(p.po_id);setOpen(false);setQ("");}});});
    (data?.customers||[]).forEach(c=>{if(r.length>=cap*4)return;if(matches(c.name,c.contact_name,c.email,c.phone))r.push({kind:"customer",icon:"user",title:c.name,sub:[c.contact_name,c.phone].filter(Boolean).join(" · "),color:B.cyan,onClick:()=>{setTab&&setTab("customers");setOpen(false);setQ("");}});});
    (data?.equipment||[]).forEach(e=>{if(r.length>=cap*4)return;if(matches(e.model,e.manufacturer,e.serial_number,e.asset_tag,e.customer_name))r.push({kind:"equipment",icon:"wrench",title:(e.model||"Equipment")+(e.asset_tag?" · "+e.asset_tag:""),sub:[e.customer_name,e.manufacturer,e.serial_number].filter(Boolean).join(" · "),color:B.cyan,onClick:()=>{openEquipment(e.id);setOpen(false);setQ("");}});});
    (data?.projects||[]).forEach(p=>{if(r.length>=cap*4)return;if(matches(p.name,p.customer,p.location))r.push({kind:"project",icon:"building",title:p.name,sub:[p.customer,p.status].filter(Boolean).join(" · "),color:B.orange,onClick:()=>{setTab&&setTab("projects");setOpen(false);setQ("");}});});
    const order={wo:0,po:1,customer:2,equipment:3,project:4};
    return r.sort((a,b)=>(order[a.kind]||9)-(order[b.kind]||9)).slice(0,20);
  })();
  const grouped=results?results.reduce((acc,r)=>{(acc[r.kind]=acc[r.kind]||[]).push(r);return acc;},{}):null;
  const groupLabel={wo:"Work Orders",po:"Purchase Orders",customer:"Customers",equipment:"Equipment",project:"Projects"};
  const mob=typeof window!=="undefined"&&window.innerWidth<768;
  return(<div ref={ref} style={{position:"relative",flex:mob?"1 1 auto":"0 1 auto",minWidth:0}}>
    <div style={{display:"flex",alignItems:"center",gap:6,background:B.bg,border:"1px solid "+B.border,borderRadius:8,padding:mob?"6px 10px":"5px 10px",minWidth:mob?0:180,maxWidth:mob?"none":280,color:B.textDim}}>
      <Icon name="search" size={14}/>
      <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>q&&setOpen(true)} placeholder={mob?"Search…":"Search WO, PO, customer…"} style={{background:"transparent",border:"none",outline:"none",color:B.text,fontSize:16,fontFamily:F,flex:1,minWidth:0,padding:0}}/>
      {q&&<button onClick={()=>{setQ("");setOpen(false);}} style={{background:"none",border:"none",color:B.textDim,fontSize:14,cursor:"pointer",padding:0,lineHeight:1}}>×</button>}
    </div>
    {open&&query&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,minWidth:mob?0:320,maxWidth:mob?"none":420,background:B.surface,border:"1px solid "+B.border,borderRadius:10,boxShadow:"0 12px 40px rgba(0,0,0,0.4)",maxHeight:420,overflowY:"auto",zIndex:300}}>
      {results.length===0?<div style={{padding:"16px 14px",fontSize:12,color:B.textDim,textAlign:"center"}}>No matches for "{q}"</div>:
      Object.keys(grouped).map(k=><div key={k}>
        <div style={{padding:"8px 12px 4px",fontSize:10,fontWeight:600,color:B.textDim,textTransform:"uppercase",letterSpacing:0.4}}>{groupLabel[k]||k}</div>
        {grouped[k].map((r,i)=><div key={i} onClick={r.onClick} style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background=B.bg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span style={{color:B.textMuted,display:"inline-flex"}}><Icon name={r.icon} size={15}/></span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:3,background:r.color,flexShrink:0}}/><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</span></div>
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
