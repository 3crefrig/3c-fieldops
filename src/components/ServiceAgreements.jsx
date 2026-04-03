import React, { useState } from "react";
import { sb, B, F, M, IS, LS, BP, BS, haptic } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, CustomSelect } from "./ui";

const FREQ_LABELS={weekly:"Weekly",biweekly:"Every 2 Weeks",monthly:"Monthly",quarterly:"Quarterly",biannual:"Every 6 Months",annual:"Annual"};
const FREQ_VISITS={weekly:52,biweekly:26,monthly:12,quarterly:4,biannual:2,annual:1};
const STATUS_COLORS={active:B.green,expired:B.red,cancelled:B.textDim,pending_renewal:B.orange};
const STATUS_LABELS={active:"Active",expired:"Expired",cancelled:"Cancelled",pending_renewal:"Pending Renewal"};
const DEFAULT_SERVICES=["PM Inspection","Filter Replacement","Coil Cleaning","Refrigerant Check","Electrical Check","Belt Inspection","Thermostat Calibration","Drain Line Clearing"];

function genAgreementNum(existing){const n=new Date(),pfx="AGR-"+String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0")+"-";const mx=(existing||[]).filter(a=>a.agreement_num&&a.agreement_num.startsWith(pfx)).reduce((m,a)=>{const s=parseInt(a.agreement_num.slice(pfx.length));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}

// ─── Tier Manager (Admin only) ────────────────────────
function AgreementTierManager({tiers,onAdd,onUpdate,onDelete}){
  const[editing,setEditing]=useState(null);const[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const[f,setF]=useState({name:"",visit_frequency:"quarterly",visits_per_year:4,included_services:[],response_time_hours:24,priority_level:"medium",discount_pct:0,base_monthly_rate:0});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const[saving,setSaving]=useState(false);const[showForm,setShowForm]=useState(false);
  const[newService,setNewService]=useState("");

  const openNew=()=>{setEditing(null);setF({name:"",visit_frequency:"quarterly",visits_per_year:4,included_services:[],response_time_hours:24,priority_level:"medium",discount_pct:0,base_monthly_rate:0});setShowForm(true);};
  const openEdit=(t)=>{setEditing(t);setF({name:t.name,visit_frequency:t.visit_frequency,visits_per_year:t.visits_per_year||FREQ_VISITS[t.visit_frequency]||4,included_services:t.included_services||[],response_time_hours:t.response_time_hours||24,priority_level:t.priority_level||"medium",discount_pct:t.discount_pct||0,base_monthly_rate:t.base_monthly_rate||0});setShowForm(true);};
  const toggleService=(svc)=>set("included_services",f.included_services.includes(svc)?f.included_services.filter(s=>s!==svc):[...f.included_services,svc]);
  const addCustomService=()=>{if(!newService.trim())return;set("included_services",[...f.included_services,newService.trim()]);setNewService("");};

  const save=async()=>{if(!f.name.trim()||saving)return;setSaving(true);
    if(editing){await onUpdate({id:editing.id,...f});msg("Tier updated");}
    else{await onAdd(f);msg("Tier created");}
    setSaving(false);setShowForm(false);setEditing(null);};

  return(<div>
    <Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Agreement Tiers (Internal)</h3>
      <button onClick={openNew} style={{...BP,fontSize:12}}>+ New Tier</button>
    </div>
    <div style={{fontSize:11,color:B.textDim,marginBottom:14,padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}>
      These are internal tier templates. Customers never see the tier name — they only see the terms, services, and pricing.
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {tiers.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}>No tiers defined yet. Create Bronze, Silver, Gold (or your own).</Card>}
      {tiers.map(t=><Card key={t.id} style={{padding:"14px 16px",borderLeft:"3px solid "+B.cyan}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:B.text}}>{t.name}</div>
            <div style={{fontSize:11,color:B.textDim,marginTop:2}}>
              {FREQ_LABELS[t.visit_frequency]||t.visit_frequency} · {t.visits_per_year} visits/yr · {t.response_time_hours}h response · {t.priority_level} priority
              {t.discount_pct>0&&<span> · {t.discount_pct}% discount</span>}
            </div>
            <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>
              <strong>${parseFloat(t.base_monthly_rate||0).toFixed(0)}/mo</strong>
              {(t.included_services||[]).length>0&&<span> · {(t.included_services||[]).slice(0,3).join(", ")}{(t.included_services||[]).length>3?"...":""}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>openEdit(t)} style={{...BS,padding:"5px 10px",fontSize:11}}>Edit</button>
            <button onClick={async()=>{if(!window.confirm("Delete tier '"+t.name+"'?"))return;await onDelete(t.id);msg("Deleted");}} style={{...BS,padding:"5px 10px",fontSize:11,color:B.red,borderColor:B.red+"40"}}>×</button>
          </div>
        </div>
      </Card>)}
    </div>

    {showForm&&<Modal title={editing?"Edit Tier":"Create Agreement Tier"} onClose={()=>{setShowForm(false);setEditing(null);}} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Tier Name (Internal Only) <span style={{color:B.red}}>*</span></label><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Gold, Premium, Standard" style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Visit Frequency</label><select value={f.visit_frequency} onChange={e=>{set("visit_frequency",e.target.value);set("visits_per_year",FREQ_VISITS[e.target.value]||4);}} style={{...IS,cursor:"pointer"}}>{Object.entries(FREQ_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
          <div><label style={LS}>Visits Per Year</label><input value={f.visits_per_year} onChange={e=>set("visits_per_year",parseInt(e.target.value)||0)} type="number" style={{...IS,fontFamily:M}}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Response Time (hours)</label><input value={f.response_time_hours} onChange={e=>set("response_time_hours",parseInt(e.target.value)||0)} type="number" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Default WO Priority</label><select value={f.priority_level} onChange={e=>set("priority_level",e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Base Monthly Rate ($)</label><input value={f.base_monthly_rate} onChange={e=>set("base_monthly_rate",parseFloat(e.target.value)||0)} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Discount %</label><input value={f.discount_pct} onChange={e=>set("discount_pct",parseFloat(e.target.value)||0)} type="number" step="1" style={{...IS,fontFamily:M}}/></div>
        </div>
        <div><label style={LS}>Included Services</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {DEFAULT_SERVICES.map(s=><button key={s} onClick={()=>toggleService(s)} style={{padding:"5px 10px",borderRadius:4,border:"1px solid "+(f.included_services.includes(s)?B.cyan:B.border),background:f.included_services.includes(s)?B.cyanGlow:"transparent",color:f.included_services.includes(s)?B.cyan:B.textDim,fontSize:11,cursor:"pointer",fontFamily:F}}>{f.included_services.includes(s)?"✓ ":""}{s}</button>)}
          </div>
          <div style={{display:"flex",gap:6}}><input value={newService} onChange={e=>setNewService(e.target.value)} placeholder="Add custom service..." style={{...IS,flex:1,padding:8,fontSize:12}} onKeyDown={e=>e.key==="Enter"&&addCustomService()}/><button onClick={addCustomService} style={{...BS,padding:"8px 12px",fontSize:11}}>Add</button></div>
          {f.included_services.filter(s=>!DEFAULT_SERVICES.includes(s)).map(s=><span key={s} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:B.purple+"22",color:B.purple,fontSize:11,fontWeight:600,marginTop:6,marginRight:4}}>{s}<button onClick={()=>toggleService(s)} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:0}}>×</button></span>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{...BS,flex:1}}>Cancel</button>
          <button onClick={save} disabled={saving||!f.name.trim()} style={{...BP,flex:1,opacity:(saving||!f.name.trim())?.6:1}}>{saving?"Saving...":(editing?"Save":"Create Tier")}</button>
        </div>
      </div>
    </Modal>}
  </div>);
}

// ─── Agreement Form ───────────────────────────────────
function AgreementForm({tiers,customers,equipment,userName,onSave,onClose,initial}){
  const[f,setF]=useState(initial?{
    customer_id:initial.customer_id||"",customer_name:initial.customer_name||"",tier_id:initial.tier_id||"",tier_name:initial.tier_name||"",
    start_date:initial.start_date||"",end_date:initial.end_date||"",visit_frequency:initial.visit_frequency||"quarterly",
    visits_per_year:initial.visits_per_year||4,included_services:initial.included_services||[],monthly_rate:initial.monthly_rate||0,
    annual_value:initial.annual_value||0,discount_pct:initial.discount_pct||0,priority_level:initial.priority_level||"medium",
    response_time_hours:initial.response_time_hours||24,equipment_ids:initial.equipment_ids||[],notes:initial.notes||"",auto_renew:initial.auto_renew||false
  }:{
    customer_id:"",customer_name:"",tier_id:"",tier_name:"",start_date:new Date().toISOString().slice(0,10),end_date:"",
    visit_frequency:"quarterly",visits_per_year:4,included_services:[],monthly_rate:0,annual_value:0,
    discount_pct:0,priority_level:"medium",response_time_hours:24,equipment_ids:[],notes:"",auto_renew:false
  });
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const selectTier=(tierId)=>{const t=tiers.find(x=>x.id===tierId);if(!t){set("tier_id","");set("tier_name","");return;}
    setF(p=>({...p,tier_id:t.id,tier_name:t.name,visit_frequency:t.visit_frequency,visits_per_year:t.visits_per_year||FREQ_VISITS[t.visit_frequency]||4,included_services:t.included_services||[],monthly_rate:t.base_monthly_rate||0,annual_value:(t.base_monthly_rate||0)*12,discount_pct:t.discount_pct||0,priority_level:t.priority_level||"medium",response_time_hours:t.response_time_hours||24}));};

  const selectCustomer=(id)=>{const c=customers.find(x=>x.id===id);set("customer_id",id);if(c)set("customer_name",c.name);};

  const custEquipment=(equipment||[]).filter(e=>e.customer_id===f.customer_id&&e.status==="active");
  const toggleEquipment=(eqId)=>set("equipment_ids",f.equipment_ids.includes(eqId)?f.equipment_ids.filter(x=>x!==eqId):[...f.equipment_ids,eqId]);

  const save=async()=>{
    if(!f.customer_name||!f.start_date||!f.end_date||saving)return;
    setSaving(true);await onSave(initial?{id:initial.id,...f}:f);setSaving(false);onClose();};

  return(<Modal title={initial?"Edit Agreement":"Create Service Agreement"} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Customer <span style={{color:B.red}}>*</span></label>
          <select value={f.customer_id} onChange={e=>selectCustomer(e.target.value)} style={{...IS,cursor:"pointer"}}>
            <option value="">Select customer...</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label style={LS}>Tier Template</label>
          <select value={f.tier_id} onChange={e=>selectTier(e.target.value)} style={{...IS,cursor:"pointer"}}>
            <option value="">— Custom (no tier) —</option>
            {tiers.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name} — ${parseFloat(t.base_monthly_rate||0).toFixed(0)}/mo</option>)}
          </select>
          <div style={{fontSize:10,color:B.textDim,marginTop:3}}>Selecting a tier auto-fills fields below. You can override any field.</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Start Date <span style={{color:B.red}}>*</span></label><input type="date" value={f.start_date} onChange={e=>set("start_date",e.target.value)} style={{...IS,padding:14}}/></div>
        <div><label style={LS}>End Date <span style={{color:B.red}}>*</span></label><input type="date" value={f.end_date} onChange={e=>set("end_date",e.target.value)} style={{...IS,padding:14}}/></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <div><label style={LS}>Visit Frequency</label><select value={f.visit_frequency} onChange={e=>{set("visit_frequency",e.target.value);set("visits_per_year",FREQ_VISITS[e.target.value]||4);}} style={{...IS,cursor:"pointer"}}>{Object.entries(FREQ_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
        <div><label style={LS}>Monthly Rate ($)</label><input value={f.monthly_rate} onChange={e=>{const v=parseFloat(e.target.value)||0;set("monthly_rate",v);set("annual_value",v*12);}} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>Annual Value ($)</label><div style={{...IS,background:B.surfaceActive,color:B.text,fontFamily:M}}>${(f.annual_value||0).toFixed(2)}</div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <div><label style={LS}>Response Time (hrs)</label><input value={f.response_time_hours} onChange={e=>set("response_time_hours",parseInt(e.target.value)||0)} type="number" style={{...IS,fontFamily:M}}/></div>
        <div><label style={LS}>WO Priority</label><select value={f.priority_level} onChange={e=>set("priority_level",e.target.value)} style={{...IS,cursor:"pointer"}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        <div><label style={LS}>Discount %</label><input value={f.discount_pct} onChange={e=>set("discount_pct",parseFloat(e.target.value)||0)} type="number" style={{...IS,fontFamily:M}}/></div>
      </div>

      <div><label style={LS}>Included Services</label>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(f.included_services||[]).map((s,i)=>
          <span key={i} style={{padding:"4px 10px",borderRadius:4,background:B.cyan+"18",color:B.cyan,fontSize:11,fontWeight:600}}>{s}</span>
        )}{(f.included_services||[]).length===0&&<span style={{fontSize:11,color:B.textDim}}>Select a tier to auto-fill, or add manually</span>}</div>
      </div>

      {/* Covered Equipment */}
      {f.customer_id&&custEquipment.length>0&&<div><label style={LS}>Covered Equipment ({f.equipment_ids.length} selected)</label>
        <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:150,overflowY:"auto"}}>
          {custEquipment.map(eq=><div key={eq.id} onClick={()=>toggleEquipment(eq.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:f.equipment_ids.includes(eq.id)?B.cyanGlow:B.bg,border:"1px solid "+(f.equipment_ids.includes(eq.id)?B.cyan:B.border),borderRadius:6,cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:3,border:"2px solid "+(f.equipment_ids.includes(eq.id)?B.cyan:B.border),background:f.equipment_ids.includes(eq.id)?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{f.equipment_ids.includes(eq.id)&&<span style={{color:"#fff",fontSize:10}}>✓</span>}</div>
            <div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:B.text}}>{eq.model||"Unknown"}</span><span style={{fontSize:10,color:B.textDim,marginLeft:6}}>{eq.serial_number||eq.asset_tag||""} · {eq.location||""}</span></div>
          </div>)}
        </div>
      </div>}

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <input type="checkbox" checked={f.auto_renew} onChange={e=>set("auto_renew",e.target.checked)} style={{width:18,height:18,accentColor:B.cyan}}/>
        <div><span style={{fontSize:13,fontWeight:600,color:B.text}}>Auto-Renew</span><div style={{fontSize:10,color:B.textDim}}>Automatically renew when the agreement expires</div></div>
      </div>

      <div><label style={LS}>Notes</label><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS,resize:"vertical"}} placeholder="Additional terms or notes..."/></div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{...BS,flex:1}}>Cancel</button>
        <button onClick={save} disabled={saving||!f.customer_name||!f.start_date||!f.end_date} style={{...BP,flex:1,opacity:(saving||!f.customer_name)?.6:1}}>{saving?"Saving...":(initial?"Save":"Create Agreement")}</button>
      </div>
    </div>
  </Modal>);
}

// ─── Agreement Detail ─────────────────────────────────
function AgreementDetail({agreement,onBack,onUpdate,wos,pos,timeEntries,equipment}){
  const[editing,setEditing]=useState(false);const[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const a=agreement;
  const linkedWOs=wos.filter(w=>w.agreement_id===a.id);
  const totalHours=linkedWOs.reduce((s,w)=>timeEntries.filter(t=>t.wo_id===w.id).reduce((ss,t)=>ss+parseFloat(t.hours||0),0)+s,0);
  const totalCost=linkedWOs.reduce((s,w)=>pos.filter(p=>p.wo_id===w.id&&p.status==="approved").reduce((ss,p)=>ss+parseFloat(p.amount||0),0)+s,0);
  const coveredEquipment=(equipment||[]).filter(e=>(a.equipment_ids||[]).includes(e.id));
  const daysRemaining=Math.ceil((new Date(a.end_date)-new Date())/86400000);

  return(<div style={{animation:"fadeIn .2s ease-out"}}>
    <Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,cursor:"pointer",fontFamily:F,fontSize:13,fontWeight:600,marginBottom:12,padding:0}}>← Back to Agreements</button>

    <Card style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:M,fontWeight:800,fontSize:16,color:B.text}}>{a.agreement_num}</span><Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge></div>
          <div style={{fontSize:14,fontWeight:600,color:B.textMuted,marginTop:4}}>{a.customer_name}</div>
          {a.tier_name&&<div style={{fontSize:11,color:B.purple,marginTop:2}}>Tier: {a.tier_name} (internal)</div>}
        </div>
        <button onClick={()=>setEditing(true)} style={{...BS,padding:"6px 12px",fontSize:11}}>Edit</button>
      </div>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
      <StatCard label="Monthly Rate" value={"$"+(a.monthly_rate||0).toFixed(0)} icon="💰" color={B.green}/>
      <StatCard label="Annual Value" value={"$"+(a.annual_value||0).toFixed(0)} icon="📊" color={B.cyan}/>
      <StatCard label="Visits Done" value={a.visits_completed+"/"+(a.visits_per_year||"?")} icon="✓" color={B.cyan}/>
      <StatCard label="Days Left" value={daysRemaining>0?daysRemaining:"Expired"} icon="📅" color={daysRemaining<=30?B.orange:B.green}/>
      <StatCard label="Service Hours" value={totalHours.toFixed(1)} icon="⏱" color={B.orange}/>
      <StatCard label="Parts Cost" value={"$"+totalCost.toFixed(0)} icon="🔧" color={B.purple}/>
    </div>

    {/* Terms */}
    <Card style={{marginBottom:12}}>
      <span style={LS}>Agreement Terms</span>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8,fontSize:12}}>
        <div><span style={{color:B.textDim}}>Period:</span> <span style={{color:B.text,fontWeight:600}}>{a.start_date} — {a.end_date}</span></div>
        <div><span style={{color:B.textDim}}>Frequency:</span> <span style={{color:B.text,fontWeight:600}}>{FREQ_LABELS[a.visit_frequency]||a.visit_frequency}</span></div>
        <div><span style={{color:B.textDim}}>Response:</span> <span style={{color:B.text,fontWeight:600}}>{a.response_time_hours}h</span></div>
        <div><span style={{color:B.textDim}}>Priority:</span> <span style={{color:B.text,fontWeight:600}}>{a.priority_level}</span></div>
        <div><span style={{color:B.textDim}}>Discount:</span> <span style={{color:B.text,fontWeight:600}}>{a.discount_pct||0}%</span></div>
        <div><span style={{color:B.textDim}}>Auto-Renew:</span> <span style={{color:a.auto_renew?B.green:B.textDim,fontWeight:600}}>{a.auto_renew?"Yes":"No"}</span></div>
      </div>
    </Card>

    {/* Included Services */}
    {(a.included_services||[]).length>0&&<Card style={{marginBottom:12}}>
      <span style={LS}>Included Services</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
        {(a.included_services||[]).map((s,i)=><span key={i} style={{padding:"5px 10px",borderRadius:4,background:B.cyan+"15",color:B.cyan,fontSize:11,fontWeight:600}}>✓ {s}</span>)}
      </div>
    </Card>}

    {/* Covered Equipment */}
    {coveredEquipment.length>0&&<Card style={{marginBottom:12}}>
      <span style={LS}>Covered Equipment ({coveredEquipment.length})</span>
      <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>
        {coveredEquipment.map(eq=><div key={eq.id} style={{padding:"8px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,fontSize:12}}>
          <span style={{fontWeight:700,color:B.text}}>{eq.model||"Unknown"}</span>
          <span style={{color:B.textDim,marginLeft:8}}>{eq.serial_number||eq.asset_tag||""} · {eq.location||""}</span>
        </div>)}
      </div>
    </Card>}

    {/* Service History */}
    <Card style={{marginBottom:12}}>
      <span style={LS}>Service History ({linkedWOs.length} visits)</span>
      {linkedWOs.length===0?<div style={{fontSize:12,color:B.textDim,marginTop:6}}>No service visits recorded yet</div>:
      <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>
        {linkedWOs.slice(0,15).map(w=><div key={w.id} style={{padding:"8px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,borderLeft:"3px solid "+(w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange),fontSize:12}}>
          <span style={{fontFamily:M,fontWeight:700,color:B.cyan}}>{w.wo_id}</span>
          <span style={{color:B.textMuted,marginLeft:8}}>{w.title}</span>
          <span style={{color:B.textDim,marginLeft:8}}>{w.created_at?.slice(0,10)}</span>
          <Badge color={w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange}>{w.status}</Badge>
        </div>)}
      </div>}
    </Card>

    {a.notes&&<Card style={{marginBottom:12}}><span style={LS}>Notes</span><div style={{fontSize:13,color:B.textMuted,marginTop:4,whiteSpace:"pre-wrap"}}>{a.notes}</div></Card>}
  </div>);
}

// ─── Agreement Dashboard ──────────────────────────────
function AgreementDashboard({D,A,userRole,userName}){
  const canEdit=userRole==="admin"||userRole==="manager";
  const[view,setView]=useState("list");const[selected,setSelected]=useState(null);
  const[creating,setCreating]=useState(false);const[manageTiers,setManageTiers]=useState(false);
  const[toast,setToast]=useState("");const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};

  const agreements=D.agreements||[];const tiers=D.agreementTiers||[];
  const active=agreements.filter(a=>a.status==="active");
  const annualRevenue=active.reduce((s,a)=>s+parseFloat(a.annual_value||0),0);
  const today=new Date().toISOString().slice(0,10);
  const thirtyDays=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const expiringSoon=agreements.filter(a=>a.status==="active"&&a.end_date>=today&&a.end_date<=thirtyDays).length;
  const renewalRate=agreements.length>0?Math.round((active.length/agreements.length)*100):0;

  if(selected){const agr=agreements.find(a=>a.id===selected);
    if(!agr)return<div style={{padding:20,color:B.textDim}}>Agreement not found. <button onClick={()=>setSelected(null)} style={{color:B.cyan,background:"none",border:"none",cursor:"pointer"}}>Go back</button></div>;
    return<AgreementDetail agreement={agr} onBack={()=>setSelected(null)} onUpdate={A.updateAgreement} wos={D.wos} pos={D.pos} timeEntries={D.time} equipment={D.equipment||[]}/>;
  }

  if(manageTiers)return<div><button onClick={()=>setManageTiers(false)} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",fontFamily:F,marginBottom:10}}>← Back to Agreements</button><AgreementTierManager tiers={tiers} onAdd={A.addAgreementTier} onUpdate={A.updateAgreementTier} onDelete={A.deleteAgreementTier}/></div>;

  return(<div>
    <Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Active Agreements" value={active.length} icon="📋" color={B.green}/>
      <StatCard label="Annual Revenue" value={"$"+annualRevenue.toLocaleString()} icon="💰" color={B.cyan}/>
      <StatCard label="Expiring Soon" value={expiringSoon} icon="⚠️" color={expiringSoon>0?B.orange:B.textDim}/>
      <StatCard label="Retention Rate" value={renewalRate+"%"} icon="📊" color={renewalRate>=70?B.green:B.orange}/>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Service Agreements</h3>
      <div style={{display:"flex",gap:6}}>
        {canEdit&&<button onClick={()=>setManageTiers(true)} style={{...BS,fontSize:11,padding:"6px 12px"}}>Manage Tiers</button>}
        {canEdit&&<button onClick={()=>setCreating(true)} style={{...BP,fontSize:12}}>+ New Agreement</button>}
      </div>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {agreements.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}>
        <div style={{fontSize:20,marginBottom:6}}>📋</div>
        <div style={{fontSize:13}}>No service agreements yet.</div>
        {canEdit&&<div style={{marginTop:8,fontSize:11,color:B.textMuted}}>Start by creating tiers (Bronze/Silver/Gold), then create agreements for customers.</div>}
      </Card>}
      {agreements.map(a=>{
        const daysLeft=Math.ceil((new Date(a.end_date)-new Date())/86400000);
        return(<Card key={a.id} className="card-hover" onClick={()=>setSelected(a.id)} style={{padding:"14px 16px",cursor:"pointer",borderLeft:"3px solid "+(STATUS_COLORS[a.status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontFamily:M,fontWeight:800,fontSize:14,color:B.text}}>{a.agreement_num}</span>
                <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                {a.tier_name&&<span style={{fontSize:10,color:B.purple,fontWeight:600,padding:"2px 6px",background:B.purple+"15",borderRadius:3}}>{a.tier_name}</span>}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:3}}>{a.customer_name}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>
                {a.start_date} — {a.end_date} · {FREQ_LABELS[a.visit_frequency]||a.visit_frequency} · {a.visits_completed}/{a.visits_per_year} visits
                {a.auto_renew&&<span style={{color:B.green}}> · Auto-renew</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:M,fontWeight:800,fontSize:14,color:B.green}}>${parseFloat(a.monthly_rate||0).toFixed(0)}/mo</div>
              {a.status==="active"&&<div style={{fontSize:10,fontWeight:600,color:daysLeft<=30?B.orange:B.textDim,marginTop:2}}>{daysLeft>0?daysLeft+"d left":"Expired"}</div>}
            </div>
          </div>
        </Card>);
      })}
    </div>

    {creating&&<AgreementForm tiers={tiers} customers={D.customers} equipment={D.equipment||[]} userName={userName} onSave={async(agr)=>{await A.addAgreement(agr);msg("Agreement created");setCreating(false);}} onClose={()=>setCreating(false)}/>}
  </div>);
}

export { AgreementDashboard, AgreementTierManager, AgreementForm, AgreementDetail, genAgreementNum };
