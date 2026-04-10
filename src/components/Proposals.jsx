import React, { useState, useEffect, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PSC, PSL, cleanText } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, CustomSelect } from "./ui";
import { jsPDF } from "jspdf";
import { fetchLogoBase64 } from "./PurchaseOrders";

// ── Email Picker for "Start from Email" ──────────────────────
function EmailPicker({onSelect,onClose}){
  const[emails,setEmails]=useState([]);const[loading,setLoading]=useState(false);const[extracting,setExtracting]=useState(null);
  const[error,setError]=useState("");const[cooldownUntil,setCooldownUntil]=useState(null);

  const fetchEmails=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const user=await sb().auth.getUser();
      const resp=await fetch(SUPABASE_URL+"/functions/v1/email-to-proposal",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},
        body:JSON.stringify({action:"list",user_id:user?.data?.user?.id||null})});
      const result=await resp.json();
      if(result.success){setEmails(result.emails||[]);}
      else if(result.error==="cooldown"){
        setCooldownUntil(new Date(result.next_refresh_at));
        setError("Refresh available "+new Date(result.next_refresh_at).toLocaleTimeString());
      }else setError(result.error||"Failed to load emails");
    }catch(e){setError("Network error");}
    setLoading(false);
  },[]);

  useEffect(()=>{fetchEmails();},[fetchEmails]);

  const extract=async(emailId)=>{
    setExtracting(emailId);
    try{
      const resp=await fetch(SUPABASE_URL+"/functions/v1/email-to-proposal",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},
        body:JSON.stringify({action:"extract",messageId:emailId})});
      const result=await resp.json();
      if(result.success)onSelect(result.extraction,result.matched_customer,result.email_subject);
      else setError("Extraction failed");
    }catch(e){setError("Network error");}
    setExtracting(null);
  };

  const canRefresh=!cooldownUntil||new Date()>=cooldownUntil;

  return(<Modal title="Select Email for Proposal" onClose={onClose} wide>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:11,color:B.textDim}}>Service-related emails from inbox</div>
      <button onClick={fetchEmails} disabled={loading||!canRefresh} style={{...BS,padding:"5px 12px",fontSize:11,opacity:(loading||!canRefresh)?.5:1}}>
        {loading?"Loading...":"Refresh"}
      </button>
    </div>
    {error&&<div style={{padding:"8px 12px",background:B.red+"15",borderRadius:6,color:B.red,fontSize:12,marginBottom:10}}>{error}</div>}
    {loading&&emails.length===0&&<div style={{textAlign:"center",padding:30}}><Spinner/></div>}
    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
      {emails.map(em=><Card key={em.id} className="card-hover" onClick={()=>!extracting&&extract(em.id)}
        style={{padding:"12px 14px",cursor:extracting?"wait":"pointer",opacity:extracting&&extracting!==em.id?.5:1,
          borderLeft:"3px solid "+B.cyan}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.subject||"(no subject)"}</div>
            <div style={{fontSize:11,color:B.textMuted,marginTop:2}}>{em.from_name} &lt;{em.from_email}&gt;</div>
            <div style={{fontSize:11,color:B.textDim,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.snippet}</div>
          </div>
          <div style={{flexShrink:0,marginLeft:8,textAlign:"right"}}>
            <div style={{fontSize:10,color:B.textDim}}>{em.date?new Date(em.date).toLocaleDateString():""}</div>
            {extracting===em.id&&<Spinner/>}
          </div>
        </div>
      </Card>)}
      {!loading&&emails.length===0&&!error&&<div style={{textAlign:"center",padding:20,color:B.textDim,fontSize:13}}>No service emails found</div>}
    </div>
  </Modal>);
}

// ── Scope Snippet Selector ───────────────────────────────────
function SnippetSelector({onAppend}){
  const[snippets,setSnippets]=useState([]);const[selected,setSelected]=useState([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const{data}=await sb().from("scope_snippets").select("*").order("category");setSnippets(data||[]);setLoading(false);})();},[]);

  const toggle=(snip)=>{
    if(selected.includes(snip.id)){setSelected(selected.filter(s=>s!==snip.id));}
    else{setSelected([...selected,snip.id]);onAppend(snip.content);}
  };

  if(loading||snippets.length===0)return null;
  const cats=[...new Set(snippets.map(s=>s.category))];

  return(<div style={{marginTop:8}}>
    <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",marginBottom:6}}>Quick-Add Scope Sections</div>
    {cats.map(cat=><div key={cat} style={{marginBottom:6}}>
      <div style={{fontSize:10,color:B.textDim,textTransform:"capitalize",marginBottom:3}}>{cat}</div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {snippets.filter(s=>s.category===cat).map(s=><button key={s.id} onClick={()=>toggle(s)}
          style={{padding:"4px 10px",borderRadius:4,fontSize:11,fontFamily:F,cursor:"pointer",
            border:"1px solid "+(selected.includes(s.id)?B.cyan:B.border),
            background:selected.includes(s.id)?B.cyanGlow:"transparent",
            color:selected.includes(s.id)?B.cyan:B.textDim}}>
          {selected.includes(s.id)?"✓ ":""}{s.name}
        </button>)}
      </div>
    </div>)}
  </div>);
}

function Logo({size,onClick}){const h=size==="large"?56:32;return(<img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C Refrigeration" style={{height:h,display:"block",cursor:onClick?"pointer":"default",transition:"opacity .2s"}} onClick={onClick}/>);}

function genProposalNum(existing){const n=new Date(),pfx="PROP-"+String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0")+"-";const mx=(existing||[]).filter(p=>p.proposal_num&&p.proposal_num.startsWith(pfx)).reduce((m,p)=>{const s=parseInt(p.proposal_num.slice(pfx.length));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}
function genEstimateNum(existing){const n=new Date(),pfx="EST-"+String(n.getFullYear()).slice(2)+String(n.getMonth()+1).padStart(2,"0")+"-";const mx=(existing||[]).filter(e=>e.estimate_num&&e.estimate_num.startsWith(pfx)).reduce((m,e)=>{const s=parseInt(e.estimate_num.slice(pfx.length));return s>m?s:m;},0);return pfx+String(mx+1).padStart(2,"0");}

function OptionPanel({tiers,setTiers,parts,setParts,label,setLabel,optDesc,setOptDesc}){
  const addTier=()=>setTiers([...tiers,{name:"",rate:0,hours:0}]);
  const updateTier=(i,k,v)=>{const t=[...tiers];t[i]={...t[i],[k]:k==="name"?v:parseFloat(v)||0};setTiers(t);};
  const removeTier=(i)=>setTiers(tiers.filter((_,j)=>j!==i));
  const addPart=()=>setParts([...parts,{description:"",quantity:1,unit_cost:0,markup_pct:35}]);
  const updatePart=(i,k,v)=>{const p=[...parts];p[i]={...p[i],[k]:k==="description"?v:parseFloat(v)||0};setParts(p);};
  const removePart=(i)=>setParts(parts.filter((_,j)=>j!==i));
  const laborTotal=tiers.reduce((s,t)=>s+t.rate*t.hours,0);
  const partsTotal=parts.reduce((s,p)=>s+p.quantity*p.unit_cost*(1+p.markup_pct/100),0);
  return(<div>
    {label!==undefined&&<div style={{marginBottom:12}}><label style={LS}>Option Label</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Option A: Repair" style={IS}/></div>}
    {optDesc!==undefined&&<div style={{marginBottom:12}}><label style={LS}>Description</label><textarea value={optDesc} onChange={e=>setOptDesc(e.target.value)} rows={2} style={{...IS,resize:"vertical"}} placeholder="Describe this option..."/></div>}
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{...LS,marginBottom:0}}>Labor Tiers</span><button onClick={addTier} style={{...BS,padding:"3px 8px",fontSize:10}}>+ Tier</button></div>
      {tiers.map((t,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:6,marginBottom:4,alignItems:"center"}}>
        <input value={t.name} onChange={e=>updateTier(i,"name",e.target.value)} placeholder="Tier name" style={{...IS,padding:7,fontSize:11}}/>
        <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:10,color:B.textDim}}>$</span><input value={t.rate||""} onChange={e=>updateTier(i,"rate",e.target.value)} type="number" placeholder="Rate" style={{...IS,padding:7,fontSize:11,fontFamily:M}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:2}}><input value={t.hours||""} onChange={e=>updateTier(i,"hours",e.target.value)} type="number" step="0.25" placeholder="Hrs" style={{...IS,padding:7,fontSize:11,fontFamily:M}}/></div>
        <button onClick={()=>removeTier(i)} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:2}}>×</button>
      </div>)}
      <div style={{textAlign:"right",fontSize:11,fontFamily:M,color:B.cyan,fontWeight:700}}>Labor: ${laborTotal.toFixed(2)}</div>
    </div>
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{...LS,marginBottom:0}}>Parts</span><button onClick={addPart} style={{...BS,padding:"3px 8px",fontSize:10}}>+ Part</button></div>
      {parts.map((p,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"2fr 0.5fr 1fr 0.6fr auto",gap:4,marginBottom:4,alignItems:"center"}}>
        <input value={p.description} onChange={e=>updatePart(i,"description",e.target.value)} placeholder="Part" style={{...IS,padding:7,fontSize:11}}/>
        <input value={p.quantity||""} onChange={e=>updatePart(i,"quantity",e.target.value)} type="number" placeholder="Qty" style={{...IS,padding:7,fontSize:11,fontFamily:M}}/>
        <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:10,color:B.textDim}}>$</span><input value={p.unit_cost||""} onChange={e=>updatePart(i,"unit_cost",e.target.value)} type="number" placeholder="Cost" style={{...IS,padding:7,fontSize:11,fontFamily:M}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:2}}><input value={p.markup_pct||""} onChange={e=>updatePart(i,"markup_pct",e.target.value)} type="number" placeholder="%" style={{...IS,padding:7,fontSize:11,fontFamily:M,width:40}}/><span style={{fontSize:9,color:B.textDim}}>%</span></div>
        <button onClick={()=>removePart(i)} style={{background:"none",border:"none",color:B.red,fontSize:12,cursor:"pointer",padding:2}}>×</button>
      </div>)}
      {parts.length>0&&<div style={{textAlign:"right",fontSize:11,fontFamily:M,color:B.orange,fontWeight:700}}>Parts: ${partsTotal.toFixed(2)}</div>}
    </div>
    <div style={{textAlign:"right",fontSize:13,fontFamily:M,fontWeight:800,color:B.green}}>Total: ${(laborTotal+partsTotal).toFixed(2)}</div>
  </div>);
}

function EstimateBuilder({customers,users,onSave,onCancel,initial}){
  const[cust,setCust]=useState(initial?.customer_name||"");
  const[estimateType,setEstimateType]=useState(initial?.estimate_type||"standard");
  const[tiers,setTiers]=useState(initial?.tier_data||[{name:"Senior Technician",rate:120,hours:0},{name:"Licensed Technician",rate:135,hours:0}]);
  const[parts,setParts]=useState(initial?.parts_data||[]);const[desc,setDesc]=useState(initial?.job_description||"");
  const[notes,setNotes]=useState(initial?.notes||"");const[validUntil,setValidUntil]=useState(initial?.valid_until||"");const[hideRates,setHideRates]=useState(initial?.hide_rates||false);
  const[terms,setTerms]=useState(initial?.payment_terms||"Net 30");const[saving,setSaving]=useState(false);
  // Multi-option state
  const[options,setOptions]=useState(initial?.options||[
    {label:"Option A: Repair",description:"",tier_data:[{name:"Senior Technician",rate:120,hours:0}],parts_data:[]},
    {label:"Option B: Replace",description:"",tier_data:[{name:"Senior Technician",rate:120,hours:0}],parts_data:[]},
  ]);
  const[activeOpt,setActiveOpt]=useState(0);

  const laborTotal=tiers.reduce((s,t)=>s+t.rate*t.hours,0);
  const partsTotal=parts.reduce((s,p)=>s+p.quantity*p.unit_cost*(1+p.markup_pct/100),0);
  const grandTotal=laborTotal+partsTotal;

  // Load customer tiers if available
  useEffect(()=>{if(cust&&!initial){const c=customers.find(x=>x.name===cust);if(c?.labor_tiers&&Array.isArray(c.labor_tiers)&&c.labor_tiers.length>0){const ct=c.labor_tiers.map(t=>({name:t.name,rate:t.rate,hours:0}));setTiers(ct);setOptions(opts=>opts.map(o=>({...o,tier_data:ct.map(t=>({...t}))})));}}
  },[cust]);

  const updateOption=(idx,key,val)=>{setOptions(opts=>{const n=[...opts];n[idx]={...n[idx],[key]:val};return n;});};
  const addOption=()=>setOptions([...options,{label:"Option "+(options.length+1),description:"",tier_data:[{name:"Senior Technician",rate:120,hours:0}],parts_data:[]}]);
  const removeOption=(idx)=>{if(options.length<=2)return;setOptions(options.filter((_,i)=>i!==idx));if(activeOpt>=options.length-1)setActiveOpt(0);};
  const calcOptTotal=(opt)=>{const l=(opt.tier_data||[]).reduce((s,t)=>s+t.rate*t.hours,0);const p=(opt.parts_data||[]).reduce((s,pp)=>s+pp.quantity*pp.unit_cost*(1+pp.markup_pct/100),0);return{labor:l,parts:p,total:l+p};};

  const save=async()=>{if(!cust||saving)return;setSaving(true);try{
    if(estimateType==="multi_option"){
      const data={customer_name:cust,customer_id:customers.find(c=>c.name===cust)?.id||null,estimate_type:"multi_option",options:options.map(o=>{const t=calcOptTotal(o);return{...o,labor_total:t.labor,parts_total:Math.round(t.parts*100)/100,grand_total:Math.round(t.total*100)/100};}),tier_data:[],parts_data:[],labor_total:0,parts_total:0,grand_total:0,job_description:desc,notes,valid_until:validUntil||null,payment_terms:terms,hide_rates:hideRates};
      await onSave(data);
    }else{
      const data={customer_name:cust,customer_id:customers.find(c=>c.name===cust)?.id||null,estimate_type:"standard",tier_data:tiers,parts_data:parts,labor_total:laborTotal,parts_total:Math.round(partsTotal*100)/100,grand_total:Math.round(grandTotal*100)/100,job_description:desc,notes,valid_until:validUntil||null,payment_terms:terms,hide_rates:hideRates};
      await onSave(data);
    }setSaving(false);}catch(e){console.error(e);setSaving(false);}};

  return(<div>
    <div style={{marginBottom:16}}>
      <label style={LS}>Customer</label>
      <CustomSelect value={cust} onChange={setCust} options={customers.map(c=>({value:c.name,label:c.name}))} placeholder="Select customer"/>
    </div>
    <div style={{marginBottom:16}}><label style={LS}>Job Description</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{...IS,resize:"vertical"}} placeholder="Describe the work..."/></div>

    {/* Estimate Type Toggle */}
    <div style={{display:"flex",gap:0,marginBottom:16,border:"1px solid "+B.border,borderRadius:8,overflow:"hidden"}}>
      <button onClick={()=>setEstimateType("standard")} style={{flex:1,padding:"10px 16px",border:"none",background:estimateType==="standard"?B.cyanGlow:"transparent",color:estimateType==="standard"?B.cyan:B.textDim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>Single Estimate</button>
      <button onClick={()=>setEstimateType("multi_option")} style={{flex:1,padding:"10px 16px",border:"none",borderLeft:"1px solid "+B.border,background:estimateType==="multi_option"?B.cyanGlow:"transparent",color:estimateType==="multi_option"?B.cyan:B.textDim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>Multi-Option (Repair/Replace/Upgrade)</button>
    </div>

    {estimateType==="standard"?<>
      <OptionPanel tiers={tiers} setTiers={setTiers} parts={parts} setParts={setParts}/>
      <Card style={{padding:16,marginBottom:16,marginTop:16,borderLeft:"3px solid "+B.green,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",marginBottom:4}}>Estimated Total</div>
        <div style={{fontSize:28,fontWeight:900,fontFamily:M,color:B.green}}>${grandTotal.toFixed(2)}</div>
        <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>Labor: ${laborTotal.toFixed(2)} + Parts: ${partsTotal.toFixed(2)}</div>
      </Card>
    </>:<>
      {/* Multi-option tabs */}
      <div style={{display:"flex",gap:0,marginBottom:12,borderBottom:"2px solid "+B.border}}>
        {options.map((o,i)=><div key={i} style={{display:"flex",alignItems:"center"}}>
          <button onClick={()=>setActiveOpt(i)} style={{padding:"8px 14px",border:"none",background:"transparent",borderBottom:activeOpt===i?"2px solid "+B.cyan:"2px solid transparent",color:activeOpt===i?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F,marginBottom:-2}}>{o.label||"Option "+(i+1)}</button>
          {options.length>2&&<button onClick={()=>removeOption(i)} style={{background:"none",border:"none",color:B.red,fontSize:10,cursor:"pointer",padding:"0 4px"}}>×</button>}
        </div>)}
        <button onClick={addOption} style={{padding:"8px 12px",border:"none",background:"transparent",color:B.cyan,fontSize:11,cursor:"pointer",fontFamily:F}}>+ Add Option</button>
      </div>
      {options[activeOpt]&&<Card style={{padding:16,marginBottom:12}}>
        <OptionPanel
          tiers={options[activeOpt].tier_data||[]} setTiers={t=>updateOption(activeOpt,"tier_data",t)}
          parts={options[activeOpt].parts_data||[]} setParts={p=>updateOption(activeOpt,"parts_data",p)}
          label={options[activeOpt].label} setLabel={v=>updateOption(activeOpt,"label",v)}
          optDesc={options[activeOpt].description} setOptDesc={v=>updateOption(activeOpt,"description",v)}
        />
      </Card>}
      {/* Summary of all options */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:16}}>
        {options.map((o,i)=>{const t=calcOptTotal(o);return<Card key={i} style={{padding:12,textAlign:"center",borderLeft:"3px solid "+(i===0?B.green:i===1?B.cyan:B.purple)}}>
          <div style={{fontSize:11,fontWeight:700,color:B.textMuted,marginBottom:4}}>{o.label||"Option "+(i+1)}</div>
          <div style={{fontSize:20,fontWeight:900,fontFamily:M,color:i===0?B.green:i===1?B.cyan:B.purple}}>${t.total.toFixed(2)}</div>
          <div style={{fontSize:10,color:B.textDim}}>L: ${t.labor.toFixed(0)} + P: ${t.parts.toFixed(0)}</div>
        </Card>;})}
      </div>
    </>}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={LS}>Valid Until</label><input value={validUntil} onChange={e=>setValidUntil(e.target.value)} type="date" style={IS}/></div>
      <div><label style={LS}>Payment Terms</label><input value={terms} onChange={e=>setTerms(e.target.value)} style={IS}/></div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",marginBottom:16,background:B.bg,borderRadius:8,border:"1px solid "+B.border}}>
      <input type="checkbox" checked={hideRates} onChange={e=>setHideRates(e.target.checked)} style={{width:16,height:16,accentColor:B.cyan}}/>
      <div><div style={{fontSize:12,fontWeight:600,color:B.text}}>Hide rates & hours on PDF</div><div style={{fontSize:10,color:B.textDim}}>Show labor as a lump sum instead of rate x hours breakdown</div></div>
    </div>
    <div style={{marginBottom:16}}><label style={LS}>Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{...IS,resize:"vertical"}} placeholder="Additional notes..."/></div>

    <div style={{display:"flex",gap:8}}>
      <button onClick={save} disabled={!cust||saving} style={{...BP,flex:1,opacity:(!cust||saving)?.6:1}}>{saving?"Saving...":"Save Estimate"}</button>
      {onCancel&&<button onClick={onCancel} style={{...BS,flex:1}}>Cancel</button>}
    </div>
  </div>);
}

function ProposalBuilder({customers,users,userName,onClose}){
  const[step,setStep]=useState(1);const[cust,setCust]=useState("");const[title,setTitle]=useState("");
  const[scope,setScope]=useState("");const[custType,setCustType]=useState("");const[location,setLocation]=useState("");
  const[generating,setGenerating]=useState(false);const[proposal,setProposal]=useState(null);const[editedContent,setEditedContent]=useState("");
  const[includeEstimate,setIncludeEstimate]=useState(false);const[estimate,setEstimate]=useState(null);
  const[expiry,setExpiry]=useState("");const[saving,setSaving]=useState(false);const[toast,setToast]=useState("");
  const[showEmailPicker,setShowEmailPicker]=useState(false);const[selectedSnippets,setSelectedSnippets]=useState([]);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};

  // Handle email extraction pre-fill
  const handleEmailSelect=(extraction,matchedCustomer,emailSubject)=>{
    if(extraction.customer_name){
      const match=customers.find(c=>c.name.toLowerCase().includes(extraction.customer_name.toLowerCase()));
      if(match)setCust(match.name);else if(matchedCustomer)setCust(matchedCustomer.name);
    }else if(matchedCustomer)setCust(matchedCustomer.name);
    if(extraction.project_title)setTitle(extraction.project_title);
    else if(emailSubject)setTitle(emailSubject);
    if(extraction.scope_description)setScope(extraction.scope_description);
    if(extraction.location)setLocation(extraction.location+(extraction.building?" — "+extraction.building:""));
    if(extraction.customer_type)setCustType(extraction.customer_type);
    setShowEmailPicker(false);
    msg("Form pre-filled from email");
  };

  const generate=async()=>{if(!cust||!scope||generating)return;setGenerating(true);
    try{
      // Collect selected snippet content for context
      const snippetTexts=selectedSnippets.length>0?selectedSnippets:undefined;
      const resp=await fetch(SUPABASE_URL+"/functions/v1/generate-proposal",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},
        body:JSON.stringify({customer_name:cust,project_title:title,scope_description:scope,customer_type:custType,location,scope_snippets:snippetTexts,estimate_summary:estimate?`Labor: $${estimate.labor_total}, Parts: $${estimate.parts_total}, Total: $${estimate.grand_total}`:null})});
      const result=await resp.json();
      if(result.success&&result.ai_sections){
        const ai=result.ai_sections;const tpl=result.template_sections;
        setProposal({...ai,...tpl});
        // Assemble: AI-generated sections + static templates
        const sections=[];
        if(ai.project_summary)sections.push("1. Project Summary\n\n"+ai.project_summary);
        if(ai.project_objectives)sections.push("2. Project Objectives\n\n"+ai.project_objectives);
        if(ai.scope_of_work)sections.push("3. Scope of Work\n\n"+ai.scope_of_work);
        if(ai.corrective_maintenance)sections.push("4. Corrective Maintenance\n\n"+ai.corrective_maintenance);
        if(tpl.pricing_and_billing)sections.push(tpl.pricing_and_billing);
        if(tpl.terms_and_conditions)sections.push(tpl.terms_and_conditions);
        if(tpl.closing_statement)sections.push(tpl.closing_statement);
        setEditedContent(sections.join("\n\n---\n\n"));
        const usage=result.usage;
        if(usage)msg(`Generated! (${usage.input_tokens}in + ${usage.output_tokens}out tokens)`);
        setStep(3);
      }else msg("Generation failed: "+(result.error||"Unknown error"));
    }catch(e){msg("Network error");}setGenerating(false);};

  const saveProposal=async()=>{if(saving)return;setSaving(true);
    try{const{data:existing}=await sb().from("proposals").select("proposal_num");const num=genProposalNum(existing||[]);
      const custObj=customers.find(c=>c.name===cust);
      let estId=null;
      if(includeEstimate&&estimate){const{data:estExisting}=await sb().from("estimates").select("estimate_num");const estNum=genEstimateNum(estExisting||[]);
        const{data:ins}=await sb().from("estimates").insert({estimate_num:estNum,customer_name:cust,customer_id:custObj?.id||null,...estimate,status:"draft",created_by:userName}).select("id").single();
        estId=ins?.id;}
      const token=crypto.randomUUID();
      await sb().from("proposals").insert({proposal_num:num,customer_name:cust,customer_id:custObj?.id||null,title:title||"Service Proposal",scope_of_work:scope,ai_generated_content:JSON.stringify(proposal),user_edits:editedContent,estimate_id:estId,status:"draft",approval_token:token,expires_at:expiry||null,created_by:userName});
      msg("Proposal "+num+" saved!");setTimeout(()=>onClose&&onClose(),1500);
    }catch(e){msg("Error saving");}setSaving(false);};

  return(<div><Toast msg={toast}/>
    {/* Step indicator */}
    <div style={{display:"flex",gap:0,marginBottom:20}}>
      {["Details","Generate","Review","Finalize"].map((l,i)=>{const s=i+1;const active=step===s;const done=step>s;return<div key={i} style={{flex:1,textAlign:"center",padding:"10px 0",background:active?B.cyanGlow:done?B.green+"15":"transparent",borderBottom:"2px solid "+(active?B.cyan:done?B.green:B.border)}}><span style={{fontSize:11,fontWeight:700,color:active?B.cyan:done?B.green:B.textDim}}>{l}</span></div>;})}
    </div>

    {/* Step 1: Details */}
    {step===1&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Start from Email button */}
      <button onClick={()=>setShowEmailPicker(true)} style={{...BS,width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderStyle:"dashed"}}>
        <span style={{fontSize:16}}>📧</span>
        <span style={{fontSize:13,fontWeight:600}}>Start from Email</span>
        <span style={{fontSize:11,color:B.textDim}}> — auto-fill from a service request</span>
      </button>
      {showEmailPicker&&<EmailPicker onSelect={handleEmailSelect} onClose={()=>setShowEmailPicker(false)}/>}

      <div><label style={LS}>Customer *</label><CustomSelect value={cust} onChange={setCust} options={customers.map(c=>({value:c.name,label:c.name}))} placeholder="Select customer"/></div>
      <div><label style={LS}>Project Title</label><input value={title} onChange={e=>setTitle(e.target.value)} style={IS} placeholder="e.g., Annual HVAC Maintenance Contract"/></div>
      <div><label style={LS}>Customer Type</label><CustomSelect value={custType} onChange={setCustType} options={[{value:"university",label:"University"},{value:"biotech",label:"Biotech/Pharma"},{value:"healthcare",label:"Healthcare"},{value:"research",label:"Research Facility"},{value:"food_service",label:"Food Service"},{value:"commercial",label:"Commercial"}]} placeholder="Select type"/></div>
      <div><label style={LS}>Location</label><input value={location} onChange={e=>setLocation(e.target.value)} style={IS} placeholder="Building/campus name"/></div>
      <div><label style={LS}>Scope Description *</label><textarea value={scope} onChange={e=>setScope(e.target.value)} rows={4} style={{...IS,resize:"vertical"}} placeholder="Describe the work in detail — what needs to be done, equipment involved, special requirements..."/></div>
      <SnippetSelector onAppend={(text)=>{setScope(prev=>prev?(prev+"\n\n"+text):text);setSelectedSnippets(prev=>[...prev,text]);}}/>
      <button onClick={()=>setIncludeEstimate(!includeEstimate)} style={{...BS,width:"100%",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,borderStyle:includeEstimate?"solid":"dashed",borderColor:includeEstimate?B.green:B.border,background:includeEstimate?B.green+"12":"transparent"}}>
        <span style={{fontSize:18}}>{includeEstimate?"✅":"💰"}</span>
        <div style={{textAlign:"left"}}><div style={{fontSize:14,fontWeight:700,color:includeEstimate?B.green:B.text}}>{includeEstimate?"Pricing Added":"Add Pricing & Estimate"}</div><div style={{fontSize:11,color:B.textDim}}>{includeEstimate?"Labor, parts, and totals attached — click to collapse":"Add labor costs, equipment pricing, and totals to this proposal"}</div></div>
      </button>
      {includeEstimate&&<Card style={{padding:16,borderLeft:"3px solid "+B.green}}><EstimateBuilder customers={customers} users={users} onSave={(data)=>{setEstimate(data);msg("Estimate saved");}} onCancel={()=>setIncludeEstimate(false)} initial={estimate}/></Card>}
      <button onClick={()=>setStep(2)} disabled={!cust||!scope} style={{...BP,width:"100%",opacity:(!cust||!scope)?.6:1}}>Continue to Generation</button>
    </div>}

    {/* Step 2: AI Generate */}
    {step===2&&<div style={{textAlign:"center",padding:20}}>
      <div style={{fontSize:48,marginBottom:16}}>🤖</div>
      <h3 style={{fontSize:16,fontWeight:800,color:B.text,marginBottom:8}}>Ready to Generate</h3>
      <p style={{fontSize:13,color:B.textMuted,marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>
        AI will draft a professional proposal for <strong>{cust}</strong> based on your scope description.
        {estimate&&" It will reference your $"+estimate.grand_total?.toFixed(2)+" estimate."}
      </p>
      <button onClick={generate} disabled={generating} style={{...BP,padding:"14px 32px",fontSize:15,opacity:generating?.6:1}}>
        {generating?"Generating... (30-60s)":"Generate Proposal"}
      </button>
      <div style={{marginTop:12}}><button onClick={()=>setStep(1)} style={{...BS,fontSize:12}}>← Back to Details</button></div>
    </div>}

    {/* Step 3: Review & Edit */}
    {step===3&&<div>
      <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:700,color:B.text}}>Review & Edit Proposal</span>
        <button onClick={generate} disabled={generating} style={{...BS,fontSize:11,padding:"5px 12px"}}>{generating?"Regenerating...":"Regenerate"}</button>
      </div>
      <textarea value={editedContent} onChange={e=>setEditedContent(e.target.value)} rows={20} style={{...IS,resize:"vertical",fontSize:13,lineHeight:1.6,fontFamily:F,minHeight:400}}/>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={()=>setStep(4)} style={{...BP,flex:1}}>Looks Good → Finalize</button>
        <button onClick={()=>setStep(1)} style={{...BS,flex:1}}>← Back</button>
      </div>
    </div>}

    {/* Step 4: Finalize */}
    {step===4&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card style={{padding:16}}>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:8}}>Proposal Summary</div>
        <div style={{fontSize:12,color:B.textMuted}}>Customer: <strong style={{color:B.text}}>{cust}</strong></div>
        <div style={{fontSize:12,color:B.textMuted}}>Title: <strong style={{color:B.text}}>{title||"Service Proposal"}</strong></div>
        {estimate&&<div style={{fontSize:12,color:B.textMuted}}>Estimate: <strong style={{color:B.green}}>${estimate.grand_total?.toFixed(2)}</strong></div>}
        <div style={{fontSize:12,color:B.textMuted,marginTop:4}}>Content: {editedContent.length} characters</div>
      </Card>
      <div><label style={LS}>Proposal Expiry Date</label><input value={expiry} onChange={e=>setExpiry(e.target.value)} type="date" style={IS}/></div>
      <button onClick={saveProposal} disabled={saving} style={{...BP,width:"100%",padding:14,fontSize:15,opacity:saving?.6:1}}>
        {saving?"Saving...":"Save Proposal as Draft"}
      </button>
      <button onClick={()=>setStep(3)} style={{...BS,width:"100%"}}>← Back to Edit</button>
    </div>}
  </div>);
}

// ── Proposal PDF Generator ──────────────────────────────────
async function generateProposalPdf(prop,est){
  const doc=new jsPDF({unit:"mm",format:"letter"});
  const pw=215.9,lm=20,rm=20,cw=pw-lm-rm;
  const cyan=[0,229,255],dark=[30,34,42],mid=[120,130,150],light=[240,243,248];
  let y=20;
  const drawLine=(y1,color)=>{doc.setDrawColor(...color);doc.setLineWidth(0.3);doc.line(lm,y1,pw-rm,y1);};
  const drawRect=(x,y1,w,h,fill)=>{doc.setFillColor(...fill);doc.rect(x,y1,w,h,"F");};
  const checkPage=(needed)=>{if(y+needed>260){doc.addPage();y=20;}};

  // Logo
  const logo=await fetchLogoBase64();
  if(logo)doc.addImage(logo,"PNG",lm,y,40,14);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
  doc.text("3C Refrigeration LLC",pw-rm,y+4,{align:"right"});
  doc.text("service@3crefrigeration.com",pw-rm,y+8,{align:"right"});
  doc.text("www.3crefrigeration.com",pw-rm,y+12,{align:"right"});
  y+=20;
  drawRect(lm,y,cw,1.5,cyan);y+=8;

  // PROPOSAL title + number
  doc.setFont("helvetica","bold");doc.setFontSize(24);doc.setTextColor(...dark);
  doc.text("PROPOSAL",lm,y);
  doc.setFont("helvetica","bold");doc.setFontSize(14);doc.setTextColor(...dark);
  doc.text(prop.proposal_num||"",pw-rm,y,{align:"right"});
  y+=10;

  // Info grid
  const col1=lm+6,col2=lm+cw/2+4;
  const labelS=()=>{doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);};
  const valueS=()=>{doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(...dark);};
  drawRect(lm,y,cw,32,light);doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(lm,y,lm,y+32);
  labelS();doc.text("PREPARED FOR",col1,y+7);valueS();doc.text(prop.customer_name||"—",col1,y+13);
  labelS();doc.text("DATE",col2,y+7);valueS();doc.text(prop.created_at?new Date(prop.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—",col2,y+13);
  labelS();doc.text("PROJECT",col1,y+22);valueS();const titleLines=doc.splitTextToSize(prop.title||"Service Proposal",cw/2-10);doc.text(titleLines,col1,y+28);
  labelS();doc.text("VALID UNTIL",col2,y+22);valueS();doc.text(prop.expires_at?new Date(prop.expires_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—",col2,y+28);
  y+=40;

  // Proposal content
  const content=prop.user_edits||prop.scope_of_work||"";
  const sections=content.split(/\n*---\n*/);
  for(const section of sections){
    const lines=section.split("\n");
    for(const line of lines){
      const trimmed=line.trim();if(!trimmed)continue;
      // Detect section headers (numbered or ALL CAPS)
      const isHeader=/^(\d+\.\s+|#{1,3}\s+)/.test(trimmed)||/^[A-Z][A-Z\s&/]{5,}$/.test(trimmed);
      if(isHeader){
        checkPage(14);y+=4;
        doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(...cyan);
        const headerText=trimmed.replace(/^#{1,3}\s+/,"");
        doc.text(headerText,lm,y);y+=6;
        drawRect(lm,y,30,0.8,cyan);y+=4;
      }else{
        doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...dark);
        const wrapped=doc.splitTextToSize(trimmed,cw);
        checkPage(wrapped.length*4.5);
        doc.text(wrapped,lm,y);y+=wrapped.length*4.5+2;
      }
    }
    y+=4;
  }

  // Estimate / Pricing section
  if(est){
    checkPage(30);y+=6;
    drawRect(lm,y,cw,9,dark);
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(255,255,255);
    doc.text("PRICING",lm+6,y+6.5);y+=9;

    const hideRates=est.hide_rates===true;
    const renderEstimate=(tierData,partsData,laborTotal,partsTotal,grandTotal,optLabel)=>{
      if(optLabel){checkPage(10);doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(...cyan);doc.text(optLabel,lm,y+5);y+=8;}
      // Filter out zero-hour tiers and zero-quantity parts
      const activeTiers=(tierData||[]).filter(t=>t.hours>0&&t.rate>0);
      const activeParts=(partsData||[]).filter(p=>p.quantity>0&&p.unit_cost>0);
      // Labor table
      if(activeTiers.length>0){
        checkPage(12);
        if(hideRates){
          // Lump sum — just show "Labor" with total
          drawRect(lm,y,cw,7,[245,247,250]);
          doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);
          doc.text("LABOR",lm+4,y+5);doc.text("AMOUNT",pw-rm-4,y+5,{align:"right"});y+=7;
          checkPage(8);
          doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...dark);
          doc.text("Labor",lm+4,y+5);
          doc.setFont("helvetica","bold");
          doc.text("$"+(laborTotal||0).toFixed(2),pw-rm-4,y+5,{align:"right"});
          drawLine(y+7,[230,235,240]);y+=8;
        }else{
          drawRect(lm,y,cw,7,[245,247,250]);
          doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);
          doc.text("LABOR",lm+4,y+5);doc.text("RATE",lm+cw*0.5,y+5);doc.text("HOURS",lm+cw*0.65,y+5);doc.text("SUBTOTAL",pw-rm-4,y+5,{align:"right"});y+=7;
          for(const t of activeTiers){
            checkPage(8);
            doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...dark);
            doc.text(t.name||"—",lm+4,y+5);
            doc.text("$"+Number(t.rate).toFixed(2),lm+cw*0.5,y+5);
            doc.text(String(t.hours||0),lm+cw*0.65,y+5);
            doc.setFont("helvetica","bold");
            doc.text("$"+(t.rate*t.hours).toFixed(2),pw-rm-4,y+5,{align:"right"});
            drawLine(y+7,[230,235,240]);y+=8;
          }
        }
        doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...mid);
        doc.text("Labor Subtotal: $"+(laborTotal||0).toFixed(2),pw-rm-4,y+5,{align:"right"});y+=8;
      }
      // Parts table
      if(activeParts.length>0){
        checkPage(12);y+=2;
        drawRect(lm,y,cw,7,[245,247,250]);
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);
        doc.text("PARTS & MATERIALS",lm+4,y+5);doc.text("QTY",lm+cw*0.55,y+5);doc.text("UNIT",lm+cw*0.68,y+5);doc.text("SUBTOTAL",pw-rm-4,y+5,{align:"right"});y+=7;
        for(const p of activeParts){
          checkPage(8);const sub=p.quantity*p.unit_cost*(1+p.markup_pct/100);
          doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...dark);
          const descLines=doc.splitTextToSize(p.description||"—",cw*0.5);
          doc.text(descLines,lm+4,y+5);
          doc.text(String(p.quantity||0),lm+cw*0.55,y+5);
          doc.text("$"+Number(p.unit_cost).toFixed(2),lm+cw*0.68,y+5);
          doc.setFont("helvetica","bold");
          doc.text("$"+sub.toFixed(2),pw-rm-4,y+5,{align:"right"});
          drawLine(y+7,[230,235,240]);y+=8;
        }
        doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...mid);
        doc.text("Parts Subtotal: $"+(partsTotal||0).toFixed(2),pw-rm-4,y+5,{align:"right"});y+=8;
      }
      // Grand total
      checkPage(16);y+=2;
      drawRect(lm,y,cw,14,cyan);
      doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(255,255,255);
      doc.text(optLabel?"OPTION TOTAL":"TOTAL",lm+6,y+9.5);
      doc.setFontSize(14);doc.text("$"+(grandTotal||0).toFixed(2),pw-rm-6,y+10,{align:"right"});
      y+=18;
    };

    if(est.estimate_type==="multi_option"&&est.options){
      for(const opt of est.options){renderEstimate(opt.tier_data,opt.parts_data,opt.labor_total,opt.parts_total,opt.grand_total,opt.label);}
    }else{renderEstimate(est.tier_data,est.parts_data,est.labor_total,est.parts_total,est.grand_total);}

    // Payment terms
    if(est.payment_terms||est.valid_until){
      checkPage(14);y+=2;
      drawRect(lm,y,cw,14,light);doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(lm,y,lm,y+14);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
      const termsText=[];
      if(est.payment_terms)termsText.push("Payment Terms: "+est.payment_terms);
      if(est.valid_until)termsText.push("Valid Until: "+new Date(est.valid_until).toLocaleDateString());
      doc.text(termsText.join("   |   "),lm+6,y+9);y+=18;
    }
  }

  // Footer
  const fy=269;
  drawLine(fy-4,[220,225,230]);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...mid);
  doc.text("3C Refrigeration LLC  |  service@3crefrigeration.com",pw/2,fy,{align:"center"});
  doc.text("Generated "+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),pw/2,fy+4,{align:"center"});

  doc.save("Proposal-"+(prop.proposal_num||"draft")+".pdf");
}

// ── Proposal Edit Modal ─────────────────────────────────────
function ProposalEditModal({prop,est:initialEst,customers,users,onSave,onClose}){
  const[title,setTitle]=useState(prop.title||"");
  const[content,setContent]=useState(prop.user_edits||prop.ai_generated_content||prop.scope_of_work||"");
  const[expiry,setExpiry]=useState(prop.expires_at?prop.expires_at.slice(0,10):"");
  const[saving,setSaving]=useState(false);
  const[showEstimate,setShowEstimate]=useState(!!initialEst);
  const[estimate,setEstimate]=useState(initialEst||null);
  const[toast,setToast]=useState("");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};

  const save=async()=>{if(saving)return;setSaving(true);
    try{
      const updates={title,user_edits:content,expires_at:expiry||null};
      // Update or create estimate
      if(showEstimate&&estimate){
        if(initialEst){
          // Update existing estimate
          await sb().from("estimates").update({...estimate,status:"draft"}).eq("id",initialEst.id);
        }else{
          // Create new estimate and link
          const{data:estExisting}=await sb().from("estimates").select("estimate_num");
          const estNum=genEstimateNum(estExisting||[]);
          const custObj=customers.find(c=>c.name===prop.customer_name);
          const{data:ins}=await sb().from("estimates").insert({estimate_num:estNum,customer_name:prop.customer_name,customer_id:custObj?.id||null,...estimate,status:"draft",created_by:prop.created_by}).select("id").single();
          if(ins?.id)updates.estimate_id=ins.id;
        }
      }
      await sb().from("proposals").update(updates).eq("id",prop.id);
      await onSave();
    }catch(e){console.error(e);msg("Error saving");}
    setSaving(false);
  };

  return(<Modal title={"Edit "+prop.proposal_num} onClose={onClose} wide>
    <Toast msg={toast}/>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={LS}>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} style={IS}/></div>
      <div><label style={LS}>Proposal Content</label><textarea value={content} onChange={e=>setContent(e.target.value)} rows={14} style={{...IS,resize:"vertical",fontSize:13,lineHeight:1.6,fontFamily:F,minHeight:250}}/></div>
      <div><label style={LS}>Expiry Date</label><input value={expiry} onChange={e=>setExpiry(e.target.value)} type="date" style={IS}/></div>
      <button onClick={()=>setShowEstimate(!showEstimate)} style={{...BS,width:"100%",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,borderStyle:showEstimate?"solid":"dashed",borderColor:showEstimate?B.green:B.border,background:showEstimate?B.green+"12":"transparent"}}>
        <span style={{fontSize:18}}>{showEstimate?"✅":"💰"}</span>
        <div style={{textAlign:"left"}}><div style={{fontSize:14,fontWeight:700,color:showEstimate?B.green:B.text}}>{showEstimate?(estimate?"Edit Pricing":"Add Pricing"):"Add Pricing & Estimate"}</div><div style={{fontSize:11,color:B.textDim}}>{showEstimate?"Click to collapse":"Add labor costs, equipment pricing, and totals"}</div></div>
      </button>
      {showEstimate&&<Card style={{padding:16,borderLeft:"3px solid "+B.green}}><EstimateBuilder customers={customers} users={users} onSave={(data)=>{setEstimate(data);msg("Estimate updated");}} onCancel={()=>setShowEstimate(false)} initial={estimate}/></Card>}
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={save} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save Changes"}</button></div>
    </div>
  </Modal>);
}

function ProposalDashboard({D,userName}){
  const[proposals,setProposals]=useState([]);const[estimates,setEstimates]=useState([]);
  const[loading,setLoading]=useState(true);const[toast,setToast]=useState("");const[view,setView]=useState("list");const[selProp,setSelProp]=useState(null);const[editing,setEditing]=useState(null);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const load=async()=>{const[{data:p},{data:e}]=await Promise.all([sb().from("proposals").select("*").order("created_at",{ascending:false}),sb().from("estimates").select("*").order("created_at",{ascending:false})]);setProposals(p||[]);setEstimates(e||[]);setLoading(false);};
  useEffect(()=>{load();},[]);

  const PSC_PROP={draft:B.purple,sent:B.cyan,approved:B.green,rejected:B.red,expired:B.textDim};
  const totalQuoted=proposals.filter(p=>p.status!=="rejected").reduce((s,p)=>{const est=estimates.find(e=>e.id===p.estimate_id);return s+(est?.grand_total||0);},0);
  const approvedCount=proposals.filter(p=>p.status==="approved").length;
  const approvalRate=proposals.length>0?Math.round((approvedCount/proposals.length)*100):0;

  const sendProposal=async(prop)=>{const cust=D.customers.find(c=>c.name===prop.customer_name);const toEmail=cust?.email||cust?.feedback_email;
    if(!toEmail){msg("No email found for "+prop.customer_name);return;}
    const portalUrl=window.location.origin+"/#/proposal/"+prop.approval_token;
    const body="<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'><p>Dear "+( cust?.contact_name||"Valued Customer")+",</p><p>Thank you for the opportunity to provide a proposal for your refrigeration/HVAC service needs. Please review our proposal at the link below:</p><p style='text-align:center;margin:24px 0'><a href='"+portalUrl+"' style='display:inline-block;padding:14px 28px;background:#00D4F5;color:#101214;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px'>View Proposal</a></p><p>This proposal"+(prop.expires_at?" is valid until "+new Date(prop.expires_at).toLocaleDateString():"")+". Please don't hesitate to reach out with any questions.</p><p>Best regards,<br/>3C Refrigeration Team</p></div>";
    try{await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({to:toEmail,subject:"Proposal from 3C Refrigeration — "+prop.title,body})});
      await sb().from("proposals").update({status:"sent",sent_to:toEmail,sent_at:new Date().toISOString()}).eq("id",prop.id);await load();msg("Proposal sent to "+toEmail);
    }catch(e){msg("Send failed");}};

  const del=async(id)=>{if(!window.confirm("Delete this proposal?"))return;await sb().from("proposals").delete().eq("id",id);await load();msg("Deleted");};

  if(view==="create")return<div><button onClick={()=>setView("list")} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",fontFamily:F,marginBottom:10}}>← Back</button><ProposalBuilder customers={D.customers} users={D.users} userName={userName} onClose={()=>{setView("list");load();}}/></div>;

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Total Proposals" value={proposals.length} icon="📋" color={B.cyan}/>
      <StatCard label="Approval Rate" value={approvalRate+"%"} icon="✓" color={approvalRate>=50?B.green:B.orange}/>
      <StatCard label="Quoted Value" value={"$"+totalQuoted.toLocaleString(undefined,{minimumFractionDigits:0})} icon="💰" color={B.green}/>
      <StatCard label="Pending" value={proposals.filter(p=>p.status==="sent").length} icon="⏳" color={B.orange}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Proposals</h3>
      <button onClick={()=>setView("create")} style={{...BP,fontSize:12}}>+ New Proposal</button>
    </div>

    {loading&&<div style={{textAlign:"center",padding:40}}><Spinner/></div>}
    {!loading&&proposals.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:24,marginBottom:6}}>📋</div><div style={{fontSize:13}}>No proposals yet. Create your first one.</div></Card>}

    {proposals.map(prop=>{const est=estimates.find(e=>e.id===prop.estimate_id);return(
      <Card key={prop.id} style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+(PSC_PROP[prop.status]||B.border)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:M,fontWeight:800,fontSize:14,color:B.text}}>{prop.proposal_num}</span>
              <Badge color={PSC_PROP[prop.status]||B.textDim}>{prop.status}</Badge>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{prop.customer_name} — {prop.title}</div>
            <div style={{fontSize:11,color:B.textDim,marginTop:2}}>
              Created {new Date(prop.created_at).toLocaleDateString()}
              {est&&<span> · Est: <strong style={{color:B.green}}>${est.grand_total?.toFixed(2)}</strong></span>}
              {prop.expires_at&&<span> · Expires {new Date(prop.expires_at).toLocaleDateString()}</span>}
              {prop.sent_to&&<span> · Sent to {prop.sent_to}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>generateProposalPdf(prop,est)} style={{...BS,padding:"5px 10px",fontSize:11}}>📄 PDF</button>
            {(prop.status==="draft"||prop.status==="sent")&&<button onClick={()=>setEditing(prop)} style={{...BS,padding:"5px 10px",fontSize:11}}>Edit</button>}
            {prop.status==="draft"&&<button onClick={()=>sendProposal(prop)} style={{...BP,padding:"5px 12px",fontSize:11}}>Send</button>}
            <button onClick={()=>{navigator.clipboard.writeText(window.location.origin+"/#/proposal/"+prop.approval_token);msg("Link copied!");}} style={{...BS,padding:"5px 10px",fontSize:11}}>🔗</button>
            <button onClick={()=>del(prop.id)} style={{...BS,padding:"5px 10px",fontSize:11,color:B.red,borderColor:B.red+"40"}}>✕</button>
          </div>
        </div>
      </Card>);})}
    {editing&&<ProposalEditModal prop={editing} est={estimates.find(e=>e.id===editing.estimate_id)||null} customers={D.customers} users={D.users} onSave={async()=>{await load();setEditing(null);msg("Proposal updated");}} onClose={()=>setEditing(null)}/>}
  </div>);
}

function ProposalPortal({token}){
  const[loading,setLoading]=useState(true);const[prop,setProp]=useState(null);const[est,setEst]=useState(null);const[error,setError]=useState(null);
  const[rejReason,setRejReason]=useState("");const[showReject,setShowReject]=useState(false);const[submitting,setSubmitting]=useState(false);const[done,setDone]=useState(null);const[selectedOpt,setSelectedOpt]=useState(null);

  useEffect(()=>{(async()=>{const{data,error:e}=await sb().from("proposals").select("*").eq("approval_token",token).single();
    if(e||!data){setError("This proposal link is invalid or has expired.");setLoading(false);return;}
    if(data.estimate_id){const{data:estData}=await sb().from("estimates").select("*").eq("id",data.estimate_id).single();setEst(estData);}
    setProp(data);setLoading(false);
  })();},[token]);

  const approve=async()=>{if(submitting)return;setSubmitting(true);try{
    await sb().from("proposals").update({status:"approved",approved_at:new Date().toISOString(),approved_by:"Customer"}).eq("id",prop.id);
    // If estimate exists, mark it approved + save selected option
    if(est){const upd={status:"approved",approved_at:new Date().toISOString()};if(selectedOpt!==null)upd.selected_option=selectedOpt;await sb().from("estimates").update(upd).eq("id",est.id);}
    const optLabel=est?.estimate_type==="multi_option"&&selectedOpt!==null?(est.options||[])[selectedOpt]?.label:"";
    sb().from("notifications").insert({type:"proposal_approved",title:"Proposal Approved",message:prop.proposal_num+" approved by "+prop.customer_name+(optLabel?" — "+optLabel:""),for_role:"admin"}).then(()=>{}).catch(e=>console.error(e));
    setDone("approved");setSubmitting(false);}catch(e){console.error(e);setSubmitting(false);}};

  const reject=async()=>{if(submitting)return;setSubmitting(true);try{
    await sb().from("proposals").update({status:"rejected",rejected_at:new Date().toISOString(),rejection_reason:rejReason}).eq("id",prop.id);
    sb().from("notifications").insert({type:"proposal_rejected",title:"Proposal Rejected",message:prop.proposal_num+" rejected by "+prop.customer_name+(rejReason?": "+rejReason.slice(0,80):""),for_role:"admin"}).then(()=>{}).catch(e=>console.error(e));
    setDone("rejected");setSubmitting(false);}catch(e){console.error(e);setSubmitting(false);}};

  if(loading)return<div style={{minHeight:"100vh",background:B.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
  if(error)return<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,color:B.text,padding:40,textAlign:"center"}}><Logo/><div style={{marginTop:20,fontSize:15,fontWeight:600}}>{error}</div></div>;
  if(done)return<div style={{minHeight:"100vh",background:B.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,color:B.text,padding:40,textAlign:"center"}}><div style={{fontSize:64,marginBottom:16}}>{done==="approved"?"✅":"📝"}</div><h2 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>{done==="approved"?"Proposal Approved!":"Response Recorded"}</h2><p style={{fontSize:14,color:B.textMuted,maxWidth:400}}>{done==="approved"?"Thank you! Our team will be in touch shortly to begin scheduling the work.":"Thank you for your feedback. Our team will follow up."}</p><div style={{marginTop:24}}><Logo/></div></div>;

  const isExpired=prop.expires_at&&new Date(prop.expires_at)<new Date();
  const alreadyActioned=prop.status==="approved"||prop.status==="rejected";

  return(<div style={{minHeight:"100vh",background:B.bg,fontFamily:F,color:B.text}}>
    <div style={{background:B.surface,padding:"14px 20px",borderBottom:"1px solid "+B.border,display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo/><div style={{fontSize:12,color:B.textDim}}>Service Proposal</div></div>
    <div style={{maxWidth:700,margin:"0 auto",padding:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px"}}>{prop.title}</h2><div style={{fontSize:13,color:B.textMuted}}>Prepared for {prop.customer_name}</div><div style={{fontSize:11,color:B.textDim}}>{prop.proposal_num} · {new Date(prop.created_at).toLocaleDateString()}</div></div>
        <Badge color={PSC[prop.status]||B.textDim}>{prop.status}</Badge>
      </div>

      {/* Proposal Content */}
      <Card style={{padding:20,marginBottom:16}}>
        <div style={{fontSize:14,color:B.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{prop.user_edits||prop.ai_generated_content||prop.scope_of_work}</div>
      </Card>

      {/* Estimate — standard or multi-option */}
      {est&&est.estimate_type==="multi_option"&&est.options&&est.options.length>0?<div style={{marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:12}}>Options</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {est.options.map((opt,i)=>{const optColors=[B.green,B.cyan,B.purple,B.orange];const c=optColors[i%optColors.length];
            return<Card key={i} onClick={()=>!alreadyActioned&&!isExpired&&setSelectedOpt(i)} style={{padding:16,borderLeft:"3px solid "+c,cursor:alreadyActioned||isExpired?"default":"pointer",border:selectedOpt===i?"2px solid "+c:"1px solid "+B.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:B.text}}>{opt.label||"Option "+(i+1)}</div>
                  {opt.description&&<div style={{fontSize:12,color:B.textMuted,marginTop:4}}>{opt.description}</div>}
                  {(opt.tier_data||[]).length>0&&<div style={{marginTop:8}}>{opt.tier_data.map((t,ti)=><div key={ti} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}><span style={{color:B.textDim}}>{t.name}</span><span style={{fontFamily:M}}>{t.hours}h × ${t.rate}/hr</span></div>)}</div>}
                  {(opt.parts_data||[]).length>0&&<div style={{marginTop:6}}>{opt.parts_data.map((p,pi)=><div key={pi} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}><span style={{color:B.textDim}}>{p.description} ×{p.quantity}</span><span style={{fontFamily:M}}>${(p.quantity*p.unit_cost*(1+p.markup_pct/100)).toFixed(2)}</span></div>)}</div>}
                </div>
                <div style={{textAlign:"right",marginLeft:16}}>
                  <div style={{fontSize:22,fontWeight:900,fontFamily:M,color:c}}>${(opt.grand_total||0).toFixed(2)}</div>
                  {selectedOpt===i&&<div style={{fontSize:10,color:c,fontWeight:700,marginTop:4}}>SELECTED</div>}
                </div>
              </div>
            </Card>;})}
        </div>
        {est.valid_until&&<div style={{fontSize:11,color:B.textDim,marginTop:8}}>Valid until {new Date(est.valid_until).toLocaleDateString()}</div>}
        {est.payment_terms&&<div style={{fontSize:11,color:B.textDim}}>Payment terms: {est.payment_terms}</div>}
      </div>:est&&<Card style={{padding:20,marginBottom:16,borderLeft:"3px solid "+B.green}}>
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:12}}>Cost Estimate</div>
        {est.tier_data&&est.tier_data.length>0&&<><div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",marginBottom:6}}>Labor</div>
          {est.tier_data.map((t,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+B.border,fontSize:12}}>
            <span style={{color:B.text}}>{t.name}</span><span style={{fontFamily:M,color:B.text}}>{t.hours}h × ${t.rate}/hr = <strong>${(t.hours*t.rate).toFixed(2)}</strong></span>
          </div>)}</>}
        {est.parts_data&&est.parts_data.length>0&&<><div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",marginTop:12,marginBottom:6}}>Parts & Materials</div>
          {est.parts_data.map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+B.border,fontSize:12}}>
            <span style={{color:B.text}}>{p.description} (×{p.quantity})</span><span style={{fontFamily:M,color:B.text}}>${(p.quantity*p.unit_cost*(1+p.markup_pct/100)).toFixed(2)}</span>
          </div>)}</>}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",marginTop:8,fontSize:16,fontWeight:800}}>
          <span style={{color:B.text}}>Total</span><span style={{fontFamily:M,color:B.green}}>${est.grand_total?.toFixed(2)}</span>
        </div>
        {est.valid_until&&<div style={{fontSize:11,color:B.textDim,marginTop:6}}>Valid until {new Date(est.valid_until).toLocaleDateString()}</div>}
        {est.payment_terms&&<div style={{fontSize:11,color:B.textDim}}>Payment terms: {est.payment_terms}</div>}
      </Card>}

      {/* Actions */}
      {!alreadyActioned&&!isExpired&&<div style={{display:"flex",gap:10,marginTop:20}}>
        <button onClick={approve} disabled={submitting||(est?.estimate_type==="multi_option"&&selectedOpt===null)} style={{...BP,flex:1,padding:16,fontSize:15,background:B.green,opacity:(submitting||(est?.estimate_type==="multi_option"&&selectedOpt===null))?.6:1}}>
          {submitting?"Processing...":(est?.estimate_type==="multi_option"&&selectedOpt!==null?"✓ Approve "+((est.options||[])[selectedOpt]?.label||"Option"):"✓ Approve Proposal")}
        </button>
        <button onClick={()=>setShowReject(!showReject)} style={{...BS,flex:1,padding:16,fontSize:15,color:B.red,borderColor:B.red+"40"}}>
          Decline
        </button>
      </div>}
      {showReject&&<Card style={{padding:16,marginTop:12}}>
        <label style={LS}>Reason for declining (optional)</label>
        <textarea value={rejReason} onChange={e=>setRejReason(e.target.value)} rows={2} style={{...IS,resize:"vertical",marginBottom:12}} placeholder="Let us know why..."/>
        <button onClick={reject} disabled={submitting} style={{...BP,width:"100%",background:B.red,opacity:submitting?.6:1}}>{submitting?"Submitting...":"Confirm Decline"}</button>
      </Card>}
      {isExpired&&<Card style={{padding:16,textAlign:"center",borderLeft:"3px solid "+B.red}}><div style={{fontSize:13,color:B.red,fontWeight:600}}>This proposal has expired. Please contact us for an updated proposal.</div></Card>}
      {alreadyActioned&&<Card style={{padding:16,textAlign:"center",borderLeft:"3px solid "+(prop.status==="approved"?B.green:B.red)}}><div style={{fontSize:13,color:prop.status==="approved"?B.green:B.red,fontWeight:600}}>This proposal has been {prop.status}.</div></Card>}
    </div>
  </div>);
}

export { genProposalNum, genEstimateNum, EstimateBuilder, ProposalBuilder, ProposalDashboard, ProposalPortal, EmailPicker, SnippetSelector, generateProposalPdf };
