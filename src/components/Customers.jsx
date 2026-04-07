import React, { useState } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, Modal, Toast, StatCard } from "./ui";

function CustomerMgmt({customers,onAdd,onUpdate,onDelete,wos,time,pos}){
  const[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[toast,setToast]=useState("");
  const[name,setName]=useState(""),[addr,setAddr]=useState(""),[contact,setContact]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[billingOverride,setBillingOverride]=useState(""),[payTerms,setPayTerms]=useState("Net 30"),[autoInvoice,setAutoInvoice]=useState(false),[partsMarkup,setPartsMarkup]=useState("25"),[custIdCode,setCustIdCode]=useState(""),[vendorNum,setVendorNum]=useState(""),[saving,setSaving]=useState(false);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  const openEdit=(c)=>{setEditing(c);setName(c.name);setAddr(c.address||"");setContact(c.contact_name||"");setPhone(c.phone||"");setEmail(c.email||"");setBillingOverride(c.billing_rate_override||"");setPayTerms(c.payment_terms||"Net 30");setAutoInvoice(c.auto_invoice||false);setPartsMarkup(c.parts_markup!=null?String(c.parts_markup):"25");setCustIdCode(c.customer_id_code||"");setVendorNum(c.vendor_number||"");setShowForm(true);};
  const openNew=()=>{setEditing(null);setName("");setAddr("");setContact("");setPhone("");setEmail("");setBillingOverride("");setPayTerms("Net 30");setAutoInvoice(false);setPartsMarkup("35");setCustIdCode("");setVendorNum("");setShowForm(true);};
  const go=async()=>{if(!name.trim()||saving)return;setSaving(true);const obj={name:name.trim(),address:addr.trim(),contact_name:contact.trim(),phone:phone.trim(),email:email.trim(),billing_rate_override:parseFloat(billingOverride)||null,payment_terms:payTerms,auto_invoice:autoInvoice,parts_markup:parseFloat(partsMarkup)||0,customer_id_code:custIdCode.trim()||null,vendor_number:vendorNum.trim()||null};if(editing){await onUpdate({...editing,...obj});}else{await onAdd(obj);}setSaving(false);setShowForm(false);msg(editing?"Customer updated":"Customer added");};
  const del=async(c)=>{if(!window.confirm("Delete customer "+c.name+"?"))return;await onDelete(c.id);msg("Deleted "+c.name);};
  const getCustStats=(cName)=>{const cWOs=(wos||[]).filter(w=>w.customer===cName);const cTime=(time||[]).filter(t=>cWOs.some(w=>w.id===t.wo_id));const cHrs=cTime.reduce((s,t)=>s+parseFloat(t.hours||0),0);const cPOs=(pos||[]).filter(p=>cWOs.some(w=>w.id===p.wo_id)&&p.status==="approved");const cSpend=cPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);const activeWOs=cWOs.filter(w=>w.status!=="completed").length;return{totalWOs:cWOs.length,activeWOs,hours:cHrs,spend:cSpend};};
  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Customers</h3>
    <button onClick={openNew} style={{...BP,marginBottom:14,fontSize:12}}>+ Add Customer</button>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {(customers||[]).length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No customers yet</div>}
      {(customers||[]).map(c=>{const st=getCustStats(c.name);return<Card key={c.id} style={{padding:"12px 16px",borderLeft:"3px solid "+B.purple}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,fontWeight:700,color:B.text}}>{c.name}</span>{c.health_score!=null&&<span style={{fontSize:10,fontWeight:800,fontFamily:M,padding:"2px 6px",borderRadius:4,background:(c.health_score>=80?B.green:c.health_score>=60?B.orange:B.red)+"18",color:c.health_score>=80?B.green:c.health_score>=60?B.orange:B.red}}>{c.health_score}</span>}</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>{[c.contact_name,c.phone,c.email].filter(Boolean).join(" · ")||"No contact info"}</div>
            {st.totalWOs>0&&<div style={{display:"flex",gap:10,marginTop:6}}><span style={{fontSize:10,fontFamily:M,color:B.cyan}}>{st.totalWOs} WOs</span>{st.activeWOs>0&&<span style={{fontSize:10,fontFamily:M,color:B.orange}}>{st.activeWOs} active</span>}<span style={{fontSize:10,fontFamily:M,color:B.green}}>{st.hours.toFixed(1)}h</span>{st.spend>0&&<span style={{fontSize:10,fontFamily:M,color:B.purple}}>{"$"+st.spend.toLocaleString()+" POs"}</span>}</div>}
          </div>
          <div style={{display:"flex",gap:6}}><button onClick={()=>openEdit(c)} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer"}}>Edit</button><button onClick={()=>del(c)} style={{background:"none",border:"none",color:B.red,fontSize:11,cursor:"pointer"}}>×</button></div>
        </div></Card>})}
    </div>
    {showForm&&<Modal title={editing?"Edit Customer":"Add Customer"} onClose={()=>setShowForm(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Company Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="ABC Grocery" style={IS}/></div>
        <div><label style={LS}>Contact Name</label><input value={contact} onChange={e=>setContact(e.target.value)} placeholder="John Smith" style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="555-123-4567" style={IS}/></div><div><label style={LS}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="john@abc.com" style={IS}/></div></div>
        <div><label style={LS}>Address</label><input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="123 Main St, City, NC" style={IS}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Invoice Customer ID <span style={{color:B.textDim,fontWeight:400}}>(e.g. DUMC)</span></label><input value={custIdCode} onChange={e=>setCustIdCode(e.target.value)} placeholder="Short code" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Vendor Number <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={vendorNum} onChange={e=>setVendorNum(e.target.value)} placeholder="e.g. 126337" style={{...IS,fontFamily:M}}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12}}>
          <div><label style={LS}>Billing Rate ($/hr)</label><input value={billingOverride} onChange={e=>setBillingOverride(e.target.value)} type="number" step="5" placeholder="default" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Parts Markup (%)</label><input value={partsMarkup} onChange={e=>setPartsMarkup(e.target.value)} type="number" step="5" placeholder="35" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Payment Terms</label><select value={payTerms} onChange={e=>setPayTerms(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="Net 15">Net 15</option><option value="Net 30">Net 30</option><option value="Net 45">Net 45</option><option value="Net 60">Net 60</option><option value="Due on Receipt">Due on Receipt</option></select></div>
        </div>
        <div onClick={()=>setAutoInvoice(!autoInvoice)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:autoInvoice?B.cyan+"15":B.bg,border:"1px solid "+(autoInvoice?B.cyan:B.border),borderRadius:8,cursor:"pointer",transition:"all .15s"}}>
          <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(autoInvoice?B.cyan:B.border),background:autoInvoice?B.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{autoInvoice&&<span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}</div>
          <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>Auto-generate invoice on job completion</div><div style={{fontSize:10,color:B.textDim,marginTop:2}}>When enabled, a draft invoice is created when all WOs for this customer are completed. Disable for TMS-entry-only customers.</div></div>
        </div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setShowForm(false)} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":(editing?"Save":"Add Customer")}</button></div>
      </div>
    </Modal>}
  </div>);
}

export { CustomerMgmt };
