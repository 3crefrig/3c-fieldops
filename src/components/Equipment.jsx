import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, haptic, cleanText, autoCorrect } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, CustomSelect } from "./ui";
import { CameraUpload } from "./CameraUpload";
import { Html5Qrcode } from "html5-qrcode";

const EQ_TYPES=[
  {value:"walk_in_cooler",label:"Walk-In Cooler"},
  {value:"walk_in_freezer",label:"Walk-In Freezer"},
  {value:"reach_in_cooler",label:"Reach-In Cooler"},
  {value:"reach_in_freezer",label:"Reach-In Freezer"},
  {value:"blast_chiller",label:"Blast Chiller"},
  {value:"ice_machine",label:"Ice Machine"},
  {value:"condenser_unit",label:"Condenser Unit"},
  {value:"evaporator",label:"Evaporator"},
  {value:"env_chamber",label:"Environmental Chamber"},
  {value:"display_case",label:"Display Case"},
  {value:"prep_table",label:"Prep Table"},
  {value:"rooftop_unit",label:"Rooftop Unit"},
  {value:"split_system",label:"Split System"},
  {value:"other",label:"Other"}
];
const EQ_LABELS=Object.fromEntries(EQ_TYPES.map(t=>[t.value,t.label]));
const REF_TYPES=["R-404A","R-134a","R-410A","R-290","R-407C","R-22","R-448A","R-449A","R-507A","R-744 (CO2)","Other"];
const STATUS_COLORS={active:B.green,decommissioned:B.textDim,pending_install:B.orange};
const STATUS_LABELS={active:"Active",decommissioned:"Decommissioned",pending_install:"Pending Install"};

// ─── Barcode / QR Scanner ─────────────────────────────
function BarcodeScanner({onScan,onClose}){
  const scannerRef=useRef(null);const containerRef=useRef(null);const[error,setError]=useState("");
  useEffect(()=>{
    const scannerId="eq-scanner-"+Date.now();
    if(containerRef.current)containerRef.current.id=scannerId;
    const scanner=new Html5Qrcode(scannerId);scannerRef.current=scanner;
    scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:280,height:180},aspectRatio:1.5},
      (text)=>{haptic(50);scanner.stop().catch(()=>{});onScan(text);},
      ()=>{}
    ).catch(err=>{setError("Camera access denied or unavailable. You can type the asset tag manually.");console.warn("Scanner error:",err);});
    return()=>{scanner.stop().catch(()=>{});};
  },[onScan,onClose]);
  return(<Modal title="Scan Asset Tag" onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
      <div ref={containerRef} style={{width:"100%",maxWidth:400,minHeight:250,borderRadius:10,overflow:"hidden",background:B.bg}}/>
      {error&&<div style={{color:B.orange,fontSize:12,textAlign:"center",padding:8}}>{error}</div>}
      <div style={{fontSize:11,color:B.textDim,textAlign:"center"}}>Point camera at barcode or QR code on equipment</div>
    </div>
  </Modal>);
}

// ─── Equipment Picker (for WO forms) ──────────────────
function EquipmentPicker({equipment,customerName,value,onChange}){
  const[scanning,setScanning]=useState(false);const[search,setSearch]=useState("");
  const filtered=equipment.filter(e=>{
    if(customerName&&e.customer_name!==customerName)return false;
    if(!search)return true;
    const s=search.toLowerCase();
    return(e.model||"").toLowerCase().includes(s)||(e.serial_number||"").toLowerCase().includes(s)||(e.asset_tag||"").toLowerCase().includes(s)||(e.location||"").toLowerCase().includes(s);
  });
  const selected=value?equipment.find(e=>e.id===value):null;
  const handleScan=(tag)=>{setScanning(false);
    const match=filtered.find(e=>e.asset_tag===tag)||equipment.find(e=>e.asset_tag===tag);
    if(match){onChange(match.id);haptic();}
    else alert("No equipment found with asset tag: "+tag+". Register it in the Equipment tab first.");
  };
  return(<div>
    <label style={LS}>Equipment</label>
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <select value={value||""} onChange={e=>onChange(e.target.value||null)} style={{...IS,flex:1,cursor:"pointer"}}>
        <option value="">— None —</option>
        {filtered.map(e=><option key={e.id} value={e.id}>{e.model||"Unknown"} — {e.serial_number||e.asset_tag||"No ID"} ({e.location||""})</option>)}
      </select>
      <button onClick={()=>setScanning(true)} type="button" style={{...BS,padding:"10px 14px",whiteSpace:"nowrap",fontSize:12}}>Scan</button>
    </div>
    {selected&&<div style={{marginTop:6,padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,fontSize:11,color:B.textMuted}}>
      <span style={{fontWeight:700,color:B.cyan}}>{selected.model||"Unknown"}</span>
      {selected.serial_number&&<span> · SN: {selected.serial_number}</span>}
      {selected.asset_tag&&<span> · Tag: {selected.asset_tag}</span>}
      {selected.refrigerant_type&&<span> · {selected.refrigerant_type}</span>}
    </div>}
    {scanning&&<BarcodeScanner onScan={handleScan} onClose={()=>setScanning(false)}/>}
  </div>);
}

// ─── Equipment Form (Create/Edit) ─────────────────────
function EquipmentForm({initial,customers,onSave,onClose}){
  const[f,setF]=useState({
    customer_id:initial?.customer_id||"",customer_name:initial?.customer_name||"",
    asset_tag:initial?.asset_tag||"",model:initial?.model||"",serial_number:initial?.serial_number||"",
    manufacturer:initial?.manufacturer||"",equipment_type:initial?.equipment_type||"other",
    refrigerant_type:initial?.refrigerant_type||"",install_date:initial?.install_date||"",
    warranty_expiration:initial?.warranty_expiration||"",location:initial?.location||"",
    location_detail:initial?.location_detail||"",notes:initial?.notes||"",
    status:initial?.status||"active"
  });
  const[saving,setSaving]=useState(false);const[scanning,setScanning]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const selectCustomer=(id)=>{const c=customers.find(x=>x.id===id);set("customer_id",id);if(c)set("customer_name",c.name);};
  const save=async()=>{
    if(!f.customer_name.trim()){alert("Customer is required.");return;}
    if(!f.model.trim()&&!f.serial_number.trim()&&!f.asset_tag.trim()){alert("At least one identifier (model, serial, or asset tag) is required.");return;}
    if(f.notes&&cleanText(f.notes,"Notes")===null)return;
    setSaving(true);try{await onSave(initial?{...initial,...f}:f);setSaving(false);onClose();}catch(e){console.error(e);setSaving(false);}
  };
  return(<Modal title={initial?"Edit Equipment":"Register Equipment"} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={LS}>Customer <span style={{color:B.red}}>*</span></label>
        <select value={f.customer_id} onChange={e=>selectCustomer(e.target.value)} style={{...IS,cursor:"pointer"}}>
          <option value="">Select customer...</option>
          {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Asset Tag</label>
          <div style={{display:"flex",gap:6}}>
            <input value={f.asset_tag} onChange={e=>set("asset_tag",e.target.value)} placeholder="Scan or type" style={{...IS,flex:1}}/>
            <button onClick={()=>setScanning(true)} type="button" style={{...BS,padding:"10px 12px",fontSize:11}}>Scan</button>
          </div></div>
        <div><label style={LS}>Equipment Type</label>
          <select value={f.equipment_type} onChange={e=>set("equipment_type",e.target.value)} style={{...IS,cursor:"pointer"}}>
            {EQ_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Model</label><input value={f.model} onChange={e=>set("model",e.target.value)} placeholder="e.g. Heatcraft PRO3" style={IS}/></div>
        <div><label style={LS}>Manufacturer</label><input value={f.manufacturer} onChange={e=>set("manufacturer",e.target.value)} placeholder="e.g. Heatcraft, Copeland" style={IS}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Serial Number</label><input value={f.serial_number} onChange={e=>set("serial_number",e.target.value)} style={IS}/></div>
        <div><label style={LS}>Refrigerant Type</label>
          <select value={f.refrigerant_type} onChange={e=>set("refrigerant_type",e.target.value)} style={{...IS,cursor:"pointer"}}>
            <option value="">Select...</option>
            {REF_TYPES.map(r=><option key={r} value={r}>{r}</option>)}
          </select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Install Date</label><input type="date" value={f.install_date} onChange={e=>set("install_date",e.target.value)} style={{...IS,padding:14}}/></div>
        <div><label style={LS}>Warranty Expiration</label><input type="date" value={f.warranty_expiration} onChange={e=>set("warranty_expiration",e.target.value)} style={{...IS,padding:14}}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={LS}>Location / Building</label><input value={f.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Building A, Kitchen" style={IS}/></div>
        <div><label style={LS}>Room / Detail</label><input value={f.location_detail} onChange={e=>set("location_detail",e.target.value)} placeholder="e.g. Room 104, Roof" style={IS}/></div>
      </div>
      <div><label style={LS}>Status</label>
        <select value={f.status} onChange={e=>set("status",e.target.value)} style={{...IS,cursor:"pointer"}}>
          <option value="active">Active</option>
          <option value="pending_install">Pending Install</option>
          <option value="decommissioned">Decommissioned</option>
        </select></div>
      <div><label style={LS}>Notes</label><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="Additional details..." style={{...IS,resize:"vertical"}}/></div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{...BS,flex:1}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":initial?"Save Changes":"Register Equipment"}</button>
      </div>
    </div>
    {scanning&&<BarcodeScanner onScan={(tag)=>{setScanning(false);set("asset_tag",tag);}} onClose={()=>setScanning(false)}/>}
  </Modal>);
}

// ─── Equipment Detail ─────────────────────────────────
function EquipmentDetail({eq,onBack,onUpdate,onDelete,wos,pos,timeEntries,photos,canEdit,loadData,userName,userRole}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[editing,setEditing]=useState(false);const[toast,setToast]=useState("");const[confirmDel,setConfirmDel]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const linkedWOs=wos.filter(w=>w.equipment_id===eq.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const linkedPhotos=photos.filter(p=>p.equipment_id===eq.id);
  const totalHours=linkedWOs.reduce((s,w)=>s+timeEntries.filter(t=>t.wo_id===w.id).reduce((ss,t)=>ss+parseFloat(t.hours||0),0),0);
  const linkedPOs=linkedWOs.flatMap(w=>pos.filter(p=>p.wo_id===w.id));
  const totalPartsCost=linkedPOs.filter(p=>p.status==="approved").reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const warrantyDays=eq.warranty_expiration?Math.ceil((new Date(eq.warranty_expiration)-new Date())/(86400000)):null;
  const warrantyColor=warrantyDays===null?B.textDim:warrantyDays<=0?B.red:warrantyDays<=30?B.orange:B.green;

  return(<div style={{animation:"fadeIn .2s ease-out"}}>
    <Toast msg={toast}/>
    <button onClick={onBack} style={{background:"none",border:"none",color:B.cyan,cursor:"pointer",fontFamily:F,fontSize:13,fontWeight:600,marginBottom:12,padding:0}}>← Back to Equipment</button>

    {/* Header Card */}
    <Card style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18,fontWeight:800,color:B.text}}>{eq.model||"Unknown Model"}</span>
            <Badge color={STATUS_COLORS[eq.status]}>{STATUS_LABELS[eq.status]||eq.status}</Badge>
          </div>
          {eq.manufacturer&&<div style={{fontSize:12,color:B.textMuted,marginTop:2}}>{eq.manufacturer}</div>}
          <div style={{fontSize:12,color:B.textDim,marginTop:4}}>
            {eq.serial_number&&<span>SN: <span style={{fontFamily:M,color:B.text}}>{eq.serial_number}</span> · </span>}
            {eq.asset_tag&&<span>Tag: <span style={{fontFamily:M,color:B.cyan}}>{eq.asset_tag}</span> · </span>}
            <span>{EQ_LABELS[eq.equipment_type]||eq.equipment_type}</span>
          </div>
        </div>
        {canEdit&&<div style={{display:"flex",gap:6}}>
          <button onClick={()=>setEditing(true)} style={{...BS,padding:"6px 12px",fontSize:11}}>Edit</button>
          <button onClick={()=>setConfirmDel(true)} style={{...BS,padding:"6px 12px",fontSize:11,color:B.red,borderColor:B.red+"40"}}>Delete</button>
        </div>}
      </div>
    </Card>

    {/* Info Grid */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:12}}>
      <StatCard label="Customer" value={eq.customer_name} icon="🏢" color={B.cyan}/>
      <StatCard label="Refrigerant" value={eq.refrigerant_type||"—"} icon="❄️" color={B.purple}/>
      <StatCard label="Warranty" value={warrantyDays===null?"N/A":warrantyDays<=0?"Expired":warrantyDays+"d left"} icon="🛡" color={warrantyColor}/>
      <StatCard label="Service Visits" value={linkedWOs.length} icon="🔧" color={B.cyan}/>
      <StatCard label="Total Hours" value={totalHours.toFixed(1)} icon="⏱" color={B.orange}/>
      <StatCard label="Parts Spend" value={"$"+totalPartsCost.toFixed(0)} icon="💰" color={B.green}/>
    </div>

    {/* Location */}
    {(eq.location||eq.location_detail)&&<Card style={{marginBottom:12}}>
      <span style={LS}>Location</span>
      <div style={{fontSize:13,color:B.text,marginTop:4}}>{eq.location}{eq.location_detail?" — "+eq.location_detail:""}</div>
      {eq.install_date&&<div style={{fontSize:11,color:B.textDim,marginTop:2}}>Installed: {eq.install_date}</div>}
    </Card>}

    {/* Notes */}
    {eq.notes&&<Card style={{marginBottom:12}}>
      <span style={LS}>Notes</span>
      <div style={{fontSize:13,color:B.textMuted,marginTop:4,whiteSpace:"pre-wrap"}}>{eq.notes}</div>
    </Card>}

    {/* Equipment Photo */}
    {canEdit&&<Card style={{marginBottom:12}}>
      <span style={LS}>Equipment Photos</span>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
        {linkedPhotos.map((p,i)=><a key={i} href={(p.photo_url||"").replace("thumbnail?id=","file/d/").replace("&sz=w400","/view")} target="_blank" rel="noreferrer" style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border}}>
          {p.photo_url?<img src={p.photo_url} alt={p.filename} style={{width:90,height:90,objectFit:"cover",display:"block"}}/>:<div style={{width:90,height:90,display:"flex",alignItems:"center",justifyContent:"center",background:B.bg,fontSize:10,color:B.textDim}}>No preview</div>}
        </a>)}
      </div>
      <div style={{marginTop:8}}><CameraUpload woId={null} equipmentId={eq.id} woName={eq.model||"Equipment"} userName={userName} onUploaded={loadData}/></div>
    </Card>}

    {/* Service History */}
    <Card style={{marginBottom:12}}>
      <span style={LS}>Service History ({linkedWOs.length})</span>
      {linkedWOs.length===0?<div style={{fontSize:12,color:B.textDim,marginTop:6}}>No service records yet</div>:<>
      {(()=>{const byTitle={};linkedWOs.forEach(w=>{const key=(w.title||"").toLowerCase().trim();if(!key)return;byTitle[key]=(byTitle[key]||0)+1;});const recurring=Object.entries(byTitle).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).slice(0,3);const firstDate=linkedWOs[linkedWOs.length-1]?.created_at?.slice(0,10);const lastDate=linkedWOs[0]?.created_at?.slice(0,10);return(recurring.length>0||linkedWOs.length>=3)?<div style={{marginTop:8,padding:"8px 10px",background:B.orange+"11",border:"1px solid "+B.orange+"33",borderRadius:6,fontSize:11}}>
        {recurring.length>0&&<div style={{color:B.orange,fontWeight:600,marginBottom:recurring.length>0?4:0}}>⚠️ Recurring issues (repair-vs-replace flag):</div>}
        {recurring.map(([title,count])=><div key={title} style={{color:B.text,marginLeft:12,marginTop:2}}>• {title.charAt(0).toUpperCase()+title.slice(1)} <span style={{color:B.orange,fontWeight:700}}>×{count}</span></div>)}
        {firstDate&&lastDate&&<div style={{color:B.textDim,marginTop:6,fontSize:10}}>First service {firstDate} · last {lastDate} · {linkedWOs.length} total visits</div>}
      </div>:null})()}
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
        {linkedWOs.slice(0,20).map(w=>{
          const hrs=timeEntries.filter(t=>t.wo_id===w.id).reduce((s,t)=>s+parseFloat(t.hours||0),0);
          const woPOs=pos.filter(p=>p.wo_id===w.id);
          return(<div key={w.id} style={{padding:"10px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,borderLeft:"3px solid "+(w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:12}}>{w.wo_id}</span>
                <span style={{fontSize:12,color:B.textMuted,marginLeft:8}}>{w.title}</span>
              </div>
              <Badge color={w.status==="completed"?B.green:w.status==="in_progress"?B.cyan:B.orange}>{w.status}</Badge>
            </div>
            <div style={{fontSize:10,color:B.textDim,marginTop:4}}>
              {w.created_at?.slice(0,10)} · {hrs.toFixed(1)}h · {woPOs.length} PO{woPOs.length!==1?"s":""}
              {w.work_performed&&<span> · {w.work_performed.slice(0,60)}{w.work_performed.length>60?"...":""}</span>}
            </div>
          </div>);
        })}
      </div></>}
    </Card>

    {/* Modals */}
    {editing&&<EquipmentForm initial={eq} customers={[{id:eq.customer_id,name:eq.customer_name}]} onSave={async(updated)=>{await onUpdate(updated);msg("Equipment updated");setEditing(false);}} onClose={()=>setEditing(false)}/>}
    {confirmDel&&<Modal title="Delete Equipment?" onClose={()=>setConfirmDel(false)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
        <div style={{fontSize:14,fontWeight:700,color:B.text}}>{eq.model||"This equipment"}</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This will unlink all associated work orders. This cannot be undone.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setConfirmDel(false)} style={{...BS,flex:1}}>Cancel</button>
          <button onClick={async()=>{await onDelete(eq.id);onBack();}} style={{...BP,flex:1,background:B.red}}>Delete</button>
        </div>
      </div>
    </Modal>}
  </div>);
}

// ─── Equipment Dashboard ──────────────────────────────
function EquipmentDashboard({D,A,userRole,userName}){
  const canEdit=userRole==="admin"||userRole==="manager";
  const[search,setSearch]=useState("");const[filter,setFilter]=useState("all");const[typeFilter,setTypeFilter]=useState("all");
  const[creating,setCreating]=useState(false);const[selected,setSelected]=useState(null);
  const[toast,setToast]=useState("");const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const[scanning,setScanning]=useState(false);

  const equipment=D.equipment||[];const customers=D.customers||[];
  const filtered=equipment.filter(e=>{
    if(filter!=="all"&&e.status!==filter)return false;
    if(typeFilter!=="all"&&e.equipment_type!==typeFilter)return false;
    if(search){const s=search.toLowerCase();return(e.model||"").toLowerCase().includes(s)||(e.serial_number||"").toLowerCase().includes(s)||(e.asset_tag||"").toLowerCase().includes(s)||(e.customer_name||"").toLowerCase().includes(s)||(e.manufacturer||"").toLowerCase().includes(s)||(e.location||"").toLowerCase().includes(s);}
    return true;
  });

  const active=equipment.filter(e=>e.status==="active").length;
  const today=new Date().toISOString().slice(0,10);
  const thirtyDays=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const expiringWarranties=equipment.filter(e=>e.status==="active"&&e.warranty_expiration&&e.warranty_expiration>=today&&e.warranty_expiration<=thirtyDays).length;
  const expiredWarranties=equipment.filter(e=>e.status==="active"&&e.warranty_expiration&&e.warranty_expiration<today).length;
  const custCount=new Set(equipment.map(e=>e.customer_name)).size;
  const types=Array.from(new Set(equipment.map(e=>e.equipment_type).filter(Boolean)));

  if(selected){const eq=equipment.find(e=>e.id===selected);
    if(!eq)return<div style={{padding:20,color:B.textDim}}>Equipment not found. <button onClick={()=>setSelected(null)} style={{color:B.cyan,background:"none",border:"none",cursor:"pointer"}}>Go back</button></div>;
    return<EquipmentDetail eq={eq} onBack={()=>setSelected(null)} onUpdate={A.updateEquipment} onDelete={A.deleteEquipment} wos={D.wos} pos={D.pos} timeEntries={D.time} photos={D.photos} canEdit={canEdit} loadData={A.loadData} userName={userName} userRole={userRole}/>;
  }

  const handleScan=(tag)=>{setScanning(false);
    const match=equipment.find(e=>e.asset_tag===tag);
    if(match){setSelected(match.id);haptic();}
    else{msg("No equipment found with tag: "+tag);if(canEdit&&window.confirm("Register new equipment with asset tag \""+tag+"\"?")){setCreating({asset_tag:tag});}}
  };

  return(<div>
    <Toast msg={toast}/>
    {/* Stats */}
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Total Units" value={equipment.length} icon="🔧" color={B.cyan}/>
      <StatCard label="Active" value={active} icon="✓" color={B.green}/>
      <StatCard label="Customers" value={custCount} icon="🏢" color={B.purple}/>
      <StatCard label="Warranty Expiring" value={expiringWarranties} icon="⚠️" color={B.orange}/>
      {expiredWarranties>0&&<StatCard label="Warranty Expired" value={expiredWarranties} icon="🛡" color={B.red}/>}
    </div>

    {/* Actions */}
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by model, serial, tag, customer..." style={{...IS,flex:1,minWidth:200,padding:"8px 12px",fontSize:12}}/>
      <button onClick={()=>setScanning(true)} style={{...BS,padding:"8px 14px",fontSize:12,whiteSpace:"nowrap"}}>Scan Tag</button>
      {canEdit&&<button onClick={()=>setCreating({})} style={{...BP,padding:"8px 14px",fontSize:12,whiteSpace:"nowrap"}}>+ Register</button>}
    </div>

    {/* Filters */}
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {[["all","All"],["active","Active"],["decommissioned","Decommissioned"],["pending_install","Pending"]].map(([k,l])=>
        <button key={k} onClick={()=>setFilter(k)} style={{padding:"5px 12px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
      {types.length>3&&<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>
        <option value="all">All Types</option>
        {types.map(t=><option key={t} value={t}>{EQ_LABELS[t]||t}</option>)}
      </select>}
    </div>

    {/* Equipment List */}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}>
        <div style={{fontSize:20,marginBottom:6}}>{search?"🔍":"🔧"}</div>
        <div style={{fontSize:13}}>{search?"No equipment matching \""+search+"\"":"No equipment registered yet"}</div>
        {canEdit&&!search&&<button onClick={()=>setCreating({})} style={{...BP,marginTop:12,fontSize:12}}>+ Register First Unit</button>}
      </Card>}
      {filtered.map(eq=>{
        const warrantyDays=eq.warranty_expiration?Math.ceil((new Date(eq.warranty_expiration)-new Date())/86400000):null;
        return(<Card key={eq.id} className="card-hover" onClick={()=>setSelected(eq.id)} style={{padding:"12px 16px",cursor:"pointer",borderLeft:"3px solid "+(STATUS_COLORS[eq.status]||B.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:14,color:B.text}}>{eq.model||"Unknown"}</span>
                <Badge color={STATUS_COLORS[eq.status]}>{STATUS_LABELS[eq.status]}</Badge>
                <span style={{fontSize:10,color:B.textDim,fontFamily:M}}>{EQ_LABELS[eq.equipment_type]||eq.equipment_type}</span>
              </div>
              <div style={{fontSize:12,color:B.textMuted,marginTop:3}}>
                {eq.customer_name}
                {eq.location&&<span> · {eq.location}</span>}
                {eq.serial_number&&<span> · SN: <span style={{fontFamily:M}}>{eq.serial_number}</span></span>}
                {eq.asset_tag&&<span> · Tag: <span style={{fontFamily:M,color:B.cyan}}>{eq.asset_tag}</span></span>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
              {eq.refrigerant_type&&<span style={{fontSize:10,color:B.purple,fontWeight:600}}>{eq.refrigerant_type}</span>}
              {warrantyDays!==null&&<span style={{fontSize:10,fontWeight:600,color:warrantyDays<=0?B.red:warrantyDays<=30?B.orange:B.green}}>
                {warrantyDays<=0?"Warranty Expired":warrantyDays+"d warranty"}
              </span>}
            </div>
          </div>
        </Card>);
      })}
    </div>

    {/* Modals */}
    {creating&&<EquipmentForm initial={typeof creating==="object"&&creating.asset_tag?creating:null} customers={customers} onSave={async(eq)=>{await A.addEquipment(eq);msg("Equipment registered");setCreating(false);}} onClose={()=>setCreating(false)}/>}
    {scanning&&<BarcodeScanner onScan={handleScan} onClose={()=>setScanning(false)}/>}
  </div>);
}

export { EquipmentDashboard, EquipmentDetail, EquipmentForm, EquipmentPicker, BarcodeScanner, EQ_TYPES, EQ_LABELS, REF_TYPES };
