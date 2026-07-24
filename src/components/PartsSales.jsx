import React, { useState, useEffect } from "react";
import { sb, B, F, M, IS, LS, BP, BS, fmtDate, haptic } from "../shared";
import { Card, Badge, StatCard, Toast } from "./ui";
import { buildInvoicePDF, buildInvoiceExcel, uploadInvoiceToDrive, SendInvoiceModal } from "./Invoices";

const r2=n=>Math.round((parseFloat(n)||0)*100)/100;
const money=n=>"$"+(parseFloat(n)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

// PS-YYMM## sequence, same scheme as invoice numbers / PO ids.
function genSaleRef(existing){
  const now=new Date();
  const pfx="PS-"+String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0");
  const mx=(existing||[]).filter(s=>s.sale_ref&&s.sale_ref.startsWith(pfx)).reduce((m,s)=>{const n=parseInt(s.sale_ref.slice(pfx.length),10);return n>m?n:m;},0);
  return pfx+String(mx+1).padStart(2,"0");
}

function PartsSales({D,A,user}){
  const customers=D.customers||[],pos=D.pos||[],invoices=D.invoices||[];
  const[sales,setSales]=useState(null);
  const[view,setView]=useState("list");
  const[expandedId,setExpandedId]=useState(null);
  const[toast,setToast]=useState("");
  // Create-form state
  const[cust,setCust]=useState("");
  const[markupPct,setMarkupPct]=useState(35);
  const[lines,setLines]=useState([]);
  const[linkedPOs,setLinkedPOs]=useState([]);
  const[custPO,setCustPO]=useState("");
  const[shipTo,setShipTo]=useState("");
  const[jobDesc,setJobDesc]=useState("Parts Supply");
  const[notes,setNotes]=useState("");
  const[saveToDrive,setSaveToDrive]=useState(true);
  const[generating,setGenerating]=useState(false);
  const[showPOPicker,setShowPOPicker]=useState(false);
  const[poSearch,setPoSearch]=useState("");
  const[showSendModal,setShowSendModal]=useState(false);
  const[lastInvoiceData,setLastInvoiceData]=useState(null);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3500);};

  const loadSales=async()=>{const{data,error}=await sb().from("parts_sales").select("*").order("created_at",{ascending:false});if(error){console.warn("parts_sales load:",error.message);setSales([]);return;}setSales(data||[]);};
  useEffect(()=>{loadSales();},[]);

  const customer=customers.find(c=>c.name===cust);
  useEffect(()=>{if(customer)setMarkupPct(customer.parts_markup!=null?parseFloat(customer.parts_markup):35);},[cust]);

  // ── Line items ──
  const addLine=()=>setLines(ls=>[...ls,{description:"",part_no:"",qty:"1",unit_cost:"",unit_price:"",priceEdited:false}]);
  const updateLine=(i,k,v)=>setLines(ls=>{const n=[...ls];const line={...n[i],[k]:v};
    if(k==="unit_price")line.priceEdited=true;
    if(k==="unit_cost"&&!line.priceEdited)line.unit_price=String(r2((parseFloat(v)||0)*(1+(parseFloat(markupPct)||0)/100)));
    n[i]=line;return n;});
  const removeLine=(i)=>{const rm=lines[i];if(rm?.po_id)setLinkedPOs(p=>p.filter(x=>x!==rm.po_id));setLines(ls=>ls.filter((_,j)=>j!==i));};
  const applyMarkup=(pct)=>{setMarkupPct(pct);setLines(ls=>ls.map(l=>l.priceEdited?l:{...l,unit_price:String(r2((parseFloat(l.unit_cost)||0)*(1+(parseFloat(pct)||0)/100)))}));};

  const validLines=lines.filter(l=>(l.description||"").trim()&&(parseFloat(l.unit_price)||0)>0);
  const costTotal=r2(lines.reduce((s,l)=>s+(parseFloat(l.qty)||1)*(parseFloat(l.unit_cost)||0),0));
  const sellTotal=r2(validLines.reduce((s,l)=>s+(parseFloat(l.qty)||1)*(parseFloat(l.unit_price)||0),0));
  const margin=r2(sellTotal-costTotal);

  // ── Vendor PO link (optional) ──
  const billedPOIds=new Set((sales||[]).flatMap(s=>s.linked_po_ids||[]));
  const availPOs=pos.filter(p=>p.status==="approved"&&!billedPOIds.has(p.id)&&!linkedPOs.includes(p.id))
    .filter(p=>{const q=poSearch.trim().toLowerCase();if(!q)return true;return(p.po_id||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q)||(p.notes||"").toLowerCase().includes(q);})
    .slice(0,30);
  const linkPO=(po)=>{
    setLinkedPOs(p=>[...p,po.id]);
    setLines(ls=>[...ls,{description:po.description||po.po_id,part_no:"",qty:"1",unit_cost:String(parseFloat(po.amount)||0),unit_price:String(r2((parseFloat(po.amount)||0)*(1+(parseFloat(markupPct)||0)/100))),priceEdited:false,po_id:po.id,po_ref:po.po_id}]);
    setShowPOPicker(false);setPoSearch("");haptic(20);
  };

  const resetForm=()=>{setCust("");setLines([]);setLinkedPOs([]);setCustPO("");setShipTo("");setJobDesc("Parts Supply");setNotes("");};

  // ── Invoice generation (reuses the standard invoice pipeline) ──
  const nextInvoiceNum=async()=>{
    const now=new Date();const pfx=String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0");
    const{data}=await sb().from("invoices").select("invoice_num");
    const mx=(data||[]).filter(i=>i.invoice_num&&i.invoice_num.startsWith(pfx)).reduce((m,i)=>{const s=parseInt(i.invoice_num.slice(4),10);return s>m?s:m;},0);
    return pfx+String(mx+1).padStart(2,"0");
  };
  const buildData=(invoiceNum)=>{
    const terms=customer?.payment_terms||"Net 30";
    const netDays=parseInt((terms.match(/\d+/)||[])[0],10)||30;
    const due=new Date();due.setDate(due.getDate()+netDays);
    const customItemsData=validLines.map(l=>{
      const q=parseFloat(l.qty)||1;
      let s=(l.description||"").trim();
      if((l.part_no||"").trim())s+=" ["+l.part_no.trim()+"]";
      // Structured qty/rate render in the invoice's QTY and RATE columns.
      return{description:s,qty:q,rate:r2(l.unit_price),amount:r2(q*(parseFloat(l.unit_price)||0))};
    });
    const customItemsTotal=r2(customItemsData.reduce((s,it)=>s+it.amount,0));
    const description=[shipTo.trim()?"Shipped to: "+shipTo.trim():null,notes.trim()||null].filter(Boolean).join("\n");
    return{invoiceNum,date:new Date().toLocaleDateString(),customerId:customer?.customer_id_code||"",customerDisplayName:customer?.name||cust,customerName:customer?.contact_name||"Accounts Payable",customerAddress:customer?.address||"",customerAddress2:"",vendorNumber:customer?.vendor_number||"",poNumber:custPO.trim(),jobDesc:jobDesc.trim()||"Parts Supply",paymentTerms:terms,dueDate:due.toLocaleDateString(),tiers:[],description,partsTotal:0,partsDetail:null,customItems:customItemsData,customItemsTotal,includeNotes:true,includeBreakdown:false,breakdownData:null,dateFrom:"",dateTo:"",customerEmail:customer?.email||"",ccEmails:customer?.invoice_settings?.email_recipients||[],subjectOverride:invoiceNum+" "+(customer?.name||cust)+" Parts Invoice",emailIntro:"Attached is the invoice for parts supplied"+(custPO.trim()?" against PO "+custPO.trim():"")+"."};
  };
  const backfillDriveUrl=async(invoiceNum,url)=>{if(!url)return;try{await sb().from("invoices").update({pdf_drive_url:url}).eq("invoice_num",invoiceNum);if(A.reloadTable)A.reloadTable("invoices");}catch(e){console.warn("backfillDriveUrl failed:",e);}};
  const saveRecords=async(d)=>{
    // The bill itself is a normal invoice row — the dashboard, reminders, and reports pick it up unchanged.
    await A.createInvoice({invoice_num:d.invoiceNum,customer:customer?.name||cust,customer_contact:d.customerName,amount:d.customItemsTotal,parts_total:0,status:"draft",wo_ids:[],tier_data:[],custom_items:d.customItems,job_desc:d.jobDesc,po_number:d.poNumber,notes:d.description||"",date_issued:new Date().toISOString().slice(0,10)});
    const itemsClean=validLines.map(l=>({description:(l.description||"").trim(),part_no:(l.part_no||"").trim()||null,qty:parseFloat(l.qty)||1,unit_cost:r2(l.unit_cost),unit_price:r2(l.unit_price),po_ref:l.po_ref||null}));
    const{error}=await sb().from("parts_sales").insert({sale_ref:genSaleRef(sales),customer:customer?.name||cust,customer_po:custPO.trim()||null,ship_to:shipTo.trim()||null,items:itemsClean,cost_total:costTotal,sell_total:sellTotal,markup_pct:parseFloat(markupPct)||0,linked_po_ids:linkedPOs,invoice_num:d.invoiceNum,notes:notes.trim()||null,created_by:user?.name||""});
    if(error){console.error("parts_sales insert:",error);msg("Invoice "+d.invoiceNum+" was created, but the parts sale record failed: "+error.message);}
    await loadSales();
  };
  const generate=async(kind)=>{
    if(generating)return;
    if(!cust){msg("Select a customer");return;}
    if(validLines.length===0){msg("Add at least one line item with a description and price");return;}
    setGenerating(true);
    try{
      const invoiceNum=await nextInvoiceNum();
      const d=buildData(invoiceNum);
      const safeName=(customer?.name||cust).replace(/[^a-zA-Z0-9]/g,"_");
      if(kind==="xlsx"){
        const buf=await buildInvoiceExcel(d);
        const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="INV_"+invoiceNum+"_"+safeName+".xlsx";a.click();URL.revokeObjectURL(url);
        await saveRecords(d);
        if(saveToDrive){const b64=btoa(String.fromCharCode(...new Uint8Array(buf)));uploadInvoiceToDrive(b64,"INV_"+invoiceNum+"_"+safeName+".xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").then(r=>{if(r){msg("Saved to Google Drive!");if(r.webViewLink)backfillDriveUrl(invoiceNum,r.webViewLink);}});}
        msg("Invoice "+invoiceNum+" created & downloaded!");resetForm();setView("list");
      }else if(kind==="pdf"){
        const doc=await buildInvoicePDF(d);
        doc.save("INV_"+invoiceNum+"_"+safeName+".pdf");
        await saveRecords(d);
        if(saveToDrive){const b64=doc.output("datauristring").split(",")[1];uploadInvoiceToDrive(b64,"INV_"+invoiceNum+"_"+safeName+".pdf","application/pdf").then(r=>{if(r){msg("Saved to Google Drive!");if(r.webViewLink)backfillDriveUrl(invoiceNum,r.webViewLink);}});}
        msg("Invoice "+invoiceNum+" created & downloaded!");resetForm();setView("list");
      }else{
        const doc=await buildInvoicePDF(d);
        const pdfB64=doc.output("datauristring").split(",")[1];
        const pdfName="INV_"+invoiceNum+"_"+safeName+".pdf";
        let driveFileId=null;
        if(saveToDrive){const r=await uploadInvoiceToDrive(pdfB64,pdfName,"application/pdf");if(r){if(r.webViewLink)backfillDriveUrl(invoiceNum,r.webViewLink);if(r.fileId)driveFileId=r.fileId;else if(r.webViewLink){const m=r.webViewLink.match(/\/d\/([^/]+)/);if(m)driveFileId=m[1];}}}
        await saveRecords(d);
        setLastInvoiceData({...d,pdfB64,pdfName,driveFileId});
        setShowSendModal(true);
        msg("Invoice "+invoiceNum+" ready to send!");
      }
    }catch(e){msg("Error: "+e.message);console.error(e);}
    setGenerating(false);
  };

  const deleteSale=async(s)=>{
    if(!window.confirm("Delete "+s.sale_ref+"? Invoice "+(s.invoice_num||"—")+" will NOT be deleted — manage it from the Invoices tab."))return;
    const{error}=await sb().from("parts_sales").delete().eq("id",s.id);
    if(error){msg("Delete failed: "+error.message);return;}
    msg(s.sale_ref+" deleted");loadSales();
  };

  // ── Render ──
  const totBilled=r2((sales||[]).reduce((s,x)=>s+(parseFloat(x.sell_total)||0),0));
  const totMargin=r2((sales||[]).reduce((s,x)=>s+((parseFloat(x.sell_total)||0)-(parseFloat(x.cost_total)||0)),0));

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>📦 Parts Sales</h3>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setView("list")} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+(view==="list"?B.cyan:B.border),background:view==="list"?B.cyanGlow:"transparent",color:view==="list"?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>Sales</button>
        <button onClick={()=>setView("create")} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+(view==="create"?B.cyan:B.border),background:view==="create"?B.cyanGlow:"transparent",color:view==="create"?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>+ New Parts Sale</button>
      </div>
    </div>

    {view==="list"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
        <StatCard label="Parts Sales" value={sales===null?"…":sales.length} color={B.cyan}/>
        <StatCard label="Total Billed" value={money(totBilled)} color={B.green}/>
        <StatCard label="Margin" value={money(totMargin)} color={B.purple}/>
      </div>
      {sales===null&&<Card style={{padding:26,textAlign:"center"}}><span style={{fontSize:12,color:B.textDim}}>Loading…</span></Card>}
      {sales!==null&&sales.length===0&&<Card style={{padding:26,textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:6}}>📦</div>
        <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:4}}>No parts sales yet</div>
        <div style={{fontSize:11,color:B.textDim}}>Bill a customer for parts only — dropship supply, no work order needed. The invoice lands in the normal Invoices tab.</div>
      </Card>}
      {sales!==null&&sales.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sales.map(s=>{
          const inv=invoices.find(i=>i.invoice_num===s.invoice_num);
          const st=inv?.status||null;
          const stColor=st==="paid"?B.green:st==="sent"?B.cyan:st==="draft"?B.purple:B.textDim;
          const m=r2((parseFloat(s.sell_total)||0)-(parseFloat(s.cost_total)||0));
          const open=expandedId===s.id;
          return(<Card key={s.id} style={{padding:"12px 16px",cursor:"pointer"}} onClick={()=>setExpandedId(open?null:s.id)}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:M,fontWeight:800,fontSize:13,color:B.cyan}}>{s.sale_ref}</span>
              <div style={{flex:1,minWidth:140}}>
                <div style={{fontSize:13,fontWeight:700,color:B.text}}>{s.customer}</div>
                <div style={{fontSize:10,color:B.textDim}}>{fmtDate((s.created_at||"").slice(0,10))} · {(s.items||[]).length} item{(s.items||[]).length!==1?"s":""}{s.invoice_num?" · INV "+s.invoice_num:""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:M,fontSize:13,fontWeight:800,color:B.text}}>{money(s.sell_total)}</div>
                <div style={{fontSize:10,color:m>=0?B.green:B.red}}>{m>=0?"+":""}{money(m)} margin</div>
              </div>
              <Badge color={stColor}>{st?st.toUpperCase():"NO INVOICE"}</Badge>
              <button onClick={e=>{e.stopPropagation();deleteSale(s);}} title="Delete this parts sale record" style={{background:"none",border:"none",color:B.red+"88",cursor:"pointer",fontSize:15,padding:4}}>🗑</button>
            </div>
            {open&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+B.border}}>
              {(s.items||[]).map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:11,color:B.textMuted,padding:"3px 0"}}>
                <span style={{flex:1}}>{it.qty!==1?it.qty+" × ":""}{it.description}{it.part_no?" ["+it.part_no+"]":""}{it.po_ref?" · PO "+it.po_ref:""}</span>
                <span style={{fontFamily:M,color:B.textDim}}>cost {money((it.qty||1)*(it.unit_cost||0))}</span>
                <span style={{fontFamily:M,fontWeight:700,color:B.text}}>{money((it.qty||1)*(it.unit_price||0))}</span>
              </div>)}
              {(s.ship_to||s.customer_po||s.notes)&&<div style={{marginTop:6,fontSize:10,color:B.textDim}}>
                {s.customer_po&&<div>Customer PO: {s.customer_po}</div>}
                {s.ship_to&&<div>Shipped to: {s.ship_to}</div>}
                {s.notes&&<div>{s.notes}</div>}
              </div>}
            </div>}
          </Card>);
        })}
      </div>}
    </>}

    {view==="create"&&<Card style={{padding:18,maxWidth:700}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:4}}>New Parts Sale</div>
      <div style={{fontSize:11,color:B.textDim,marginBottom:14}}>Bill a customer for parts only — no work order. Creates a normal draft invoice you can send right away.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Customer</label><select value={cust} onChange={e=>setCust(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="">— Select —</option>{customers.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Customer PO # <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={custPO} onChange={e=>setCustPO(e.target.value)} placeholder="e.g. 4605021670" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>Parts Markup %</label><input value={markupPct} onChange={e=>applyMarkup(e.target.value)} type="number" min="0" style={{...IS,fontFamily:M}}/></div>
        </div>
        <div><label style={LS}>Ship To <span style={{color:B.textDim,fontWeight:400}}>(dropship destination, optional — appears on invoice)</span></label><input value={shipTo} onChange={e=>setShipTo(e.target.value)} placeholder="e.g. Store #214, 100 Main St, Durham NC" style={IS}/></div>
        <div><label style={LS}>Job Description <span style={{color:B.textDim,fontWeight:400}}>(shows in the invoice JOB box)</span></label><input value={jobDesc} onChange={e=>setJobDesc(e.target.value)} style={IS}/></div>

        {/* Line items */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:12,fontWeight:700,color:B.text}}>Parts</span>
            <div style={{display:"flex",gap:10}}>
              <button onClick={addLine} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",fontFamily:F,fontWeight:600}}>+ Add Part</button>
              <button onClick={()=>setShowPOPicker(!showPOPicker)} style={{background:"none",border:"none",color:B.purple,fontSize:11,cursor:"pointer",fontFamily:F,fontWeight:600}}>📄 Add from Vendor PO</button>
            </div>
          </div>
          {showPOPicker&&<div style={{padding:10,background:B.purple+"08",border:"1px dashed "+B.purple+"55",borderRadius:6,marginBottom:8}}>
            <input value={poSearch} onChange={e=>setPoSearch(e.target.value)} placeholder="Search approved POs — number, description, vendor…" style={{...IS,fontSize:12,marginBottom:6}}/>
            <div style={{maxHeight:170,overflowY:"auto",border:"1px solid "+B.border,borderRadius:4,background:B.bg}}>
              {availPOs.length===0&&<div style={{padding:10,fontSize:11,color:B.textDim,textAlign:"center"}}>No unbilled approved POs match</div>}
              {availPOs.map(po=><div key={po.id} onClick={()=>linkPO(po)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:"1px solid "+B.border+"40",cursor:"pointer"}}>
                <span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.cyan,flexShrink:0}}>{po.po_id}</span>
                <span style={{flex:1,fontSize:11,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{po.description}{po.notes?<span style={{color:B.textDim}}> · {po.notes}</span>:null}</span>
                <span style={{fontFamily:M,fontSize:11,fontWeight:700,color:B.text,flexShrink:0}}>{money(po.amount)}</span>
              </div>)}
            </div>
            <div style={{fontSize:9.5,color:B.textDim,marginTop:5}}>Linking a PO adds its cost as a line (marked up) and ties it to this sale so it can't be billed twice.</div>
          </div>}
          {lines.length===0&&<div style={{padding:"14px",fontSize:12,color:B.textDim,textAlign:"center",border:"1px dashed "+B.border,borderRadius:6,background:B.bg}}>No parts yet — add a part or pull one in from a vendor PO</div>}
          {lines.map((l,i)=><div key={i} style={{padding:"8px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,marginBottom:6}}>
            <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
              <input value={l.description} onChange={e=>updateLine(i,"description",e.target.value)} placeholder="Part description" style={{...IS,flex:1,padding:"6px 10px",fontSize:12}}/>
              <input value={l.part_no} onChange={e=>updateLine(i,"part_no",e.target.value)} placeholder="Part #" style={{...IS,width:90,padding:"6px 8px",fontSize:11,fontFamily:M}}/>
              <button onClick={()=>removeLine(i)} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:14,flexShrink:0}}>×</button>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              {l.po_ref&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:B.purple+"20",color:B.purple,border:"1px solid "+B.purple+"30"}}>PO {l.po_ref}</span>}
              <div style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:10,color:B.textDim}}>Qty</span><input value={l.qty} onChange={e=>updateLine(i,"qty",e.target.value)} type="number" min="0" step="1" style={{...IS,width:52,padding:"5px 6px",fontSize:12,fontFamily:M}}/></div>
              <div style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:10,color:B.textDim}}>Cost $</span><input value={l.unit_cost} onChange={e=>updateLine(i,"unit_cost",e.target.value)} type="number" min="0" step="0.01" style={{...IS,width:76,padding:"5px 6px",fontSize:12,fontFamily:M}}/></div>
              <div style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:10,color:B.textDim}}>Price $</span><input value={l.unit_price} onChange={e=>updateLine(i,"unit_price",e.target.value)} type="number" min="0" step="0.01" style={{...IS,width:76,padding:"5px 6px",fontSize:12,fontFamily:M}}/></div>
              <span style={{marginLeft:"auto",fontFamily:M,fontSize:12,fontWeight:700,color:B.green}}>{money((parseFloat(l.qty)||1)*(parseFloat(l.unit_price)||0))}</span>
            </div>
          </div>)}
        </div>

        <div><label style={LS}>Notes <span style={{color:B.textDim,fontWeight:400}}>(internal + appears on invoice)</span></label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Tracking #, vendor, context…" style={{...IS,resize:"vertical",minHeight:38}}/></div>

        {/* Totals */}
        {lines.length>0&&<div style={{padding:"10px 14px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:11,color:B.textDim}}>Cost <strong style={{fontFamily:M,color:B.text}}>{money(costTotal)}</strong></span>
          <span style={{fontSize:11,color:B.textDim}}>Margin <strong style={{fontFamily:M,color:margin>=0?B.green:B.red}}>{money(margin)}</strong></span>
          <span style={{fontSize:12,fontWeight:800,color:B.text}}>Invoice Total <strong style={{fontFamily:M,color:B.cyan}}>{money(sellTotal)}</strong></span>
        </div>}

        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setSaveToDrive(!saveToDrive)}>
          <span style={{width:18,height:18,borderRadius:4,border:"2px solid "+(saveToDrive?B.cyan:B.border),background:saveToDrive?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{saveToDrive&&<span style={{color:B.bg,fontSize:11}}>✓</span>}</span>
          <span style={{fontSize:11,color:B.textMuted}}>Save a copy to Google Drive</span>
        </label>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>generate("xlsx")} disabled={generating} style={{...BS,flex:1,minWidth:130,opacity:generating?.6:1}}>{generating?"Working…":"⬇ Excel"}</button>
          <button onClick={()=>generate("pdf")} disabled={generating} style={{...BS,flex:1,minWidth:130,opacity:generating?.6:1}}>{generating?"Working…":"⬇ PDF"}</button>
          <button onClick={()=>generate("send")} disabled={generating} style={{...BP,flex:2,minWidth:170,background:"linear-gradient(135deg,#00D4F5,#7C3AED)",opacity:generating?.6:1}}>{generating?"Working…":"📧 Create & Send"}</button>
        </div>
        <div style={{fontSize:10,color:B.textDim}}>All three create the invoice as a draft in the Invoices tab — payment tracking and reminders work like any other invoice.</div>
      </div>
    </Card>}

    {showSendModal&&lastInvoiceData&&<SendInvoiceModal data={lastInvoiceData} onClose={()=>{setShowSendModal(false);resetForm();setView("list");}} msg={msg} emailTemplates={D.emailTemplates} currentUser={user}/>}
  </div>);
}

export { PartsSales };
