import React from "react";
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "dompurify";

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export function sb(){ return _sb; }

// Columns readable on the users table by `authenticated` — billing_rate/cost_rate
// are REVOKED (managers/admins read them via the user_rates() RPC), so a
// `select("*")` would be denied by Postgres. Always select these explicitly.
export const USER_COLS="id,name,email,role,active,created_at,title,phone,available_hours_week";

// Columns fetched for work_order LIST views — every column EXCEPT `signature`.
// `signature` holds a base64 PNG (~6KB/row, ~2.5MB across the table) and is only
// ever rendered in WODetail, one WO at a time. Including it in the bulk fetch made
// every loadData()/reloadTable("work_orders") ship ~2.9MB instead of ~340KB, which
// is what blew the Supabase free-tier egress quota (2026-08-01).
// WODetail loads the signature on demand via loadWOSignature() below.
// NOTE: when a migration adds a column to work_orders, add it here too or it will
// silently be missing from the app's data.
export const WO_COLS="id,wo_id,title,priority,status,assignee,due_date,hours_total,notes,location,building,wo_type,date_completed,created_at,customer,field_notes,crew,customer_wo,work_performed,tms_entered,project_id,chamber_id,invoiced,equipment_id,agreement_id,nte,nte_approved_by,nte_approved_at,dispatched_at,on_site_at,resolved_at,sla_response_hours";

// Fetch a single work order's signature (excluded from WO_COLS to keep list
// payloads small). Returns the base64 data-URL string, or null.
export async function loadWOSignature(woId){
  if(!woId)return null;
  const{data,error}=await sb().from("work_orders").select("signature").eq("id",woId).single();
  if(error){console.warn("loadWOSignature failed:",error.message);return null;}
  return data?.signature||null;
}

export const DARK={bg:"#101214",surface:"#1A1D21",surfaceActive:"#2A2F35",border:"#2E3338",text:"#E8EAED",textMuted:"#8B929A",textDim:"#5E656E",cyan:"#00D4F5",cyanDark:"#00A5C0",cyanGlow:"rgba(0,212,245,0.12)",red:"#FF4757",orange:"#FFA040",green:"#26D9A2",purple:"#A78BFA",greenGlow:"rgba(38,217,162,0.15)",orangeGlow:"rgba(255,160,64,0.15)"};
export const LIGHT={bg:"#F5F6F8",surface:"#FFFFFF",surfaceActive:"#E8EAED",border:"#D1D5DB",text:"#1A1D21",textMuted:"#4B5563",textDim:"#9CA3AF",cyan:"#0891B2",cyanDark:"#0E7490",cyanGlow:"rgba(8,145,178,0.1)",red:"#DC2626",orange:"#D97706",green:"#059669",purple:"#7C3AED",greenGlow:"rgba(5,150,105,0.1)",orangeGlow:"rgba(217,119,6,0.1)"};
let _theme=localStorage.getItem("fieldops-theme")||"dark";
export let B=_theme==="light"?{...LIGHT}:{...DARK};
export function setTheme(t){_theme=t;localStorage.setItem("fieldops-theme",t);Object.assign(B,t==="light"?LIGHT:DARK);}
export function getTheme(){return _theme;}
export function haptic(ms){try{navigator.vibrate&&navigator.vibrate(ms||30);}catch(e){}}
export const F="'Barlow',sans-serif",M="'JetBrains Mono',monospace";
export const getRoles=()=>({admin:{label:"Admin",color:B.red},manager:{label:"Manager",color:B.green},technician:{label:"Technician",color:B.cyan}});
export let ROLES=getRoles();
export function refreshRoles(){ROLES=getRoles();}

const _BW=["fuck","shit","ass","bitch","damn","dick","cock","pussy","cunt","bastard","slut","whore","nigger","nigga","faggot","fag","retard","retarded","spic","chink","kike","wetback","cracker","dyke","tranny","motherfucker","bullshit","asshole","dumbass","jackass","goddamn","piss","twat","wanker"];
export const hasProfanity=(text)=>{if(!text)return false;const lower=text.toLowerCase().replace(/[^a-z\s]/g,"");return _BW.some(w=>{const re=new RegExp("\\b"+w+"\\b","i");return re.test(lower);});};
const _TYPOS={teh:"the",hte:"the",adn:"and",taht:"that",waht:"what",wiht:"with",thier:"their",recieve:"receive",recieved:"received",acheive:"achieve",occured:"occurred",occurence:"occurrence",seperate:"separate",definately:"definitely",accomodate:"accommodate",independant:"independent",maintainance:"maintenance",enviroment:"environment",goverment:"government",neccessary:"necessary",untill:"until",wich:"which",becuase:"because",beleive:"believe",calender:"calendar",catagory:"category",commited:"committed",completly:"completely",concensus:"consensus",consistant:"consistent",develope:"develop",diffrent:"different",dissapear:"disappear",efficency:"efficiency",embarass:"embarrass",equiptment:"equipment",explaination:"explanation",familar:"familiar",finaly:"finally",foriegn:"foreign",fourty:"forty",freind:"friend",guage:"gauge",gaurd:"guard",happend:"happened",harrass:"harass",immediatly:"immediately",incidently:"incidentally",knowlege:"knowledge",liason:"liaison",libary:"library",manuever:"maneuver",millenium:"millennium",mispell:"misspell",noticable:"noticeable",ocasionally:"occasionally",occassion:"occasion",paralel:"parallel",pasttime:"pastime",percieve:"perceive",persistant:"persistent",personel:"personnel",possesion:"possession",prefered:"preferred",preformance:"performance",privelege:"privilege",probly:"probably",proffessional:"professional",programing:"programming",publically:"publicly",realy:"really",refridgerator:"refrigerator",relevent:"relevant",rember:"remember",remeber:"remember",restaraunt:"restaurant",rythem:"rhythm",saftey:"safety",schudule:"schedule",schdule:"schedule",sence:"sense",similiar:"similar",sincerly:"sincerely",speach:"speech",succesful:"successful",suprise:"surprise",technition:"technician",temperture:"temperature",temprature:"temperature",tommorrow:"tomorrow",togehter:"together",vaccuum:"vacuum",vegatable:"vegetable",wether:"whether",writeing:"writing",compresser:"compressor",condensar:"condenser",evaporater:"evaporator",thermastat:"thermostat",termostat:"thermostat",refridgerant:"refrigerant",refrigerent:"refrigerant",compressor:"compressor",diagnositc:"diagnostic",diagonstic:"diagnostic",inpsection:"inspection",insepction:"inspection",replacment:"replacement",instlalation:"installation",instalation:"installation",malfuction:"malfunction",malfuntion:"malfunction",circut:"circuit",cirucit:"circuit",capaciter:"capacitor",capacitor:"capacitor",voltmeter:"voltmeter",amerage:"amperage",wattege:"wattage",freon:"Freon",hvac:"HVAC"};
export const autoCorrect=(text)=>{if(!text||typeof text!=="string")return text;let t=text;
  t=t.replace(/\s{2,}/g," ");
  t=t.replace(/\n\s*\n\s*\n/g,"\n\n");
  t=t.replace(/(^|[.!?]\s+)([a-z])/g,(_,p,c)=>p+c.toUpperCase());
  t=t.replace(/\bi\b(?=[^.])/g,"I");
  t=t.replace(/\b([A-Za-z]+)\b/g,(m)=>{const lw=m.toLowerCase();const fix=_TYPOS[lw];if(!fix)return m;if(m[0]===m[0].toUpperCase())return fix[0].toUpperCase()+fix.slice(1);return fix;});
  return t.trim();};
let _profanityToast=null;
export const setProfanityHandler=(fn)=>{_profanityToast=fn;};
export const cleanText=(text,fieldName)=>{const corrected=autoCorrect(text);if(hasProfanity(corrected)){if(_profanityToast)_profanityToast("Inappropriate language in "+fieldName);else alert("Inappropriate language detected in "+fieldName+".");return null;}return corrected;};
// Sanitize author-entered email-template HTML before rendering it via
// dangerouslySetInnerHTML. DOMPurify parses in an inert document (no network,
// no script execution during parse) and strips event handlers + javascript:/
// data: URLs — replacing the previous hand-rolled filter which used a live
// innerHTML parse and case-sensitive checks that could be bypassed.
export const sanitizeHTML=(html)=>{if(!html)return"";return DOMPurify.sanitize(String(html),{FORBID_TAGS:["script","iframe","object","embed","form","link","style","svg"],FORBID_ATTR:["style"]});};
export const calcWOHours=(woId,timeEntries)=>timeEntries.filter(t=>t.wo_id===woId).reduce((s,t)=>s+parseFloat(t.hours||0),0);
export const fmtHours=(n)=>{const v=parseFloat(n||0);if(!isFinite(v))return"0h";return parseFloat(v.toFixed(2))+"h";};
export const PC={high:B.red,medium:B.orange,low:B.green};
export const SC={pending:B.orange,in_progress:B.cyan,completed:B.green};
export const SL={pending:"Pending",in_progress:"In Progress",completed:"Completed"};
export const PSC={pending:B.orange,approved:B.green,rejected:B.red,revised:B.orange};
export const PSL={pending:"Pending",approved:"Approved",rejected:"Rejected",revised:"Revised"};
// Radius scale: 6 chips/inset panels · 10 inputs/buttons/cards · 14 modals · 999 pills
const _IS=()=>({width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid "+B.border,background:B.bg,color:B.text,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box",transition:"border-color .15s, box-shadow .15s"});
const _LS=()=>({fontSize:11,color:B.textDim,fontWeight:600,letterSpacing:0.4,textTransform:"uppercase",marginBottom:5,display:"block"});
const _BP=()=>({padding:"12px 20px",borderRadius:10,border:"none",background:B.cyan,color:B.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"opacity .15s, transform .1s",minHeight:44});
const _BS=()=>({padding:"12px 20px",borderRadius:10,border:"1px solid "+B.border,background:"transparent",color:B.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,transition:"background .15s, border-color .15s",minHeight:44});
export const IS=new Proxy({},{get:(_,p)=>_IS()[p],ownKeys:()=>Object.keys(_IS()),getOwnPropertyDescriptor:(_,p)=>({value:_IS()[p],enumerable:true,configurable:true})});
export const LS=new Proxy({},{get:(_,p)=>_LS()[p],ownKeys:()=>Object.keys(_LS()),getOwnPropertyDescriptor:(_,p)=>({value:_LS()[p],enumerable:true,configurable:true})});
export const BP=new Proxy({},{get:(_,p)=>_BP()[p],ownKeys:()=>Object.keys(_BP()),getOwnPropertyDescriptor:(_,p)=>({value:_BP()[p],enumerable:true,configurable:true})});
export const BS=new Proxy({},{get:(_,p)=>_BS()[p],ownKeys:()=>Object.keys(_BS()),getOwnPropertyDescriptor:(_,p)=>({value:_BS()[p],enumerable:true,configurable:true})});

export function genPO(list){const n=new Date(),pfx=String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0");const mx=list.filter(p=>p.po_id&&p.po_id.startsWith(pfx)).reduce((m,p)=>{const s=parseInt(p.po_id.slice(4));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}
// Slugify free text for use in an RFQ reference (letters/digits, dash-separated).
export function slugify(s){return String(s||"").trim().replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").replace(/-{2,}/g,"-");}
// Build a unique RFQ ref: 3C-RFQ-<descriptor> (slugified) or a zero-padded
// sequence 3C-RFQ-0042 when no descriptor is given. Appends -2, -3, … on collision.
export function genRfqRef(list,descriptor){
  const existing=new Set((list||[]).map(r=>r.rfq_ref).filter(Boolean));
  let base;const slug=slugify(descriptor);
  if(slug){base="3C-RFQ-"+slug;}
  else{let mx=0;(list||[]).forEach(r=>{const m=/^3C-RFQ-(\d{4})$/.exec(r.rfq_ref||"");if(m){const n=parseInt(m[1]);if(n>mx)mx=n;}});base="3C-RFQ-"+String(mx+1).padStart(4,"0");}
  if(!existing.has(base))return base;
  let i=2;while(existing.has(base+"-"+i))i++;return base+"-"+i;
}
export function genProjectPO(list){const n=new Date(),pfx="PPO-"+String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0");const mx=list.filter(p=>p.po_id&&p.po_id.startsWith(pfx)).reduce((m,p)=>{const s=parseInt(p.po_id.slice(pfx.length));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}
// Format a date string for display. Handles YYYY-MM-DD (date-only, parsed as
// local to avoid UTC timezone shifting the day) and full ISO timestamps.
export function fmtDate(s,opts){if(!s)return"";const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(m)return new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString("en-US",opts);return new Date(s).toLocaleDateString("en-US",opts);}
export function fmtDateTime(s){if(!s)return"";return new Date(s).toLocaleString("en-US",{month:"numeric",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}

// --- Billing rates: single source of truth ---
// 3C's standard labor tiers + parts markup. A customer's own labor_tiers /
// parts_markup override these; this is the fallback so a NEW customer's first
// invoice isn't silently wrong. (Previously these numbers were re-hardcoded in
// Invoices, Reports, Proposals, and tryAutoInvoice and drifted: 25/30/35 markup,
// $120/$135 tiers scattered.)
export const DEFAULT_LABOR_TIERS=[{name:"Senior Technician",rate:120},{name:"Licensed Technician",rate:135}];
export const DEFAULT_PARTS_MARKUP=35;
export const getCustomerTiers=(customer)=>{
  if(customer&&Array.isArray(customer.labor_tiers)&&customer.labor_tiers.length>0)
    return customer.labor_tiers.map(t=>({name:t.name,rate:parseFloat(t.rate)||0}));
  return DEFAULT_LABOR_TIERS.map(t=>({...t}));
};
export const getPartsMarkup=(customer)=>customer&&customer.parts_markup!=null&&customer.parts_markup!==""?parseFloat(customer.parts_markup):DEFAULT_PARTS_MARKUP;

// --- Role-tailored alerts / notifications ---
// Customers whose completed WOs are NOT invoiced per-order (they close as projects /
// contract billing). These are excluded from the "ready to invoice" alert.
// Matched loosely so minor punctuation/casing variations still hit.
export const isInvoiceExcludedCustomer=(name)=>{const n=(name||"").toLowerCase();return n.includes("school of medicine")||(n.includes("duke")&&n.includes("facilities maintenance"));};
// A completed WO that a human should invoice: done, not yet invoiced, not part of a
// project (projects invoice separately), and not an excluded (project-billed) customer.
export const woReadyToInvoice=(wo)=>!!wo&&wo.status==="completed"&&!wo.invoiced&&!wo.project_id&&!isInvoiceExcludedCustomer(wo.customer);
// due_date is free text ("TBD", "", or YYYY-MM-DD) — overdue only when it's a real past date.
export const woOverdue=(wo,todayStr)=>{if(!wo||wo.status==="completed")return false;const d=wo.due_date;if(!/^\d{4}-\d{2}-\d{2}$/.test(d||""))return false;return d<(todayStr||new Date().toISOString().slice(0,10));};
// Role-tailored bell visibility: admins see everything; managers see manager+technician+
// global; technicians see technician+global. (for_role null = everyone.)
export const visibleNotifs=(notifs,role)=>{if(!Array.isArray(notifs))return[];if(role==="admin")return notifs;return notifs.filter(n=>{const r=n.for_role;if(!r)return true;if(role==="manager")return r==="manager"||r==="technician";return r==="technician";});};

export const GlobalStyles=()=><style>{`
html,body,#root{height:100%;margin:0;padding:0;overflow:hidden}
/* App shell height: 100vh falls back for old browsers; 100dvh (dynamic viewport)
   wins where supported so the bottom of the app isn't hidden behind mobile/tablet
   browser toolbars — otherwise trailing buttons become unreachable when scrolling. */
.app-root{height:100vh;height:100dvh}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.card-hover{transition:border-color .2s,box-shadow .2s,transform .15s}
.card-hover:hover{box-shadow:0 2px 12px rgba(0,0,0,0.15)}
.card-hover:active{transform:scale(0.985)}
.tab-content{animation:fadeIn .2s ease-out;-webkit-overflow-scrolling:touch}
.tab-content::-webkit-scrollbar{width:6px}
.tab-content::-webkit-scrollbar-track{background:transparent}
.tab-content::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.3);border-radius:3px}
.tab-content::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,0.5)}
.modal-card{max-height:85vh;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
@supports(max-height:100dvh){.modal-card{max-height:85dvh}}
@media(max-width:480px){.modal-card{padding:18px!important;width:100%!important;border-radius:14px!important}}
/* iOS auto-zooms (and doesn't zoom back) when a focused field's font is <16px,
   leaving the page zoomed/shifted so it looks "stuck". Force 16px on phones. */
@media(max-width:767px){input,select,textarea{font-size:16px!important}}
input[type="date"],input[type="time"]{cursor:pointer;position:relative}
input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0;cursor:pointer}
select{cursor:pointer}
`}</style>;

// Authenticated edge-function call: sends the signed-in user's access token
// (functions now reject the bare anon key — 2026-07-10 security hardening).
export async function fnFetch(name,payload){
  let token=SUPABASE_ANON_KEY;
  try{const{data:{session}}=await sb().auth.getSession();if(session?.access_token)token=session.access_token;}catch(e){}
  return fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(payload)});
}
