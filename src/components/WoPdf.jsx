import React, { useState } from "react";
import { B, BP, BS, fmtDate, fmtHours, fnFetch, importRetry } from "../shared";
import { Modal, previewPdfDoc } from "./ui";
import { fetchLogoBase64 } from "./PurchaseOrders";
import { EQ_LABELS } from "./Equipment";

// ─────────────────────────────────────────────────────────────────────────────
// Work Order → customer-facing SERVICE TICKET PDF.
//
// Same letterhead language as the invoice/PO PDFs (cyan rule, logo top-left,
// dark info strip) so a customer who gets a ticket and then an invoice sees one
// company. Defaults to the customer copy: no rates, no costs, no internal notes.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS={before:"Before",during:"During",after:"After",general:""};
const STAGE_ORDER={before:0,during:1,after:2,general:3};
const DRIVE_ID=/[?&]id=([A-Za-z0-9_-]{10,})/;

// Drive thumbnails answer with no Access-Control-Allow-Origin, so the browser
// can't read their bytes for jsPDF. The drive-upload function proxies them back
// as data URIs. Anything already CORS-friendly (Supabase Storage) is fetched
// directly. Photos that fail either way are simply left out of the PDF.
async function fetchPhotoImages(photos,size){
  const out=new Map();
  const viaDrive=[],direct=[];
  photos.forEach(p=>{const u=p.photo_url||"";const m=DRIVE_ID.exec(u);if(m)viaDrive.push([p,m[1]]);else if(u)direct.push(p);});
  if(viaDrive.length){
    try{
      const resp=await fnFetch("drive-upload",{fetchIds:[...new Set(viaDrive.map(v=>v[1]))],size:size||900});
      const body=await resp.json();
      if(body&&body.images)viaDrive.forEach(([p,id])=>{if(body.images[id])out.set(p,body.images[id]);});
    }catch(e){console.warn("Service ticket: Drive photo fetch failed",e);}
  }
  await Promise.all(direct.map(async p=>{
    try{
      const r=await fetch(p.photo_url);if(!r.ok)return;
      const blob=await r.blob();
      out.set(p,await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(blob);}));
    }catch(e){}
  }));
  return out;
}

// jsPDF's built-in fonts are WinAnsi, so anything outside it prints as garbage.
// This also repairs the mis-encoded curly quotes ("PMâ€™s") that live in some
// older work-order titles — a customer-facing page shouldn't show them.
const WINANSI_OK=/[^\t\n\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC]/g;
const S=v=>String(v==null?"":v)
  .replace(/\u00E2\u20AC(?:\u2122|\u02DC)/g,"\u2019")
  .replace(/\u00E2\u20AC(?:\u009C|\u009D|\u0153)/g,"\u201D")
  .replace(/\u00E2\u20AC(?:\u201C|\u201D)/g,"\u2014")
  .replace(/\u00E2\u20AC\u00A6/g,"...")
  .replace(/\u00C2\u00B0/g,"\u00B0").replace(/\u00C2/g,"")
  .replace(WINANSI_OK,"");

const money=n=>"$"+(parseFloat(n)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const stampStr=s=>s?new Date(s).toLocaleString("en-US",{month:"numeric",day:"numeric",year:"2-digit",hour:"numeric",minute:"2-digit"}):"—";
const gap=(from,to)=>{if(!from||!to)return"";const m=Math.round((new Date(to)-new Date(from))/60000);return m<60?m+"m":Math.floor(m/60)+"h "+String(m%60).padStart(2,"0")+"m";};

// Pull everything the ticket needs off the WO detail view's already-loaded state,
// so building the PDF costs one photo fetch and nothing else.
function collectWOPdfData({wo,customer,equipment,timeEntries,lineItems,pos,photos,refLog,fieldNotes,opts}){
  const o=opts||{};
  const hours=(timeEntries||[]).reduce((s,t)=>s+(parseFloat(t.hours)||0),0);
  const techs=[...new Set([wo.assignee,...(wo.crew||[]),...(timeEntries||[]).map(t=>t.technician)].filter(n=>n&&n!=="Unassigned"))];
  const autoPerformed=[...new Set((timeEntries||[]).map(t=>(t.description||"").trim()).filter(Boolean))].join(". ");
  const reported=(wo.notes||"").trim();
  return{
    woId:wo.wo_id||"",
    title:wo.title||"",
    status:wo.status==="in_progress"?"In Progress":wo.status==="completed"?"Completed":"Pending",
    woType:wo.wo_type==="PM"?"Preventative Maintenance":"Corrective Maintenance",
    priority:(wo.priority||"medium").replace(/^./,c=>c.toUpperCase()),
    customerWO:wo.customer_wo||"",
    dateStr:fmtDate(wo.date_completed||wo.due_date)||new Date().toLocaleDateString("en-US"),
    dueDate:wo.due_date&&wo.due_date!=="TBD"?fmtDate(wo.due_date):"",
    completedDate:wo.date_completed?fmtDate(wo.date_completed):"",
    customerName:customer?.name||wo.customer||"",
    contactName:customer?.contact_name||"",
    customerAddress:customer?.address||"",
    location:wo.location||"",
    building:wo.building||"",
    techs,
    hours,
    reported:reported&&reported.toLowerCase()!=="no details."?reported:"",
    workPerformed:(wo.work_performed||"").trim()||autoPerformed,
    equipment:equipment?{
      model:equipment.model||"",manufacturer:equipment.manufacturer||"",serial:equipment.serial_number||"",
      tag:equipment.asset_tag||"",number:equipment.equipment_number||"",
      type:EQ_LABELS[equipment.equipment_type]||equipment.equipment_type||"",
      refrigerant:equipment.refrigerant_type||"",spot:equipment.location_detail||equipment.location||"",
    }:null,
    timeEntries:[...(timeEntries||[])].sort((a,b)=>(a.logged_date||"").localeCompare(b.logged_date||"")),
    lineItems:lineItems||[],
    pos:(pos||[]).filter(p=>p.status==="approved"),
    refLog:[...(refLog||[])].sort((a,b)=>(a.logged_at||"").localeCompare(b.logged_at||"")),
    fieldNotes:o.notes?(fieldNotes||[]):[],
    photos:o.photos?[...(photos||[])].sort((a,b)=>(STAGE_ORDER[a.photo_stage]??3)-(STAGE_ORDER[b.photo_stage]??3)||String(a.created_at||"").localeCompare(String(b.created_at||""))):[],
    sla:{dispatched:wo.dispatched_at||null,onSite:wo.on_site_at||null,resolved:wo.resolved_at||null},
    pricing:!!o.pricing,
  };
}

async function buildWOPdf(d){
  const{jsPDF}=await importRetry(()=>import("jspdf"));
  const doc=new jsPDF({unit:"mm",format:"letter",compress:true});
  const pw=215.9,ph=279.4,lm=18,rm=18,cw=pw-lm-rm;
  const cyan=[0,212,245],dark=[30,34,40],mid=[100,112,130],light=[245,247,252],hair=[221,226,235],white=[255,255,255];
  let y=0;

  const R=(x,y1,w,h,fill)=>{doc.setFillColor(...fill);doc.rect(x,y1,w,h,"F");};
  const txt=(t,x,yy,o)=>doc.text(S(t),x,yy,o||{});
  const wrap=(t,w)=>doc.splitTextToSize(S(t),w);
  const clip=(t,w)=>{const l=wrap(t,w);return l.length>1?l[0].replace(/\s+\S*$/,"")+"…":(l[0]||"");};
  // Content stops above the footer bar; 20mm leaves room for the bar plus air.
  const need=h=>{if(y+h>ph-20){doc.addPage();y=18;return true;}return false;};
  const section=(label,reserve)=>{
    need(Math.max(18,reserve||0));
    doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
    txt(label,lm,y+4);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.4);doc.line(lm,y+5.8,lm+doc.getTextWidth(label),y+5.8);
    y+=10;
  };
  const rule=()=>{doc.setDrawColor(...hair);doc.setLineWidth(0.2);doc.line(lm,y,pw-rm,y);y+=5;};
  const para=(text,x,width,size,color)=>{
    doc.setFont("helvetica","normal");doc.setFontSize(size);doc.setTextColor(...color);
    wrap(String(text||""),width).forEach(ln=>{need(7);txt(ln,x,y+3);y+=4.6;});
  };

  // ── Letterhead ──
  R(0,0,pw,3,cyan);
  y=12;
  const logo=await fetchLogoBase64();
  if(logo)doc.addImage(logo,"PNG",lm,y,44,16);
  doc.setFont("helvetica","bold");doc.setFontSize(23);doc.setTextColor(...dark);
  txt("SERVICE TICKET",pw-rm,y+8,{align:"right"});
  doc.setDrawColor(...cyan);doc.setLineWidth(1.2);
  doc.line(pw-rm-doc.getTextWidth("SERVICE TICKET"),y+11,pw-rm,y+11);
  y+=18;

  const infoRows=[["DATE",d.dateStr],["WORK ORDER #",d.woId]];
  if(d.customerWO)infoRows.push(["YOUR WO #",d.customerWO]);
  infoRows.push(["STATUS",d.status]);
  const boxW=64,boxX=pw-rm-boxW,boxH=5+infoRows.length*7.5;
  R(boxX,y,boxW,boxH,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.6);doc.line(boxX,y,boxX,y+boxH);
  infoRows.forEach((r,i)=>{
    const ry=y+6.5+i*7.5;
    doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...mid);txt(r[0],boxX+4,ry);
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...dark);txt(r[1],pw-rm-4,ry,{align:"right"});
  });
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...mid);
  ["3C Refrigeration, LLC","3065 Gwyn Rd., Elon, N.C. 27244","336-264-0935  |  service@3crefrigeration.com","N.C. License 4923"]
    .forEach((t,i)=>txt(t,lm,y+5+i*4.2));
  y+=Math.max(boxH,22)+7;

  // ── Job title ──
  doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(...dark);
  wrap(d.title||"Service Call",cw).slice(0,2).forEach(ln=>{txt(ln,lm,y+4);y+=6;});
  y+=3;

  // ── Customer / Service location ──
  const custLines=[d.customerName,d.contactName].filter(Boolean);
  if(d.customerAddress)wrap(d.customerAddress,cw/2-14).forEach(l=>custLines.push(l));
  const siteLines=[d.location,d.building&&("Building "+d.building)].filter(Boolean);
  if(!siteLines.length)siteLines.push("—");
  const paneH=Math.max(24,13+Math.max(custLines.length,siteLines.length)*4.6);
  const paneW=(cw-6)/2;
  [["CUSTOMER",custLines,lm],["SERVICE LOCATION",siteLines,lm+paneW+6]].forEach(([label,lines,x])=>{
    R(x,y,paneW,paneH,light);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.8);doc.line(x,y,x,y+paneH);
    doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...cyan);txt(label,x+5,y+5.5);
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
    lines.forEach((l,i)=>txt(l,x+5,y+12+i*4.6));
  });
  y+=paneH+6;

  // ── Dark summary strip ──
  const strip=[
    {label:"TECHNICIAN",val:d.techs.join(", ")||"—",w:cw*0.34},
    {label:"SERVICE TYPE",val:d.woType,w:cw*0.28},
    {label:d.completedDate?"COMPLETED":"SCHEDULED",val:d.completedDate||d.dueDate||"—",w:cw*0.20},
    {label:"TOTAL HOURS",val:fmtHours(d.hours),w:cw*0.18},
  ];
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  const wrapped=strip.map(c=>({...c,lines:wrap(String(c.val),c.w-8)}));
  const stripH=8+Math.max(...wrapped.map(c=>c.lines.length))*4.5;
  need(stripH+4);
  R(lm,y,cw,stripH,dark);
  let sx=lm;
  doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...cyan);
  wrapped.forEach(c=>{txt(c.label,sx+4,y+4.5);sx+=c.w;});
  sx=lm;
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...white);
  wrapped.forEach(c=>{c.lines.forEach((ln,i)=>txt(ln,sx+4,y+9+i*4.5));sx+=c.w;});
  y+=stripH+8;

  // ── Equipment ──
  if(d.equipment){
    const e=d.equipment;
    const pairs=[["UNIT",e.model||e.number||"—"],["MANUFACTURER",e.manufacturer],["TYPE",e.type],["SERIAL #",e.serial],["ASSET TAG",e.tag],["REFRIGERANT",e.refrigerant],["LOCATED",e.spot]].filter(p=>p[1]);
    if(pairs.length){
      const gridH=8+Math.ceil(pairs.length/2)*7;
      section("EQUIPMENT SERVICED",gridH+12);
      R(lm,y-2,cw,gridH,light);
      pairs.forEach((p,i)=>{
        const px=lm+6+(i%2)*(cw/2),py=y+4+Math.floor(i/2)*7;
        doc.setFont("helvetica","bold");doc.setFontSize(6.8);doc.setTextColor(...mid);txt(p[0],px,py);
        doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...dark);
        txt(clip(p[1],cw/2-32),px+30,py);
      });
      y+=gridH+4;
      rule();
    }
  }

  // ── Narrative ──
  if(d.reported){section("REPORTED ISSUE");para(d.reported,lm,cw-4,9,mid);y+=3;rule();}
  if(d.workPerformed){section("WORK PERFORMED");para(d.workPerformed,lm,cw-4,9,dark);y+=3;rule();}

  // ── Service log ──
  if(d.timeEntries.length){
    section("SERVICE LOG",26);
    const cDate=lm+4,cTech=lm+30,cHrs=lm+72,cDesc=lm+88;
    need(14);
    R(lm,y-4,cw,7,cyan);
    doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...white);
    txt("DATE",cDate,y+0.5);txt("TECHNICIAN",cTech,y+0.5);txt("HOURS",cHrs,y+0.5);txt("WORK DESCRIPTION",cDesc,y+0.5);
    y+=6;
    d.timeEntries.forEach((t,i)=>{
      const lines=wrap(t.description||"—",pw-rm-cDesc-2).slice(0,4);
      const rowH=Math.max(7,3+lines.length*4.4);
      need(rowH+2);
      if(i%2===0)R(lm,y-1.5,cw,rowH,light);
      doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...dark);
      txt(fmtDate(t.logged_date,{month:"numeric",day:"numeric",year:"2-digit"}),cDate,y+3);
      txt(clip(t.technician||"—",40),cTech,y+3);
      doc.setFont("helvetica","bold");doc.setTextColor(...cyan);
      txt((parseFloat(t.hours)||0).toFixed(2),cHrs,y+3);
      doc.setFont("helvetica","normal");doc.setTextColor(...mid);
      lines.forEach((ln,li)=>txt(ln,cDesc,y+3+li*4.4));
      y+=rowH;
    });
    y+=1;
    need(10);
    doc.setDrawColor(...hair);doc.setLineWidth(0.3);doc.line(pw-rm-56,y,pw-rm,y);
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...dark);
    txt("TOTAL HOURS",pw-rm-56,y+5);txt(fmtHours(d.hours),pw-rm,y+5,{align:"right"});
    y+=11;
    rule();
  }

  // ── Response times ──
  if(d.sla.dispatched||d.sla.onSite||d.sla.resolved){
    section("RESPONSE TIMES",30);
    const cells=[
      ["DISPATCHED",stampStr(d.sla.dispatched),""],
      ["ON SITE",stampStr(d.sla.onSite),gap(d.sla.dispatched,d.sla.onSite)],
      ["RESOLVED",stampStr(d.sla.resolved),gap(d.sla.onSite,d.sla.resolved)],
    ];
    const cellW=(cw-8)/3;
    need(20);
    cells.forEach((c,i)=>{
      const x=lm+i*(cellW+4);
      R(x,y-2,cellW,16,light);
      doc.setFont("helvetica","bold");doc.setFontSize(6.8);doc.setTextColor(...mid);txt(c[0],x+5,y+3);
      doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...dark);txt(c[1],x+5,y+9);
      if(c[2]){doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...cyan);txt("+"+c[2],x+cellW-5,y+9,{align:"right"});}
    });
    y+=20;
    rule();
  }

  // ── Parts & materials ──
  if(d.lineItems.length){
    section("PARTS & MATERIALS");
    d.lineItems.forEach((li,i)=>{
      const lines=wrap(li.description||"—",cw-(d.pricing?46:12)).slice(0,3);
      const rowH=Math.max(7,2.5+lines.length*4.4);
      need(rowH+2);
      if(i%2===0)R(lm,y-1.5,cw,rowH,light);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...dark);
      lines.forEach((ln,li2)=>txt(ln,lm+6,y+3+li2*4.4));
      if(d.pricing){doc.setFont("helvetica","bold");txt(money(li.amount),pw-rm-4,y+3,{align:"right"});}
      y+=rowH;
    });
    if(d.pricing){
      y+=1;need(10);
      const total=d.lineItems.reduce((s,li)=>s+(parseFloat(li.amount)||0),0);
      doc.setDrawColor(...hair);doc.setLineWidth(0.3);doc.line(pw-rm-56,y,pw-rm,y);
      doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...dark);
      txt("MATERIALS TOTAL",pw-rm-56,y+5);txt(money(total),pw-rm,y+5,{align:"right"});
      y+=11;
    }else y+=3;
    rule();
  }

  // ── Approved POs — cost data, internal copy only ──
  if(d.pricing&&d.pos.length){
    section("PURCHASE ORDERS");
    d.pos.forEach((p,i)=>{
      need(9);
      if(i%2===0)R(lm,y-1.5,cw,7,light);
      doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);txt(p.po_id||"",lm+6,y+3);
      doc.setFont("helvetica","normal");doc.setTextColor(...dark);
      txt(clip(p.description||"—",cw-74),lm+34,y+3);
      doc.setFont("helvetica","bold");txt(money(p.amount),pw-rm-4,y+3,{align:"right"});
      y+=7;
    });
    y+=3;
    rule();
  }

  // ── Refrigerant (EPA 608 record) ──
  if(d.refLog.length){
    section("REFRIGERANT LOG",26);
    need(12);
    R(lm,y-4,cw,7,cyan);
    doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...white);
    txt("DATE",lm+4,y+0.5);txt("ACTION",lm+26,y+0.5);txt("REFRIGERANT",lm+52,y+0.5);
    txt("POUNDS",lm+92,y+0.5);txt("CYLINDER / NOTES",lm+112,y+0.5);
    y+=6;
    d.refLog.forEach((r,i)=>{
      need(9);
      if(i%2===0)R(lm,y-1.5,cw,7,light);
      doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...dark);
      txt(r.logged_at?new Date(r.logged_at).toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"2-digit"}):"—",lm+4,y+3);
      txt((r.action||"").replace(/^./,c=>c.toUpperCase()),lm+26,y+3);
      txt(r.refrigerant_type||"—",lm+52,y+3);
      doc.setFont("helvetica","bold");txt((parseFloat(r.pounds)||0).toFixed(2),lm+92,y+3);
      doc.setFont("helvetica","normal");doc.setTextColor(...mid);
      txt(clip([r.cylinder_id,r.notes].filter(Boolean).join(" — ")||"—",cw-116),lm+112,y+3);
      y+=7;
    });
    const net=d.refLog.reduce((s,r)=>s+(r.action==="added"?parseFloat(r.pounds||0):r.action==="recovered"?-parseFloat(r.pounds||0):0),0);
    y+=1;need(10);
    doc.setDrawColor(...hair);doc.setLineWidth(0.3);doc.line(pw-rm-60,y,pw-rm,y);
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(...dark);
    txt("NET CHARGE CHANGE",pw-rm-60,y+5);txt((net>0?"+":"")+net.toFixed(2)+" lbs",pw-rm,y+5,{align:"right"});
    y+=11;
    rule();
  }

  // ── Field notes (internal copy only) ──
  if(d.fieldNotes.length){
    section("FIELD NOTES");
    d.fieldNotes.forEach(n=>{
      need(12);
      doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...mid);
      txt((n.author||"")+"  ·  "+(n.created_at?new Date(n.created_at).toLocaleDateString("en-US"):""),lm+2,y+3);
      y+=5;
      para(n.body||"",lm+2,cw-6,8.5,dark);
      y+=3;
    });
    rule();
  }

  // ── Photos ──
  if(d.photos.length&&d.photoImages&&d.photoImages.size){
    // Phone photos are mostly portrait. A fixed grid boxes them inside landscape
    // cells and leaves a page of grey, so instead every shot is scaled to a shared
    // row height and the frames flow left to right, wrapping like a filmstrip.
    const targetH=d.photos.length<=3?60:44;
    const items=d.photos.map(p=>{
      const src=d.photoImages.get(p);
      if(!src)return null;
      try{
        const props=doc.getImageProperties(src);
        return{p,src,h:targetH,w:Math.min(cw-3,props.width/props.height*targetH)};
      }catch(e){console.warn("Service ticket: photo skipped",e);return null;}
    }).filter(Boolean);
    if(items.length){
      section("JOB PHOTOS",targetH+22);
      let row=[],rowW=0;
      const flush=()=>{
        if(!row.length)return;
        const rowH=Math.max(...row.map(it=>it.h))+3;
        need(rowH+11);
        let x=lm;
        row.forEach(it=>{
          R(x,y,it.w+3,it.h+3,light);
          doc.setDrawColor(...hair);doc.setLineWidth(0.2);doc.rect(x,y,it.w+3,it.h+3);
          try{doc.addImage(it.src,x+1.5,y+1.5,it.w,it.h);}catch(e){}
          const cap=STAGE_LABELS[it.p.photo_stage]||"";
          if(cap){
            doc.setFont("helvetica","bold");doc.setFontSize(6.8);doc.setTextColor(...mid);
            txt(cap.toUpperCase(),x+1,y+it.h+8);
          }
          x+=it.w+7;
        });
        y+=rowH+11;row=[];rowW=0;
      };
      items.forEach(it=>{
        if(row.length&&rowW+4+it.w+3>cw)flush();
        rowW+=(row.length?4:0)+it.w+3;
        row.push(it);
      });
      flush();
      rule();
    }
  }

  // ── Acknowledgement ──
  // Blank ruled lines, not the signature captured in the app: this sheet is meant
  // to be handed over or printed, so the customer signs the copy in front of them.
  {
    const ackH=30;
    // Reserve the closing line too, so it never lands alone on a page of its own.
    section("ACKNOWLEDGEMENT",ackH+32);
    R(lm,y,cw,ackH,light);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.8);doc.line(lm,y,lm,y+ackH);
    const fields=[
      {label:"CUSTOMER SIGNATURE",x:lm+6,w:66,val:""},
      {label:"PRINT NAME",x:lm+78,w:48,val:""},
      {label:"DATE",x:lm+130,w:42,val:d.completedDate||d.dateStr},
    ];
    fields.forEach(f=>{
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...dark);
      if(f.val)txt(clip(f.val,f.w),f.x,y+17);
      doc.setDrawColor(...mid);doc.setLineWidth(0.3);doc.line(f.x,y+19,f.x+f.w,y+19);
      doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...mid);
      txt(f.label,f.x,y+23);
    });
    doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...mid);
    txt("SERVICED BY",lm+6,y+6.5);
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...dark);
    txt(clip(d.techs.join(", ")||"—",cw-40),lm+34,y+6.5);
    y+=ackH+6;
  }

  // ── Closing line ──
  need(14);
  doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.setTextColor(...dark);
  txt("Thank you for trusting 3C Refrigeration with your equipment.",pw/2,y+4,{align:"center"});
  doc.setFont("helvetica","italic");doc.setFontSize(8);doc.setTextColor(...mid);
  txt("Questions about this service? Call 336-264-0935 or reply to service@3crefrigeration.com",pw/2,y+9.5,{align:"center"});

  // ── Footer bar on every page ──
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    R(0,ph-8,pw,8,dark);
    doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(180,190,200);
    txt("3C Refrigeration LLC  |  service@3crefrigeration.com  |  336-264-0935  |  N.C. License 4923",lm,ph-3.5);
    txt(d.woId+"   ·   Page "+p+" of "+pages,pw-rm,ph-3.5,{align:"right"});
  }
  return doc;
}

function OptRow({on,label,hint,disabled,onToggle}){
  return(<label style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",borderRadius:8,border:"1px solid "+(on?B.cyan+"55":B.border),background:on?B.cyan+"0e":B.bg,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.45:1,marginBottom:8}}>
    <input type="checkbox" checked={!!on} disabled={disabled} onChange={e=>onToggle(e.target.checked)} style={{marginTop:2,accentColor:B.cyan,width:16,height:16,cursor:disabled?"not-allowed":"pointer"}}/>
    <span><span style={{fontSize:13,fontWeight:650,color:B.text}}>{label}</span><br/><span style={{fontSize:11,color:B.textDim}}>{hint}</span></span>
  </label>);
}

// Options sheet. Defaults are the customer copy — flipping "internal copy" turns
// on the three things a customer shouldn't see (costs, PO amounts, field notes).
function WOPdfModal({wo,customer,equipment,timeEntries,lineItems,pos,photos,refLog,fieldNotes,onClose,onPreview,onToast}){
  const[opts,setOpts]=useState({photos:true,pricing:false,notes:false});
  const[busy,setBusy]=useState(false);
  const set=(k,v)=>setOpts(o=>({...o,[k]:v}));
  const photoCount=(photos||[]).length,noteCount=(fieldNotes||[]).length;
  const go=async()=>{
    if(busy)return;setBusy(true);
    try{
      const d=collectWOPdfData({wo,customer,equipment,timeEntries,lineItems,pos,photos,refLog,fieldNotes,opts});
      if(d.photos.length)d.photoImages=await fetchPhotoImages(d.photos,900);
      const doc=await buildWOPdf(d);
      onPreview(doc,"Service Ticket "+(wo.wo_id||""));
      onClose();
    }catch(e){console.error(e);onToast&&onToast("⚠️ PDF failed: "+e.message);}
    setBusy(false);
  };
  return(<Modal title="Service Ticket PDF" onClose={onClose}>
    <div style={{fontSize:12,color:B.textMuted,marginBottom:14,lineHeight:1.5}}>
      A branded, customer-ready ticket for {wo.wo_id}. Defaults leave out anything internal.
    </div>
    <OptRow on={opts.photos} onToggle={v=>set("photos",v)} disabled={!photoCount} label={"Include job photos"+(photoCount?" ("+photoCount+")":"")} hint={photoCount?"Before / during / after shots, grouped by stage.":"No photos on this work order yet."}/>
    <OptRow on={opts.pricing} onToggle={v=>set("pricing",v)} label="Internal copy — show costs" hint="Adds material amounts and approved purchase orders. Leave off for the customer."/>
    <OptRow on={opts.notes} onToggle={v=>set("notes",v)} disabled={!noteCount} label={"Internal copy — show field notes"+(noteCount?" ("+noteCount+")":"")} hint={noteCount?"Tech-to-tech notes. Not written for customers.":"No field notes on this work order."}/>
    <div style={{display:"flex",gap:8,marginTop:18}}>
      <button onClick={onClose} style={{...BS,flex:1}}>Cancel</button>
      <button onClick={go} disabled={busy} style={{...BP,flex:2,opacity:busy?.6:1}}>{busy?"Building…":"Generate PDF"}</button>
    </div>
  </Modal>);
}

export { buildWOPdf, collectWOPdfData, fetchPhotoImages, WOPdfModal };
