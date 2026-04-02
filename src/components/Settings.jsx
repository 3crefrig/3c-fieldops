import React, { useState, useEffect } from "react";
import { sb, B, F, M, IS, LS, BP, BS, sanitizeHTML } from "../shared";
import { Card, Modal, Toast, StatCard } from "./ui";
import { WorkflowBuilder } from "./Workflows";

function Settings({emailTemplates,onAddTemplate,onUpdateTemplate,onDeleteTemplate,D,userName}){
  const[tab,setTab]=useState("templates"),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[tName,setTName]=useState(""),[tSubject,setTSubject]=useState(""),[tBody,setTBody]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openNew=()=>{setEditing(null);setTName("");setTSubject("3C Refrigeration \u2014 Timesheet");setTBody("<p>Hi,</p><p>Please find attached the timesheet.</p><p>If you have any questions, please reply to this email.</p>");setShowForm(true);};
  const openEdit=(t)=>{setEditing(t);setTName(t.name);setTSubject(t.subject);setTBody(t.body);setShowForm(true);};
  const go=async()=>{if(!tName.trim()||!tSubject.trim()||saving)return;setSaving(true);const obj={name:tName.trim(),subject:tSubject.trim(),body:tBody.trim()};if(editing){await onUpdateTemplate({...editing,...obj});}else{await onAddTemplate(obj);}setSaving(false);setShowForm(false);msg(editing?"Template updated":"Template created");};
  const del=async(t)=>{if(!window.confirm("Delete template '"+t.name+"'?"))return;await onDeleteTemplate(t.id);msg("Deleted");};

  const tabs=[["templates","📧 Email Templates"],["workflows","⚡ Workflows"],["company","🏢 Company"],["app","⚙️ App Settings"]];

  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>System Settings</h3>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 14px",borderRadius:6,border:"1px solid "+(tab===k?B.cyan:B.border),background:tab===k?B.cyanGlow:"transparent",color:tab===k?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    {tab==="templates"&&<div>
      <div style={{fontSize:12,color:B.textMuted,marginBottom:12}}>Create email templates for sending timesheets. Templates set the subject line and body text. The timesheet table and Excel attachment are added automatically.</div>
      <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ New Email Template</button>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {(!emailTemplates||emailTemplates.length===0)&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:12}}>No templates yet. Click above to create one.</div></Card>}
        {(emailTemplates||[]).map(t=><Card key={t.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.purple}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:B.text}}>{t.name}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>Subject: {t.subject}</div><div style={{fontSize:11,color:B.textDim,marginTop:2,maxHeight:40,overflow:"hidden"}} dangerouslySetInnerHTML={{__html:sanitizeHTML(t.body)}}/></div>
            <div style={{display:"flex",gap:6,flexShrink:0}}><button onClick={()=>openEdit(t)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button><button onClick={()=>del(t)} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button></div>
          </div></Card>)}
      </div>
      {showForm&&<Modal title={editing?"Edit Template":"New Email Template"} onClose={()=>setShowForm(false)} wide>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={LS}>Template Name</label><input value={tName} onChange={e=>setTName(e.target.value)} placeholder="e.g. Monthly Timesheet, Invoice Follow-up" style={IS}/></div>
          <div><label style={LS}>Email Subject</label><input value={tSubject} onChange={e=>setTSubject(e.target.value)} placeholder="3C Refrigeration — Timesheet" style={IS}/></div>
          <div><label style={LS}>Email Body <span style={{color:B.textDim,fontWeight:400}}>(timesheet table and your signature are added automatically below)</span></label><textarea value={tBody} onChange={e=>setTBody(e.target.value)} rows={6} placeholder="<p>Hi,</p><p>Please find attached...</p>" style={{...IS,resize:"vertical",lineHeight:1.5,fontFamily:M,fontSize:12}}/></div>
          <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border}}><span style={{fontSize:10,color:B.textDim}}>Preview:</span><div style={{marginTop:6,fontSize:12,color:B.textMuted}} dangerouslySetInnerHTML={{__html:sanitizeHTML(tBody||"<em>Empty</em>")}}/></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save":"Create Template")}</button></div>
        </div>
      </Modal>}
    </div>}
    {tab==="workflows"&&D&&<WorkflowBuilder D={D} userName={userName||"Admin"}/>}
    {tab==="company"&&<CompanyProfile msg={msg}/>}
    {tab==="app"&&<AppSettings msg={msg}/>}
  </div>);
}

function CompanyProfile({msg}){
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[profile,setProfile]=useState({company_name:"",address:"",phone:"",email:"",logo_url:"",default_senior_rate:"",default_licensed_rate:"",emergency_senior_rate:"",emergency_licensed_rate:"",default_parts_markup:"",working_hours_start:"",working_hours_end:"",emergency_min_hours:""});

  useEffect(()=>{(async()=>{
    const{data}=await sb().from("app_settings").select("*").eq("key","company_profile").single();
    if(data?.value)setProfile(p=>({...p,...data.value}));
    else setProfile(p=>({...p,company_name:"3C Refrigeration",address:"",phone:"(336) 264-0935",email:"aclapp@3crefrigeration.com",logo_url:"https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png",default_senior_rate:"120",default_licensed_rate:"135",emergency_senior_rate:"175",emergency_licensed_rate:"190",default_parts_markup:"30",working_hours_start:"07:30",working_hours_end:"16:00",emergency_min_hours:"4"}));
    setLoading(false);
  })();},[]);

  const save=async()=>{if(saving)return;setSaving(true);
    await sb().from("app_settings").upsert({key:"company_profile",value:profile},{onConflict:"key"});
    setSaving(false);msg("Company profile saved");};

  const set=(k,v)=>setProfile(p=>({...p,[k]:v}));

  if(loading)return<div style={{textAlign:"center",padding:40,color:B.textDim}}>Loading...</div>;
  return(<div>
    <div style={{fontSize:12,color:B.textMuted,marginBottom:16}}>Company information used in proposals, invoices, and email communications.</div>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Company Information</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Company Name</label><input value={profile.company_name} onChange={e=>set("company_name",e.target.value)} style={IS}/></div>
        <div><label style={LS}>Phone</label><input value={profile.phone} onChange={e=>set("phone",e.target.value)} style={IS}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={LS}>Address</label><input value={profile.address} onChange={e=>set("address",e.target.value)} style={IS} placeholder="Full company address"/></div>
        <div><label style={LS}>Email</label><input value={profile.email} onChange={e=>set("email",e.target.value)} style={IS}/></div>
        <div><label style={LS}>Logo URL</label><input value={profile.logo_url} onChange={e=>set("logo_url",e.target.value)} style={{...IS,fontSize:11}}/></div>
      </div>
      {profile.logo_url&&<div style={{marginTop:12,padding:12,background:B.bg,borderRadius:8,border:"1px solid "+B.border,textAlign:"center"}}><img src={profile.logo_url} alt="Logo preview" style={{height:48,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/></div>}
    </Card>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Default Labor Rates</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Senior Tech ($/hr)</label><input value={profile.default_senior_rate} onChange={e=>set("default_senior_rate",e.target.value)} type="number" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Licensed Tech ($/hr)</label><input value={profile.default_licensed_rate} onChange={e=>set("default_licensed_rate",e.target.value)} type="number" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Emergency Senior ($/hr)</label><input value={profile.emergency_senior_rate} onChange={e=>set("emergency_senior_rate",e.target.value)} type="number" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Emergency Licensed ($/hr)</label><input value={profile.emergency_licensed_rate} onChange={e=>set("emergency_licensed_rate",e.target.value)} type="number" style={{...IS,fontFamily:M}}/></div>
      </div>
    </Card>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Billing & Hours</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <div><label style={LS}>Default Parts Markup %</label><input value={profile.default_parts_markup} onChange={e=>set("default_parts_markup",e.target.value)} type="number" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Work Hours Start</label><input value={profile.working_hours_start} onChange={e=>set("working_hours_start",e.target.value)} type="time" style={IS}/></div>
        <div><label style={LS}>Work Hours End</label><input value={profile.working_hours_end} onChange={e=>set("working_hours_end",e.target.value)} type="time" style={IS}/></div>
      </div>
      <div style={{marginTop:12}}>
        <div><label style={LS}>Emergency Minimum Hours</label><input value={profile.emergency_min_hours} onChange={e=>set("emergency_min_hours",e.target.value)} type="number" style={{...IS,fontFamily:M,maxWidth:120}}/></div>
      </div>
    </Card>

    <button onClick={save} disabled={saving} style={{...BP,width:"100%",padding:14,opacity:saving?.6:1}}>{saving?"Saving...":"Save Company Profile"}</button>
  </div>);
}

function AppSettings({msg}){
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[settings,setSettings]=useState({max_daily_hours:"12",invoice_reminder_days:"30",default_payment_terms:"Net 30",auto_invoice_default:false,feedback_enabled:true,proposal_validity_months:"6",po_auto_approve_threshold:""});

  useEffect(()=>{(async()=>{
    const{data}=await sb().from("app_settings").select("*").eq("key","app_settings").single();
    if(data?.value)setSettings(s=>({...s,...data.value}));
    setLoading(false);
  })();},[]);

  const save=async()=>{if(saving)return;setSaving(true);
    await sb().from("app_settings").upsert({key:"app_settings",value:settings},{onConflict:"key"});
    setSaving(false);msg("Settings saved");};

  const set=(k,v)=>setSettings(s=>({...s,[k]:v}));

  if(loading)return<div style={{textAlign:"center",padding:40,color:B.textDim}}>Loading...</div>;
  return(<div>
    <div style={{fontSize:12,color:B.textMuted,marginBottom:16}}>Configure global application thresholds and defaults.</div>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Time & Labor</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Max Daily Hours (block threshold)</label><input value={settings.max_daily_hours} onChange={e=>set("max_daily_hours",e.target.value)} type="number" style={{...IS,fontFamily:M}}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Techs are blocked from logging more than this per day</div></div>
        <div><label style={LS}>Default Payment Terms</label><input value={settings.default_payment_terms} onChange={e=>set("default_payment_terms",e.target.value)} style={IS} placeholder="Net 30"/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Applied to new customers</div></div>
      </div>
    </Card>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Invoicing</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Overdue Invoice Threshold (days)</label><input value={settings.invoice_reminder_days} onChange={e=>set("invoice_reminder_days",e.target.value)} type="number" style={{...IS,fontFamily:M}}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Invoices older than this are flagged overdue</div></div>
        <div><label style={LS}>PO Auto-Approve Under $</label><input value={settings.po_auto_approve_threshold} onChange={e=>set("po_auto_approve_threshold",e.target.value)} type="number" placeholder="0 = disabled" style={{...IS,fontFamily:M}}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>POs below this amount skip approval (0 = disabled)</div></div>
      </div>
      <div style={{display:"flex",gap:20,marginTop:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={settings.auto_invoice_default} onChange={e=>set("auto_invoice_default",e.target.checked)} style={{width:18,height:18,accentColor:B.cyan}}/><div><div style={{fontSize:12,fontWeight:600,color:B.text}}>Auto-Invoice Default</div><div style={{fontSize:10,color:B.textDim}}>New customers get auto-invoicing enabled</div></div></label>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={settings.feedback_enabled} onChange={e=>set("feedback_enabled",e.target.checked)} style={{width:18,height:18,accentColor:B.cyan}}/><div><div style={{fontSize:12,fontWeight:600,color:B.text}}>Feedback Requests</div><div style={{fontSize:10,color:B.textDim}}>Auto-send feedback emails when invoices are sent</div></div></label>
      </div>
    </Card>

    <Card style={{padding:18,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:12}}>Proposals</div>
      <div><label style={LS}>Default Proposal Validity (months)</label><input value={settings.proposal_validity_months} onChange={e=>set("proposal_validity_months",e.target.value)} type="number" style={{...IS,fontFamily:M,maxWidth:120}}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>How long proposals remain valid before expiring</div></div>
    </Card>

    <button onClick={save} disabled={saving} style={{...BP,width:"100%",padding:14,opacity:saving?.6:1}}>{saving?"Saving...":"Save App Settings"}</button>
  </div>);
}

export { Settings };
