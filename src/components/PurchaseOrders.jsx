import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PSC, PSL, haptic, cleanText , fnFetch , openWO, importRetry, scanDocument, scanLineSummary, scanTotal, getCompanyProfile, getAppSetting, fmtDate, todayLocal} from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, CustomSelect, Logo, PdfPreviewModal, previewPdfDoc, usePasteImage } from "./ui";
import { TicketCaptureModal } from "./VendorAudit";

let _logoB64Cache=null;

async function fetchLogoBase64(){
  if(_logoB64Cache)return _logoB64Cache;
  try{const resp=await fetch("https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png");
    const blob=await resp.blob();return new Promise((res)=>{const r=new FileReader();r.onload=()=>{_logoB64Cache=r.result;res(r.result);};r.readAsDataURL(blob);});
  }catch(e){console.warn("Logo fetch failed:",e);return null;}
}

// ── PO form vocabulary ────────────────────────────────────────
export const DELIVERY_LABELS={pickup:"Counter pickup",deliver_job:"Deliver to job site",deliver_shop:"Deliver to shop"};
export const PO_TERMS_OPTIONS=["Net 30","Account","Net 15","Due on receipt","COD","Credit card on file"];

// Standard terms printed on every PO. These are the things a vendor's AR
// desk and counter staff need to see from the buyer: how to invoice, that
// the PO is the ceiling, and what happens with backorders/substitutions.
export const PO_TERMS=[
  "This PO number must appear on all invoices, packing slips, pickup tickets and correspondence. Invoices without a PO number may be delayed.",
  "Quantities and amounts on this order are not to be exceeded without written authorization from 3C Refrigeration.",
  "Notify the requester before substituting, backordering or partially shipping any line. Substitutions require approval.",
  "Pricing is per quote, contract or current price book. Discrepancies must be resolved with 3C before invoicing.",
  "Material is subject to inspection on receipt. Incorrect, damaged or defective goods will be returned for full credit at vendor expense.",
  "Email invoices to the AP address shown below. Statements should reference open PO numbers.",
];

// Buyer block — company profile from Settings, with the letterhead values
// the invoice PDF has always carried as fallbacks so an unconfigured
// profile never prints a blank PO.
export function poCompanyInfo(){
  const cp=getCompanyProfile()||{};
  return{
    name:cp.company_name||"3C Refrigeration LLC",
    address:cp.address||"3065 Gwyn Rd., Elon, NC 27244",
    phone:cp.phone||"(336) 264-0935",
    fax:cp.fax||"(877) 278-4608",
    email:cp.email||"service@3crefrigeration.com",
    ap:cp.ap_email||"service@3crefrigeration.com",
    web:cp.website||"www.3crefrigeration.com",
    lic:cp.license_no||"NC License 4923",
    ein:cp.tax_id||"",
    resale:cp.resale_cert||"",
  };
}

// Normalize the optional itemized lines. Lines with neither a part number
// nor a description are dropped; unit_price null means "vendor to price".
export function poLineItems(po){
  const raw=Array.isArray(po?.line_items)?po.line_items:[];
  return raw.filter(l=>l&&((l.description||"").trim()||(l.part_no||"").trim())).map(l=>({
    qty:parseFloat(l.qty)||1,
    unit:(l.unit||"ea").trim(),
    part_no:(l.part_no||"").trim(),
    description:(l.description||"").trim(),
    unit_price:l.unit_price===""||l.unit_price==null||isNaN(parseFloat(l.unit_price))?null:parseFloat(l.unit_price),
  }));
}
export const lineItemsTotal=(lines)=>lines.reduce((s,l)=>s+(l.unit_price!=null?l.qty*l.unit_price:0),0);
const money=(n)=>"$"+(parseFloat(n)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
// WinAnsi-safe text for jsPDF's built-in Helvetica (same idea as WoPdf's S()).
const S=(t)=>String(t??"").replace(/[^\x00-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,"");

// Vendor-facing purchase order. Layout mirrors buildInvoicePDF (logo left,
// cyan rule, dark info strip, light boxes with a cyan left edge) so a PO and
// the invoice that follows read as one company's paperwork.
// opts: {returnDoc, vendor (vendors row), customer (customers row)}
// Two-pass fit: build at normal rhythm; if it spills past one page, rebuild
// compact (tighter gaps, smaller terms) and keep that only if it saves the page.
async function generatePOPdf(po,wo,opts){
  opts=opts||{};
  let doc=await buildPOPdf(po,wo,opts,false);
  if(doc.getNumberOfPages()>1){const c=await buildPOPdf(po,wo,opts,true);if(c.getNumberOfPages()<doc.getNumberOfPages())doc=c;}
  if(opts.returnDoc)return doc;
  doc.save("PO-"+po.po_id+".pdf");
}

async function buildPOPdf(po,wo,opts,compact){
  const{jsPDF}=await importRetry(()=>import("jspdf"));const doc=new jsPDF({unit:"mm",format:"letter",compress:true});
  const pw=215.9,ph=279.4,lm=16,rm=16,cw=pw-lm-rm;
  const G=compact?0.55:1;              // vertical gap multiplier
  const LIMIT=compact?ph-14:ph-24;     // content floor above the footer
  const LH=compact?4.0:4.4;            // line height inside the vendor / ship-to boxes
  const cyan=[0,212,245],dark=[30,34,42],mid=[110,120,138],light=[242,245,249],hair=[220,225,230],white=[255,255,255];
  const co=poCompanyInfo();
  const vendor=opts.vendor||null;
  const vendorName=po.vendor_name||vendor?.name||po.notes||"";
  const techs=(po.assigned_techs||[]).join(", ");
  // Auto-approvals are stored as "auto (under $500)" — internal wording a
  // vendor shouldn't see. Print the company as the authorizing party instead.
  const autoApproved=/^auto/i.test(po.approved_by||"");
  const approver=po.approved_by&&!autoApproved?po.approved_by:(po.status==="approved"?co.name:"Pending approval");
  let y=compact?12:16;

  const txt=(t,x,yy,o)=>doc.text(S(t),x,yy,o||{});
  const R=(x,yy,w,h,fill)=>{doc.setFillColor(...fill);doc.rect(x,yy,w,h,"F");};
  const line=(yy,color,w)=>{doc.setDrawColor(...color);doc.setLineWidth(w||0.3);doc.line(lm,yy,pw-rm,yy);};
  const label=(t,x,yy,color)=>{doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...(color||mid));txt(t.toUpperCase(),x,yy);};
  const body=(size,color,style)=>{doc.setFont("helvetica",style||"normal");doc.setFontSize(size||9);doc.setTextColor(...(color||dark));};
  const ensure=(h)=>{if(y+h>LIMIT){doc.addPage();y=16;}};

  // ── Letterhead ──
  const logo=await fetchLogoBase64();
  if(logo)doc.addImage(logo,"PNG",lm,y,40,14);
  body(10,dark,"bold");txt(co.name,pw-rm,y+4,{align:"right"});
  body(8,mid);
  const head=[co.address,"Phone "+co.phone+(co.fax?"   Fax "+co.fax:""),co.email+"   "+co.web,[co.lic,co.ein?"EIN "+co.ein:""].filter(Boolean).join("   ")].filter(Boolean);
  const hl=compact?3.4:3.8;
  head.forEach((t,i)=>txt(t,pw-rm,y+8.5+i*hl,{align:"right"}));
  y+=Math.max(compact?16:18,8.5+head.length*hl)+3*G;
  R(lm,y,cw,1.2,cyan);y+=8;

  // ── Title ──
  body(22,dark,"bold");txt("PURCHASE ORDER",lm,y);
  body(15,dark,"bold");txt("PO #"+po.po_id,pw-rm,y,{align:"right"});
  y+=5;

  // ── Info strip ──
  const dateStr=po.created_at?new Date(po.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
  const needStr=po.needed_by?fmtDate(po.needed_by,{month:"short",day:"numeric",year:"numeric"}):(po.urgency==="urgent"?"ASAP":"—");
  const cols=[["PO DATE",dateStr],["NEEDED BY",needStr],["TERMS",po.payment_terms||vendor?.payment_terms||getAppSetting("default_payment_terms","Net 30")],["DELIVERY",DELIVERY_LABELS[po.delivery_method]||"Counter pickup"],["STATUS",(po.status||"pending").toUpperCase()]];
  const colW=cw/cols.length;
  R(lm,y,cw,13,dark);
  cols.forEach(([l,v],i)=>{const x=lm+i*colW+4;label(l,x,y+4.5,cyan);body(9,white);txt(v,x,y+10);});
  y+=13+6*G;

  // ── Vendor / Ship-to boxes ──
  const boxW=cw*0.49,gap=cw*0.02,bx2=lm+boxW+gap;
  body(9);
  const vLines=[];
  if(vendorName)vLines.push({t:vendorName,b:true});else vLines.push({t:"Vendor not specified",b:true});
  if(vendor?.address)doc.splitTextToSize(S(vendor.address),boxW-10).forEach(l=>vLines.push({t:l}));
  const vContact=po.vendor_contact||vendor?.contact_name;
  if(vContact)vLines.push({t:"Attn: "+vContact});
  const vPhone=[vendor?.phone?"Phone "+vendor.phone:"",vendor?.fax?"Fax "+vendor.fax:""].filter(Boolean).join("   ");
  if(vPhone)vLines.push({t:vPhone});
  if(vendor?.email)vLines.push({t:vendor.email});
  if(vendor?.account_number)vLines.push({t:"3C account # "+vendor.account_number,m:true});

  const sLines=[];
  const method=po.delivery_method||"pickup";
  sLines.push({t:DELIVERY_LABELS[method]||"Counter pickup",b:true});
  if(method==="pickup"){
    sLines.push({t:techs?"Will be picked up by: "+techs:"Will be picked up by 3C technician"});
    sLines.push({t:"Please hold under PO #"+po.po_id+" / "+co.name});
  }else{
    const dest=po.ship_to||(method==="deliver_shop"?co.name+"\n"+co.address:(wo?.location||""));
    doc.splitTextToSize(S(dest||"Address to be confirmed"),boxW-10).forEach(l=>sLines.push({t:l}));
    if(techs)sLines.push({t:"Attn: "+techs});
  }
  sLines.push({t:"Contact "+co.phone});

  const boxH=Math.max(compact?24:32,(compact?12:13)+Math.max(vLines.length,sLines.length)*LH);
  ensure(boxH+8);
  const drawBox=(x,title,lines)=>{
    R(x,y,boxW,boxH,light);doc.setDrawColor(...cyan);doc.setLineWidth(0.8);doc.line(x,y,x,y+boxH);
    label(title,x+5,y+5.5,cyan);
    let ly=y+12;
    lines.forEach(l=>{if(l.b)body(10,dark,"bold");else if(l.m)body(8.5,mid,"bold");else body(9,mid);txt(l.t,x+5,ly);ly+=LH;});
  };
  drawBox(lm,"VENDOR",vLines);
  drawBox(bx2,"SHIP TO / PICKUP",sLines);
  y+=boxH+6*G;

  // ── Job reference ──
  const jobCols=[
    ["WORK ORDER",wo?wo.wo_id+(wo.title?" — "+wo.title:""):"Stock / shop (no work order)"],
    ["CUSTOMER / JOB",wo?.customer||opts.customer?.name||"3C Refrigeration — shop stock"],
    ["JOB SITE",wo?.location||opts.customer?.address||"—"],
    ["REQUESTED BY",po.requested_by||"—"],
    ["APPROVED BY",approver],
    ["CUSTOMER REF",wo?.customer_wo||po.project_id?(wo?.customer_wo||"Project"):"—"],
  ];
  const jw=cw/3;body(9);
  const jWrapped=jobCols.map(([l,v])=>({l,lines:doc.splitTextToSize(S(v||"—"),jw-8).slice(0,2)}));
  const rowH=(r)=>(compact?5:6)+Math.max(...r.map(c=>c.lines.length))*4.2+(compact?1:2);
  const r1=jWrapped.slice(0,3),r2=jWrapped.slice(3);const h1=rowH(r1),h2=rowH(r2);
  ensure(h1+h2+8);
  R(lm,y,cw,h1+h2,light);doc.setDrawColor(...hair);doc.setLineWidth(0.2);doc.rect(lm,y,cw,h1+h2);doc.line(lm,y+h1,pw-rm,y+h1);
  const drawRow=(r,yy)=>r.forEach((c,i)=>{const x=lm+i*jw+4;label(c.l,x,yy+4.5);body(9,dark);c.lines.forEach((ln,k)=>txt(ln,x,yy+9.5+k*4.2));});
  drawRow(r1,y);drawRow(r2,y+h1);
  y+=h1+h2+6*G;

  // ── Line items ──
  let lines=poLineItems(po);
  const amount=parseFloat(po.amount)||0;
  if(!lines.length){
    const qty=parseInt(po.quantity)||1;
    lines=[{qty,unit:"ea",part_no:"",description:po.description||"—",unit_price:amount?amount/qty:null}];
  }
  const cQty=14,cUnit=12,cPart=38,cPrice=24,cAmt=26,cDesc=cw-cQty-cUnit-cPart-cPrice-cAmt;
  const xQty=lm,xUnit=xQty+cQty,xPart=xUnit+cUnit,xDesc=xPart+cPart,xPrice=xDesc+cDesc,xAmt=xPrice+cPrice;
  const header=()=>{
    R(lm,y,cw,8,dark);body(7.5,white,"bold");
    txt("QTY",xQty+3,y+5.5);txt("UNIT",xUnit+2,y+5.5);txt("PART #",xPart+2,y+5.5);txt("DESCRIPTION",xDesc+2,y+5.5);txt("UNIT PRICE",xPrice+cPrice-2,y+5.5,{align:"right"});txt("AMOUNT",xAmt+cAmt-2,y+5.5,{align:"right"});
    y+=8;
  };
  ensure(30);header();
  let subtotal=0,unpriced=false;
  lines.forEach((l,i)=>{
    body(9,dark);
    const dLines=doc.splitTextToSize(S(l.description||"—"),cDesc-4);
    const pLines=doc.splitTextToSize(S(l.part_no||""),cPart-4);
    const h=Math.max(compact?7:8,Math.max(dLines.length,pLines.length)*4.2+(compact?2.5:3.5));
    if(y+h>LIMIT){doc.addPage();y=16;header();}
    R(lm,y,cw,h,i%2?light:white);doc.setDrawColor(...hair);doc.setLineWidth(0.2);doc.line(lm,y+h,pw-rm,y+h);
    body(9,dark);txt(String(l.qty),xQty+3,y+5.5);body(8.5,mid);txt(l.unit,xUnit+2,y+5.5);
    body(8.5,dark);pLines.forEach((t,k)=>txt(t,xPart+2,y+5.5+k*4.2));
    body(9,dark);dLines.forEach((t,k)=>txt(t,xDesc+2,y+5.5+k*4.2));
    const amt=l.unit_price!=null?l.qty*l.unit_price:null;
    if(amt!=null){subtotal+=amt;body(9,dark);txt(money(l.unit_price),xPrice+cPrice-2,y+5.5,{align:"right"});body(9,dark,"bold");txt(money(amt),xAmt+cAmt-2,y+5.5,{align:"right"});}
    else{unpriced=true;body(8,mid,"italic");txt("quote",xPrice+cPrice-2,y+5.5,{align:"right"});txt("—",xAmt+cAmt-2,y+5.5,{align:"right"});}
    y+=h;
  });
  // The PO amount is the authorized ceiling. When lines carry no prices
  // (tech requested, manager approved a number) the amount is still the total.
  const total=lines.some(l=>l.unit_price!=null)?subtotal:amount;
  y+=3;ensure(32);
  const tx=xPrice-20,tw=cw-(tx-lm);
  const taxStr=co.resale?"Exempt — resale cert "+co.resale:"As applicable";
  if(compact){
    body(8,mid);txt("Subtotal "+(unpriced&&!total?"—":money(total))+"   ·   Sales tax: "+taxStr,pw-rm-2,y+4.5,{align:"right"});
    y+=6;
  }else{
    body(8.5,mid);txt("Subtotal",tx+4,y+5);body(9,dark);txt(unpriced&&!total?"—":money(total),pw-rm-2,y+5,{align:"right"});
    y+=6;
    body(8.5,mid);txt("Sales tax",tx+4,y+5);body(8.5,co.resale?mid:dark,co.resale?"italic":"normal");
    txt(taxStr,pw-rm-2,y+5,{align:"right"});
    y+=7;
  }
  R(tx,y,tw,11,cyan);body(9,white,"bold");txt(unpriced&&!total?"AUTHORIZED AMOUNT":"TOTAL",tx+4,y+7.5);body(13,white,"bold");txt(unpriced&&!total?"Per quote":money(total),pw-rm-2,y+7.8,{align:"right"});
  y+=11;
  if(lines.some(l=>l.unit_price!=null)&&Math.abs(subtotal-amount)>0.01&&amount>0){body(7.5,mid,"italic");txt("Authorized not-to-exceed amount: "+money(amount),pw-rm-2,y+4,{align:"right"});y+=5;}
  y+=5*G;

  // ── Special instructions ──
  const instr=[po.special_instructions,po.notes&&po.notes!==vendorName?po.notes:""].filter(s=>s&&s.trim()).join("\n");
  if(instr){
    body(9,mid);const iLines=doc.splitTextToSize(S(instr),cw-12);const ih=(compact?10:12)+iLines.length*4.4;
    ensure(ih+6);
    R(lm,y,cw,ih,light);doc.setDrawColor(...cyan);doc.setLineWidth(0.8);doc.line(lm,y,lm,y+ih);
    label("SPECIAL INSTRUCTIONS",lm+5,y+5.5,cyan);body(9,dark);iLines.forEach((t,k)=>txt(t,lm+5,y+11.5+k*4.4));
    y+=ih+6*G;
  }

  // ── Terms & conditions ──
  const tf=compact?6.3:7,tl=compact?2.75:3.3;
  body(tf,mid);
  const tLines=PO_TERMS.map((t,i)=>doc.splitTextToSize(S((i+1)+". "+t),cw-4));
  ensure(14);
  label("TERMS & CONDITIONS",lm,y+3);y+=6;
  tLines.forEach(ls=>{const h=ls.length*tl+0.8;if(y+h>LIMIT){doc.addPage();y=16;}body(tf,mid);ls.forEach((t,k)=>txt(t,lm+2,y+k*tl));y+=h;});
  ensure(8);body(7.5,dark,"bold");txt("Send invoices to: "+co.ap+"   —   reference PO #"+po.po_id,lm+2,y+2);
  y+=9*G;

  // ── Authorization ──
  const sl=compact?6:9;   // signature line offset
  ensure(sl+6);
  const sigW=cw*0.46;
  doc.setDrawColor(...dark);doc.setLineWidth(0.3);
  doc.line(lm,y+sl,lm+sigW,y+sl);doc.line(pw-rm-sigW,y+sl,pw-rm,y+sl);
  body(9,dark);
  if(po.status==="approved")txt((autoApproved?co.name:po.approved_by||co.name)+(po.approved_at?"   "+new Date(po.approved_at).toLocaleDateString("en-US"):""),lm+1,y+sl-1.5);
  label("AUTHORIZED BY — "+co.name,lm,y+sl+4);
  label("VENDOR ACKNOWLEDGEMENT / DATE",pw-rm-sigW,y+sl+4);
  y+=sl+9;

  if(opts.debugY)console.log("PO layout end: y="+y.toFixed(1)+" compact="+compact+" pages="+doc.getNumberOfPages());
  // ── Footer on every page ──
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);const fy=compact?ph-8:ph-10;
    doc.setDrawColor(...hair);doc.setLineWidth(0.2);doc.line(lm,fy-4,pw-rm,fy-4);
    body(7,mid);
    txt(co.name+"  |  "+co.address+"  |  "+co.phone+"  |  "+co.ap,lm,fy);
    txt("PO #"+po.po_id+"  ·  Page "+p+" of "+pages,pw-rm,fy,{align:"right"});
  }

  return doc;
}

const vendorSuggestions=(pos)=>[...new Set((pos||[]).map(p=>(p.vendor_name||p.notes||"").trim()).filter(v=>v&&v.length<=40))].slice(0,12);

// Vendors master (Price Book table). Small list, cached per session;
// refresh() after an edit so every open PO form sees the new row.
let _vendorCache=null;
export function useVendors(){
  const[vendors,setVendors]=useState(_vendorCache||[]);
  const refresh=useCallback(async()=>{
    const{data}=await sb().from("vendors").select("*").eq("active",true).order("name");
    if(data){_vendorCache=data;setVendors(data);}
  },[]);
  useEffect(()=>{if(!_vendorCache)refresh();},[refresh]);
  return{vendors,refresh};
}
const normV=(s)=>String(s||"").toUpperCase().replace(/\b(CO|INC|LLC|LTD|CORP|COMPANY|SUPPLY|SUPPLIES)\b/g,"").replace(/[^A-Z0-9]/g,"");
export const matchVendor=(vendors,name)=>{const n=normV(name);if(!n)return null;return(vendors||[]).find(v=>normV(v.name)===n)||(vendors||[]).find(v=>normV(v.name).includes(n)||n.includes(normV(v.name)))||null;};

// A PO can be filled at more than one supply house — Grainger for one part,
// United for the next. Sum the pickup tickets captured against it, broken out
// per vendor, so the PO shows what was actually spent.
export function ticketRollup(tickets,poId){
  const mine=(tickets||[]).filter(t=>t.po_id===poId);
  if(!mine.length)return null;
  const lineTotal=(t)=>{const v=parseFloat(t.total);if(isFinite(v))return v;const s=parseFloat(t.subtotal)||0,x=parseFloat(t.tax)||0;return s+x;};
  const byVendor={};
  mine.forEach(t=>{const n=(t.vendor_name||"Unknown vendor").trim();byVendor[n]=(byVendor[n]||0)+lineTotal(t);});
  return{
    count:mine.length,
    total:mine.reduce((s,t)=>s+lineTotal(t),0),
    vendors:Object.entries(byVendor).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total),
  };
}

// Receipt / vendor-invoice scanning, shared by the PO modals. Fills what
// was bought, what it cost, and who sold it.
function useReceiptScan(setDesc,setAmt,setVendor){
  const[busy,setBusy]=useState("");
  const receiptRef=useRef(null),invoiceRef=useRef(null);
  const scan=async(file,kind)=>{
    if(!file||busy)return;
    setBusy(kind);
    try{
      const x=await scanDocument(file,kind==="receipt"?"purchase_receipt":"vendor_invoice");
      const ref=kind==="receipt"?x.receipt_number:x.invoice_number;
      const summary=scanLineSummary(x);
      if(summary||ref)setDesc([summary,ref?"(#"+ref+")":""].filter(Boolean).join(" "));
      const total=scanTotal(x);
      if(total!=null)setAmt(total.toFixed(2));
      if(x.vendor_name)setVendor(String(x.vendor_name).trim());
      if(total==null)alert("Read the "+(kind==="receipt"?"receipt":"invoice")+", but couldn't find a total — please type the amount in.");
    }catch(err){
      console.error("Scan error:",err);
      alert("Could not read the "+(kind==="receipt"?"receipt":"invoice")+".\n\n"+(err.message||err)+"\n\nYou can still fill the fields in by hand.");
    }finally{setBusy("");}
  };
  const pick=(ref,kind)=>async(e)=>{const f=e.target.files?.[0];await scan(f,kind);if(ref.current)ref.current.value="";};
  return{busy,receiptRef,invoiceRef,onReceiptFile:pick(receiptRef,"receipt"),onInvoiceFile:pick(invoiceRef,"invoice"),scan};
}

// The scan buttons + hidden file inputs, identical in both PO modals.
function ScanRow({s}){
  return(<div>
    <input ref={s.receiptRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={s.onReceiptFile}/>
    <input ref={s.invoiceRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={s.onInvoiceFile}/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={()=>s.receiptRef.current?.click()} disabled={!!s.busy} type="button" style={{...BS,flex:"1 1 140px",padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:s.busy?.6:1}}>{s.busy==="receipt"?"Scanning...":"Scan Receipt"}</button>
      <button onClick={()=>s.invoiceRef.current?.click()} disabled={!!s.busy} type="button" style={{...BS,flex:"1 1 140px",padding:"10px 14px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:s.busy?.6:1}}>{s.busy==="invoice"?"Scanning...":"Scan Vendor Invoice"}</button>
    </div>
    {s.busy?<div style={{fontSize:11,color:B.cyan,marginTop:4,textAlign:"center"}}>AI is reading the {s.busy==="receipt"?"receipt":"invoice"}...</div>
      :<div style={{fontSize:10,color:B.textDim,marginTop:4,textAlign:"center"}}>Photo, screenshot, or PDF — you can also paste a screen capture with Ctrl+V</div>}
  </div>);
}

// ── Vendor master editor ──────────────────────────────────────
// Managers fill in the address/contact/account details that print in the
// VENDOR block. Creates the row when the vendor was typed free-form.
export function VendorEditModal({vendor,name,onSaved,onClose}){
  const[v,setV]=useState({name:vendor?.name||name||"",address:vendor?.address||"",contact_name:vendor?.contact_name||"",phone:vendor?.phone||"",fax:vendor?.fax||"",email:vendor?.email||"",website:vendor?.website||"",account_number:vendor?.account_number||"",payment_terms:vendor?.payment_terms||"",notes:vendor?.notes||""});
  const[saving,setSaving]=useState(false);const[err,setErr]=useState("");
  const set=(k,val)=>setV(p=>({...p,[k]:val}));
  const save=async()=>{
    if(!v.name.trim()||saving)return;setSaving(true);setErr("");
    const row={...v,name:v.name.trim()};Object.keys(row).forEach(k=>{if(typeof row[k]==="string")row[k]=row[k].trim()||null;});row.name=v.name.trim();
    try{
      let res;
      if(vendor?.id)res=await sb().from("vendors").update(row).eq("id",vendor.id).select().single();
      else res=await sb().from("vendors").insert({...row,role:"secondary"}).select().single();
      if(res.error)throw res.error;
      _vendorCache=null;setSaving(false);onSaved(res.data);
    }catch(e){console.error(e);setSaving(false);setErr(e.message||"Could not save vendor");}
  };
  return(<Modal title={vendor?.id?"Vendor details — "+vendor.name:"Add vendor"} onClose={onClose} wide>
    <div style={{fontSize:11,color:B.textDim,marginBottom:12}}>These details print in the VENDOR block on every purchase order sent to this supplier.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
      <div style={{gridColumn:"1/-1"}}><label style={LS}>Vendor name <span style={{color:B.red}}>*</span></label><input value={v.name} onChange={e=>set("name",e.target.value)} style={IS}/></div>
      <div style={{gridColumn:"1/-1"}}><label style={LS}>Address</label><textarea value={v.address} onChange={e=>set("address",e.target.value)} rows={2} placeholder={"Street\nCity, ST ZIP"} style={{...IS,resize:"vertical",fontFamily:F}}/></div>
      <div><label style={LS}>Contact / Sales rep</label><input value={v.contact_name} onChange={e=>set("contact_name",e.target.value)} style={IS}/></div>
      <div><label style={LS}>3C account # with vendor</label><input value={v.account_number} onChange={e=>set("account_number",e.target.value)} style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Phone</label><input value={v.phone} onChange={e=>set("phone",e.target.value)} style={IS}/></div>
      <div><label style={LS}>Fax</label><input value={v.fax} onChange={e=>set("fax",e.target.value)} style={IS}/></div>
      <div><label style={LS}>Order / AR email</label><input value={v.email} onChange={e=>set("email",e.target.value)} style={IS}/></div>
      <div><label style={LS}>Website</label><input value={v.website} onChange={e=>set("website",e.target.value)} style={IS}/></div>
      <div><label style={LS}>Default terms</label><input list="po-terms-list" value={v.payment_terms} onChange={e=>set("payment_terms",e.target.value)} placeholder="Net 30" style={IS}/></div>
      <div><label style={LS}>Notes</label><input value={v.notes} onChange={e=>set("notes",e.target.value)} style={IS}/></div>
    </div>
    <datalist id="po-terms-list">{PO_TERMS_OPTIONS.map(t=><option key={t} value={t}/>)}</datalist>
    {err&&<div style={{fontSize:11,color:B.red,marginTop:8}}>{err}</div>}
    <div style={{display:"flex",gap:8,marginTop:14}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={save} disabled={saving||!v.name.trim()} style={{...BP,flex:1,opacity:saving||!v.name.trim()?.6:1}}>{saving?"Saving...":"Save vendor"}</button></div>
  </Modal>);
}

// ── Shared PO detail fields ───────────────────────────────────
// Everything beyond description + amount: vendor, needed-by, delivery,
// terms, itemized lines, instructions. Used by request, standalone and
// edit forms so the three stay in step.
export const emptyPOForm=(po)=>({
  vendor_id:po?.vendor_id||null,vendor_name:po?.vendor_name||(po?.vendor_id?"":po?.notes||""),
  needed_by:po?.needed_by||"",delivery_method:po?.delivery_method||"pickup",ship_to:po?.ship_to||"",
  payment_terms:po?.payment_terms||"",vendor_contact:po?.vendor_contact||"",special_instructions:po?.special_instructions||"",
  line_items:Array.isArray(po?.line_items)&&po.line_items.length?po.line_items.map(l=>({qty:l.qty??1,unit:l.unit||"ea",part_no:l.part_no||"",description:l.description||"",unit_price:l.unit_price==null?"":String(l.unit_price)})):[],
});
// Fields → DB columns. Blank strings become null so old rows stay clean.
export const poFormPayload=(f)=>{
  const lines=poLineItems({line_items:f.line_items});
  return{
    vendor_id:f.vendor_id||null,vendor_name:f.vendor_name.trim()||null,
    needed_by:f.needed_by||null,delivery_method:f.delivery_method||"pickup",ship_to:f.delivery_method==="pickup"?null:(f.ship_to.trim()||null),
    payment_terms:f.payment_terms.trim()||null,vendor_contact:f.vendor_contact.trim()||null,special_instructions:f.special_instructions.trim()||null,
    line_items:lines.length?lines:null,
  };
};
const blankLine=()=>({qty:1,unit:"ea",part_no:"",description:"",unit_price:""});

function PODetailFields({f,setF,wo,isMgr,desc,setDesc,amt,setAmt,defaultOpen}){
  const{vendors,refresh}=useVendors();
  const[more,setMore]=useState(!!defaultOpen);
  const[editVendor,setEditVendor]=useState(null);  // {vendor,name}
  const co=poCompanyInfo();
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const vendorRow=f.vendor_id?vendors.find(v=>v.id===f.vendor_id):null;
  const selVal=f.vendor_id?f.vendor_id:(f.vendor_name?"__other":"");
  const pickVendor=(val)=>{
    if(val==="__other"){setF(p=>({...p,vendor_id:null,vendor_name:p.vendor_id?"":p.vendor_name}));return;}
    const v=vendors.find(x=>x.id===val);
    setF(p=>({...p,vendor_id:v?v.id:null,vendor_name:v?v.name:"",payment_terms:p.payment_terms||v?.payment_terms||""}));
  };
  const pickDelivery=(m)=>setF(p=>({...p,delivery_method:m,ship_to:m==="pickup"?"":(p.ship_to||(m==="deliver_shop"?co.name+"\n"+co.address:(wo?.location||"")))}));
  // Itemized lines: when any line carries a price the amount follows the sum.
  const lines=f.line_items||[];
  const setLines=(next)=>{setF(p=>({...p,line_items:next}));const norm=poLineItems({line_items:next});if(norm.some(l=>l.unit_price!=null))setAmt(lineItemsTotal(norm).toFixed(2));};
  const setLine=(i,k,v)=>setLines(lines.map((l,j)=>j===i?{...l,[k]:v}:l));
  const itemized=lines.length>0;
  const priced=poLineItems({line_items:lines}).some(l=>l.unit_price!=null);
  const seg=(active)=>({...BS,flex:"1 1 110px",padding:"8px 10px",fontSize:12,minHeight:36,fontWeight:active?700:500,color:active?B.text:B.textMuted,borderColor:active?B.text:B.border,background:active?B.surfaceActive:"transparent"});

  return(<>
    {editVendor&&<VendorEditModal vendor={editVendor.vendor} name={editVendor.name} onClose={()=>setEditVendor(null)} onSaved={async(row)=>{setEditVendor(null);await refresh();setF(p=>({...p,vendor_id:row.id,vendor_name:row.name,payment_terms:p.payment_terms||row.payment_terms||""}));}}/>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
      <div style={{gridColumn:"1/-1"}}>
        <label style={LS}>Vendor <span style={{color:B.red}}>*</span></label>
        <select value={selVal} onChange={e=>pickVendor(e.target.value)} style={{...IS,cursor:"pointer"}}>
          <option value="">— Select vendor —</option>
          {vendors.map(v=><option key={v.id} value={v.id}>{v.name}{v.account_number?" · acct "+v.account_number:""}</option>)}
          <option value="__other">Other vendor…</option>
        </select>
        {selVal==="__other"&&<input list="po-vendor-suggest" value={f.vendor_name} onChange={e=>set("vendor_name",e.target.value)} placeholder="Vendor name (e.g. Home Depot, Bull City Sheet Metal)" style={{...IS,marginTop:6}} autoFocus/>}
        {(vendorRow||(selVal==="__other"&&f.vendor_name.trim()))&&<div style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:6,fontSize:11,color:B.textDim,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 200px",minWidth:0,whiteSpace:"pre-line"}}>{vendorRow?[vendorRow.address,vendorRow.phone?"Phone "+vendorRow.phone:"",vendorRow.account_number?"Acct #"+vendorRow.account_number:""].filter(Boolean).join("\n")||"No address or account on file — the PO will print the name only.":"Not in the vendor list yet."}</div>
          {isMgr&&<button type="button" onClick={()=>setEditVendor({vendor:vendorRow,name:f.vendor_name})} style={{...BS,padding:"6px 10px",fontSize:11,minHeight:30,color:B.cyan,borderColor:B.cyan+"55"}}>{vendorRow?"Edit vendor details":"Save as vendor"}</button>}
        </div>}
      </div>
      <div><label style={LS}>Needed by</label><input type="date" value={f.needed_by} min={todayLocal()} onChange={e=>set("needed_by",e.target.value)} style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Payment terms</label><input list="po-terms-list" value={f.payment_terms} onChange={e=>set("payment_terms",e.target.value)} placeholder={vendorRow?.payment_terms||getAppSetting("default_payment_terms","Net 30")} style={IS}/></div>
    </div>
    <datalist id="po-terms-list">{PO_TERMS_OPTIONS.map(t=><option key={t} value={t}/>)}</datalist>
    <div>
      <label style={LS}>Delivery</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.entries(DELIVERY_LABELS).map(([k,l])=><button key={k} type="button" onClick={()=>pickDelivery(k)} style={seg(f.delivery_method===k)}>{l}</button>)}
      </div>
      {f.delivery_method!=="pickup"&&<textarea value={f.ship_to} onChange={e=>set("ship_to",e.target.value)} rows={2} placeholder={f.delivery_method==="deliver_job"?"Job site address":"Shop address"} style={{...IS,marginTop:6,resize:"vertical",fontFamily:F}}/>}
    </div>

    <button type="button" onClick={()=>setMore(m=>!m)} style={{...BS,padding:"8px 12px",fontSize:12,minHeight:36,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span>{more?"Hide":"More"} details — itemized parts, vendor contact, instructions{itemized?" · "+lines.length+" line"+(lines.length!==1?"s":""):""}</span><span>{more?"▾":"▸"}</span>
    </button>
    {more&&<div style={{display:"flex",flexDirection:"column",gap:12,padding:"12px",borderRadius:8,border:"1px solid "+B.border,background:B.bg}}>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <label style={{...LS,marginBottom:0}}>Itemized parts <span style={{color:B.textDim,fontWeight:400,fontSize:10.5,textTransform:"none",letterSpacing:0}}>optional — prints as line items with part numbers</span></label>
          <button type="button" onClick={()=>setLines([...lines,blankLine()])} style={{...BS,padding:"6px 10px",fontSize:11,minHeight:30}}>+ Add line</button>
        </div>
        {lines.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8,overflowX:"auto",minWidth:0}}>
          <div className="po-line-head" style={{display:"grid",gridTemplateColumns:"56px 52px 110px minmax(120px,1fr) 90px 30px",gap:6,minWidth:440,fontSize:10,color:B.textDim,fontWeight:600,letterSpacing:.3,textTransform:"uppercase"}}><span>Qty</span><span>Unit</span><span>Part #</span><span>Description</span><span>Unit $</span><span/></div>
          {lines.map((l,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"56px 52px 110px minmax(120px,1fr) 90px 30px",gap:6,alignItems:"center",minWidth:440}}>
            <input value={l.qty} onChange={e=>setLine(i,"qty",e.target.value)} type="number" min="0" step="1" style={{...IS,fontFamily:M,padding:"8px 6px",minWidth:0}}/>
            <input value={l.unit} onChange={e=>setLine(i,"unit",e.target.value)} placeholder="ea" style={{...IS,padding:"8px 6px",minWidth:0}}/>
            <input value={l.part_no} onChange={e=>setLine(i,"part_no",e.target.value)} placeholder="Part #" style={{...IS,fontFamily:M,padding:"8px 6px",minWidth:0}}/>
            <input value={l.description} onChange={e=>setLine(i,"description",e.target.value)} placeholder="Description" style={{...IS,padding:"8px 6px",minWidth:0}}/>
            <input value={l.unit_price} onChange={e=>setLine(i,"unit_price",e.target.value)} type="number" min="0" step="0.01" placeholder="quote" style={{...IS,fontFamily:M,padding:"8px 6px",minWidth:0}}/>
            <button type="button" onClick={()=>setLines(lines.filter((_,j)=>j!==i))} title="Remove line" style={{background:"none",border:"1px solid "+B.border,borderRadius:6,color:B.red,cursor:"pointer",minHeight:36,minWidth:30,padding:0}}>×</button>
          </div>)}
          <div style={{fontSize:10.5,color:B.textDim}}>{priced?"Amount is set from the priced lines ("+money(lineItemsTotal(poLineItems({line_items:lines})))+"). Leave Unit $ blank on lines the vendor should quote.":"No prices yet — the Amount field above stays the authorized not-to-exceed total."}</div>
        </div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        <div><label style={LS}>Vendor contact / rep for this order</label><input value={f.vendor_contact} onChange={e=>set("vendor_contact",e.target.value)} placeholder={vendorRow?.contact_name||"Counter, sales rep name…"} style={IS}/></div>
        <div><label style={LS}>Special instructions</label><input value={f.special_instructions} onChange={e=>set("special_instructions",e.target.value)} placeholder="e.g. Call when ready, match existing unit, no substitutions" style={IS}/></div>
      </div>
    </div>}
  </>);
}

// ── Email PO to vendor ────────────────────────────────────────
// Renders the PO PDF, attaches it, and sends through send-email (Gmail).
// Marks sent_to_vendor on success so the card shows when it went out.
function EmailPOModal({po,wo,vendor,onSent,onClose}){
  const co=poCompanyInfo();
  const vendorName=po.vendor_name||vendor?.name||po.notes||"Vendor";
  const needStr=po.needed_by?fmtDate(po.needed_by,{month:"long",day:"numeric",year:"numeric"}):"";
  const lines=poLineItems(po);
  const[to,setTo]=useState(vendor?.email||"");
  const[cc,setCc]=useState(co.ap||"");
  const[subject,setSubject]=useState("Purchase Order #"+po.po_id+" — "+co.name+(wo?.customer?" — "+wo.customer:""));
  const NL=String.fromCharCode(10);
  const[body,setBody]=useState(
    "Hello"+(po.vendor_contact||vendor?.contact_name?" "+(po.vendor_contact||vendor.contact_name):"")+","+NL+NL+
    "Please find attached purchase order #"+po.po_id+" from "+co.name+(vendor?.account_number?" (account #"+vendor.account_number+")":"")+"."+NL+NL+
    (lines.length?lines.map(l=>"  - "+l.qty+" "+l.unit+"  "+(l.part_no?l.part_no+"  ":"")+l.description).join(NL)+NL+NL:"  - "+(po.description||"")+NL+NL)+
    (DELIVERY_LABELS[po.delivery_method]||"Counter pickup")+(needStr?" — needed by "+needStr:"")+"."+NL+
    (po.delivery_method&&po.delivery_method!=="pickup"&&po.ship_to?"Ship to: "+po.ship_to.split(NL).join(", ")+NL:"")+
    (po.special_instructions?NL+po.special_instructions+NL:"")+
    NL+"Please reference PO #"+po.po_id+" on the invoice and packing slip, and email invoices to "+co.ap+". Reply to this email with any questions or substitutions before filling."+NL+NL+
    "Thank you,"+NL+(po.approved_by&&!/^auto/.test(po.approved_by)?po.approved_by:po.requested_by||co.name)+NL+co.name+NL+co.phone);
  const[sending,setSending]=useState(false);const[err,setErr]=useState("");
  const emailOk=(v)=>v.split(/[,;\s]+/).filter(Boolean).every(e=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  const send=async()=>{
    if(sending)return;
    if(!to.trim()||!emailOk(to)){setErr("Enter a valid vendor email address.");return;}
    if(cc.trim()&&!emailOk(cc)){setErr("Check the CC address.");return;}
    if(po.status!=="approved"&&!window.confirm("This PO is "+(PSL[po.status]||po.status)+", not approved. Send it to the vendor anyway?"))return;
    setSending(true);setErr("");
    try{
      const doc=await generatePOPdf(po,wo,{returnDoc:true,vendor});
      const b64=doc.output("datauristring").split(",")[1];
      const esc=(t)=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const html='<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;font-size:14px;line-height:1.5;white-space:pre-wrap">'+esc(body)+'</div>';
      const resp=await fnFetch("send-email",{to:to.trim(),cc:cc.trim()||undefined,subject:subject.trim(),body:html,attachment:{name:"PO-"+po.po_id+".pdf",content:b64,type:"application/pdf"}});
      const res=await resp.json();
      if(!res.success)throw new Error(res.error||"send failed");
      const stamp=new Date().toISOString();
      await sb().from("purchase_orders").update({sent_to_vendor:true,sent_to_vendor_at:stamp}).eq("id",po.id);
      if(vendor&&!vendor.email&&emailOk(to)&&!to.includes(",")){await sb().from("vendors").update({email:to.trim()}).eq("id",vendor.id);_vendorCache=null;}
      setSending(false);onSent(to.trim(),stamp);
    }catch(e){console.error(e);setSending(false);setErr(e.message||"Could not send");}
  };
  return(<Modal title={"Email PO "+po.po_id+" to "+vendorName} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {po.sent_to_vendor_at&&<div style={{fontSize:11,color:B.orange,background:B.orange+"12",border:"1px solid "+B.orange+"44",borderRadius:6,padding:"8px 12px"}}>Already sent {new Date(po.sent_to_vendor_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}. Sending again will issue a duplicate copy.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        <div><label style={LS}>To <span style={{color:B.red}}>*</span></label><input value={to} onChange={e=>setTo(e.target.value)} placeholder="orders@vendor.com" style={IS} autoFocus={!to}/>{vendor&&!vendor.email&&<div style={{fontSize:10,color:B.textDim,marginTop:3}}>No email on file for {vendor.name} — this address will be saved to the vendor.</div>}</div>
        <div><label style={LS}>CC</label><input value={cc} onChange={e=>setCc(e.target.value)} style={IS}/></div>
      </div>
      <div><label style={LS}>Subject</label><input value={subject} onChange={e=>setSubject(e.target.value)} style={IS}/></div>
      <div><label style={LS}>Message</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} style={{...IS,resize:"vertical",fontFamily:F,lineHeight:1.45}}/></div>
      <div style={{fontSize:11,color:B.textDim}}>Attaches <span style={{fontFamily:M,color:B.text}}>PO-{po.po_id}.pdf</span> · sent from service@3crefrigeration.com</div>
      {err&&<div style={{fontSize:11,color:B.red}}>{err}</div>}
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={send} disabled={sending} style={{...BP,flex:1,opacity:sending?.6:1}}>{sending?"Sending...":"Send PO"}</button></div>
    </div>
  </Modal>);
}

function POReqModal({wo,pos,onCreatePO,onClose,userName,userRole,userId,initial}){
  const isMgr=userRole==="admin"||userRole==="manager";
  const[desc,setDesc]=useState(initial?.description||""),[amt,setAmt]=useState(initial?.amount?String(initial.amount):""),[saving,setSaving]=useState(false);
  const[f,setF]=useState(()=>emptyPOForm(initial));
  const[ticketFor,setTicketFor]=useState(null);
  const{vendors}=useVendors();
  const setVendorFromScan=(name)=>{const v=matchVendor(vendors,name);setF(p=>({...p,vendor_id:v?v.id:null,vendor_name:v?v.name:name}));};
  const scan=useReceiptScan(setDesc,setAmt,setVendorFromScan);
  usePasteImage(true,(f)=>scan.scan(f,"receipt"));
  const existing=pos.filter(p=>p.wo_id===wo.id);
  const go=async()=>{if(!desc.trim()||saving)return;if(!f.vendor_name.trim()){alert("Pick a vendor (or choose Other and type one) so the PO can be sent to them.");return;}if(cleanText(desc,"PO Description")===null||cleanText(f.special_instructions,"PO Instructions")===null)return;setSaving(true);try{await onCreatePO({wo_id:wo.id,description:desc.trim(),amount:parseFloat(amt)||0,notes:"",...poFormPayload(f)});setSaving(false);onClose();}catch(e){console.error(e);setSaving(false);}};
  return(<Modal title="Purchase Order" onClose={onClose} wide>
    {existing.length>0&&<div style={{marginBottom:18}}><span style={LS}>Existing POs on {wo.wo_id}</span><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{existing.map(po=>{const canSee=isMgr||po.requested_by===userName;return<div key={po.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+B.border,gap:6}}><div style={{flex:1,minWidth:0}}><span style={{fontFamily:M,fontWeight:700,color:B.cyan,fontSize:13}}>{po.po_id}</span><span style={{color:B.textDim,fontSize:11,marginLeft:8}}>{po.description}{canSee?" · $"+po.amount:""}</span></div><button data-tip="Snap the counter ticket at pickup. Supply Audit uses it to catch vendor billing errors later." onClick={()=>setTicketFor(po)} title="Snap the supply house pickup ticket for this PO" style={{...BS,padding:"4px 8px",fontSize:11,minHeight:28,flexShrink:0}}>Ticket</button><Badge color={PSC[po.status]}>{PSL[po.status]}</Badge></div>})}</div><div style={{borderTop:"1px solid "+B.border,margin:"16px 0",paddingTop:16}}><span style={{fontSize:12,color:B.textMuted,fontWeight:600}}>— or create new PO —</span></div></div>}
    {ticketFor&&<TicketCaptureModal po={ticketFor} userName={userName} userId={userId} onClose={()=>setTicketFor(null)} onSaved={(warn)=>{if(warn)alert("Ticket saved"+warn);}}/>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <ScanRow s={scan}/>
      <div><label style={LS}>Parts/Materials <span style={{color:B.red}}>*</span></label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Compressor refrigerant R-404A" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Estimated Amount ($) <span style={{color:B.textDim,fontWeight:400,fontSize:10.5}}>optional</span></label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted}}>{wo.wo_id}</div></div></div>
      <PODetailFields f={f} setF={setF} wo={wo} isMgr={isMgr} desc={desc} setDesc={setDesc} amt={amt} setAmt={setAmt}/>
      <datalist id="po-vendor-suggest">{vendorSuggestions(pos).map(v=><option key={v} value={v}/>)}</datalist>
      {!isMgr&&<div style={{fontSize:10,color:B.textDim,background:B.bg,padding:"8px 12px",borderRadius:6,border:"1px solid "+B.border}}>Don't know the exact price? Leave the amount blank — your manager will fill it in before approving.</div>}
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Request PO"}</button></div>
    </div></Modal>);
}

function POEditForm({po,wo,onSave,onClose}){
  const[desc,setDesc]=useState(po.description),[amt,setAmt]=useState(String(po.amount)),[notes,setNotes]=useState(po.notes||""),[status,setStatus]=useState(po.status),[saving,setSaving]=useState(false);
  const[f,setF]=useState(()=>emptyPOForm(po));
  const[surplusPool,setSurplusPool]=useState(!!po.surplus_pool),[surplusNotes,setSurplusNotes]=useState(po.surplus_notes||"");
  const go=async()=>{if(saving)return;setSaving(true);try{await onSave({...po,description:desc.trim(),amount:parseFloat(amt)||0,notes:notes.trim(),status,surplus_pool:surplusPool,surplus_notes:surplusPool?surplusNotes.trim()||null:null,...poFormPayload(f)});setSaving(false);}catch(e){console.error(e);setSaving(false);}};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div><label style={LS}>Description</label><input value={desc} onChange={e=>setDesc(e.target.value)} style={IS}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div><label style={LS}>Amount ($)</label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" style={{...IS,fontFamily:M}}/></div>
      <div><label style={LS}>Status</label><select value={status} onChange={e=>setStatus(e.target.value)} style={{...IS,cursor:"pointer"}}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revised">Revised</option></select></div>
    </div>
    <PODetailFields f={f} setF={setF} wo={wo} isMgr desc={desc} setDesc={setDesc} amt={amt} setAmt={setAmt} defaultOpen={!!(po.line_items&&po.line_items.length)}/>
    <div><label style={LS}>Internal notes <span style={{color:B.textDim,fontWeight:400,fontSize:10.5}}>not printed on the PO</span></label><input value={notes} onChange={e=>setNotes(e.target.value)} style={IS}/></div>
    <div style={{padding:"10px 12px",borderRadius:6,border:"1px dashed "+B.orange+"66",background:B.orange+"08"}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
        <input type="checkbox" checked={surplusPool} onChange={e=>setSurplusPool(e.target.checked)}/>
        <span style={{fontSize:12,fontWeight:700,color:B.orange}}>Surplus — material was purchased but not used</span>
      </label>
      <div style={{fontSize:10,color:B.textDim,marginTop:4,marginLeft:24}}>Mark this PO as available to bill on a future job. It will show up in the Surplus Parts picker when creating a new invoice.</div>
      {surplusPool&&<div style={{marginTop:8}}><label style={LS}>Surplus Notes <span style={{color:B.textDim,fontWeight:400,fontSize:10.5}}>(optional — where stored, qty remaining, etc.)</span></label><input value={surplusNotes} onChange={e=>setSurplusNotes(e.target.value)} placeholder="e.g. 5 contactors left, stored on Truck 3" style={IS}/></div>}
    </div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Save"}</button></div>
  </div>);
}

function StandalonePOModal({onCreatePO,onClose,pos}){
  const[desc,setDesc]=useState(""),[amt,setAmt]=useState(""),[saving,setSaving]=useState(false);
  const[f,setF]=useState(()=>emptyPOForm(null));
  const{vendors}=useVendors();
  const setVendorFromScan=(name)=>{const v=matchVendor(vendors,name);setF(p=>({...p,vendor_id:v?v.id:null,vendor_name:v?v.name:name}));};
  const scan=useReceiptScan(setDesc,setAmt,setVendorFromScan);
  usePasteImage(true,(f)=>scan.scan(f,"receipt"));
  const go=async()=>{if(!desc.trim()||saving)return;if(!f.vendor_name.trim()){alert("Pick a vendor (or choose Other and type one) so the PO can be sent to them.");return;}if(cleanText(desc,"PO Description")===null||cleanText(f.special_instructions,"PO Instructions")===null)return;setSaving(true);try{await onCreatePO({description:desc.trim(),amount:parseFloat(amt)||0,notes:"",...poFormPayload(f)});setSaving(false);onClose();}catch(e){console.error(e);setSaving(false);}};
  return(<Modal title="Create Standalone PO" onClose={onClose} wide>
    <div style={{fontSize:11,color:B.textDim,background:B.bg,padding:"8px 12px",borderRadius:6,border:"1px solid "+B.border,marginBottom:14}}>This PO will not be linked to a work order. Use for shop stock, tools, office supplies, etc.</div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <ScanRow s={scan}/>
      <div><label style={LS}>Parts/Materials <span style={{color:B.red}}>*</span></label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Shop refrigerant stock, tools, office supplies" style={IS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={LS}>Amount ($) <span style={{color:B.textDim,fontWeight:400,fontSize:10.5}}>optional</span></label><input value={amt} onChange={e=>setAmt(e.target.value)} type="number" step="0.01" placeholder="0.00" style={{...IS,fontFamily:M}}/></div><div><label style={LS}>Work Order</label><div style={{...IS,background:B.surfaceActive,color:B.textMuted,fontStyle:"italic"}}>None (standalone)</div></div></div>
      <PODetailFields f={f} setF={setF} wo={null} isMgr desc={desc} setDesc={setDesc} amt={amt} setAmt={setAmt}/>
      <datalist id="po-vendor-suggest">{vendorSuggestions(pos).map(v=><option key={v} value={v}/>)}</datalist>
      <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...BS,flex:1}}>Cancel</button><button onClick={go} disabled={saving} style={{...BP,flex:1,opacity:saving?.6:1}}>{saving?"Saving...":"Create PO"}</button></div>
    </div></Modal>);
}

function POMgmt({pos,onUpdatePO,onDeletePO,wos,onCreatePO,tickets,userName,userId,users,reloadTable}){
  const PAGE_SIZE=50;
  const[filter,setFilter]=useState("all"),[editing,setEditing]=useState(null),[toast,setToast]=useState(""),[search,setSearch]=useState(""),[confirmDelete,setConfirmDelete]=useState(null),[visibleCount,setVisibleCount]=useState(PAGE_SIZE),[showCreate,setShowCreate]=useState(false),[ticketFor,setTicketFor]=useState(null);
  // Preload the PDF library so the first PO PDF doesn't pay its chunk download.
  useEffect(()=>{import("jspdf").catch(()=>{});},[]);
  const[pdfPreview,setPdfPreview]=useState(null);
  const[emailFor,setEmailFor]=useState(null);
  const{vendors}=useVendors();
  const vendorFor=(po)=>(po.vendor_id&&vendors.find(v=>v.id===po.vendor_id))||matchVendor(vendors,po.vendor_name||po.notes);
  // Tie technicians to a PO — same chip + "+ Add" control the WO crew uses.
  const setPOTechs=async(po,techs)=>{
    const{error}=await sb().from("purchase_orders").update({assigned_techs:techs}).eq("id",po.id);
    if(error){msg("Failed: "+error.message);return;}
    if(reloadTable)reloadTable("purchase_orders");
  };
  // Pull the PO's dollar amount up to what the captured receipts actually say.
  const syncPOAmount=async(po,total)=>{
    await onUpdatePO({...po,amount:Number(total.toFixed(2))});
    msg("PO "+po.po_id+" set to $"+total.toFixed(2));
  };
  const[inlineAmt,setInlineAmt]=useState({});   // po.id → amount typed on the card ($0 POs approve inline, no Edit detour)
  const[selPOs,setSelPOs]=useState([]);          // bulk-approve selection (pending filter)
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),2500);};
  // Deep-link: GlobalSearch / bell dispatch "open-po" with a po_id — prefill the search box.
  useEffect(()=>{const h=(e)=>{setFilter("all");setSearch(String(e.detail||""));};window.addEventListener("open-po",h);return()=>window.removeEventListener("open-po",h);},[]);
  const flt=pos.filter(p=>{if(filter!=="all"&&p.status!==filter)return false;if(search){const s=search.toLowerCase();const wo=wos.find(o=>o.id===p.wo_id);return(p.po_id||"").toLowerCase().includes(s)||(p.description||"").toLowerCase().includes(s)||(p.vendor_name||p.notes||"").toLowerCase().includes(s)||(p.requested_by||"").toLowerCase().includes(s)||((p.assigned_techs||[]).join(" ").toLowerCase().includes(s))||(wo?.title||"").toLowerCase().includes(s)||(wo?.customer||"").toLowerCase().includes(s);}return true;});const pc=pos.filter(p=>p.status==="pending").length;
  useEffect(()=>{setVisibleCount(PAGE_SIZE);},[flt.length]);
  const approve=async(po)=>{const amt=parseFloat(po.amount)||parseFloat(inlineAmt[po.id])||0;if(!amt){msg("Type the amount in the $ box first");return;}await onUpdatePO({...po,amount:amt,status:"approved"});setInlineAmt(a=>({...a,[po.id]:""}));msg("PO "+po.po_id+" approved"+(parseFloat(po.amount)?"":" — $"+amt.toFixed(2))); };
  const toggleSel=(id)=>setSelPOs(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const bulkApprove=async()=>{const sel=pos.filter(p=>selPOs.includes(p.id)&&p.status==="pending");const ok=sel.filter(p=>parseFloat(p.amount));const skip=sel.length-ok.length;for(const p of ok)await onUpdatePO({...p,status:"approved"});setSelPOs([]);msg(ok.length+" PO"+(ok.length!==1?"s":"")+" approved"+(skip>0?" · "+skip+" skipped (needs amount)":""));};
  const reject=async(po)=>{await onUpdatePO({...po,status:"rejected"});msg("PO "+po.po_id+" rejected");};
  const deletePO=async(po)=>{await onDeletePO(po);setConfirmDelete(null);msg("PO "+po.po_id+" deleted");};
  const approved=pos.filter(p=>p.status==="approved");const approvedAmt=approved.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  return(<div><Toast msg={toast}/>{pdfPreview&&<PdfPreviewModal {...pdfPreview} onClose={()=>setPdfPreview(null)}/>}
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"stretch"}}><div style={{display:"flex",gap:10,flexWrap:"wrap",flex:"1 1 420px"}}><StatCard label="Total POs" value={pos.length} icon="file" color={B.cyan}/><StatCard label="Pending" value={pc} icon="clock" color={B.orange}/><StatCard label="Approved" value={approved.length} icon="✓" color={B.green}/><StatCard label="Approved $" value={"$"+approvedAmt.toLocaleString()} icon="dollar" color={B.green}/></div>{onCreatePO&&<button data-tip="Create a purchase order not tied to a job — shop stock, tools, supplies. You’re auto-assigned as its tech." data-tour="po-new" onClick={()=>setShowCreate(true)} style={{...BP,padding:"10px 18px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",marginLeft:"auto"}}>+ Create PO</button>}</div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["revised","Revised"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:4,border:"1px solid "+(filter===k?B.cyan:B.border),background:filter===k?B.cyanGlow:"transparent",color:filter===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}{k==="pending"&&pc>0?" ("+pc+")":""}</button>)}</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search POs by #, description, tech, customer..." style={{...IS,marginBottom:14,padding:"8px 12px",fontSize:12}}/>
    {selPOs.length>0&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:B.cyanGlow,border:"1px solid "+B.cyan+"40",borderRadius:8,marginBottom:10}}>
      <span style={{fontSize:12,fontWeight:700,color:B.cyan}}>{selPOs.length} selected</span>
      <button onClick={bulkApprove} style={{...BP,padding:"8px 16px",fontSize:12,minHeight:36,background:B.green}}>Approve Selected</button>
      <button onClick={()=>setSelPOs([])} style={{...BS,padding:"8px 14px",fontSize:12,minHeight:36}}>Clear</button>
      <span style={{fontSize:10,color:B.textDim}}>POs without an amount are skipped</span>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {flt.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No POs found</div>}
      {flt.slice(0,visibleCount).map(po=>{const wo=wos.find(o=>o.id===po.wo_id);return(
        <Card key={po.id} style={{padding:"12px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            {po.status==="pending"&&<input type="checkbox" checked={selPOs.includes(po.id)} onChange={()=>toggleSel(po.id)} style={{width:18,height:18,accentColor:B.cyan,cursor:"pointer",marginTop:4,flexShrink:0}}/>}
            {/* 240px basis: on a phone the button cluster can't fit beside this,
                so it wraps to its own line instead of squeezing the text to
                one-word-per-line. */}
            <div className="ticket-stub" style={{width:80,flexShrink:0,display:"flex",flexDirection:"column",gap:4,paddingRight:12,borderRight:"1px dashed "+B.cyan+"66",minWidth:0}}>
              <span style={{fontFamily:M,fontSize:10,letterSpacing:0.8,color:B.cyan}}>PO</span>
              <span className="ticket-num" style={{fontFamily:M,fontSize:20,fontWeight:700,color:B.text,lineHeight:1,letterSpacing:-0.5,overflow:"hidden",textOverflow:"ellipsis"}}>{String(po.po_id||"").replace(/^PO-?/i,"")}</span>
            </div>
            <div style={{flex:"1 1 240px",minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><Badge color={PSC[po.status]||B.textDim}>{PSL[po.status]||po.status}</Badge>{wo&&<button onClick={()=>openWO(wo.wo_id||wo.id)} title={"Open "+wo.wo_id+(wo.title?" — "+wo.title:"")} style={{fontFamily:M,fontSize:11,color:B.cyan,background:"none",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationColor:B.cyan+"44"}}>{wo.wo_id}</button>}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{po.description}</div>
              <div style={{fontSize:11,color:B.textDim,marginTop:2}}>By {po.requested_by} · {po.created_at?.slice(0,10)} · {parseFloat(po.amount)?<span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(po.amount).toFixed(2)}</span>:<span style={{fontFamily:M,fontWeight:700,color:B.orange}}>$ —  needs amount</span>}{wo&&<span> · {wo.title}</span>}</div>
              {(po.vendor_name||po.notes||po.needed_by||po.delivery_method)&&<div style={{fontSize:11,color:B.textMuted,marginTop:3}}>{[po.vendor_name||(po.notes&&!po.vendor_name?po.notes:""),po.needed_by?"Needed "+fmtDate(po.needed_by,{month:"short",day:"numeric"}):"",po.delivery_method&&po.delivery_method!=="pickup"?DELIVERY_LABELS[po.delivery_method]:""].filter(Boolean).join(" · ")}</div>}
              {po.notes&&po.vendor_name&&<div style={{fontSize:11,color:B.orange,marginTop:2,fontStyle:"italic"}}>Note: {po.notes}</div>}
              {(()=>{
                // Actual spend so far, from the pickup tickets captured against
                // this PO — one line per supply house, since a PO can be filled
                // by several vendors.
                const t=ticketRollup(tickets,po.id);if(!t)return null;
                const poAmt=parseFloat(po.amount)||0;const off=Math.abs(t.total-poAmt)>0.01;
                return(<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:B.bg,border:"1px solid "+(off?B.orange+"55":B.border)}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:B.textDim,fontWeight:700,letterSpacing:.4,textTransform:"uppercase"}}>Receipts</span>
                    <span style={{fontFamily:M,fontSize:12,fontWeight:800,color:off?B.orange:B.green}}>${t.total.toFixed(2)}</span>
                    <span style={{fontSize:10,color:B.textDim}}>from {t.count} ticket{t.count!==1?"s":""}</span>
                    {off&&<button onClick={()=>syncPOAmount(po,t.total)} title={"Set the PO amount to the receipts total ($"+t.total.toFixed(2)+")"} style={{...BS,padding:"3px 10px",fontSize:10,minHeight:26,color:B.cyan,borderColor:B.cyan+"55"}}>Set PO to ${t.total.toFixed(2)}</button>}
                  </div>
                  <div style={{fontSize:10,color:B.textMuted,marginTop:3}}>{t.vendors.map(v=>v.name+" $"+v.total.toFixed(2)).join(" · ")}</div>
                </div>);
              })()}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:6}}>
                <span style={{fontSize:10,color:B.textDim,fontWeight:600,letterSpacing:.4,textTransform:"uppercase"}}>Techs</span>
                {(po.assigned_techs||[]).map((t,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:6,background:B.cyan+"22",color:B.cyan,fontSize:12,fontWeight:600}}>{t}<button onClick={()=>setPOTechs(po,(po.assigned_techs||[]).filter(x=>x!==t))} title={"Remove "+t} style={{background:"none",border:"none",color:B.red,fontSize:14,cursor:"pointer",padding:"0 6px",minWidth:28,minHeight:28,padding:"0 2px",lineHeight:1}}>×</button></span>)}
                {(po.assigned_techs||[]).length===0&&<span style={{fontSize:11,color:B.textDim}}>None assigned</span>}
                <select value="" onChange={e=>{if(!e.target.value)return;setPOTechs(po,[...(po.assigned_techs||[]),e.target.value]);e.target.value="";}} style={{...IS,width:"auto",padding:"6px 10px",fontSize:12,cursor:"pointer",minHeight:32}}>
                  <option value="">+ Add</option>
                  {(users||[]).filter(u=>u.active!==false&&!(po.assigned_techs||[]).includes(u.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",maxWidth:"100%"}}>
              {(()=>{const tc=(tickets||[]).filter(t=>t.po_id===po.id).length;return<button onClick={()=>setTicketFor(po)} title="Capture a supply house pickup ticket against this PO" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36,...(tc>0?{color:B.cyan,borderColor:B.cyan+"50"}:{})}}>{tc>0?"Tickets ("+tc+")":"Ticket"}</button>;})()}
              <button onClick={async()=>{try{const d=await generatePOPdf(po,wo,{returnDoc:true,vendor:vendorFor(po)});previewPdfDoc(d,"PO-"+po.po_id,setPdfPreview);}catch(e){msg("Error: "+e.message);}}} title="Preview the PO form (no download)" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36,color:B.cyan,borderColor:B.cyan+"55"}}>Preview</button><button onClick={()=>generatePOPdf(po,wo,{vendor:vendorFor(po)})} title="Download the PO form" style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36}}>PO Form</button>
              <button onClick={()=>setEmailFor(po)} title={po.sent_to_vendor_at?"Sent to vendor "+new Date(po.sent_to_vendor_at).toLocaleDateString("en-US"):"Email the PO PDF to the vendor"} style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36,...(po.sent_to_vendor?{color:B.green,borderColor:B.green+"55"}:{})}}>{po.sent_to_vendor?"Sent ✓":"Email"}</button>
              <button onClick={()=>setEditing(po)} style={{...BS,padding:"8px 12px",fontSize:11,minHeight:36}}>Edit</button>
              {po.status==="pending"&&<>{!parseFloat(po.amount)&&<div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:12,color:B.textDim}}>$</span><input value={inlineAmt[po.id]||""} onChange={e=>setInlineAmt(a=>({...a,[po.id]:e.target.value}))} type="number" min="0" step="0.01" placeholder="0.00" title="Type the amount and hit Approve — no Edit needed" style={{...IS,width:86,padding:"7px 8px",fontSize:12,fontFamily:M,minHeight:36}}/></div>}<button onClick={()=>approve(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.green}}>Approve</button><button onClick={()=>reject(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.red}}>Reject</button></>}
              {po.status==="rejected"&&<button onClick={()=>approve(po)} style={{...BP,padding:"8px 14px",fontSize:11,minHeight:36,background:B.green}}>Re-approve</button>}
              <button onClick={()=>setConfirmDelete(po)} style={{...BS,padding:"8px 12px",fontSize:12,minHeight:36,color:B.red,borderColor:B.red+"40"}}>✕</button>
            </div></div></Card>);})}
      {visibleCount<flt.length&&<button onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)} style={{...BS,width:"100%",marginTop:8,textAlign:"center",fontSize:12}}>Show More ({visibleCount} of {flt.length})</button>}
    </div>
    {editing&&<Modal title={"Edit PO "+editing.po_id} onClose={()=>setEditing(null)} wide><POEditForm po={editing} wo={wos.find(o=>o.id===editing.wo_id)} onSave={async u=>{await onUpdatePO(u);setEditing(null);msg("PO "+u.po_id+" updated");}} onClose={()=>setEditing(null)}/></Modal>}
    {confirmDelete&&<Modal title="Delete PO?" onClose={()=>setConfirmDelete(null)}>
      <div style={{textAlign:"center",padding:"10px 0"}}>
        
        <div style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:4}}>Delete PO {confirmDelete.po_id}?</div>
        <div style={{fontSize:12,color:B.textMuted,marginBottom:4}}>{confirmDelete.description}</div>
        <div style={{fontSize:12,color:B.textDim,marginBottom:16}}>This cannot be undone.</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>setConfirmDelete(null)} style={{...BS,flex:1}}>Cancel</button><button onClick={()=>deletePO(confirmDelete)} style={{...BP,flex:1,background:B.red}}>Delete PO</button></div>
      </div>
    </Modal>}
    {emailFor&&<EmailPOModal po={emailFor} wo={wos.find(o=>o.id===emailFor.wo_id)} vendor={vendorFor(emailFor)} onClose={()=>setEmailFor(null)} onSent={(to)=>{setEmailFor(null);msg("PO "+emailFor.po_id+" emailed to "+to);if(reloadTable)reloadTable("purchase_orders");}}/>}
    {showCreate&&<StandalonePOModal onCreatePO={onCreatePO} pos={pos} onClose={()=>setShowCreate(false)}/>}
    {ticketFor&&<TicketCaptureModal po={ticketFor} userName={userName} userId={userId} onClose={()=>setTicketFor(null)} onSaved={(warn)=>{
      msg("Pickup ticket saved on "+ticketFor.po_id+(warn||""));
      if(reloadTable){reloadTable("po_tickets");reloadTable("po_ticket_items");reloadTable("purchase_orders");}
    }}/>}
  </div>);
}

export { POReqModal, POEditForm, POMgmt, generatePOPdf, fetchLogoBase64 };
