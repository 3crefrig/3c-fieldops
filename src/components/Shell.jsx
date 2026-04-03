import React, { useState, useEffect, useRef } from "react";
import { B, F, BS, haptic, setTheme, getTheme, getRoles, ROLES, GlobalStyles } from "../shared";
import { Logo, Badge } from "./ui";
import { NotifBell } from "./CameraUpload";

let _ROLES = ROLES;

export function Shell({user,onLogout,children,tab,setTab,tabs,syncing,offlineQueueCount,notifications,onMarkRead,onQuickApprovePO,onQuickRejectPO,onNavigateWO,onRefresh}){
  const[theme,setThemeState]=useState(getTheme());
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);
  const[offline,setOffline]=useState(!navigator.onLine);
  const[showMoreTabs,setShowMoreTabs]=useState(false);
  const[openNavGroup,setOpenNavGroup]=useState(null);
  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  useEffect(()=>{const on=()=>setOffline(false);const off=()=>setOffline(true);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);
  const toggleTheme=()=>{const t=theme==="dark"?"light":"dark";setTheme(t);_ROLES=getRoles();setThemeState(t);};
  // Keyboard shortcuts — Alt+T for theme, number keys for tabs
  useEffect(()=>{const handler=(e)=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT"||e.target.isContentEditable)return;if(e.key>="1"&&e.key<="9"){const idx=parseInt(e.key)-1;if(tabs[idx])setTab(tabs[idx].key);}if(e.key==="t"&&e.altKey)toggleTheme();};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[tabs,theme]);
  // Pull to refresh — requires intentional slow vertical pull, ignores taps on interactive elements
  const contentRef=useRef(null);
  const pullIndicatorRef=useRef(null);
  useEffect(()=>{const el=contentRef.current;if(!el)return;let startY=0,startX=0,startTime=0,pulling=false,ready=false,aborted=false;const THRESHOLD=140;const MIN_HOLD_MS=300;
    const indicator=document.createElement("div");
    indicator.style.cssText="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;padding:6px 18px;border-radius:0 0 12px 12px;font-size:12px;font-weight:600;font-family:Barlow,sans-serif;opacity:0;transition:opacity .15s;pointer-events:none;text-align:center;";
    document.body.appendChild(indicator);
    pullIndicatorRef.current=indicator;
    const isInteractive=(t)=>{let n=t;while(n&&n!==el){const tag=n.tagName;if(tag==="BUTTON"||tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||tag==="A"||tag==="CANVAS"||n.isContentEditable)return true;n=n.parentElement;}return false;};
    const ts=(e)=>{if(el.scrollTop===0&&!isInteractive(e.target)){startY=e.touches[0].clientY;startX=e.touches[0].clientX;startTime=Date.now();ready=false;aborted=false;}else{startY=0;}};
    const tm=(e)=>{if(!startY||el.scrollTop>0||aborted)return;const dy=e.touches[0].clientY-startY;const dx=Math.abs(e.touches[0].clientX-startX);if(dx>dy*0.5){aborted=true;indicator.style.opacity="0";return;}if(dy<0){startY=0;indicator.style.opacity="0";return;}const held=Date.now()-startTime>=MIN_HOLD_MS;
      if(dy>40&&dy<=THRESHOLD){indicator.textContent="↓ Pull to refresh";indicator.style.background=B.surface;indicator.style.color=B.textDim;indicator.style.border="1px solid "+B.border;indicator.style.opacity="0.9";ready=false;}
      else if(dy>THRESHOLD&&held){indicator.textContent="↻ Release to refresh";indicator.style.background=B.cyan;indicator.style.color="#fff";indicator.style.border="none";indicator.style.opacity="1";ready=true;}
      else{indicator.style.opacity="0";ready=false;}};
    const te=()=>{if(ready&&!pulling){pulling=true;haptic(50);indicator.textContent="Refreshing...";setTimeout(()=>{if(onRefresh)onRefresh();indicator.style.opacity="0";pulling=false;},200);}else{indicator.style.opacity="0";}startY=0;startX=0;startTime=0;ready=false;aborted=false;pulling=false;};
    el.addEventListener("touchstart",ts,{passive:true});el.addEventListener("touchmove",tm,{passive:true});el.addEventListener("touchend",te);return()=>{el.removeEventListener("touchstart",ts);el.removeEventListener("touchmove",tm);el.removeEventListener("touchend",te);indicator.remove();};},[onRefresh]);
  // Ensure wheel/trackpad scroll always works even when hovering over overflow:hidden children
  useEffect(()=>{const el=contentRef.current;if(!el)return;const onWheel=(e)=>{const t=e.target;let n=t;let scrollable=false;while(n&&n!==el){if(n.scrollHeight>n.clientHeight&&(getComputedStyle(n).overflowY==="auto"||getComputedStyle(n).overflowY==="scroll")){scrollable=true;break;}n=n.parentElement;}if(!scrollable){el.scrollTop+=e.deltaY;e.preventDefault();}};el.addEventListener("wheel",onWheel,{passive:false});return()=>el.removeEventListener("wheel",onWheel);},[]);
  return(<div style={{height:"100vh",background:B.bg,fontFamily:F,color:B.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <GlobalStyles/>
    <div style={{background:B.surface,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid "+B.border,flexWrap:"wrap",gap:8,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
      <Logo onClick={()=>setTab(tabs[0]?.key)}/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={toggleTheme} style={{background:B.bg,border:"1px solid "+B.border,borderRadius:8,fontSize:14,cursor:"pointer",padding:"4px 8px",transition:"background .15s"}} title={theme==="dark"?"Switch to light mode":"Switch to dark mode"}>{theme==="dark"?"☀️":"🌙"}</button>
        {offline&&<span style={{fontSize:10,color:B.red,fontWeight:700,background:B.red+"22",padding:"2px 8px",borderRadius:4}}>Offline{offlineQueueCount>0?" ("+offlineQueueCount+" queued)":""}</span>}
        {syncing&&!offline&&<span style={{fontSize:10,color:B.orange,fontWeight:600,animation:"pulseGlow 2s infinite"}}>syncing{offlineQueueCount>0?" ("+offlineQueueCount+")":""}...</span>}
        <NotifBell notifications={notifications||[]} onMarkRead={onMarkRead} onQuickApprovePO={onQuickApprovePO} onQuickRejectPO={onQuickRejectPO} userRole={user.role} onNavigate={onNavigateWO}/>
        <Badge color={_ROLES[user.role]?_ROLES[user.role].color:B.textDim}>{user.role}</Badge>
        <span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>{user.name}</span>
        <button onClick={onLogout} style={{...BS,padding:"5px 12px",fontSize:11,borderRadius:8,transition:"background .15s,color .15s"}} onMouseEnter={e=>{e.currentTarget.style.background=B.surfaceActive;}} onMouseLeave={e=>{e.currentTarget.style.background=B.bg;}}>Sign Out</button>
      </div>
    </div>
    {(()=>{
      // Group tabs into sections for cleaner navigation (6+ tabs triggers grouping)
      const TAB_GROUPS=[
        {label:"Operations",icon:"⚡",keys:["overview","inbox","orders","calendar"]},
        {label:"Finance",icon:"💰",keys:["billing","invoices","proposals","feedback","reports"]},
        {label:"Management",icon:"👥",keys:["pos","customers","equipment","users","recurring","team","projects"]},
        {label:"System",icon:"⚙️",keys:["settings","kb"]},
      ];
      const useGroups=!isMobile&&tabs.length>8;
      const activeGroup=useGroups?TAB_GROUPS.find(g=>g.keys.includes(tab)):null;
      const effectiveOpen=openNavGroup||(activeGroup?.label)||null;

      if(useGroups){
        return(<div style={{background:B.surface,borderBottom:"1px solid "+B.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          {/* Group headers */}
          <div style={{display:"flex",gap:0,padding:"0 16px"}}>
            {TAB_GROUPS.map(g=>{const groupTabs=tabs.filter(t=>g.keys.includes(t.key));if(groupTabs.length===0)return null;
              const isActive=g.keys.includes(tab);const isOpen=effectiveOpen===g.label;
              const badge=g.label==="Operations"?tabs.find(t=>t.key==="inbox"&&t.label.includes("("))?"":"":null;
              return<button key={g.label} onClick={()=>{setOpenNavGroup(isOpen&&!isActive?null:g.label);if(!isOpen&&groupTabs[0])setTab(groupTabs[0].key);haptic(15);}}
                style={{padding:"10px 18px",border:"none",background:isOpen?B.cyanGlow:"transparent",fontSize:12,fontWeight:isActive?700:500,color:isActive?B.cyan:B.textMuted,borderBottom:isActive?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap",transition:"all .15s",letterSpacing:0.3,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13}}>{g.icon}</span>{g.label}<span style={{fontSize:9,color:B.textDim,transition:"transform .15s",transform:isOpen?"rotate(180deg)":"rotate(0)"}}>{isOpen?"▾":"▸"}</span>
              </button>;})}
          </div>
          {/* Sub-tabs for open group */}
          {effectiveOpen&&<div style={{display:"flex",gap:0,padding:"0 16px",background:B.bg,borderTop:"1px solid "+B.border}}>
            {tabs.filter(t=>(TAB_GROUPS.find(g=>g.label===effectiveOpen)?.keys||[]).includes(t.key)).map(t=>
              <button key={t.key} onClick={()=>{setTab(t.key);haptic(15);}} style={{padding:"8px 16px",border:"none",background:tab===t.key?B.cyan+"18":"transparent",fontSize:11,fontWeight:tab===t.key?700:500,color:tab===t.key?B.cyan:B.textDim,borderBottom:tab===t.key?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap",transition:"all .12s",borderRadius:"6px 6px 0 0"}}>{t.icon} {t.label}</button>)}
          </div>}
        </div>);
      }
      // Simple flat tabs for tech dashboard or small tab counts
      return(<div style={{background:B.surface,padding:isMobile?"0 8px":"0 16px",display:"flex",gap:0,borderBottom:"1px solid "+B.border,overflowX:"auto",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        {tabs.map(t=><button key={t.key} onClick={()=>{setTab(t.key);haptic(15);}} style={{padding:isMobile?"8px 10px":"11px 16px",border:"none",background:tab===t.key?B.cyanGlow:"transparent",fontSize:isMobile?9:11,fontWeight:tab===t.key?700:500,color:tab===t.key?B.cyan:B.textDim,borderBottom:tab===t.key?"2px solid "+B.cyan:"2px solid transparent",cursor:"pointer",fontFamily:F,whiteSpace:"nowrap",transition:"all .15s",letterSpacing:0.2}}>{t.icon} {t.label}</button>)}
      </div>);
    })()}
    <div ref={contentRef} className="tab-content" key={tab+theme} style={{flex:1,padding:isMobile?"14px 10px":"20px 14px",paddingBottom:isMobile?74:20,overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"none",maxWidth:1200,width:"100%",margin:"0 auto",boxSizing:"border-box",minHeight:0}}>{children}</div>
    {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:B.surface,borderTop:"1px solid "+B.border,display:"flex",justifyContent:"space-around",padding:"4px 0",paddingBottom:"max(4px, env(safe-area-inset-bottom))",zIndex:200,boxShadow:"0 -2px 12px rgba(0,0,0,0.2)"}}>{tabs.slice(0,4).map(t=><button key={t.key} onClick={()=>{setTab(t.key);haptic(15);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,border:"none",background:"transparent",color:tab===t.key?B.cyan:B.textDim,fontSize:20,cursor:"pointer",padding:"6px 12px",minHeight:48,transition:"color .15s"}}><span>{t.icon}</span><span style={{fontSize:10,fontWeight:tab===t.key?700:500,fontFamily:F}}>{t.label}</span></button>)}<button onClick={()=>setShowMoreTabs(!showMoreTabs)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,border:"none",background:"transparent",color:showMoreTabs?B.cyan:B.textDim,fontSize:20,cursor:"pointer",padding:"6px 12px",minHeight:48}}><span>•••</span><span style={{fontSize:10,fontWeight:500,fontFamily:F}}>More</span></button></div>}
    {isMobile&&showMoreTabs&&<div style={{position:"fixed",bottom:64,left:0,right:0,background:B.surface,borderTop:"1px solid "+B.border,zIndex:199,padding:"8px",display:"flex",flexWrap:"wrap",gap:4,boxShadow:"0 -4px 16px rgba(0,0,0,0.3)"}}>{tabs.slice(4).map(t=><button key={t.key} onClick={()=>{setTab(t.key);setShowMoreTabs(false);haptic(15);}} style={{padding:"10px 14px",borderRadius:8,border:"1px solid "+(tab===t.key?B.cyan:B.border),background:tab===t.key?B.cyanGlow:"transparent",color:tab===t.key?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F,minHeight:44}}>{t.icon} {t.label}</button>)}</div>}
  </div>);
}
