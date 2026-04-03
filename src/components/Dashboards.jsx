import React, { useState } from "react";
import { sb, B, F, M, IS, LS, BP, BS, SC, SL, ROLES, haptic, cleanText, calcWOHours } from "../shared";
import { Card, Badge, StatCard, Modal, EmptyState, Toast } from "./ui";
import { KPIDashboard, DashAnalytics } from "./KPIDashboard";
import { Reports } from "./Reports";
import { CustomerMgmt } from "./Customers";
import { UserMgmt } from "./Users";
import { Settings } from "./Settings";
import { CompanyCalendar } from "./Calendar";
import { KnowledgeBase } from "./KnowledgeBase";
import { RecurringPM } from "./RecurringPM";
import { ServiceRequests } from "./ServiceRequests";
import { FeedbackDashboard } from "./Feedback";
import { ProposalDashboard } from "./Proposals";
import { Projects } from "./Projects";
import { WOList, WOOverview } from "./WorkOrders";
import { Shell } from "./Shell";
import { TimeLog } from "./TimeTracking";
import { BillingExport } from "./Billing";
import { InvoiceDashboard } from "./Invoices";
import { POMgmt } from "./PurchaseOrders";
import { GlobalActivityFeed } from "./ActivityLog";
import { EquipmentDashboard } from "./Equipment";

function TechDash({user,onLogout,D,A,syncing,offlineMode,offlineQueueCount}){
  const[tab,setTab]=useState("today");const[navWOId,setNavWOId]=useState(null);
  const[quickLog,setQuickLog]=useState(false),[qlWO,setQlWO]=useState(""),[qlH,setQlH]=useState(""),[qlD,setQlD]=useState(""),[qlDate,setQlDate]=useState(new Date().toISOString().slice(0,10)),[qlSaving,setQlSaving]=useState(false);
  const my=D.wos.filter(o=>o.assignee===user.name||(o.crew&&o.crew.includes(user.name)));
  const myActive=my.filter(o=>o.status!=="completed");
  const myCompleted=my.filter(o=>o.status==="completed");
  const myTime=D.time.filter(t=>t.technician===user.name);
  const todayStr=new Date().toISOString().slice(0,10);
  const todayHours=myTime.filter(t=>t.logged_date===todayStr).reduce((s,t)=>s+parseFloat(t.hours||0),0);
  const recentWOs=[...my].sort((a,b)=>{const aT=D.time.filter(t=>t.wo_id===a.id).sort((x,y)=>(y.logged_date||"").localeCompare(x.logged_date||""))[0];const bT=D.time.filter(t=>t.wo_id===b.id).sort((x,y)=>(y.logged_date||"").localeCompare(x.logged_date||""))[0];return((bT?.logged_date||b.created_at)||"").localeCompare((aT?.logged_date||a.created_at)||"");}).slice(0,5);
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,equipment:D.equipment||[],userName:user.name,userRole:user.role,loadData:A.loadData,navWOId,clearNavWO:()=>setNavWOId(null)};
  const submitQuickLog=async()=>{if(!qlWO||!qlH||qlSaving)return;if(cleanText(qlD,"Description")===null)return;setQlSaving(true);const h=parseFloat(qlH)||0;await A.addTime({wo_id:qlWO,hours:h,description:qlD.trim()||"Work performed",logged_date:qlDate});setQlSaving(false);setQuickLog(false);setQlWO("");setQlH("");setQlD("");};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} offlineQueueCount={offlineQueueCount} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} onNavigateWO={(woId)=>{setTab("orders");if(woId)setNavWOId(woId);}} onRefresh={A.loadData} tabs={[{key:"today",label:"My Day",icon:"📍"},{key:"orders",label:"All Orders",icon:"📋"},{key:"time",label:"Hours",icon:"⏱"},{key:"equipment",label:"Equipment",icon:"🔧"},{key:"calendar",label:"Calendar",icon:"📅"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="calendar"&&<CompanyCalendar userRole={user.role} wos={D.wos} userName={user.name}/>}
    {tab==="today"&&<>{(()=>{const noTimeToday=myActive.filter(o=>o.status==="in_progress"&&!D.time.some(t=>t.wo_id===o.id&&t.logged_date===todayStr));const isAfternoon=new Date().getHours()>=15;return<>
      {noTimeToday.length>0&&<div style={{background:B.orange+"15",border:"1px solid "+B.orange+"33",borderRadius:8,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>⏰</span><span style={{fontSize:13,fontWeight:700,color:B.orange}}>You have {noTimeToday.length} active WO{noTimeToday.length!==1?"s":""} with no time logged today</span></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{noTimeToday.map(wo=><span key={wo.id} style={{fontFamily:M,fontSize:11,color:B.cyan,background:B.cyan+"18",padding:"3px 8px",borderRadius:4,cursor:"pointer"}} onClick={()=>{setQlWO(wo.id);setQuickLog(true);}}>{wo.wo_id}</span>)}</div>
      </div>}
      {isAfternoon&&todayHours<4&&myActive.length>0&&<div style={{background:B.red+"15",border:"1px solid "+B.red+"33",borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16}}>⚠️</span>
        <div style={{fontSize:12,color:B.red,fontWeight:600}}>It's past 3pm and you have only {todayHours.toFixed(1)}h logged today. Don't forget to log your time before end of day.</div>
      </div>}
      </>;})()}
      <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <StatCard label="Active Jobs" value={myActive.length} icon="🔧" color={B.cyan}/>
        <StatCard label="Today's Hours" value={todayHours.toFixed(1)+"h"} icon="⏱" color={B.green}/>
        <StatCard label="Completed" value={myCompleted.length} icon="✓" color={B.green}/>
      </div>
      {/* My Performance Stats */}
      {(()=>{const thirtyDays=new Date(Date.now()-30*86400000);const myCompleted30=my.filter(o=>o.status==="completed"&&o.date_completed&&new Date(o.date_completed)>=thirtyDays);
        const ftfr=myCompleted30.length>0?(()=>{let fixed=0;myCompleted30.forEach(wo=>{const dc=new Date(wo.date_completed);const followUp=D.wos.find(o=>o.id!==wo.id&&o.customer===wo.customer&&o.location===wo.location&&o.created_at&&new Date(o.created_at)>dc&&new Date(o.created_at)<new Date(dc.getTime()+30*86400000));if(!followUp)fixed++;});return Math.round((fixed/myCompleted30.length)*100);})():0;
        const weekHrs=myTime.filter(t=>{const d=new Date(t.logged_date);return d>=new Date(new Date().setDate(new Date().getDate()-7));}).reduce((s,t)=>s+parseFloat(t.hours||0),0);
        const avail=parseFloat(user.available_hours_week||40);const util=avail>0?Math.round((weekHrs/avail)*100):0;
        return <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <Card style={{flex:"1 1 100px",minWidth:100,padding:"10px 14px"}}><div style={{fontSize:8,color:B.textDim,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>Fix Rate (30d)</div><div style={{fontSize:20,fontWeight:900,fontFamily:M,color:ftfr>=85?B.green:ftfr>=70?B.orange:B.red}}>{ftfr}%</div></Card>
          <Card style={{flex:"1 1 100px",minWidth:100,padding:"10px 14px"}}><div style={{fontSize:8,color:B.textDim,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>Week Utilization</div><div style={{fontSize:20,fontWeight:900,fontFamily:M,color:util>=80?B.green:util>=60?B.orange:B.red}}>{util}%</div></Card>
          <Card style={{flex:"1 1 100px",minWidth:100,padding:"10px 14px"}}><div style={{fontSize:8,color:B.textDim,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>Week Hours</div><div style={{fontSize:20,fontWeight:900,fontFamily:M,color:B.cyan}}>{weekHrs.toFixed(1)}h</div></Card>
        </div>;})()}
      {recentWOs.length>0&&<div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,marginBottom:10,textTransform:"uppercase",letterSpacing:0.8}}>Recent</div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:6}}>{recentWOs.map(wo=>{const sc=wo.status==="completed"?B.green:wo.status==="in_progress"?B.cyan:B.orange;return <div key={wo.id} onClick={()=>{setTab("orders");setNavWOId(wo.id);haptic(15);}} style={{minWidth:148,padding:"12px 14px",background:B.surface,border:"1px solid "+B.border,borderLeft:"3px solid "+sc,borderRadius:10,cursor:"pointer",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",transition:"transform .15s, box-shadow .15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.12)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
          <div style={{fontSize:10,fontFamily:M,color:B.textDim,fontWeight:600}}>{wo.wo_id}</div>
          <div style={{fontSize:12,fontWeight:700,color:B.text,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wo.title}</div>
          <div style={{fontSize:10,color:sc,marginTop:4,fontWeight:600}}>{wo.status==="completed"?"✓ Done":wo.status==="in_progress"?"● Active":"○ Pending"}</div>
        </div>})}</div>
      </div>}
      {myActive.length>0&&<div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,marginBottom:10,textTransform:"uppercase",letterSpacing:0.8}}>Active Jobs</div>
        <WOList orders={myActive} {...wlp}/>
      </div>}
      {myActive.length===0&&<EmptyState icon="✅" title="All caught up!" subtitle="No active work orders right now. Enjoy the downtime."/>}
      {myCompleted.length>0&&<div>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,marginBottom:10,textTransform:"uppercase",letterSpacing:0.8}}>Recently Completed</div>
        <WOList orders={myCompleted.slice(0,3)} {...wlp}/>
      </div>}
      {/* Floating Quick Log Button */}
      <button onClick={()=>{setQuickLog(true);haptic(30);}} style={{position:"fixed",bottom:"max(90px, calc(70px + env(safe-area-inset-bottom)))",right:20,width:58,height:58,borderRadius:"50%",background:`linear-gradient(135deg,${B.cyan},${B.cyanDark})`,border:"none",color:B.bg,fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,212,245,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150,animation:"pulseGlow 3s ease-in-out infinite",transition:"transform .15s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.08)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>⏱</button>
      {quickLog&&<Modal title="Quick Log Time" onClose={()=>setQuickLog(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={LS}>Work Order</label><select value={qlWO} onChange={e=>setQlWO(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select WO —</option>{myActive.map(wo=><option key={wo.id} value={wo.id}>{wo.wo_id} — {wo.title}</option>)}</select></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>Hours</label><input value={qlH} onChange={e=>setQlH(e.target.value)} type="number" step="0.25" placeholder="1.5" style={{...IS,fontFamily:M,fontSize:16,padding:14}}/></div>
            <div><label style={LS}>Date</label><input value={qlDate} onChange={e=>setQlDate(e.target.value)} type="date" style={{...IS,padding:14}}/></div>
          </div>
          <div><label style={LS}>What was done?</label><input value={qlD} onChange={e=>setQlD(e.target.value)} placeholder="Describe work..." style={{...IS,padding:14}}/></div>
          <button onClick={submitQuickLog} disabled={qlSaving||!qlWO||!qlH} style={{...BP,width:"100%",padding:14,opacity:(qlSaving||!qlWO||!qlH)?.6:1}}>{qlSaving?"Logging...":"Log Time"}</button>
        </div>
      </Modal>}
    </>}
    {tab==="orders"&&<WOList orders={my} {...wlp}/>}
    {tab==="time"&&<TimeLog timeEntries={myTime} wos={D.wos}/>}
    {tab==="projects"&&<Projects projects={(D.projects||[]).filter(p=>(p.assigned_techs||[]).includes(user.name)||p.status==="active")} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="equipment"&&<EquipmentDashboard D={D} A={A} userRole={user.role} userName={user.name}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

function MgrDash({user,onLogout,D,A,syncing,offlineMode,offlineQueueCount}){
  const[tab,setTab]=useState("overview");const[navWOId,setNavWOId]=useState(null);
  const pendingDrafts=(D.woDrafts||[]).filter(d=>d.status==="pending_review").length;
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,equipment:D.equipment||[],userName:user.name,userRole:user.role,loadData:A.loadData,navWOId,clearNavWO:()=>setNavWOId(null)};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} offlineQueueCount={offlineQueueCount} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} onNavigateWO={(woId)=>{setTab("orders");if(woId)setNavWOId(woId);}} onRefresh={A.loadData} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"inbox",label:"Requests"+(pendingDrafts?" ("+pendingDrafts+")":""),icon:"📬"},{key:"orders",label:"Work Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"invoices",label:"Invoices",icon:"📝"},{key:"feedback",label:"Feedback",icon:"⭐"},{key:"equipment",label:"Equipment",icon:"🔧"},{key:"team",label:"Team",icon:"👥"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"},{key:"calendar",label:"Calendar",icon:"📅"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="overview"&&<><KPIDashboard D={D} A={A} userRole={user.role} userName={user.name}/>{pendingDrafts>0&&<Card onClick={()=>setTab("inbox")} style={{padding:"14px 18px",marginBottom:12,borderLeft:"3px solid "+B.orange,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>📬</span><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>Service Requests</div><div style={{fontSize:11,color:B.textMuted}}>{pendingDrafts} pending review</div></div></div><span style={{background:B.orange,color:B.bg,padding:"4px 10px",borderRadius:12,fontSize:13,fontWeight:800,fontFamily:M}}>{pendingDrafts}</span></div></Card>}<WOOverview orders={D.wos} wlp={wlp} pos={D.pos} time={D.time}/><GlobalActivityFeed/></>}
    {tab==="inbox"&&<ServiceRequests drafts={D.woDrafts||[]} customers={D.customers} users={D.users} onApprove={A.approveDraft} onReject={A.rejectDraft}/>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} onDeletePO={A.deletePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users} customers={D.customers}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers} emailTemplates={D.emailTemplates} currentUser={user}/>}
    {tab==="feedback"&&<FeedbackDashboard D={D}/>}
    {tab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{D.users.filter(u=>u.role==="technician"&&u.active!==false).map(t=>{const to=D.wos.filter(o=>o.assignee===t.name);return(<Card key={t.id} style={{padding:"14px 18px"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:8,background:ROLES.technician.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800}}>{t.name.split(" ").map(n=>n[0]).join("")}</div><div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim}}>{to.filter(o=>o.status==="in_progress").length} active · {to.filter(o=>o.status==="completed").length} done · {to.reduce((s,o)=>s+calcWOHours(o.id,D.time),0).toFixed(1)}h</div></div>{(D.onlineUsers||[]).includes(t.name)?<Badge color={B.green}>Online</Badge>:<Badge color={B.textDim}>Offline</Badge>}</div></Card>);})}</div>}
    {tab==="invoices"&&<InvoiceDashboard invoices={D.invoices||[]} onUpdateInvoice={A.updateInvoice} onDeleteInvoice={A.deleteInvoice} onCreateInvoice={A.createInvoice} wos={D.wos} pos={D.pos} time={D.time} users={D.users} customers={D.customers}/>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer} wos={D.wos} time={D.time} pos={D.pos}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="projects"&&<Projects projects={D.projects||[]} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="calendar"&&<CompanyCalendar userRole={user.role} wos={D.wos} userName={user.name}/>}
    {tab==="equipment"&&<EquipmentDashboard D={D} A={A} userRole={user.role} userName={user.name}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

function AdminDash({user,onLogout,D,A,syncing,offlineMode,offlineQueueCount}){
  const[tab,setTab]=useState("overview");const[navWOId,setNavWOId]=useState(null);
  const pendingDrafts=(D.woDrafts||[]).filter(d=>d.status==="pending_review").length;
  const wlp={canEdit:true,pos:D.pos,onCreatePO:A.createPO,onUpdateWO:A.updateWO,onDeleteWO:A.deleteWO,onCreateWO:A.createWO,timeEntries:D.time,photos:D.photos,onAddTime:A.addTime,onUpdateTime:A.updateTime,onDeleteTime:A.deleteTime,onAddPhoto:A.addPhoto,users:D.users,customers:D.customers,equipment:D.equipment||[],userName:user.name,userRole:user.role,loadData:A.loadData,navWOId,clearNavWO:()=>setNavWOId(null)};
  return(<Shell user={user} onLogout={onLogout} tab={tab} setTab={setTab} syncing={syncing} offlineQueueCount={offlineQueueCount} notifications={D.notifs} onMarkRead={A.markRead} onQuickApprovePO={A.quickApprovePO} onQuickRejectPO={A.quickRejectPO} onNavigateWO={(woId)=>{setTab("orders");if(woId)setNavWOId(woId);}} onRefresh={A.loadData} tabs={[{key:"overview",label:"Overview",icon:"📊"},{key:"inbox",label:"Requests"+(pendingDrafts?" ("+pendingDrafts+")":""),icon:"📬"},{key:"orders",label:"All Orders",icon:"📋"},{key:"pos",label:"PO Mgmt",icon:"📄"},{key:"reports",label:"Reports",icon:"📈"},{key:"billing",label:"Billing",icon:"💰"},{key:"invoices",label:"Invoices",icon:"📝"},{key:"feedback",label:"Feedback",icon:"⭐"},{key:"proposals",label:"Proposals",icon:"📑"},{key:"recurring",label:"PM Schedule",icon:"🔁"},{key:"equipment",label:"Equipment",icon:"🔧"},{key:"customers",label:"Customers",icon:"🏢"},{key:"users",label:"Users",icon:"👤"},{key:"settings",label:"Settings",icon:"⚙️"},{key:"calendar",label:"Calendar",icon:"📅"},{key:"projects",label:"Projects",icon:"🏗️"},{key:"kb",label:"Knowledge",icon:"📖"}]}>
    {tab==="overview"&&<><KPIDashboard D={D} A={A} userRole={user.role} userName={user.name}/>{pendingDrafts>0&&<Card onClick={()=>setTab("inbox")} style={{padding:"14px 18px",marginBottom:12,borderLeft:"3px solid "+B.orange,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>📬</span><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>Service Requests</div><div style={{fontSize:11,color:B.textMuted}}>{pendingDrafts} pending review</div></div></div><span style={{background:B.orange,color:B.bg,padding:"4px 10px",borderRadius:12,fontSize:13,fontWeight:800,fontFamily:M}}>{pendingDrafts}</span></div></Card>}<WOOverview orders={D.wos} wlp={wlp} pos={D.pos} time={D.time}/><GlobalActivityFeed/></>}
    {tab==="inbox"&&<ServiceRequests drafts={D.woDrafts||[]} customers={D.customers} users={D.users} onApprove={A.approveDraft} onReject={A.rejectDraft}/>}
    {tab==="orders"&&<WOList orders={D.wos} {...wlp}/>}
    {tab==="pos"&&<POMgmt pos={D.pos} onUpdatePO={A.updatePO} onDeletePO={A.deletePO} wos={D.wos}/>}
    {tab==="reports"&&<Reports wos={D.wos} pos={D.pos} timeEntries={D.time} users={D.users} customers={D.customers}/>}
    {tab==="billing"&&<BillingExport wos={D.wos} pos={D.pos} timeEntries={D.time} customers={D.customers} emailTemplates={D.emailTemplates} currentUser={user}/>}
    {tab==="invoices"&&<InvoiceDashboard invoices={D.invoices||[]} onUpdateInvoice={A.updateInvoice} onDeleteInvoice={A.deleteInvoice} onCreateInvoice={A.createInvoice} wos={D.wos} pos={D.pos} time={D.time} users={D.users} customers={D.customers}/>}
    {tab==="feedback"&&<FeedbackDashboard D={D}/>}
    {tab==="proposals"&&<ProposalDashboard D={D} userName={user.name}/>}
    {tab==="recurring"&&<RecurringPM templates={D.templates} onAdd={A.addTemplate} onDelete={A.deleteTemplate} users={D.users}/>}
    {tab==="equipment"&&<EquipmentDashboard D={D} A={A} userRole={user.role} userName={user.name}/>}
    {tab==="customers"&&<CustomerMgmt customers={D.customers} onAdd={A.addCustomer} onUpdate={A.updateCustomer} onDelete={A.deleteCustomer} wos={D.wos} time={D.time} pos={D.pos}/>}
    {tab==="users"&&<UserMgmt users={D.users} onAddUser={A.addUser} onUpdateUser={A.updateUser} onDeleteUser={A.deleteUser} cur={user}/>}
    {tab==="settings"&&<Settings emailTemplates={D.emailTemplates} onAddTemplate={A.addEmailTemplate} onUpdateTemplate={A.updateEmailTemplate} onDeleteTemplate={A.deleteEmailTemplate} D={D} userName={user.name}/>}
    {tab==="projects"&&<Projects projects={D.projects||[]} users={D.users} customers={D.customers} userName={user.name} userRole={user.role} onAdd={A.addProject} onUpdate={A.updateProject} onDelete={A.deleteProject} allWOs={D.wos} onCreateWO={A.createWO} allPOs={D.pos} allTime={D.time}/>}
    {tab==="calendar"&&<CompanyCalendar userRole={user.role} wos={D.wos} userName={user.name}/>}
    {tab==="kb"&&<KnowledgeBase userName={user.name} userRole={user.role}/>}
  </Shell>);
}

export { TechDash, MgrDash, AdminDash };
