import React, { useState, useEffect, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, autoCorrect, genPO, GlobalStyles, setProfanityHandler } from "./shared";
import { Logo, Spinner } from "./components/ui";
import { LoginScreen, FirstSetup } from "./components/Auth";
import { TechDash, MgrDash, AdminDash } from "./components/Dashboards";
import { CustomerPortal } from "./components/CustomerPortal";
import { FeedbackForm } from "./components/Feedback";
import { ProposalPortal } from "./components/Proposals";

/*
 * 3C Refrigeration FieldOps Pro — Modular Edition
 * App.jsx: orchestrator — auth, data loading, actions, routing
 */

function App(){
  const[authUser,setAuthUser]=useState(null);const[appUser,setAppUser]=useState(null);
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);const[syncing,setSyncing]=useState(false);

  useEffect(()=>{const client=sb();if(!client)return;
    client.auth.getSession().then(({data:{session}})=>{setAuthUser(session?.user||null);});
    const{data:{subscription}}=client.auth.onAuthStateChange((_,session)=>{setAuthUser(session?.user||null);});
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=useCallback(async()=>{try{const client=sb();if(!client)return;
    const[wos,pos,time,photos,users,schedule,templates,notifs,customers,emailTemplates,projects,woDrafts,invoices,feedbackData]=await Promise.all([
      client.from("work_orders").select("id,wo_id,title,description,status,priority,wo_type,customer,customer_wo,location,building,notes,field_notes,assignee,crew,due_date,date_completed,work_performed,invoiced,invoice_id,tms_entered,created_at,updated_at").order("created_at",{ascending:false}),
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
      client.from("wo_drafts").select("*").order("created_at",{ascending:false}),
      client.from("invoices").select("*").order("created_at",{ascending:false}),
      client.from("feedback").select("*").order("submitted_at",{ascending:false}),
    ]);
    [wos,pos,time,photos,users,schedule,templates,notifs,customers,emailTemplates,projects,woDrafts,invoices,feedbackData].forEach((r,i)=>{if(r.error)console.warn("loadData query "+i+" failed:",r.error.message);});
    setData({wos:wos.data||[],pos:pos.data||[],time:time.data||[],photos:photos.data||[],users:users.data||[],schedule:schedule.data||[],templates:templates.data||[],notifs:notifs.data||[],customers:customers.data||[],emailTemplates:emailTemplates.data||[],projects:projects.data||[],woDrafts:woDrafts.data||[],invoices:invoices.data||[],feedback:feedbackData.data||[]});
    setLoading(false);
  }catch(err){console.error("loadData failed:",err);}
  },[]);
  const tableMap={work_orders:{key:"wos",order:"created_at",asc:false},purchase_orders:{key:"pos",order:"created_at",asc:false},time_entries:{key:"time",order:"logged_date",asc:false},photos:{key:"photos",order:"uploaded_at",asc:false},users:{key:"users",order:"name",asc:true},schedule:{key:"schedule",order:"time",asc:true},recurring_templates:{key:"templates",order:"title",asc:true},notifications:{key:"notifs",order:"created_at",asc:false,limit:50},customers:{key:"customers",order:"name",asc:true},email_templates:{key:"emailTemplates",order:"name",asc:true},projects:{key:"projects",order:"created_at",asc:false},wo_drafts:{key:"woDrafts",order:"created_at",asc:false},invoices:{key:"invoices",order:"created_at",asc:false},feedback:{key:"feedback",order:"submitted_at",asc:false}};
  const reloadTable=useCallback(async(table)=>{const client=sb();if(!client)return;const m=tableMap[table];if(!m)return;let q=client.from(table).select("*").order(m.order,{ascending:m.asc});if(m.limit)q=q.limit(m.limit);const{data:d}=await q;setData(prev=>({...prev,[m.key]:d||[]}));},[]);

  useEffect(()=>{if(authUser)loadData();},[authUser,loadData]);
  useEffect(()=>{if(!authUser){sb().from("users").select("*").then(({data:u})=>{setData(d=>({...(d||{wos:[],pos:[],time:[],photos:[],schedule:[],templates:[],notifs:[],customers:[],emailTemplates:[],projects:[],woDrafts:[]}),users:u||[]}));setLoading(false);});}},[authUser]);

  useEffect(()=>{if(!authUser||!data?.users)return;const match=data.users.find(u=>u.email?.toLowerCase()===authUser.email?.toLowerCase()&&u.active!==false);setAppUser(match||null);},[authUser,data?.users]);

  // Realtime subscriptions, recurring PM checks, deadline checks
  useEffect(()=>{if(!authUser)return;const client=sb();
    const chan=client.channel("fieldops-rt").on("postgres_changes",{event:"*",schema:"public",table:"work_orders"},()=>reloadTable("work_orders")).on("postgres_changes",{event:"*",schema:"public",table:"purchase_orders"},()=>reloadTable("purchase_orders")).on("postgres_changes",{event:"*",schema:"public",table:"time_entries"},()=>reloadTable("time_entries")).on("postgres_changes",{event:"*",schema:"public",table:"users"},()=>reloadTable("users")).on("postgres_changes",{event:"*",schema:"public",table:"photos"},()=>reloadTable("photos")).on("postgres_changes",{event:"*",schema:"public",table:"notifications"},()=>reloadTable("notifications")).on("postgres_changes",{event:"*",schema:"public",table:"customers"},()=>reloadTable("customers")).on("postgres_changes",{event:"*",schema:"public",table:"wo_drafts"},()=>reloadTable("wo_drafts")).on("postgres_changes",{event:"*",schema:"public",table:"invoices"},()=>reloadTable("invoices")).subscribe();
    const poll=setInterval(()=>loadData(),300000);
    const onVis=()=>{if(document.visibilityState==="visible")loadData();};document.addEventListener("visibilitychange",onVis);
    // Smart Recurring PM: auto-generate WOs from templates with past-due dates
    const checkRecurringPMs=async()=>{
      const{data:tpls}=await client.from("recurring_templates").select("*").eq("active",true);
      if(!tpls||tpls.length===0)return;
      const today=new Date().toISOString().slice(0,10);
      for(const t of tpls){
        if(!t.next_due||t.next_due>today)continue;
        const{data:existing}=await client.from("work_orders").select("wo_id").ilike("title","PM: "+t.title+"%").eq("due_date",t.next_due);
        if(existing&&existing.length>0)continue;
        const{data:lastWO}=await client.from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);
        const ln=lastWO&&lastWO[0]?parseInt(lastWO[0].wo_id.replace("WO-",""))||1000:1000;
        await client.from("work_orders").insert({wo_id:"WO-"+(ln+1),title:"PM: "+t.title,priority:t.priority||"medium",status:"pending",assignee:t.assignee||"Unassigned",due_date:t.next_due,hours_total:0,notes:t.notes||"Auto-generated from recurring PM template.",location:t.location||"",building:t.building||"",wo_type:"PM",customer:t.customer||""});
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
    const checkDeadlines=async()=>{const twoDays=new Date(Date.now()+2*86400000).toISOString().slice(0,10);const today=new Date().toISOString().slice(0,10);const{data:due}=await client.from("work_orders").select("wo_id,title,due_date,assignee").neq("status","completed").gte("due_date",today).lte("due_date",twoDays);if(due&&due.length>0){for(const w of due){const{data:existing}=await client.from("notifications").select("id").eq("type","deadline_warning").ilike("message","%"+w.wo_id+"%").gte("created_at",today);if(!existing||existing.length===0)await client.from("notifications").insert({type:"deadline_warning",title:"Deadline Approaching",message:w.wo_id+" — "+w.title+" is due "+w.due_date,for_role:null});}}};
    checkDeadlines();
    return()=>{client.removeChannel(chan);clearInterval(poll);document.removeEventListener("visibilitychange",onVis);};
  },[authUser,loadData]);

  const withSync=fn=>async(...args)=>{setSyncing(true);try{await fn(...args);await loadData();}finally{setSyncing(false);}};
  // Workflow trigger evaluation engine
  const evaluateTriggers=async(triggerType,triggerData)=>{try{
    const{data:activeWFs}=await sb().from("workflows").select("*").eq("active",true);
    if(!activeWFs||activeWFs.length===0)return;
    for(const wf of activeWFs){const triggerNode=(wf.nodes||[]).find(n=>n.type==="trigger"&&n.config?.event===triggerType);
      if(!triggerNode)continue;
      const edges=wf.edges||[];const nodes=wf.nodes||[];const log=[];let paused=false;
      const visit=async(nodeId)=>{const outEdges=edges.filter(e=>e.source===nodeId);
        for(const edge of outEdges){const next=nodes.find(n=>n.id===edge.target);if(!next)continue;
          if(next.type==="condition"){const{field,operator,value}=next.config||{};const actual=triggerData[field];
            let passes=true;if(field&&operator){const a=String(actual||"").toLowerCase(),v=String(value||"").toLowerCase();
              if(operator==="equals"||operator==="=")passes=a===v;else if(operator==="not_equals"||operator==="!=")passes=a!==v;
              else if(operator===">")passes=parseFloat(actual)>parseFloat(value);else if(operator==="<")passes=parseFloat(actual)<parseFloat(value);
              else if(operator===">=")passes=parseFloat(actual)>=parseFloat(value);else if(operator==="<=")passes=parseFloat(actual)<=parseFloat(value);
              else if(operator==="contains")passes=a.includes(v);}
            log.push({node_id:next.id,action:"condition",result:passes,timestamp:new Date().toISOString()});
            if(passes)await visit(next.id);
          }else if(next.type==="wait"){const hrs=next.config?.delay_hours||24;
            await sb().from("workflow_runs").insert({workflow_id:wf.id,trigger_type:triggerType,trigger_data:triggerData,status:"waiting",current_node_id:next.id,resume_at:new Date(Date.now()+hrs*3600000).toISOString(),execution_log:[...log,{node_id:next.id,action:"wait",delay_hours:hrs,timestamp:new Date().toISOString()}]});
            paused=true;
          }else if(next.type==="action"){const cfg=next.config||{};
            if(cfg.action_type==="create_notification"){await sb().from("notifications").insert({type:"workflow",title:cfg.title||"Workflow Alert",message:cfg.message||"",for_role:cfg.for_role||null});log.push({node_id:next.id,action:"notification",timestamp:new Date().toISOString()});}
            else if(cfg.action_type==="send_email"&&cfg.to_email){try{await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({to:cfg.to_email,subject:cfg.subject||"Notification",body:cfg.body||""})});log.push({node_id:next.id,action:"email",timestamp:new Date().toISOString()});}catch(e){}}
            else if(cfg.action_type==="log_activity"&&triggerData.id){await sb().from("wo_activity").insert({wo_id:triggerData.id,action:"workflow",details:cfg.message||"Automated action",actor:"Workflow"});log.push({node_id:next.id,action:"log",timestamp:new Date().toISOString()});}
            await visit(next.id);}
        }};
      await visit(triggerNode.id);
      if(!paused&&log.length>0){await sb().from("workflow_runs").insert({workflow_id:wf.id,trigger_type:triggerType,trigger_data:triggerData,status:"completed",execution_log:log,completed_at:new Date().toISOString()});}
    }}catch(e){console.error("Workflow trigger error:",e);}};
  const withTableSync=(table,fn)=>async(...args)=>{setSyncing(true);try{await fn(...args);await reloadTable(table);}finally{setSyncing(false);}};
  const notify=async(type,title,message,forRole)=>{await sb().from("notifications").insert({type,title,message,for_role:forRole||null});};

  // Auto-invoice: creates a draft invoice for a single completed WO
  const tryAutoInvoice=async(completedWO)=>{
    try{const cust=data.customers.find(c=>c.name===completedWO.customer);
    if(!cust||!cust.auto_invoice)return;
    if(completedWO.invoiced)return;
    const woTime=data.time.filter(t=>t.wo_id===completedWO.id);
    const totalHrs=woTime.reduce((s,t)=>s+parseFloat(t.hours||0),0);
    const woPOs=data.pos.filter(p=>p.wo_id===completedWO.id&&p.status==="approved");
    const partsCost=woPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const mkup=cust.parts_markup!=null?parseFloat(cust.parts_markup):35;
    const partsTotal=Math.round(partsCost*(1+mkup/100)*100)/100;
    let defaultTiers;
    if(cust.labor_tiers&&Array.isArray(cust.labor_tiers)&&cust.labor_tiers.length>0){defaultTiers=cust.labor_tiers.map(t=>({name:t.name,rate:t.rate}));}
    else{defaultTiers=cust.name.includes("DUMC")||cust.name.includes("Medical")?[{name:"Journeyman Mechanic",rate:60},{name:"Senior Technician",rate:75},{name:"Licensed Technician",rate:90}]:[{name:"Senior Technician",rate:120},{name:"Licensed Technician",rate:135}];}
    const tiers=defaultTiers.map((t,i)=>({...t,hours:i===0?totalHrs:0}));
    const laborTotal=tiers.reduce((s,t)=>s+t.rate*t.hours,0);
    const now=new Date();const pfx=String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0");const{data:invAll}=await sb().from("invoices").select("invoice_num");const mxInv=(invAll||[]).filter(i=>i.invoice_num&&i.invoice_num.startsWith(pfx)).reduce((m,i)=>{const s=parseInt(i.invoice_num.slice(4));return s>m?s:m;},0);const invNum=pfx+String(mxInv+1).padStart(2,"0");
    await sb().from("invoices").insert({invoice_num:invNum,customer:cust.name,customer_contact:cust.contact_name||"",amount:laborTotal+partsTotal,parts_total:partsTotal,status:"draft",wo_ids:[completedWO.wo_id],tier_data:tiers,job_desc:completedWO.title,po_number:completedWO.customer_wo||"",notes:""});
    await sb().from("work_orders").update({invoiced:true}).eq("id",completedWO.id);
    await notify("invoice_created","Invoice Draft","$"+(laborTotal+partsTotal).toFixed(2)+" for "+cust.name+" — "+(completedWO.wo_id||""),"admin");
    }catch(e){console.error("Auto-invoice error:",e);}
  };

  const actions={
    loadData,
    logActivity:async(woId,action,details)=>{try{await sb().from("wo_activity").insert({wo_id:woId,action,details,actor:appUser?.name||"System"});}catch(e){}},
    createWO:withSync(async(wo)=>{if(wo.title)wo.title=autoCorrect(wo.title);if(wo.notes)wo.notes=autoCorrect(wo.notes);if(wo.location)wo.location=autoCorrect(wo.location);const{data:ex}=await sb().from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);const ln=ex&&ex[0]?parseInt(ex[0].wo_id.replace("WO-",""))||1000:1000;const newId="WO-"+(ln+1);const{data:inserted}=await sb().from("work_orders").insert({...wo,wo_id:newId,status:"pending",hours_total:0}).select("id").single();await notify("wo_created","New Work Order",newId+": "+wo.title);if(inserted){await sb().from("wo_activity").insert({wo_id:inserted.id,action:"created",details:"Work order created",actor:appUser?.name||"System"});evaluateTriggers("wo_created",{...wo,wo_id:newId,id:inserted.id});}}),
    updateWO:withTableSync("work_orders",async(wo)=>{if(wo.title)wo.title=autoCorrect(wo.title);if(wo.notes)wo.notes=autoCorrect(wo.notes);if(wo.work_performed)wo.work_performed=autoCorrect(wo.work_performed);if(wo.field_notes)wo.field_notes=autoCorrect(wo.field_notes);const{id,...rest}=wo;const old=data.wos.find(w=>w.id===id);const{error}=await sb().from("work_orders").update(rest).eq("id",id);if(error)console.error("updateWO error:",error);const changes=[];if(old){if(rest.status&&rest.status!==old.status)changes.push("Status → "+rest.status);if(rest.assignee&&rest.assignee!==old.assignee)changes.push("Assigned → "+rest.assignee);if(rest.priority&&rest.priority!==old.priority)changes.push("Priority → "+rest.priority);if(rest.tms_entered!==undefined&&rest.tms_entered!==old.tms_entered)changes.push(rest.tms_entered?"TMS marked complete":"TMS unmarked");}if(changes.length>0)await sb().from("wo_activity").insert({wo_id:id,action:"updated",details:changes.join(", "),actor:appUser?.name||"System"});if(rest.assignee&&rest.assignee!==old?.assignee&&rest.assignee!=="Unassigned")await notify("wo_assigned","WO Assigned",(old?.wo_id||"")+" assigned to "+rest.assignee,"technician");if(rest.status==="completed"&&old?.status!=="completed"){await notify("wo_completed","WO Completed",(old?.wo_id||"")+" completed","admin");await tryAutoInvoice({...old,...rest});evaluateTriggers("wo_completed",{...old,...rest});}if(rest.status&&rest.status!==old?.status)evaluateTriggers("wo_status_changed",{...old,...rest,status:rest.status});}),
    deleteWO:withTableSync("work_orders",async(id)=>{const wo=data.wos.find(w=>w.id===id);if(wo?.invoiced){alert("This WO has been invoiced and cannot be deleted.");return;}const{error}=await sb().from("work_orders").delete().eq("id",id);if(error)console.error("deleteWO error:",error);}),
    createPO:withSync(async(po)=>{if(po.description)po.description=autoCorrect(po.description);if(po.notes)po.notes=autoCorrect(po.notes);const{data:all}=await sb().from("purchase_orders").select("po_id");const id=genPO(all||[]);await sb().from("purchase_orders").insert({...po,po_id:id,requested_by:appUser.name,status:"pending"});await notify("po_requested","PO Requested",id+" — $"+po.amount+" by "+appUser.name,"manager");evaluateTriggers("po_requested",{...po,po_id:id});}),
    updatePO:withTableSync("purchase_orders",async(po)=>{const{id,...rest}=po;const old=data.pos.find(p=>p.id===id);await sb().from("purchase_orders").update(rest).eq("id",id);if(rest.status&&rest.status!==old?.status){if(rest.status==="approved"){await notify("po_approved","PO Approved",(old?.po_id||"")+" approved — $"+(rest.amount||old?.amount||0),"technician");evaluateTriggers("po_approved",{...old,...rest});}if(rest.status==="rejected"){await notify("po_rejected","PO Rejected",(old?.po_id||"")+" rejected","technician");evaluateTriggers("po_rejected",{...old,...rest});}}}),
    deletePO:withTableSync("purchase_orders",async(po)=>{await sb().from("purchase_orders").delete().eq("id",po.id);}),
    createInvoice:withTableSync("invoices",async(inv)=>{await sb().from("invoices").insert(inv);}),
    updateInvoice:withTableSync("invoices",async(inv)=>{const{id,...rest}=inv;await sb().from("invoices").update(rest).eq("id",id);}),
    deleteInvoice:withTableSync("invoices",async(inv)=>{await sb().from("invoices").delete().eq("id",inv.id);}),
    addTime:withTableSync("time_entries",async(te)=>{
      if(te.description)te.description=autoCorrect(te.description);
      const h=Math.round((parseFloat(te.hours)||0)*4)/4;
      const logDate=te.logged_date||new Date().toISOString().slice(0,10);
      const dayHrs=data.time.filter(t=>t.technician===appUser.name&&t.logged_date===logDate).reduce((s,t)=>s+parseFloat(t.hours||0),0);
      if(dayHrs+h>12){const isManager=appUser.role==="admin"||appUser.role==="manager";if(!isManager){alert("Daily limit: 12 hours exceeded for "+logDate+". Ask a manager to override.");return;}if(!window.confirm("This would put "+(appUser.name)+" over 12 hours for "+logDate+" ("+(dayHrs+h).toFixed(1)+"h). Override and allow?")){return;}}
      await sb().from("time_entries").insert({...te,hours:h,technician:appUser.name,logged_date:logDate});
      const wo=data.wos.find(w=>w.id===te.wo_id);
      if(wo&&wo.status==="pending"){await sb().from("work_orders").update({status:"in_progress"}).eq("id",wo.id);await sb().from("wo_activity").insert({wo_id:wo.id,action:"updated",details:"Status → in_progress (auto on first time entry)",actor:appUser?.name||"System"});}
    }),
    updateTime:withTableSync("time_entries",async(te)=>{if(te.description)te.description=autoCorrect(te.description);const{id,...rest}=te;await sb().from("time_entries").update(rest).eq("id",id);}),
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
    approveDraft:withSync(async(draft,edits)=>{
      const wo={title:edits?.title||draft.title||"Service Request",priority:edits?.priority||draft.priority||"medium",assignee:edits?.assignee||"Unassigned",due_date:edits?.due_date||"TBD",notes:edits?.description||draft.description||"From email: "+draft.email_subject,location:edits?.location||draft.location||"",building:edits?.building||draft.building||"",wo_type:"CM",customer:edits?.customer_name||draft.customer_name||"",customer_wo:edits?.customer_wo||draft.customer_wo||null,crew:[]};
      const{data:ex}=await sb().from("work_orders").select("wo_id").order("wo_id",{ascending:false}).limit(1);const ln=ex&&ex[0]?parseInt(ex[0].wo_id.replace("WO-",""))||1000:1000;const newId="WO-"+(ln+1);
      await sb().from("work_orders").insert({...wo,wo_id:newId,status:"pending",hours_total:0});
      await sb().from("wo_drafts").update({status:"approved",reviewed_by:appUser.id,reviewed_at:new Date().toISOString(),created_wo_id:newId}).eq("id",draft.id);
      await notify("wo_created","New Work Order (Email)",newId+": "+wo.title);
    }),
    rejectDraft:withSync(async(draftId,reason)=>{
      await sb().from("wo_drafts").update({status:"rejected",reviewed_by:appUser.id,reviewed_at:new Date().toISOString(),reject_reason:reason||null}).eq("id",draftId);
    }),
  };

  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,animation:"fadeIn .4s ease-out"}}><GlobalStyles/><Logo size="large"/><div style={{marginTop:24}}><Spinner/></div><div style={{color:B.textDim,fontSize:12,marginTop:12,fontWeight:500,letterSpacing:0.3}}>Connecting...</div></div>);
  if(authUser&&data?.users?.length===0)return <FirstSetup authUser={authUser} onDone={loadData}/>;
  if(!appUser)return <LoginScreen authUser={authUser} loading={false}/>;
  const p={user:appUser,onLogout:async()=>{await sb().auth.signOut();setAppUser(null);setAuthUser(null);},D:data,A:actions,syncing};
  if(appUser.role==="admin")return <AdminDash {...p}/>;
  if(appUser.role==="manager")return <MgrDash {...p}/>;
  return <TechDash {...p}/>;
}

class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  componentDidCatch(error,info){console.error("App crash:",error,info);}
  render(){if(this.state.hasError){return<div style={{minHeight:"100vh",background:"#101214",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow',sans-serif",color:"#E8EAED",padding:40,textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>⚠️</div><h1 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>Something went wrong</h1><p style={{fontSize:14,color:"#8B929A",marginBottom:20,maxWidth:400}}>The app encountered an unexpected error. Try refreshing the page.</p><button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}} style={{padding:"12px 24px",borderRadius:8,border:"none",background:"#00D4F5",color:"#101214",fontSize:14,fontWeight:700,cursor:"pointer"}}>Refresh App</button><pre style={{marginTop:20,fontSize:10,color:"#5E656E",maxWidth:500,overflow:"auto",textAlign:"left"}}>{this.state.error?.message}</pre></div>;}return this.props.children;}
}

export default function AppRouter(){
  const hash=window.location.hash;
  const portalMatch=hash.match(/#\/portal\/(.+)/);
  if(portalMatch)return <ErrorBoundary><CustomerPortal customerSlug={portalMatch[1]}/></ErrorBoundary>;
  const feedbackMatch=hash.match(/#\/feedback\/(.+)/);
  if(feedbackMatch)return <ErrorBoundary><FeedbackForm token={feedbackMatch[1]}/></ErrorBoundary>;
  const proposalMatch=hash.match(/#\/proposal\/(.+)/);
  if(proposalMatch)return <ErrorBoundary><ProposalPortal token={proposalMatch[1]}/></ErrorBoundary>;
  return <ErrorBoundary><App/></ErrorBoundary>;
}
