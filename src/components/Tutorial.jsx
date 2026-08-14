import React, { useState, useEffect, useRef, useCallback } from "react";
import { B, F, M, BP, BS, gotoTab } from "../shared";

/*
 * Interactive tutorial system — spotlight tours + hotspot tips.
 *
 * Design (researched against 2026 onboarding patterns — Appcues/ProductFruits/
 * Plotline guidance): INVITE, never hijack. Each page with a tour shows a small
 * dismissible chip the first time it's visited; the user chooses to take the
 * tour, skip it, or turn invitations off entirely. Tours are 3-6 steps, role-
 * filtered, and every step is skippable (✕ or Esc). A separate "hotspot tips"
 * mode overlays pulsing dots on controls tagged with data-tip; tapping a dot
 * explains the control. All preferences are per-device (localStorage), managed
 * from the Guide tab — nothing here blocks real work.
 *
 * Integration surface kept deliberately tiny:
 *   - Shell mounts <TutorialLayer tab={tab} role={user.role}/> once.
 *   - Spotlight targets are elements tagged data-tour="key" (a handful of
 *     stable chrome elements). Steps without a target render as centered cards.
 *   - Guide's controls use the exported tutorialPrefs helpers + startTour().
 */

// ── Preferences (per device) ──────────────────────────────────────────────
const LS_INVITES="fieldops-tut-invites";   // "on" (default) | "off"
const LS_TIPS="fieldops-tut-tips";         // "on" | "off" (default)
const LS_DONE="fieldops-tut-done";         // JSON: {tabKey:true}
export const tutorialPrefs={
  invitesOn:()=>localStorage.getItem(LS_INVITES)!=="off",
  setInvites:(on)=>localStorage.setItem(LS_INVITES,on?"on":"off"),
  tipsOn:()=>localStorage.getItem(LS_TIPS)==="on",
  setTips:(on)=>localStorage.setItem(LS_TIPS,on?"on":"off"),
  doneMap:()=>{try{return JSON.parse(localStorage.getItem(LS_DONE)||"{}");}catch(e){return{};}},
  markDone:(tab)=>{const m=tutorialPrefs.doneMap();m[tab]=true;localStorage.setItem(LS_DONE,JSON.stringify(m));},
  resetDone:()=>localStorage.removeItem(LS_DONE),
};
export const startTour=(tab)=>{
  // Jump to the tab first, then launch once it has mounted. Keys starting with
  // "_" (The Basics) run on whatever page is open — no tab switch.
  if(!tab.startsWith("_"))gotoTab(tab);
  setTimeout(()=>window.dispatchEvent(new CustomEvent("start-tour",{detail:tab})),250);
};

// ── Tour content ──────────────────────────────────────────────────────────
// target = data-tour key (omit for a centered card). Keep steps SHORT — one
// idea each, tied to what's on screen. roles limits who sees the tour.
export const TOURS={
  // The Basics — offered before anything else on a brand-new device. Every step
  // targets chrome that exists on every tab, so it can run from anywhere.
  _welcome:{title:"The Basics",steps:[
    {title:"Welcome to 3C FieldOps 👋",body:"This app runs the whole shop — jobs, hours, parts, paperwork. This 60-second tour shows you how to get around; each page then offers its own short tour when you first open it."},
    {target:"global-search",title:"Search finds everything",body:"Job numbers, customers, purchase orders, equipment — type a few letters and jump straight there. On a keyboard, Ctrl+K opens it from anywhere."},
    {title:"Tabs are grouped",body:"The buttons across the top (or the bar at the bottom on your phone) switch pages. Start with the first tab each morning — it's built to show what needs your attention."},
    {title:"The bell keeps you posted",body:"🔔 collects everything aimed at you: new assignments, approvals, overdue work. Tap an alert and it takes you to the thing itself."},
    {title:"Help is always on",body:"The Guide tab holds written how-tos, these tours (replay any time), and a Tips mode that puts tappable ⦿ dots on controls. If you're ever lost, start there."},
  ]},
  today:{title:"My Day",roles:["technician"],steps:[
    {title:"Your home base",body:"My Day shows the jobs assigned to you, today's logged hours, and anything still needing time. Start here every morning."},
    {target:"quick-log",title:"Log time in seconds",body:"This floating button is the fastest way to log hours — pick the job, hours, a short note, done. It follows you on every tab."},
    {title:"Reading a job card",body:"The colored edge is priority, the badge is status (orange Pending, blue Active, green Done). Tap any card to open the full job."},
    {target:"nav-groups",title:"Everything else",body:"All Orders has every job you can see, Week Plan lays out your week, Hours lists what you've logged, Knowledge holds the shop's repair guides."},
    {title:"Finishing a job",body:"Open the job → ✓ Done → confirm hours → customer signs on your screen. Enter their work-order number right there so the office doesn't have to chase it."},
    {title:"Stay reachable",body:"If a “Turn on job alerts” bar appears, tap Enable then Allow — you'll get a buzz when work is assigned to you. iPhones need the app added to the Home Screen first."},
  ]},
  overview:{title:"Overview",roles:["manager","admin"],steps:[
    {title:"Your command center",body:"Everything that needs attention surfaces here: KPIs, overdue work, service requests, repeat failures, and the live activity feed."},
    {target:"kpi-ranges",title:"Rolling windows",body:"Numbers default to the last 30 days so they never reset to zero on the 1st. Switch ranges any time — the ↑↓ arrows compare against the prior period."},
    {target:"kpi-tiles",title:"Tiles drill down",body:"Overdue WOs, Outstanding AR, and WOs Completed are clickable — and every row inside opens the actual work order or invoice."},
    {target:"wo-filters",title:"The TMS queue",body:"“TMS Needed” collects completed jobs still needing entry in the customer's system. Each row has a Copy button that formats the whole line for pasting."},
    {title:"Narrowing a long queue",body:"Under the buttons there's a search box and chips built from what's on screen — every customer and tech with a count. One tap on “Duke School Of Medicine 75” leaves just those, and the counts show you the shape of the backlog before you tap. Your pick is remembered."},
    {title:"Requests inbox",body:"Emails to service@ become drafts in Requests. Approving one creates a numbered work order — and now drops you straight onto it."},
  ]},
  pricebook:{title:"Price Book",roles:["manager","admin"],steps:[
    {title:"What every part costs",body:"This builds itself. Every pickup ticket and vendor bill a tech scans drops its line items in here — part number, price, vendor, date. Nobody maintains a catalog."},
    {title:"Spotting a bad price",body:"“Wide price swings” lists the parts where what you pay moves most. Tap one to see every price ever charged. If the same part bounces between two prices, that's usually two price files at the supplier — worth a phone call, not an accusation."},
    {title:"Compare to elsewhere",body:"Open a part → Add a price → Reference, and enter what another supply house charges. The “Cheaper elsewhere” view then shows the gap. Reference prices never touch job costing — they exist only to compare."},
    {title:"It cuts both ways",body:"Half the time your usual supplier wins. When they beat the outside price the card says so, so you keep buying the things they're genuinely good on and move only what you shouldn't."},
  ]},
  orders:{title:"Work Orders",steps:[
    {target:"wo-search",title:"Find any job",body:"Search hits job numbers, titles, customers, locations, assignees, and the customer's own WO number."},
    {target:"wo-new",title:"New work order",body:"Create a job here — title, customer, priority, due date, assignee. It lands on the assigned tech's My Day instantly, with a push alert."},
    {title:"What the statuses mean",body:"Pending (orange) = not started. Active (blue) = someone's on it — logging time flips this automatically. Done (green) = completed and signed."},
    {title:"Cards do things",body:"Swipe right to start a job, swipe left to complete — completing always goes through Review & Sign so nothing skips the signature. The TMS button marks customer-system entry."},
    {title:"Inside a job",body:"Call and Navigate chips at the top, then time, photos, purchase orders, equipment, and completion — everything about the job in one place."},
    {roles:["manager","admin"],title:"Manager extras",body:"Edit any job, set an NTE spending cap (tracks labor AND parts), see the AI job summary, and bill straight from a completed job with the green button."},
  ]},
  inbox:{title:"Requests",roles:["manager","admin"],steps:[
    {title:"Email becomes work",body:"Emails sent to service@ appear here as drafts — the AI pulls out the customer, location, and problem for you."},
    {title:"Approve & go",body:"Review, tweak anything, Approve & Create WO. You land on the new numbered job immediately, ready to assign. Rejected requests keep a record too."},
  ]},
  users:{title:"Users",roles:["admin"],steps:[
    {title:"The roster",body:"Add someone with their Gmail and a role — Technician, Manager, or Admin — and they can sign in immediately. New techs get the welcome email automatically."},
    {title:"Roles set what they see",body:"Techs see their own jobs and hours — no pricing, no invoices. Managers add approvals and money screens. Deactivate keeps history but blocks sign-in."},
  ]},
  feedback:{title:"Feedback",roles:["manager","admin"],steps:[
    {title:"How'd we do?",body:"When an invoice is sent, the customer gets a one-tap rating link automatically. Scores and comments collect here — worth a glance each week."},
  ]},
  team:{title:"Team",roles:["manager","admin"],steps:[
    {title:"Who's doing what",body:"Each tech's active jobs, completions, and logged hours, plus a live Online badge when they have the app open."},
  ]},
  planner:{title:"Week Plan",steps:[
    {title:"The week at a glance",body:"Jobs appear under the day they're due, with batching hints when several land at the same site. Tap any job to open it."},
    {title:"Reschedule inline",body:"Managers see a small date box on each row — change it and the job moves. No more opening the job just to push a date."},
  ]},
  time:{title:"Hours",roles:["technician"],steps:[
    {title:"Your logged time",body:"Every entry you've made, newest first. Tap one to fix hours or wording — it updates the job too."},
    {title:"Daily guard",body:"The app blocks accidental >12h days and rounds to the quarter hour, matching how billing works."},
  ]},
  pos:{title:"Purchase Orders",roles:["manager","admin"],steps:[
    {target:"po-new",title:"Create instantly",body:"Parts run? Create the PO here — you're auto-assigned as its tech, and more techs can be attached on the card."},
    {title:"The approval lane",body:"Pending POs show an inline amount box + Approve right on the card — set the real amount and approve in one motion. Small POs under your threshold skip approval automatically."},
    {title:"Approve from anywhere",body:"PO requests also land in the 🔔 bell with Approve / Reject buttons — you never have to come to this tab just to unblock a tech at the counter."},
    {title:"Counter tickets",body:"The 🧾 button snaps the supply-house ticket at pickup. Those tickets power the Supply Audit's 3-way match against vendor bills."},
    {title:"Paperwork",body:"PO Form makes a signed-looking PDF for vendors that require one; Preview shows it without downloading."},
  ]},
  invoices:{title:"Invoices",roles:["manager","admin"],steps:[
    {target:"inv-create",title:"Three-step generator",body:"Pick the customer and jobs, confirm hours and rates, generate. Rates come from the customer's saved tiers — no math by hand."},
    {title:"One row = one invoice",body:"Each row shows status and age: Draft (orange) hasn't gone out, Sent (blue) is awaiting payment and turns red past the overdue threshold, Paid (green) is done. Tap a row to expand its jobs, labor, and parts."},
    {title:"Send = sent",body:"Send emails the PDF and marks the invoice sent in one motion — the customer feedback request goes out automatically. Schedule-send delivers early next morning and still updates the tracker."},
    {title:"Getting paid",body:"Mark Paid stamps the date and feeds Avg-Days-to-Pay and the AR tiles on Overview. Excel and PDF re-download any invoice exactly as issued."},
  ]},
  billing:{title:"Billing",roles:["manager","admin"],steps:[
    {title:"Timesheet exports",body:"For customers billed through their own system (Duke SoM, Facilities), export the completed-work table here — copy it, download Excel, or email it directly. Every row opens its work order."},
  ]},
  parts:{title:"Parts Sales",roles:["manager","admin"],steps:[
    {title:"Dropship billing",body:"Bill parts with no work order — it creates a normal invoice. Link the vendor PO so the same part can never be billed twice, and the SHIP TO box prints on the PDF."},
  ]},
  audit:{title:"Supply Audit",roles:["manager","admin"],steps:[
    {title:"Catch billing errors",body:"Techs snap counter tickets at pickup; when the vendor's bill arrives, scan it and the app matches every line — price, quantity, missing tickets — and flags what doesn't add up."},
    {title:"No ticket? Still checked",body:"If a bill line has no pickup ticket, the Price Book stands in — a price above the most you've ever paid gets flagged, a line over $1,000 asks you to confirm delivery, and anything at its normal price passes quietly. Catching a wrong QUANTITY still needs the counter ticket, so keep snapping them."},
  ]},
  rfqs:{title:"RFQs",steps:[
    {title:"Price requests",body:"Draft a parts pricing request, a manager approves, and it emails the vendor as a branded document. Record their quote on the line items."},
    {title:"Quote → PO",body:"Once quoted, the → PO button turns the whole quote into a purchase order — items, prices, vendor — no retyping."},
  ]},
  reports:{title:"Reports",roles:["manager","admin"],steps:[
    {title:"Rolling numbers",body:"Defaults to the last 30 days with change-vs-prior arrows. Revenue by Customer uses real invoiced amounts, not estimates. Export CSV or PDF for meetings."},
  ]},
  customers:{title:"Customers",roles:["manager","admin"],steps:[
    {title:"Rates live here",body:"Each customer's labor tiers, parts markup, and payment terms feed every invoice automatically. Auto-invoice drafts one the moment their job completes."},
  ]},
  kb:{title:"Knowledge Base",steps:[
    {title:"The shop's brain",body:"Repair procedures with photos exactly where you need them — search by symptom, part number, or model. Anyone can submit an article; managers approve."},
  ]},
  equipment:{title:"Equipment",steps:[
    {title:"Track the machines",body:"Register a unit once — model, serial, refrigerant — and every job on it builds a service history. Scan its asset tag on site to pull it up instantly."},
  ]},
  projects:{title:"Projects",steps:[
    {title:"Big jobs, organized",body:"Chambers, milestones, parts, files, and photos in one place. Checking off a milestone prompts for record photos. Work orders link back to their project."},
  ]},
  calendar:{title:"Calendar",steps:[
    {title:"The month view",body:"Due jobs, logged hours per day, and company events together. Tap a day for details — every job listed opens with one tap."},
  ]},
  settings:{title:"Settings",roles:["admin"],steps:[
    {title:"The controls are real",body:"Default rates, parts markup, payment terms, the overdue threshold, and the feedback-email toggle here all feed the live app. Email templates and automation workflows live here too."},
  ]},
};

// ── Layer ─────────────────────────────────────────────────────────────────
// Steps can carry their own roles list (e.g. a manager-only step inside a tour
// everyone sees) — resolve the effective steps for a role here.
export const stepsForRole=(tour,role)=>tour.steps.filter(s=>!s.roles||s.roles.includes(role));

export function TutorialLayer({tab,role}){
  const[tourTab,setTourTab]=useState(null);
  const[step,setStep]=useState(0);
  const[inviteFor,setInviteFor]=useState(null);
  const[tipsOn,setTipsOn]=useState(tutorialPrefs.tipsOn());
  const tour=tourTab?TOURS[tourTab]:null;
  const roleOk=(t)=>!t.roles||t.roles.includes(role);

  // Invite chip: brand-new device gets "The Basics" first; after that, each
  // tab with a tour offers itself on first visit.
  useEffect(()=>{
    setInviteFor(null);
    if(tourTab)return;
    if(!tutorialPrefs.invitesOn())return;
    const done=tutorialPrefs.doneMap();
    let offer=null;
    if(!done._welcome&&Object.keys(done).length===0)offer="_welcome";
    else{const t=TOURS[tab];if(t&&roleOk(t)&&!done[tab])offer=tab;}
    if(!offer)return;
    const id=setTimeout(()=>setInviteFor(offer),900);
    return()=>clearTimeout(id);
  // eslint-disable-next-line
  },[tab,tourTab]);

  // Guide "start tour" requests.
  useEffect(()=>{
    const h=(e)=>{const k=e.detail;if(TOURS[k]&&roleOk(TOURS[k])){setStep(0);setTourTab(k);setInviteFor(null);}};
    window.addEventListener("start-tour",h);
    const p=()=>setTipsOn(tutorialPrefs.tipsOn());
    window.addEventListener("tut-prefs-changed",p);
    return()=>{window.removeEventListener("start-tour",h);window.removeEventListener("tut-prefs-changed",p);};
  // eslint-disable-next-line
  },[role]);

  const endTour=(markDone)=>{if(markDone&&tourTab){tutorialPrefs.markDone(tourTab);window.dispatchEvent(new Event("tut-done-changed"));}setTourTab(null);setStep(0);};

  return(<>
    {inviteFor&&!tourTab&&<InviteChip title={TOURS[inviteFor].title}
      onStart={()=>{setStep(0);setTourTab(inviteFor);setInviteFor(null);}}
      onSkip={()=>{tutorialPrefs.markDone(inviteFor);setInviteFor(null);}}
      onNever={()=>{tutorialPrefs.setInvites(false);setInviteFor(null);}}/>}
    {tour&&<TourOverlay tour={{...tour,steps:stepsForRole(tour,role)}} step={step} setStep={setStep} onClose={(finished)=>endTour(finished!==false)}/>}
    {tipsOn&&!tour&&<HotspotLayer tab={tab}/>}
  </>);
}

// ── Invite chip (never blocks the page) ──────────────────────────────────
function InviteChip({title,onStart,onSkip,onNever}){
  return(<div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:"max(84px, calc(64px + env(safe-area-inset-bottom)))",zIndex:1180,background:B.surface,border:"1px solid "+B.cyan+"55",borderRadius:12,boxShadow:"0 8px 30px rgba(0,0,0,.35)",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,maxWidth:"min(94vw,460px)",animation:"fadeIn .25s ease-out"}}>
    <span style={{fontSize:18}}>👋</span>
    <span style={{fontSize:12,color:B.text,fontWeight:600,whiteSpace:"nowrap"}}>Quick tour of {title}?</span>
    <button onClick={onStart} style={{...BP,padding:"6px 12px",fontSize:11}}>Show me</button>
    <button onClick={onSkip} style={{...BS,padding:"6px 10px",fontSize:11}}>Skip</button>
    <button onClick={onNever} title="Stop offering tours (re-enable any time in the Guide tab)" style={{background:"none",border:"none",color:B.textDim,fontSize:10,cursor:"pointer",whiteSpace:"nowrap"}}>Don't offer</button>
  </div>);
}

// ── Spotlight tour overlay ────────────────────────────────────────────────
function TourOverlay({tour,step,setStep,onClose}){
  const steps=tour.steps;
  const s=steps[Math.min(step,steps.length-1)];
  const[rect,setRect]=useState(null);
  const isMobile=window.innerWidth<768;

  const locate=useCallback(()=>{
    if(!s.target){setRect(null);return;}
    const el=document.querySelector('[data-tour="'+s.target+'"]');
    if(!el){setRect(null);return;}
    el.scrollIntoView({block:"center",behavior:"smooth"});
    // measure after the scroll settles
    setTimeout(()=>{const r=el.getBoundingClientRect();setRect({top:r.top,left:r.left,width:r.width,height:r.height});},280);
    const r=el.getBoundingClientRect();setRect({top:r.top,left:r.left,width:r.width,height:r.height});
  },[s]);
  useEffect(()=>{locate();const on=()=>locate();window.addEventListener("resize",on);window.addEventListener("scroll",on,true);return()=>{window.removeEventListener("resize",on);window.removeEventListener("scroll",on,true);};},[locate]);
  useEffect(()=>{const k=(e)=>{if(e.key==="Escape")onClose(false);if(e.key==="ArrowRight"&&step<steps.length-1)setStep(step+1);if(e.key==="ArrowLeft"&&step>0)setStep(step-1);};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k);// eslint-disable-next-line
  },[step]);

  const last=step>=steps.length-1;
  const pad=6;
  // Card position: under/over the spotlight on desktop; bottom sheet on mobile or when centered.
  let cardStyle;
  if(!rect||isMobile){
    cardStyle=rect&&isMobile
      ?{position:"fixed",left:10,right:10,bottom:"max(14px, env(safe-area-inset-bottom))",zIndex:1202}
      :{position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",zIndex:1202,width:"min(92vw,420px)"};
  }else{
    const below=rect.top+rect.height+180<window.innerHeight;
    cardStyle={position:"fixed",zIndex:1202,width:"min(92vw,400px)",
      left:Math.max(12,Math.min(rect.left,window.innerWidth-412)),
      ...(below?{top:rect.top+rect.height+pad+10}:{bottom:window.innerHeight-rect.top+pad+10})};
  }
  return(<div style={{position:"fixed",inset:0,zIndex:1200}}>
    {/* dim layer — a spotlight ring is punched out around the target via box-shadow */}
    {rect
      ?<div style={{position:"fixed",top:rect.top-pad,left:rect.left-pad,width:rect.width+pad*2,height:rect.height+pad*2,borderRadius:10,boxShadow:"0 0 0 9999px rgba(0,0,0,.62)",border:"2px solid "+B.cyan,pointerEvents:"none",transition:"all .25s ease",zIndex:1201}}/>
      :<div onClick={()=>onClose(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.62)",zIndex:1201}}/>}
    {rect&&<div onClick={()=>onClose(false)} style={{position:"fixed",inset:0,zIndex:1200}}/>}
    <div style={{...cardStyle,background:B.surface,border:"1px solid "+B.border,borderRadius:14,boxShadow:"0 16px 50px rgba(0,0,0,.5)",padding:"16px 18px",fontFamily:F,animation:"fadeIn .2s ease-out"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{fontSize:14,fontWeight:700,color:B.text}}>{s.title}</div>
        <button onClick={()=>onClose(false)} title="Close tour (Esc)" style={{background:"none",border:"none",color:B.textDim,fontSize:16,cursor:"pointer",lineHeight:1,padding:2}}>✕</button>
      </div>
      <div style={{fontSize:12.5,color:B.textMuted,lineHeight:1.55,marginTop:6}}>{s.body}</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14}}>
        <span style={{fontFamily:M,fontSize:10,color:B.textDim,flexShrink:0}}>{step+1} of {steps.length}</span>
        <div style={{display:"flex",gap:4,flex:1}}>
          {steps.map((_,i)=><span key={i} style={{width:6,height:6,borderRadius:3,background:i===step?B.cyan:B.border,transition:"background .2s"}}/>)}
        </div>
        {step>0&&<button onClick={()=>setStep(step-1)} style={{...BS,padding:"7px 12px",fontSize:11}}>Back</button>}
        <button onClick={()=>last?onClose(true):setStep(step+1)} style={{...BP,padding:"7px 16px",fontSize:11}}>{last?"Done ✓":"Next"}</button>
      </div>
    </div>
  </div>);
}

// ── Hotspot tips ("tooltips mode") ────────────────────────────────────────
// Pulsing dots over anything tagged data-tip; tap/hover a dot to read the tip.
function HotspotLayer({tab}){
  const[spots,setSpots]=useState([]);
  const[openTip,setOpenTip]=useState(null); // {text, x, y}
  const scan=useCallback(()=>{
    const els=[...document.querySelectorAll("[data-tip]")];
    setSpots(els.filter(el=>el.offsetParent!==null).map((el,i)=>{
      const r=el.getBoundingClientRect();
      return{id:i,text:el.getAttribute("data-tip"),x:r.right-4,y:r.top-4};
    }).filter(s=>s.y>0&&s.y<window.innerHeight));
  },[]);
  useEffect(()=>{
    setOpenTip(null);
    const t1=setTimeout(scan,600);const t2=setTimeout(scan,1600);
    const on=()=>{scan();setOpenTip(null);};
    window.addEventListener("resize",on);window.addEventListener("scroll",on,true);
    // Detail views (a work order, an invoice row, a modal) render without a tab
    // change — watch the DOM so their dots appear too. Debounced to stay cheap.
    let deb=null;
    const mo=new MutationObserver(()=>{clearTimeout(deb);deb=setTimeout(scan,400);});
    mo.observe(document.body,{childList:true,subtree:true});
    // Belt & braces: a slow interval guarantees dots converge even if a render
    // path slips past the observer (the query is ~1ms on this DOM size).
    const iv=setInterval(scan,1200);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(deb);clearInterval(iv);mo.disconnect();window.removeEventListener("resize",on);window.removeEventListener("scroll",on,true);};
  },[tab,scan]);
  return(<>
    {/* Reminder pill — makes it obvious tips mode is on and how to leave it */}
    <div style={{position:"fixed",right:14,bottom:"max(14px, env(safe-area-inset-bottom))",zIndex:1152,background:B.surface,border:"1px solid "+B.cyan+"55",borderRadius:20,padding:"6px 12px",display:"flex",alignItems:"center",gap:8,boxShadow:"0 6px 20px rgba(0,0,0,.3)"}}>
      <span style={{width:10,height:10,borderRadius:5,background:B.cyan,animation:"tutPulse 2s ease-in-out infinite",flexShrink:0}}/>
      <span style={{fontSize:11,fontWeight:600,color:B.text,fontFamily:F}}>Tips on — tap a dot</span>
      <button onClick={()=>{localStorage.setItem("fieldops-tut-tips","off");window.dispatchEvent(new Event("tut-prefs-changed"));}} style={{background:"none",border:"none",color:B.textDim,fontSize:11,cursor:"pointer",padding:0,fontWeight:700}}>turn off</button>
    </div>
    {spots.map(s=><button key={s.id} onClick={(e)=>{e.stopPropagation();setOpenTip(openTip&&openTip.id===s.id?null:{...s});}}
      title="What's this?"
      style={{position:"fixed",top:s.y,left:s.x,width:14,height:14,borderRadius:"50%",background:B.cyan,border:"2px solid "+B.bg,cursor:"pointer",zIndex:1150,padding:0,animation:"tutPulse 2s ease-in-out infinite"}}/>)}
    {openTip&&<div style={{position:"fixed",top:Math.min(openTip.y+20,window.innerHeight-120),left:Math.max(10,Math.min(openTip.x-140,window.innerWidth-300)),width:280,zIndex:1151,background:B.surface,border:"1px solid "+B.cyan+"55",borderRadius:10,boxShadow:"0 10px 30px rgba(0,0,0,.4)",padding:"10px 12px",fontSize:12,color:B.text,lineHeight:1.5,fontFamily:F}}
      onClick={()=>setOpenTip(null)}>{openTip.text}</div>}
  </>);
}
