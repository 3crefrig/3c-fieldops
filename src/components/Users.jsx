import React, { useState } from "react";
import { B, F, M, IS, LS, BP, BS, ROLES } from "../shared";
import { Card, Badge, Modal, Toast } from "./ui";

function UserMgmt({users,onAddUser,onUpdateUser,onDeleteUser,cur}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[search,setSearch]=useState(""),[rf,setRf]=useState("all"),[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const save=async d=>{if(editing){await onUpdateUser({...editing,...d});msg("Updated "+d.name);}else{await onAddUser(d);msg("Created "+d.name);}setShowForm(false);setEditing(null);};
  const filtered=users.filter(u=>(rf==="all"||u.role===rf)&&(u.name.toLowerCase().includes(search.toLowerCase())||(u.email||"").toLowerCase().includes(search.toLowerCase())));
  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}><button onClick={()=>{setEditing(null);setShowForm(true)}} style={{...BP,padding:"8px 14px",fontSize:12}}>+ New User</button><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...IS,flex:1,minWidth:150,padding:"8px 12px",fontSize:12}}/>{[["all","All"],["admin","Admin"],["manager","Mgr"],["technician","Tech"]].map(([k,l])=><button key={k} onClick={()=>setRf(k)} style={{padding:"6px 10px",borderRadius:4,border:"1px solid "+(rf===k?B.cyan:B.border),background:rf===k?B.cyanGlow:"transparent",color:rf===k?B.cyan:B.textMuted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>{filtered.map(u=><Card key={u.id} style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:"3px solid "+(u.active===false?"#555":ROLES[u.role]?ROLES[u.role].color:B.textDim),opacity:u.active===false?0.6:1}}><div><div style={{fontSize:14,fontWeight:700,color:B.text}}>{u.name}{u.active===false&&<span style={{fontSize:10,color:B.red,fontWeight:600,marginLeft:8,background:B.red+"18",padding:"2px 6px",borderRadius:4}}>INACTIVE</span>}</div><div style={{fontSize:11,color:B.textDim}}>{u.email} · <Badge color={ROLES[u.role]?ROLES[u.role].color:B.textDim}>{u.role}</Badge></div></div><div style={{display:"flex",alignItems:"center",gap:6}}>{u.id!==cur.id&&<button onClick={async()=>{await onUpdateUser({...u,active:u.active===false?true:false});msg(u.active===false?"Activated "+u.name:"Deactivated "+u.name);}} style={{background:"none",border:"none",color:u.active===false?B.green:B.orange,fontSize:10,cursor:"pointer",fontWeight:600}}>{u.active===false?"Activate":"Deactivate"}</button>}<button onClick={()=>{setEditing(u);setShowForm(true)}} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button>{u.id!==cur.id&&<button onClick={async()=>{await onDeleteUser(u.id);msg("Deleted "+u.name)}} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button>}</div></Card>)}</div>
    {showForm&&<UserForm user={editing} onSave={save} onClose={()=>{setShowForm(false);setEditing(null)}} curRole={cur?.role}/>}
  </div>);
}

function UserForm({user,onSave,onClose,curRole}){
  const isAdmin=curRole==="admin";
  const[n,setN]=useState(user?.name||""),[e,setE]=useState(user?.email||""),[r,setR]=useState(user?.role||"technician"),[saving,setSaving]=useState(false);
  const[title,setTitle]=useState(user?.title||""),[phone,setPhone]=useState(user?.phone||"");
  const[billingRate,setBillingRate]=useState(user?.billing_rate||""),[costRate,setCostRate]=useState(user?.cost_rate||"");
  const[active,setActive]=useState(user?.active!==false);
  const go=async()=>{if(!n.trim()||!e.trim()||saving)return;setSaving(true);await onSave({name:n.trim(),email:e.trim().toLowerCase(),role:r,title:title.trim(),phone:phone.trim(),billing_rate:parseFloat(billingRate)||0,cost_rate:parseFloat(costRate)||0,active});setSaving(false);};
  return(<Modal title={user?"Edit User":"Add New User"} onClose={onClose} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Full Name</label><input value={n} onChange={ev=>setN(ev.target.value)} placeholder="Mike Johnson" style={IS}/></div>
    <div><label style={LS}>Gmail Address</label><input value={e} onChange={ev=>setE(ev.target.value)} placeholder="mike@gmail.com" style={IS}/><div style={{fontSize:10,color:B.textDim,marginTop:4}}>Must match their Google account email exactly.</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div><label style={LS}>Role</label><select value={r} onChange={ev=>setR(ev.target.value)} style={{...IS,cursor:"pointer"}}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      <div><label style={LS}>Job Title</label><input value={title} onChange={ev=>setTitle(ev.target.value)} placeholder="Manager, Lead Tech, etc." style={IS}/></div>
    </div>
    <div><label style={LS}>Phone</label><input value={phone} onChange={ev=>setPhone(ev.target.value)} placeholder="(336) 264-0935" style={IS}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {isAdmin&&<div><label style={LS}>Billing Rate ($/hr)</label><input value={billingRate} onChange={ev=>setBillingRate(ev.target.value)} type="number" step="5" placeholder="85" style={{...IS,fontFamily:M}}/></div>}
      {isAdmin&&<div><label style={LS}>Cost Rate ($/hr)</label><input value={costRate} onChange={ev=>setCostRate(ev.target.value)} type="number" step="5" placeholder="35" style={{...IS,fontFamily:M}}/></div>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:B.text}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} style={{width:16,height:16,accentColor:B.cyan,cursor:"pointer"}}/><span style={{fontWeight:600}}>Active</span></label><span style={{fontSize:10,color:B.textDim}}>{active?"User can log in and use the app":"User is deactivated and cannot log in"}</span></div>
    <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border}}>
      <span style={LS}>Email Signature Preview</span>
      <div style={{marginTop:6,fontSize:12,color:B.text,lineHeight:1.5}}><strong>{n||"Name"}</strong><br/>{title||"Title"}<br/>{phone||"Phone"}<br/><img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C" style={{width:100,height:"auto",marginTop:4}}/></div>
    </div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(user?"Save":"Add User")}</button></div>
  </div></Modal>);
}

export { UserMgmt, UserForm };
