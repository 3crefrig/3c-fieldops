import React, { useState, useEffect, useRef } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS, PC, SC, SL, PSC, PSL, haptic, cleanText, calcWOHours } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, CustomSelect } from "./ui";
import { jsPDF } from "jspdf";
import { fetchLogoBase64 } from "./PurchaseOrders";

async function buildInvoiceExcel(d){
  const ExcelJS=await import("exceljs");
  const wb=new ExcelJS.default.Workbook();
  wb.creator="3C FieldOps Pro";
  const ws=wb.addWorksheet(d.customerName+" Invoice",{properties:{defaultRowHeight:15}});
  ws.columns=[{width:10},{width:22},{width:14},{width:16},{width:14},{width:16}];
  const thinBorder={style:"thin",color:{argb:"FF999999"}};
  const acctFmt='_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)';
  const numFmt='_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';
  const shadeFill={type:"pattern",pattern:"solid",fgColor:{argb:"FFD9E2F3"}};

  // Logo
  let logoId=null;
  try{const logo=await fetchLogoBase64();if(logo){const b64=logo.split(",")[1];logoId=wb.addImage({base64:b64,extension:"png"});ws.addImage(logoId,{tl:{col:0,row:0},ext:{width:200,height:60}});}}catch(e){}

  // Row 1 — INVOICE title
  ws.getRow(1).height=50;
  const invCell=ws.getCell("E1");invCell.value="INVOICE";invCell.font={name:"Palatino Linotype",size:22,bold:true};invCell.alignment={horizontal:"right",vertical:"middle"};

  // Rows 3-9 — Company info (left) + Date/Invoice#/CustID (right)
  const companyInfo=["3065 Gwyn Rd.","Elon, N.C. 27244","Phone: 336-264-0935","Email: service@3crefrigeration.com","FAX: (877) 278-4608","N.C. License 4923","Vendor Number "+(d.vendorNumber||"126337")];
  companyInfo.forEach((txt,i)=>{const c=ws.getCell("A"+(i+3));c.value=txt;c.font={name:"Palatino Linotype",size:10};});

  // Right side labels
  const rLabels=[["E3","Date:","F3",d.date],["E4","Invoice #:","F4",d.invoiceNum],["E5","Customer ID:","F5",d.customerId]];
  rLabels.forEach(([lc,lv,vc,vv])=>{const l=ws.getCell(lc);l.value=lv;l.font={name:"Palatino Linotype",size:10,bold:true};l.alignment={horizontal:"right"};const v=ws.getCell(vc);v.value=vv;v.font={name:"Palatino Linotype",size:10};});

  // Row 11-13 — Bill To
  ws.getCell("A11").value="To:";ws.getCell("A11").font={name:"Palatino Linotype",size:10,bold:true};
  ws.mergeCells("B11:C11");ws.getCell("B11").value=d.customerName;ws.getCell("B11").font={name:"Palatino Linotype",size:10};
  if(d.customerAddress){ws.mergeCells("B12:C12");ws.getCell("B12").value=d.customerAddress;ws.getCell("B12").font={name:"Palatino Linotype",size:10};}
  if(d.customerAddress2){ws.getCell("B13").value=d.customerAddress2;ws.getCell("B13").font={name:"Palatino Linotype",size:10};}

  // Row 16 — separator
  ws.mergeCells("A16:F16");ws.getRow(16).height=6;

  // Row 17 — Table headers (PO, Job, Payment Terms, Due Date)
  ws.mergeCells("A17:B17");ws.mergeCells("D17:E17");
  const hdr17=[["A17","Purchase Order"],["C17","Job"],["D17","Payment Terms"],["F17","Due Date"]];
  hdr17.forEach(([c,v])=>{const cell=ws.getCell(c);cell.value=v;cell.font={name:"Palatino Linotype",size:10,bold:true};cell.fill=shadeFill;cell.alignment={horizontal:"center"};cell.border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});
  ["B17","E17"].forEach(c=>{ws.getCell(c).fill=shadeFill;ws.getCell(c).border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});

  // Row 18 — Table values
  ws.mergeCells("A18:B18");ws.mergeCells("D18:E18");
  const val18=[["A18",d.poNumber||""],["C18",d.jobDesc||"Repairs"],["D18",d.paymentTerms||"Net 30"],["F18",d.dueDate||""]];
  val18.forEach(([c,v])=>{const cell=ws.getCell(c);cell.value=v;cell.font={name:"Palatino Linotype",size:10};cell.fill=shadeFill;cell.alignment={horizontal:"center"};cell.border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});
  ["B18","E18"].forEach(c=>{ws.getCell(c).fill=shadeFill;ws.getCell(c).border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});

  // Row 20 — Line items header
  const hdr20=[["A20","Qty"],["B20","Description"],["E20","Unit Price"],["F20","Line Total"]];
  hdr20.forEach(([c,v])=>{const cell=ws.getCell(c);cell.value=v;cell.font={name:"Palatino Linotype",size:10,bold:true};cell.fill=shadeFill;cell.alignment={horizontal:"center"};cell.border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});
  ["C20","D20"].forEach(c=>{ws.getCell(c).fill=shadeFill;ws.getCell(c).border={top:thinBorder,bottom:thinBorder,left:thinBorder,right:thinBorder};});

  // Row 21 — "Labor" label
  ws.getCell("B21").value="Labor ";ws.getCell("B21").font={name:"Palatino Linotype",size:10,bold:true,underline:true};

  // Rows 22+ — Labor tiers (dynamic)
  let r=22;const tierStartRow=r;
  const tierRows=[];
  d.tiers.forEach(t=>{
    ws.getCell("A"+r).value=t.hours;ws.getCell("A"+r).numFmt="0.00";ws.getCell("A"+r).font={name:"Palatino Linotype",size:10};
    ws.getCell("B"+r).value=t.name;ws.getCell("B"+r).font={name:"Palatino Linotype",size:10};
    ws.getCell("E"+r).value=t.rate;ws.getCell("E"+r).numFmt=numFmt;ws.getCell("E"+r).font={name:"Palatino Linotype",size:10};
    ws.getCell("F"+r).value={formula:"E"+r+"*A"+r};ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).font={name:"Palatino Linotype",size:10};
    ws.getCell("F"+r).fill=shadeFill;
    tierRows.push(r);
    r++;
  });
  // Ensure at least 3 tier rows for layout consistency
  while(tierRows.length<3){
    ws.getCell("F"+r).value={formula:'IF(SUM(A'+r+')>0,SUM(A'+r+'*E'+r+'),"")'};ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
    tierRows.push(r);r++;
  }

  // Description section
  const descStartRow=r;
  ws.getCell("B"+r).value="Description:";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true,underline:true};
  ws.getCell("F"+r).value={formula:'IF(SUM(A'+r+')>0,SUM(A'+r+'*E'+r+'),"")'};ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
  r++;
  // Write description text across merged cells
  if(d.description){
    const descLines=d.description.split("\n").slice(0,4);
    const descEndRow=r+Math.max(descLines.length-1,2);
    ws.mergeCells("B"+r+":D"+descEndRow);
    ws.getCell("B"+r).value=descLines.join("\n");ws.getCell("B"+r).font={name:"Palatino Linotype",size:9};ws.getCell("B"+r).alignment={wrapText:true,vertical:"top"};
    for(let i=r;i<=descEndRow;i++){ws.getCell("F"+i).fill=shadeFill;ws.getCell("F"+i).numFmt=numFmt;}
    r=descEndRow+1;
  }else{r+=3;}

  // PM/CM/EM Breakdown section (if included)
  if(d.breakdownData){
    const bd=d.breakdownData;
    // Breakdown header
    ws.getCell("E"+r).value="Breakdown:";ws.getCell("E"+r).font={name:"Palatino Linotype",size:10,bold:true,italic:true};ws.getCell("F"+r).fill=shadeFill;
    r++;
    if(bd.pm_hours>0){
      ws.getCell("A"+r).value=bd.pm_hours;ws.getCell("A"+r).numFmt="0.00";ws.getCell("A"+r).font={name:"Palatino Linotype",size:10};
      ws.getCell("B"+r).value="Preventative maintenance";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true};
      ws.getCell("F"+r).value=bd.pm_total;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
      r++;
    }
    if(bd.cm_hours>0){
      ws.getCell("A"+r).value=bd.cm_hours;ws.getCell("A"+r).numFmt="0.00";ws.getCell("A"+r).font={name:"Palatino Linotype",size:10};
      ws.getCell("B"+r).value="Corrective maintenance";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true};
      ws.getCell("F"+r).value=bd.cm_total;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
      r++;
    }
    if(bd.em_hours>0){
      ws.getCell("A"+r).value=bd.em_hours;ws.getCell("A"+r).numFmt="0.00";ws.getCell("A"+r).font={name:"Palatino Linotype",size:10};
      ws.getCell("B"+r).value="Emergency service";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true};
      ws.getCell("F"+r).value=bd.em_total;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
      r++;
    }
    r++;
  }

  // Parts section
  const partsRow=r;
  ws.getCell("B"+r).value="Parts:";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true,underline:true};
  ws.getCell("F"+r).value=d.partsTotal||0;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
  if(d.partsDetail&&d.partsDetail.length>0){
    r++;
    const pEnd=r+Math.max(d.partsDetail.length-1,1);
    ws.mergeCells("B"+r+":D"+pEnd);
    ws.getCell("B"+r).value=d.partsDetail.map(p=>p.desc+" — $"+p.amount.toFixed(2)).join("\n");
    ws.getCell("B"+r).font={name:"Palatino Linotype",size:9};ws.getCell("B"+r).alignment={wrapText:true,vertical:"top"};
    for(let i=r;i<=pEnd;i++){ws.getCell("F"+i).fill=shadeFill;ws.getCell("F"+i).numFmt=numFmt;}
    r=pEnd+1;
  }else{r+=2;}

  // Custom Line Items section
  const customItemRows=[];
  if(d.customItems&&d.customItems.length>0){
    ws.getCell("B"+r).value="Other Charges:";ws.getCell("B"+r).font={name:"Palatino Linotype",size:10,bold:true,underline:true};
    ws.getCell("F"+r).fill=shadeFill;
    r++;
    d.customItems.forEach(it=>{
      ws.getCell("B"+r).value=it.description;ws.getCell("B"+r).font={name:"Palatino Linotype",size:10};
      ws.getCell("F"+r).value=it.amount;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).font={name:"Palatino Linotype",size:10};ws.getCell("F"+r).fill=shadeFill;
      customItemRows.push(r);
      r++;
    });
    r++;
  }

  // Totals section
  r++;
  const subtotalRow=r;
  // Build subtotal formula: sum of all tier F cells + parts + custom items
  const tierFCells=tierRows.filter((_,i)=>i<d.tiers.length).map(tr=>"F"+tr).join("+");
  const customFCells=customItemRows.map(cr=>"F"+cr).join("+");
  ws.getCell("E"+r).value="Subtotal";ws.getCell("E"+r).font={name:"Palatino Linotype",size:10,bold:true};ws.getCell("E"+r).fill=shadeFill;
  ws.getCell("F"+r).value={formula:(tierFCells||"0")+"+F"+partsRow+(customFCells?"+"+customFCells:"")};ws.getCell("F"+r).numFmt=acctFmt;ws.getCell("F"+r).font={name:"Palatino Linotype",size:10,bold:true};ws.getCell("F"+r).fill=shadeFill;
  ["A","B","C","D"].forEach(c=>{ws.getCell(c+r).fill=shadeFill;});
  ws.getCell("E"+r).border={top:thinBorder,bottom:thinBorder};ws.getCell("F"+r).border={top:thinBorder,bottom:thinBorder};
  r++;
  ws.getCell("E"+r).value="Sales Tax";ws.getCell("E"+r).font={name:"Palatino Linotype",size:10,bold:true};ws.getCell("E"+r).fill=shadeFill;
  ws.getCell("F"+r).value=0;ws.getCell("F"+r).numFmt=numFmt;ws.getCell("F"+r).fill=shadeFill;
  ["A","B","C","D"].forEach(c=>{ws.getCell(c+r).fill=shadeFill;});
  r++;
  const totalRow=r;
  ws.mergeCells("A"+r+":F"+r);
  // Unmerge and redo — total needs E and F separate
  ws.unMergeCells("A"+r+":F"+r);
  ws.getCell("E"+r).value="Total";ws.getCell("E"+r).font={name:"Palatino Linotype",size:12,bold:true};ws.getCell("E"+r).fill=shadeFill;
  ws.getCell("F"+r).value={formula:"F"+subtotalRow+"+F"+(subtotalRow+1)};ws.getCell("F"+r).numFmt=acctFmt;ws.getCell("F"+r).font={name:"Palatino Linotype",size:12,bold:true};ws.getCell("F"+r).fill=shadeFill;
  ["A","B","C","D"].forEach(c=>{ws.getCell(c+r).fill=shadeFill;});
  ws.getCell("E"+r).border={top:{style:"medium",color:{argb:"FF000000"}},bottom:{style:"double",color:{argb:"FF000000"}}};
  ws.getCell("F"+r).border={top:{style:"medium",color:{argb:"FF000000"}},bottom:{style:"double",color:{argb:"FF000000"}}};

  // Footer
  r+=2;
  ws.mergeCells("A"+r+":F"+(r+1));
  ws.getCell("A"+r).value="Make all checks payable to 3C Refrigeration, LLC\nThank you for your business!";
  ws.getCell("A"+r).font={name:"Palatino Linotype",size:11,bold:true};ws.getCell("A"+r).alignment={horizontal:"center",wrapText:true};

  const buf=await wb.xlsx.writeBuffer();
  return buf;
}

async function buildInvoicePDF(d){
  const doc=new jsPDF({unit:"mm",format:"letter"});
  const pw=215.9,ph=279.4,lm=18,rm=18,cw=pw-lm-rm;
  const cyan=[0,212,245],cyanDk=[0,160,200],dark=[30,34,40],mid=[100,112,130],light=[245,247,252],white=[255,255,255];
  let y=0;
  const R=(x,y1,w,h,fill)=>{doc.setFillColor(...fill);doc.rect(x,y1,w,h,"F");};
  const L=(y1,c,w)=>{doc.setDrawColor(...c);doc.setLineWidth(w||0.3);doc.line(lm,y1,pw-rm,y1);};
  const txt=(t,x,yy,opts)=>doc.text(String(t||""),x,yy,opts||{});

  // ── Top accent bar ──
  R(0,0,pw,3,cyan);

  // ── Header section ──
  y=12;
  const logo=await fetchLogoBase64();
  if(logo)doc.addImage(logo,"PNG",lm,y,44,16);

  // INVOICE title — large, right-aligned
  doc.setFont("helvetica","bold");doc.setFontSize(28);doc.setTextColor(...dark);
  txt("INVOICE",pw-rm,y+8,{align:"right"});
  // Cyan underline under INVOICE
  doc.setDrawColor(...cyan);doc.setLineWidth(1.2);doc.line(pw-rm-52,y+11,pw-rm,y+11);

  // Invoice details box — right side
  y+=18;
  const boxX=pw-rm-62,boxW=62;
  R(boxX,y,boxW,28,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.5);doc.line(boxX,y,boxX,y+28);
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...mid);
  txt("DATE",boxX+4,y+6);txt("INVOICE #",boxX+4,y+14);txt("CUSTOMER ID",boxX+4,y+22);
  doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(...dark);
  txt(d.date,pw-rm-3,y+6,{align:"right"});txt(d.invoiceNum,pw-rm-3,y+14,{align:"right"});txt(d.customerId||"",pw-rm-3,y+22,{align:"right"});

  // Company info — left side
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...mid);
  const ci=["3065 Gwyn Rd., Elon, N.C. 27244","Phone: 336-264-0935  |  FAX: (877) 278-4608","service@3crefrigeration.com","N.C. License 4923","Vendor Number "+(d.vendorNumber||"126337")];
  ci.forEach((t,i)=>{txt(t,lm,y+5+i*4.2);});
  y+=34;

  // ── Bill To ──
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  const addrLines=[];
  if(d.customerDisplayName)addrLines.push(d.customerDisplayName);
  if(d.customerName&&d.customerName!==d.customerDisplayName)addrLines.push(d.customerName);
  if(d.customerAddress){doc.splitTextToSize(d.customerAddress,cw*0.6-12).forEach(l=>addrLines.push(l));}
  if(d.customerAddress2){doc.splitTextToSize(d.customerAddress2,cw*0.6-12).forEach(l=>addrLines.push(l));}
  const billH=Math.max(24,14+addrLines.length*4.5);
  R(lm,y,cw*0.62,billH,light);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.8);doc.line(lm,y,lm,y+billH);
  doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...cyan);
  txt("BILL TO",lm+5,y+5.5);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
  let by=y+12;
  addrLines.forEach(l=>{txt(l,lm+5,by);by+=4.5;});
  y+=billH+6;

  // ── Order info row ──
  const cols=[{label:"PURCHASE ORDER",val:d.poNumber||"—",w:cw*0.22},{label:"JOB",val:d.jobDesc||"Repairs",w:cw*0.28},{label:"PAYMENT TERMS",val:d.paymentTerms||"Net 30",w:cw*0.28},{label:"DUE DATE",val:d.dueDate||"—",w:cw*0.22}];
  R(lm,y,cw,14,dark);
  let cx=lm;
  doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...cyan);
  cols.forEach(c=>{txt(c.label,cx+4,y+4.5);cx+=c.w;});
  cx=lm;
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...white);
  cols.forEach(c=>{txt(c.val,cx+4,y+10.5);cx+=c.w;});
  y+=18;

  // ── Line items ──
  R(lm,y,cw,7,[0,212,245]);
  doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(...white);
  txt("QTY",lm+4,y+5);txt("DESCRIPTION",lm+24,y+5);txt("RATE",pw-rm-34,y+5);txt("AMOUNT",pw-rm-2,y+5,{align:"right"});
  y+=9;

  // Labor section
  doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
  txt("LABOR",lm+4,y+5);
  doc.setDrawColor(...cyan);doc.setLineWidth(0.3);doc.line(lm+4,y+6.5,lm+22,y+6.5);
  y+=9;

  doc.setFontSize(9.5);
  d.tiers.forEach((t,i)=>{
    const total=(t.hours||0)*(t.rate||0);
    if(i%2===0)R(lm,y-1,cw,8,light);
    doc.setFont("helvetica","normal");doc.setTextColor(...dark);
    txt((t.hours||0).toFixed(2),lm+6,y+4);
    txt(t.name,lm+24,y+4);
    txt("$"+(t.rate||0).toFixed(2),pw-rm-34,y+4);
    doc.setFont("helvetica","bold");
    const totalStr=total>0?"$"+total.toLocaleString("en-US",{minimumFractionDigits:2}):"—";
    txt(totalStr,pw-rm-2,y+4,{align:"right"});
    y+=8;
  });
  y+=2;L(y,[220,225,235],0.2);y+=4;

  // Description / coverage text
  const descText=d.breakdownData?.description||d.description;
  if(descText){
    doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
    txt("WORK PERFORMED",lm+4,y+4);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.3);doc.line(lm+4,y+5.5,lm+40,y+5.5);
    y+=8;
    doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...mid);
    const descLines=doc.splitTextToSize(descText,cw-12);
    descLines.slice(0,15).forEach(line=>{txt(line,lm+6,y+3);y+=4;});
    y+=2;L(y,[220,225,235],0.2);y+=4;
  }

  // PM/CM/EM Breakdown
  if(d.breakdownData){
    const bd=d.breakdownData;
    doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
    txt("BREAKDOWN",lm+4,y+4);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.3);doc.line(lm+4,y+5.5,lm+30,y+5.5);
    y+=9;
    doc.setFontSize(9.5);
    const bItems=[[bd.pm_hours,bd.pm_total,"Preventative maintenance"],[bd.cm_hours,bd.cm_total,"Corrective maintenance"],[bd.em_hours,bd.em_total,"Emergency service"]];
    bItems.forEach((item,i)=>{
      if(item[0]>0){
        if(i%2===0)R(lm,y-1,cw,8,light);
        doc.setFont("helvetica","normal");doc.setTextColor(...dark);
        txt(item[0].toFixed(2),lm+6,y+4);
        doc.setFont("helvetica","bold");txt(item[2],lm+24,y+4);
        txt("$"+item[1].toLocaleString("en-US",{minimumFractionDigits:2}),pw-rm-2,y+4,{align:"right"});
        y+=8;
      }
    });
    y+=2;L(y,[220,225,235],0.2);y+=4;
  }

  // Parts
  if(d.partsTotal>0){
    doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
    txt("PARTS & MATERIALS",lm+4,y+4);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.3);doc.line(lm+4,y+5.5,lm+42,y+5.5);
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...dark);
    txt("$"+(d.partsTotal||0).toFixed(2),pw-rm-2,y+4,{align:"right"});
    y+=8;
    if(d.partsDetail&&d.partsDetail.length>0){
      doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(...mid);
      d.partsDetail.forEach(p=>{txt(p.desc+" — $"+p.amount.toFixed(2),lm+8,y+3);y+=4.5;});
    }
    y+=2;L(y,[220,225,235],0.2);y+=4;
  }

  // Custom Line Items
  if(d.customItems&&d.customItems.length>0){
    doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...cyan);
    txt("OTHER CHARGES",lm+4,y+4);
    doc.setDrawColor(...cyan);doc.setLineWidth(0.3);doc.line(lm+4,y+5.5,lm+36,y+5.5);
    y+=9;
    doc.setFontSize(9.5);
    d.customItems.forEach((it,i)=>{
      if(i%2===0)R(lm,y-1,cw,8,light);
      doc.setFont("helvetica","normal");doc.setTextColor(...dark);
      txt(it.description,lm+24,y+4);
      doc.setFont("helvetica","bold");
      txt("$"+it.amount.toLocaleString("en-US",{minimumFractionDigits:2}),pw-rm-2,y+4,{align:"right"});
      y+=8;
    });
    y+=2;L(y,[220,225,235],0.2);y+=4;
  }

  // ── Totals ──
  y+=4;
  const laborTotal=d.tiers.reduce((s,t)=>s+(t.hours||0)*(t.rate||0),0);
  const subtotal=laborTotal+(d.partsTotal||0)+(d.customItemsTotal||0);
  const tw=70,tx=pw-rm-tw;

  R(tx,y,tw,9,light);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...mid);
  txt("Subtotal",tx+4,y+6);doc.setTextColor(...dark);txt("$ "+subtotal.toLocaleString("en-US",{minimumFractionDigits:2}),pw-rm-4,y+6,{align:"right"});
  y+=10;
  R(tx,y,tw,9,light);
  doc.setTextColor(...mid);txt("Sales Tax",tx+4,y+6);doc.setTextColor(...dark);txt("—",pw-rm-4,y+6,{align:"right"});
  y+=11;
  R(tx,y,tw,12,cyan);
  doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(...white);
  txt("TOTAL",tx+5,y+8.5);txt("$ "+subtotal.toLocaleString("en-US",{minimumFractionDigits:2}),pw-rm-4,y+8.5,{align:"right"});
  y+=22;

  // ── Footer ──
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...dark);
  txt("Make all checks payable to 3C Refrigeration, LLC",pw/2,y,{align:"center"});
  doc.setFont("helvetica","italic");doc.setFontSize(9);doc.setTextColor(...mid);
  txt("Thank you for your business!",pw/2,y+6,{align:"center"});

  // Bottom bar
  R(0,ph-8,pw,8,dark);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(180,190,200);
  txt("3C Refrigeration LLC  |  service@3crefrigeration.com  |  336-264-0935",pw/2,ph-3.5,{align:"center"});

  return doc;
}

async function uploadInvoiceToDrive(fileBase64,fileName,mimeType){
  const now=new Date();
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const folderPath="3C FieldOps/Invoices/"+now.getFullYear()+"/"+monthNames[now.getMonth()];
  try{
    const resp=await fetch(SUPABASE_URL+"/functions/v1/drive-upload",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({fileBase64,fileName,mimeType,folderPath})});
    const result=await resp.json();
    return result.success?result:null;
  }catch(e){console.warn("Drive upload failed:",e);return null;}
}

function InvoiceDashboard({invoices,onUpdateInvoice,onDeleteInvoice,onCreateInvoice,wos,pos,time,users,customers,emailTemplates,currentUser,lineItems,projects}){
  const PAGE_SIZE=50;
  const[view,setView]=useState("tracker"),[toast,setToast]=useState(""),[editingInv,setEditingInv]=useState(null),[visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  useEffect(()=>{setVisibleCount(PAGE_SIZE);},[invoices.length]);
  const today=new Date();
  const daysOut=(d)=>{if(!d)return 0;return Math.floor((today-new Date(d))/86400000);};
  const agingColor=(days)=>days>30?B.red:days>15?B.orange:B.green;
  const outstanding=invoices.filter(i=>i.status==="sent"||i.status==="draft");
  const overdue=invoices.filter(i=>i.status==="sent"&&daysOut(i.date_issued)>30);
  const paidThisMonth=invoices.filter(i=>i.status==="paid"&&i.date_paid&&i.date_paid.slice(0,7)===today.toISOString().slice(0,7));
  const totalOutstanding=outstanding.reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const totalPaidMonth=paidThisMonth.reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const avgDays=invoices.filter(i=>i.status==="paid"&&i.date_paid&&i.date_issued).length>0?Math.round(invoices.filter(i=>i.status==="paid"&&i.date_paid&&i.date_issued).reduce((s,i)=>s+daysOut(i.date_issued)-daysOut(i.date_paid),0)/invoices.filter(i=>i.status==="paid").length):0;

  const markSent=async(inv)=>{await onUpdateInvoice({...inv,status:"sent",date_sent:today.toISOString().slice(0,10)});msg("Invoice "+inv.invoice_num+" marked as sent");
    // Auto-send feedback request
    try{const cust=customers.find(c=>c.name===inv.customer);const toEmail=cust?.feedback_email||cust?.email;
    if(toEmail){const token=crypto.randomUUID();
      await sb().from("feedback_requests").insert({invoice_id:inv.id,invoice_num:inv.invoice_num,customer_name:inv.customer,sent_to:toEmail,token});
      const feedbackUrl=window.location.origin+"/#/feedback/"+token;
      const body="<div style='font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px'><p>Hi,</p><p>Thank you for choosing 3C Refrigeration. We recently completed work on your behalf (Invoice "+inv.invoice_num+") and would love to hear how we did.</p><p style='text-align:center;margin:24px 0'><a href='"+feedbackUrl+"' style='display:inline-block;padding:14px 28px;background:#00D4F5;color:#101214;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px'>Share Your Feedback</a></p><p style='color:#666;font-size:13px'>It only takes 30 seconds and helps us improve our service.</p><p>Best regards,<br/>3C Refrigeration Team</p></div>";
      await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({to:toEmail,subject:"How was our service? — 3C Refrigeration",body})});
    }}catch(e){console.error("Feedback request error:",e);}
  };
  const markPaid=async(inv)=>{await onUpdateInvoice({...inv,status:"paid",date_paid:today.toISOString().slice(0,10)});msg("Invoice "+inv.invoice_num+" marked as paid");};
  const del=async(inv)=>{if(!window.confirm("Delete invoice "+inv.invoice_num+"?"))return;await onDeleteInvoice(inv);msg("Deleted");};
  const rebuildData=(inv)=>{const c=customers.find(x=>x.name===inv.customer);const terms=c?.payment_terms||"Net 30";const netDays=parseInt((terms.match(/\d+/)||[])[0])||30;const issued=inv.date_issued?new Date(inv.date_issued):new Date();const due=new Date(issued);due.setDate(due.getDate()+netDays);const invPOs=pos.filter(p=>inv.wo_ids&&inv.wo_ids.some(wid=>{const wo=wos.find(w=>w.wo_id===wid||w.id===wid);return wo&&p.wo_id===wo.id;})&&p.status==="approved");const mkup=c?.parts_markup!=null?parseFloat(c.parts_markup):35;const partsDetail=invPOs.map(p=>({desc:p.description+(p.po_id?" ("+p.po_id+")":""),amount:Math.round(parseFloat(p.amount||0)*(1+mkup/100)*100)/100}));return{invoiceNum:inv.invoice_num,date:issued.toLocaleDateString(),customerId:c?.customer_id_code||"",customerDisplayName:c?.name||inv.customer,customerName:c?.contact_name||"Accounts Payable",customerAddress:c?.address||"",customerAddress2:"",vendorNumber:c?.vendor_number||"",poNumber:inv.po_number||"",jobDesc:inv.job_desc||"Repairs",paymentTerms:terms,dueDate:due.toLocaleDateString(),tiers:inv.tier_data||[],description:inv.notes||"",partsTotal:parseFloat(inv.parts_total)||0,partsDetail:partsDetail.length>0?partsDetail:null};};
  const regenExcel=async(inv)=>{msg("Generating...");try{const d=rebuildData(inv);const buf=await buildInvoiceExcel(d);const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="INV_"+inv.invoice_num+"_"+(inv.customer||"").replace(/[^a-zA-Z0-9]/g,"_")+".xlsx";a.click();URL.revokeObjectURL(url);msg("Excel downloaded!");}catch(e){msg("Error: "+e.message);}};
  const regenPDF=async(inv)=>{msg("Generating...");try{const d=rebuildData(inv);const doc=await buildInvoicePDF(d);doc.save("INV_"+inv.invoice_num+"_"+(inv.customer||"").replace(/[^a-zA-Z0-9]/g,"_")+".pdf");msg("PDF downloaded!");}catch(e){msg("Error: "+e.message);}};

  const ISC={draft:B.purple,sent:B.cyan,paid:B.green,overdue:B.red};
  const ISL={draft:"Draft",sent:"Sent",paid:"Paid",overdue:"Overdue"};
  const getStatus=(inv)=>inv.status==="sent"&&daysOut(inv.date_issued)>30?"overdue":inv.status;

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <StatCard label="Outstanding" value={"$"+totalOutstanding.toLocaleString(undefined,{minimumFractionDigits:2})} icon="💰" color={B.cyan}/>
      <StatCard label="Overdue (30d+)" value={overdue.length} icon="⚠️" color={B.red}/>
      <StatCard label="Avg Days to Pay" value={avgDays+"d"} icon="📊" color={B.orange}/>
      <StatCard label="Paid This Month" value={"$"+totalPaidMonth.toLocaleString(undefined,{minimumFractionDigits:2})} icon="✓" color={B.green}/>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:16}}>
      <button onClick={()=>setView("tracker")} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+(view==="tracker"?B.cyan:B.border),background:view==="tracker"?B.cyanGlow:"transparent",color:view==="tracker"?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>📋 Invoice Tracker</button>
      <button onClick={()=>setView("create")} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+(view==="create"?B.cyan:B.border),background:view==="create"?B.cyanGlow:"transparent",color:view==="create"?B.cyan:B.textDim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>+ Create Invoice</button>
    </div>
    {view==="tracker"&&<div>
      {invoices.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:24,marginBottom:6}}>📝</div><div style={{fontSize:13}}>No invoices yet. Create one or enable auto-invoicing on a customer.</div></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {invoices.slice(0,visibleCount).map(inv=>{const st=getStatus(inv);const days=daysOut(inv.date_issued);const ac=agingColor(days);return(
          <Card key={inv.id} style={{padding:"14px 16px",borderLeft:"3px solid "+(ISC[st]||B.border)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontFamily:M,fontWeight:800,fontSize:15,color:B.text}}>INV-{inv.invoice_num}</span>
                  <Badge color={ISC[st]||B.textDim}>{ISL[st]||inv.status}</Badge>
                  {st==="sent"&&<span style={{fontFamily:M,fontSize:11,fontWeight:700,color:ac}}>{days}d</span>}
                </div>
                <div style={{fontSize:13,fontWeight:600,color:B.textMuted,marginTop:4}}>{inv.customer}</div>
                <div style={{fontSize:11,color:B.textDim,marginTop:2}}>
                  <span style={{fontFamily:M,fontWeight:700,color:B.text}}>${parseFloat(inv.amount||0).toFixed(2)}</span>
                  {inv.parts_total>0&&<span> (incl. ${parseFloat(inv.parts_total).toFixed(2)} parts)</span>}
                  {" · Issued "+inv.date_issued}
                  {inv.date_sent&&" · Sent "+inv.date_sent}
                  {inv.date_paid&&" · Paid "+inv.date_paid}
                  {inv.wo_ids&&<span> · {inv.wo_ids.length} WO{inv.wo_ids.length!==1?"s":""}</span>}
                </div>
                {inv.job_desc&&<div style={{fontSize:10,color:B.textDim,marginTop:2,fontStyle:"italic"}}>{inv.job_desc}</div>}
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                <button onClick={()=>regenExcel(inv)} style={{...BS,padding:"5px 10px",fontSize:11}} title="Download Excel">📊</button>
                <button onClick={()=>regenPDF(inv)} style={{...BS,padding:"5px 10px",fontSize:11}} title="Download PDF">📄</button>
                {inv.status==="draft"&&<button onClick={()=>markSent(inv)} style={{...BP,padding:"5px 10px",fontSize:11}}>Mark Sent</button>}
                {(inv.status==="sent"||st==="overdue")&&<button onClick={()=>markPaid(inv)} style={{...BP,padding:"5px 10px",fontSize:11,background:B.green}}>Mark Paid</button>}
                <button onClick={()=>del(inv)} style={{...BS,padding:"5px 10px",fontSize:11,color:B.red,borderColor:B.red+"40"}}>✕</button>
              </div>
            </div>
          </Card>);})}
        {visibleCount<invoices.length&&<button onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)} style={{...BS,width:"100%",marginTop:8,textAlign:"center",fontSize:12}}>Show More ({visibleCount} of {invoices.length})</button>}
      </div>
    </div>}
    {view==="create"&&<InvoiceGenerator wos={wos} pos={pos} time={time} users={users} customers={customers} invoices={invoices} onCreateInvoice={onCreateInvoice} emailTemplates={emailTemplates} currentUser={currentUser} lineItems={lineItems} projects={projects}/>}
  </div>);
}

// Helper: classify a WO or time entry into PM/CM/EM category
function classifyWorkType(wo,te){
  if(!wo)return"pm";
  const t=(wo.wo_type||"").toUpperCase();
  const desc=((te?.description||"")+" "+(wo.title||"")+" "+(wo.notes||"")).toLowerCase();
  if(t==="EM"||desc.includes("emergency"))return"em";
  if(t==="CM"||desc.includes("corrective")||desc.includes("repair")||desc.includes("replaced")||desc.includes("faulty"))return"cm";
  return"pm"; // PM, walkthrough, preventative all count as PM
}

// Calculate bi-weekly date range based on a start anchor date
function getBiWeeklyRange(anchorDateStr){
  const anchor=anchorDateStr?new Date(anchorDateStr):new Date("2026-01-05");
  const now=new Date();const ms=now-anchor;const periods=Math.floor(ms/(14*86400000));
  const start=new Date(anchor.getTime()+periods*14*86400000);
  const end=new Date(start.getTime()+13*86400000);
  return{from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}

function InvoiceGenerator({wos,pos,time,users,customers,invoices,onCreateInvoice,emailTemplates,currentUser,lineItems,projects}){
  const[cust,setCust]=useState(""),[mode,setMode]=useState("wo"),[selWO,setSelWO]=useState(""),[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState(""),[invoiceNum,setInvoiceNum]=useState(""),[step,setStep]=useState(1);
  const[tierAssign,setTierAssign]=useState({}),[includeNotes,setIncludeNotes]=useState(true),[includeParts,setIncludeParts]=useState(true),[includeBreakdown,setIncludeBreakdown]=useState(false);
  const[poNum,setPoNum]=useState(""),[jobDesc,setJobDesc]=useState(""),[toast,setToast]=useState(""),[saveToDrive,setSaveToDrive]=useState(true),[generating,setGenerating]=useState(false),[dragIdx,setDragIdx]=useState(null),[dragOver,setDragOver]=useState(null);
  const[showSendModal,setShowSendModal]=useState(false),[lastInvoiceData,setLastInvoiceData]=useState(null);
  const[customItems,setCustomItems]=useState([]);
  const[linkedPOs,setLinkedPOs]=useState([]);
  const addCustomItem=()=>setCustomItems([...customItems,{description:"",amount:0}]);
  const updateCustomItem=(i,k,v)=>{const n=[...customItems];n[i]={...n[i],[k]:k==="description"?v:parseFloat(v)||0};setCustomItems(n);};
  const removeCustomItem=(i)=>setCustomItems(customItems.filter((_,j)=>j!==i));
  const customTotal=customItems.reduce((s,it)=>s+(it.amount||0),0);
  const togglePOLink=(poId)=>setLinkedPOs(prev=>prev.includes(poId)?prev.filter(x=>x!==poId):[...prev,poId]);
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const customer=customers.find(c=>c.name===cust);
  const isDUMC=cust.includes("DUMC")||cust.includes("Duke")||customer?.customer_id_code==="DUMC";
  const custWOs=wos.filter(w=>w.customer===cust&&w.status==="completed");
  // Filter: per-WO mode or date range mode
  const filteredWOs=mode==="wo"?(selWO?custWOs.filter(w=>w.id===selWO):[]): custWOs.filter(w=>{const d=w.date_completed||w.created_at?.slice(0,10);if(!d)return false;if(dateFrom&&d<dateFrom)return false;if(dateTo&&d>dateTo)return false;return true;});
  // Get time entries for filtered WOs
  const filteredTime=time.filter(t=>filteredWOs.some(w=>w.id===t.wo_id));
  // Group hours by technician
  const techHours={};filteredTime.forEach(t=>{if(!techHours[t.technician])techHours[t.technician]=0;techHours[t.technician]+=parseFloat(t.hours||0);});
  // POs for filtered WOs
  const filteredPOs=pos.filter(p=>filteredWOs.some(w=>w.id===p.wo_id)&&p.status==="approved");
  const partsCost=filteredPOs.reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const[markupPct,setMarkupPct]=useState(35);
  useEffect(()=>{if(customer)setMarkupPct(customer.parts_markup!=null?parseFloat(customer.parts_markup):35);},[cust]);
  const partsTotal=Math.round(partsCost*(1+markupPct/100)*100)/100;

  // PM/CM/EM breakdown — calculate hours per category from time entries + WO types
  const breakdown=React.useMemo(()=>{
    const b={pm:{hours:0,wos:0},cm:{hours:0,wos:0},em:{hours:0,wos:0}};
    filteredWOs.forEach(wo=>{
      const woTime=filteredTime.filter(t=>t.wo_id===wo.id);
      const cat=classifyWorkType(wo);
      b[cat].wos++;
      if(woTime.length>0){woTime.forEach(te=>{const teCat=classifyWorkType(wo,te);b[teCat].hours+=parseFloat(te.hours||0);});}
    });
    return b;
  },[filteredWOs,filteredTime]);
  const pmCount=breakdown.pm.wos;const cmCount=breakdown.cm.wos;const emCount=breakdown.em.wos;

  // Default tiers based on customer
  const totalLogged=Object.values(techHours).reduce((s,h)=>s+h,0);
  const buildTiers=(c)=>{let base;if(customer?.labor_tiers&&Array.isArray(customer.labor_tiers)&&customer.labor_tiers.length>0){base=customer.labor_tiers.map(t=>({name:t.name,rate:t.rate,hours:0}));}else{const isDk=c.includes("DUMC")||c.includes("Medical");base=isDk?[{name:"Journeyman Mechanic",rate:60,hours:0},{name:"Senior Technician",rate:75,hours:0},{name:"Licensed Technician",rate:90,hours:0}]:[{name:"Senior Technician",rate:120,hours:0},{name:"Licensed Technician",rate:135,hours:0}];}
    // DUMC auto-split: 50/50 between Journeyman (idx 0) and Licensed Tech (idx 2)
    if((c.includes("DUMC")||c.includes("Duke"))&&base.length>=3){
      const half=Math.round(totalLogged/2*100)/100;
      base[0].hours=half;base[1].hours=0;base[2].hours=Math.round((totalLogged-half)*100)/100;
    }else if(base.length>0){base[0].hours=totalLogged;}
    return base;};
  const[tiers,setTiers]=useState(()=>cust?buildTiers(cust):[{name:"Senior Technician",rate:120,hours:0},{name:"Licensed Technician",rate:135,hours:0}]);
  useEffect(()=>{if(cust)setTiers(buildTiers(cust));},[cust,totalLogged]);

  // DUMC quick-fill: auto-set fields when DUMC is selected
  useEffect(()=>{
    if(!isDUMC||!customer)return;
    const settings=customer.invoice_settings||{};
    setMode("range");
    setIncludeBreakdown(true);
    setJobDesc(settings.default_job_desc||"PMs, Repairs");
    setPoNum(settings.default_po||customer.vendor_number||"");
    // Auto-set bi-weekly date range
    const range=getBiWeeklyRange(settings.bi_weekly_start);
    if(!dateFrom)setDateFrom(range.from);
    if(!dateTo)setDateTo(range.to);
  },[isDUMC,customer]);
  // Auto-generate invoice number
  useEffect(()=>{if(!invoiceNum){(async()=>{const now=new Date();const pfx=String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0");const{data}=await sb().from("invoices").select("invoice_num");const mx=(data||[]).filter(i=>i.invoice_num&&i.invoice_num.startsWith(pfx)).reduce((m,i)=>{const s=parseInt(i.invoice_num.slice(4));return s>m?s:m;},0);setInvoiceNum(pfx+String(mx+1).padStart(2,"0"));})();}},[]);

  const buildInvoiceData=()=>{
    const notes=includeNotes?filteredWOs.map(w=>((w.customer_wo?"["+w.customer_wo+"] ":"")+w.title+" — "+(w.work_performed||w.notes||"")).trim()).filter(Boolean).join("\n"):"";
    const tiersData=tiers.filter(t=>(t.hours||0)>0||tiers.length<=3).map(t=>({name:t.name,rate:t.rate,hours:t.hours||0}));
    const partsDetailData=filteredPOs.map(p=>({desc:p.description+(p.po_id?" ("+p.po_id+")":""),amount:Math.round(parseFloat(p.amount||0)*(1+markupPct/100)*100)/100}));
    const terms=customer?.payment_terms||"Net 30";const netDays=parseInt((terms.match(/\d+/)||[])[0])||30;const due=new Date();due.setDate(due.getDate()+netDays);const dueStr=due.toLocaleDateString();
    // Build breakdown data with dollar amounts based on blended rate
    const totalHrs=tiersData.reduce((s,t)=>s+(t.hours||0),0);
    const laborTotal=tiersData.reduce((s,t)=>s+(t.hours||0)*(t.rate||0),0);
    const blendedRate=totalHrs>0?laborTotal/totalHrs:0;
    const breakdownData=includeBreakdown?{
      pm_hours:breakdown.pm.hours,pm_total:Math.round(breakdown.pm.hours*blendedRate*100)/100,
      cm_hours:breakdown.cm.hours,cm_total:Math.round(breakdown.cm.hours*blendedRate*100)/100,
      em_hours:breakdown.em.hours,em_total:Math.round(breakdown.em.hours*blendedRate*100)/100,
      description:(dateFrom&&dateTo)?dateFrom.replace(/-/g,"/")+' - '+dateTo.replace(/-/g,"/")+' Coverage for repairs and preventive maintenance':'Coverage for repairs and preventive maintenance'
    }:null;
    const customItemsData=customItems.filter(it=>it.description&&it.amount>0).map(it=>({description:it.description,amount:Math.round(it.amount*100)/100}));
    const customItemsTotal=customItemsData.reduce((s,it)=>s+it.amount,0);
    return{invoiceNum,date:new Date().toLocaleDateString(),customerId:customer?.customer_id_code||"",customerDisplayName:customer?.name||cust,customerName:customer?.contact_name||"Accounts Payable",customerAddress:customer?.address||"",customerAddress2:"",vendorNumber:customer?.vendor_number||"",poNumber:poNum,jobDesc:jobDesc||"Repairs",paymentTerms:terms,dueDate:dueStr,tiers:tiersData,description:notes,partsTotal,partsDetail:includeParts?partsDetailData:null,customItems:customItemsData,customItemsTotal,includeNotes,includeBreakdown,pmCount,cmCount,emCount,breakdownData,dateFrom,dateTo,isDUMC,customerEmail:customer?.email||"",ccEmails:customer?.invoice_settings?.email_recipients||[]};
  };
  const safeName=(customer?.name||cust).replace(/[^a-zA-Z0-9]/g,"_");
  const saveInvoiceRecord=async(d)=>{
    if(!onCreateInvoice)return;
    const laborTotal=d.tiers.reduce((s,t)=>s+(t.hours||0)*(t.rate||0),0);
    const record={invoice_num:invoiceNum,customer:customer?.name||cust,customer_contact:d.customerName,amount:laborTotal+(d.partsTotal||0)+(d.customItemsTotal||0),parts_total:d.partsTotal||0,status:"draft",wo_ids:filteredWOs.map(w=>w.wo_id||w.id),tier_data:d.tiers,custom_items:d.customItems||[],job_desc:d.jobDesc,po_number:d.poNumber,notes:d.description||"",date_issued:new Date().toISOString()};
    if(d.breakdownData)record.breakdown_data=d.breakdownData;
    await onCreateInvoice(record);
    filteredWOs.forEach(w=>{sb().from("work_orders").update({invoiced:true}).eq("id",w.id);});
    if(customer)sb().from("customers").update({labor_tiers:tiers.map(t=>({name:t.name,rate:t.rate}))}).eq("id",customer.id);
  };
  const generateXLSX=async()=>{
    if(generating)return;setGenerating(true);
    try{
      const d=buildInvoiceData();const buf=await buildInvoiceExcel(d);
      const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download="INV_"+invoiceNum+"_"+safeName+".xlsx";a.click();URL.revokeObjectURL(url);
      msg("Invoice downloaded!");
      await saveInvoiceRecord(d);setLastInvoiceData(d);
      if(customer&&markupPct!==(customer.parts_markup!=null?parseFloat(customer.parts_markup):35)){sb().from("customers").update({parts_markup:markupPct}).eq("id",customer.id);}
      if(saveToDrive){const b64=btoa(String.fromCharCode(...new Uint8Array(buf)));uploadInvoiceToDrive(b64,"INV_"+invoiceNum+"_"+safeName+".xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").then(r=>{if(r)msg("Saved to Google Drive!");else msg("Drive save failed");});}
    }catch(e){msg("Error: "+e.message);console.error(e);}
    setGenerating(false);
  };
  const generatePDF=async()=>{
    if(generating)return;setGenerating(true);
    try{
      const d=buildInvoiceData();const doc=await buildInvoicePDF(d);
      doc.save("INV_"+invoiceNum+"_"+safeName+".pdf");
      msg("PDF downloaded!");
      await saveInvoiceRecord(d);setLastInvoiceData(d);
      if(customer&&markupPct!==(customer.parts_markup!=null?parseFloat(customer.parts_markup):35)){sb().from("customers").update({parts_markup:markupPct}).eq("id",customer.id);}
      if(saveToDrive){const b64=doc.output("datauristring").split(",")[1];uploadInvoiceToDrive(b64,"INV_"+invoiceNum+"_"+safeName+".pdf","application/pdf").then(r=>{if(r)msg("Saved to Google Drive!");else msg("Drive save failed");});}
    }catch(e){msg("Error: "+e.message);console.error(e);}
    setGenerating(false);
  };
  const generateAndSend=async()=>{
    if(generating)return;setGenerating(true);
    try{
      const d=buildInvoiceData();
      // Generate PDF for attachment
      const doc=await buildInvoicePDF(d);
      const pdfB64=doc.output("datauristring").split(",")[1];
      const pdfName="INV_"+invoiceNum+"_"+safeName+".pdf";
      // Upload to Drive first to get preview link
      let driveFileId=null;
      if(saveToDrive){const r=await uploadInvoiceToDrive(pdfB64,pdfName,"application/pdf");if(r&&r.fileId)driveFileId=r.fileId;else if(r&&r.webViewLink){const m=r.webViewLink.match(/\/d\/([^/]+)/);if(m)driveFileId=m[1];}}
      await saveInvoiceRecord(d);
      setLastInvoiceData({...d,pdfB64,pdfName,driveFileId});
      setShowSendModal(true);
      msg("Invoice ready to send!");
    }catch(e){msg("Error: "+e.message);console.error(e);}
    setGenerating(false);
  };


  return(<div><Toast msg={toast}/>
    <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800,color:B.text}}>Invoice Generator</h3>

    {step===1&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:14}}>Step 1: Select Customer & Work Order</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={LS}>Customer</label><select value={cust} onChange={e=>{setCust(e.target.value);setSelWO("");setTierAssign({});}} style={{...IS,cursor:"pointer"}}><option value="">— Select —</option>{customers.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        {cust&&<div style={{display:"flex",gap:4}}>{[["wo","Per Work Order"],["range","Date Range"],["lineonly","Line Items Only"]].map(([k,l])=><button key={k} onClick={()=>{setMode(k);setSelWO("");}} style={{padding:"5px 12px",borderRadius:4,border:"1px solid "+(mode===k?B.cyan:B.border),background:mode===k?B.cyanGlow:"transparent",color:mode===k?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}</div>}
        {cust&&mode==="wo"&&<div><label style={LS}>Work Order</label><CustomSelect value={selWO} onChange={v=>{setSelWO(v);const w=custWOs.find(x=>x.id===v);if(w){setJobDesc(w.title);setPoNum(w.customer_wo||"");
              // Project WO: auto-fill customer PO from project + line items
              if(w.project_id){
                const proj=(projects||[]).find(p=>p.id===w.project_id);
                if(proj?.customer_po)setPoNum(proj.customer_po);
                if(lineItems){const woLI=(lineItems||[]).filter(li=>li.wo_id===w.id);if(woLI.length>0)setCustomItems(woLI.map(li=>({description:li.description,amount:parseFloat(li.amount||0)})));}
              }
            }}} placeholder="— Select WO —" options={custWOs.filter(w=>{const inv=(invoices||[]).find(i=>i.wo_ids&&i.wo_ids.includes(w.wo_id));return!inv||inv.status!=="paid";}).map(w=>{const inv=(invoices||[]).find(i=>i.wo_ids&&i.wo_ids.includes(w.wo_id));const st=inv?(inv.status==="sent"&&(new Date()-new Date(inv.date_issued))>30*86400000?"overdue":inv.status):null;const tagMap={draft:["Draft",B.purple],sent:["Sent",B.cyan],overdue:["Overdue",B.red]};const t=st&&tagMap[st]?tagMap[st]:null;return{value:w.id,label:w.wo_id+" — "+w.title,sub:w.customer_wo?"#"+w.customer_wo:null,badge:t?t[1]:null,tag:t?t[0]:null,tagColor:t?t[1]:null};})}/></div>}
        {cust&&mode==="range"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>From</label><input value={dateFrom} onChange={e=>setDateFrom(e.target.value)} type="date" style={IS}/></div>
          <div><label style={LS}>To</label><input value={dateTo} onChange={e=>setDateTo(e.target.value)} type="date" style={IS}/></div>
        </div>}
        {cust&&filteredWOs.length>0&&<div style={{padding:12,background:B.bg,borderRadius:6}}>
          <div style={{fontSize:12,color:B.textDim}}>Found <strong style={{color:B.cyan}}>{filteredWOs.length}</strong> completed WO{filteredWOs.length!==1?"s":""} · <strong style={{color:B.cyan}}>{Object.keys(techHours).length}</strong> tech{Object.keys(techHours).length!==1?"s":""} · <strong style={{color:B.cyan}}>{Object.values(techHours).reduce((s,h)=>s+h,0).toFixed(1)}h</strong> total</div>
          {filteredPOs.length>0&&<div style={{fontSize:12,color:B.textDim,marginTop:4}}>{"$"+partsCost.toLocaleString()+" cost → $"+partsTotal.toLocaleString()+" billed ("+markupPct+"% markup)"}</div>}
        </div>}
        {cust&&mode==="lineonly"&&<div style={{padding:12,background:B.bg,borderRadius:6}}>
          <div style={{fontSize:12,color:B.textDim}}>Create an invoice with flat-rate line items only — no work order or time entries required. Ideal for project milestones, mobilization, equipment charges.</div>
        </div>}
        <button onClick={()=>{if(!cust){msg("Select a customer");return;}if(mode==="lineonly"){setStep(2);return;}if(filteredWOs.length===0){msg(mode==="wo"?"Select a work order":"No completed WOs in date range");return;}setStep(2);}} style={{...BP}} disabled={!cust||(mode!=="lineonly"&&filteredWOs.length===0)}>{mode==="lineonly"?"Next: Add Line Items":"Next: Set Labor Rates"}</button>
      </div>
    </Card>}

    {step===2&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:6}}>{mode==="lineonly"?"Step 2: Add Line Items":"Step 2: Set Labor Rates"}</div>
      {mode!=="lineonly"&&<div style={{fontSize:11,color:B.textDim,marginBottom:14}}>Enter hours for each rate tier. Total logged: <strong style={{color:B.cyan}}>{Object.values(techHours).reduce((s,h)=>s+h,0).toFixed(1)}h</strong> by {Object.keys(techHours).join(", ")||"—"}</div>}
      {mode!=="lineonly"&&<div style={{marginBottom:14}}>
        {tiers.map((t,i)=><div key={i} draggable onDragStart={()=>setDragIdx(i)} onDragOver={e=>{e.preventDefault();setDragOver(i);}} onDragEnd={()=>{setDragIdx(null);setDragOver(null);}} onDrop={e=>{e.preventDefault();if(dragIdx===null||dragIdx===i)return;const n=[...tiers];const[moved]=n.splice(dragIdx,1);n.splice(i,0,moved);setTiers(n);setDragIdx(null);setDragOver(null);}} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",padding:"8px 12px",background:B.bg,borderRadius:6,border:"1px solid "+(dragOver===i?B.cyan:B.border),opacity:dragIdx===i?0.4:1,transition:"border-color .15s,opacity .15s",cursor:"grab"}}>
          <span style={{color:B.textDim,fontSize:14,cursor:"grab",userSelect:"none",flexShrink:0}}>⠿</span>
          <input value={t.name} onChange={e=>{const n=[...tiers];n[i]={...n[i],name:e.target.value};setTiers(n);}} style={{...IS,flex:1,padding:"6px 10px",fontSize:12}} placeholder="Tier name"/>
          <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:11,color:B.textDim}}>$</span><input value={t.rate} onChange={e=>{const n=[...tiers];n[i]={...n[i],rate:parseFloat(e.target.value)||0};setTiers(n);}} type="number" style={{...IS,width:60,padding:"6px 8px",fontSize:12,fontFamily:M}} placeholder="0"/><span style={{fontSize:11,color:B.textDim}}>/hr</span></div>
          <div style={{display:"flex",alignItems:"center",gap:2}}><input value={t.hours||""} onChange={e=>{const n=[...tiers];n[i]={...n[i],hours:parseFloat(e.target.value)||0};setTiers(n);}} type="number" step="0.25" style={{...IS,width:60,padding:"6px 8px",fontSize:12,fontFamily:M}} placeholder="0"/><span style={{fontSize:11,color:B.textDim}}>hrs</span></div>
          <span style={{fontFamily:M,fontSize:12,color:B.green,minWidth:60,textAlign:"right"}}>${((t.rate||0)*(t.hours||0)).toFixed(0)}</span>
          {tiers.length>1&&<button onClick={()=>setTiers(tiers.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:14}}>×</button>}
        </div>)}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setTiers([...tiers,{name:"Technician",rate:100,hours:0}])} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",fontFamily:F}}>+ Add Tier</button>
          <span style={{color:B.border}}>|</span>
          <button onClick={()=>{const active=tiers.filter(t=>t.rate>0);if(active.length<2){msg("Need at least 2 tiers to split");return;}const per=Math.round(totalLogged/active.length*100)/100;const remainder=Math.round((totalLogged-per*(active.length-1))*100)/100;setTiers(tiers.map((t,i)=>{if(t.rate<=0)return{...t,hours:0};const isLast=i===tiers.map((tt,ii)=>tt.rate>0?ii:-1).filter(x=>x>=0).pop();return{...t,hours:isLast===i?remainder:per};}));}} style={{background:"none",border:"none",color:B.orange,fontSize:11,cursor:"pointer",fontFamily:F}}>Split evenly</button>
          <button onClick={()=>{setTiers(tiers.map(t=>({...t,hours:0})));}} style={{background:"none",border:"none",color:B.textDim,fontSize:11,cursor:"pointer",fontFamily:F}}>Clear all</button>
        </div>
      </div>}
      {/* Custom Line Items — flat rate charges */}
      <div style={{marginTop:mode==="lineonly"?0:16,paddingTop:mode==="lineonly"?0:14,borderTop:mode==="lineonly"?"none":"1px solid "+B.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:B.text}}>Custom Line Items</span>
          <button onClick={addCustomItem} style={{background:"none",border:"none",color:B.cyan,fontSize:11,cursor:"pointer",fontFamily:F}}>+ Add Line Item</button>
        </div>
        <div style={{fontSize:10,color:B.textDim,marginBottom:8}}>Flat-rate charges: mobilization, equipment rental, permits, etc.</div>
        {customItems.map((it,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center",padding:"6px 10px",background:B.bg,borderRadius:6,border:"1px solid "+B.border}}>
          <input value={it.description} onChange={e=>updateCustomItem(i,"description",e.target.value)} style={{...IS,flex:1,padding:"6px 10px",fontSize:12}} placeholder="e.g. Mobilization"/>
          <div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:11,color:B.textDim}}>$</span><input value={it.amount||""} onChange={e=>updateCustomItem(i,"amount",e.target.value)} type="number" step="0.01" style={{...IS,width:80,padding:"6px 8px",fontSize:12,fontFamily:M}} placeholder="0.00"/></div>
          <button onClick={()=>removeCustomItem(i)} style={{background:"none",border:"none",color:B.red+"66",cursor:"pointer",fontSize:14}}>×</button>
        </div>)}
        {customTotal>0&&<div style={{textAlign:"right",fontSize:12,fontFamily:M,color:B.purple,fontWeight:700}}>Line Items: ${customTotal.toFixed(2)}</div>}
      </div>

      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={()=>setStep(1)} style={{...BS,flex:1}}>Back</button>
        <button onClick={()=>{if(mode==="lineonly"){if(customItems.filter(it=>it.description&&it.amount>0).length===0){msg("Add at least one line item");return;}}else if(tiers.every(t=>!t.hours)&&customItems.length===0){msg("Enter hours or add a line item");return;}setStep(3);}} style={{...BP,flex:1}}>Next: Options</button>
      </div>
    </Card>}

    {step===3&&<Card style={{padding:18,maxWidth:600}}>
      <div style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:14}}>Step 3: Invoice Details</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={LS}>Invoice # (YYMM##)</label><input value={invoiceNum} onChange={e=>setInvoiceNum(e.target.value)} placeholder="250301" style={{...IS,fontFamily:M}}/></div>
          <div><label style={LS}>PO Number</label><input value={poNum} onChange={e=>setPoNum(e.target.value)} placeholder="e.g. 4605021670" style={{...IS,fontFamily:M}}/></div>
        </div>
        {/* Project customer POs — quick apply */}
        {(()=>{const custProjects=(projects||[]).filter(p=>p.customer===cust&&p.customer_po);
          return custProjects.length>0?<div>
            <div style={{fontSize:11,color:B.textDim,marginBottom:4}}>Customer PO# from projects:</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {custProjects.map(p=>{const active=poNum===p.customer_po;return<button key={p.id} onClick={()=>setPoNum(p.customer_po)} style={{padding:"5px 12px",borderRadius:4,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:M,border:"1px solid "+(active?B.green:B.border),background:active?B.green+"18":"transparent",color:active?B.green:B.textDim}}>
                {active?"✓ ":""}{p.customer_po} <span style={{fontFamily:F,fontWeight:400,color:B.textDim,fontSize:9}}>({p.name})</span>
              </button>;})}
            </div>
          </div>:null;
        })()}
        {/* Link POs from system */}
        {filteredPOs.length>0&&<div>
          <div style={{fontSize:11,color:B.textDim,marginBottom:4}}>Link POs from system:</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {filteredPOs.map(p=>{const isLinked=linkedPOs.includes(p.id);return<button key={p.id} onClick={()=>{
              togglePOLink(p.id);
              const pid=p.po_id||p.id.slice(0,8);
              if(!isLinked){setPoNum(prev=>prev?(prev.includes(pid)?prev:prev+", "+pid):pid);}
              else{setPoNum(prev=>{const parts=prev.split(",").map(s=>s.trim()).filter(s=>s&&s!==pid);return parts.join(", ");});}
            }} style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F,border:"1px solid "+(isLinked?B.green:B.border),background:isLinked?B.green+"18":"transparent",color:isLinked?B.green:B.textDim}}>
              {isLinked?"✓ ":""}{p.po_id||"PO"} — ${parseFloat(p.amount||0).toFixed(0)} — {(p.description||"").slice(0,30)}
            </button>;})}
          </div>
        </div>}
        <div><label style={LS}>Job Description</label><input value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder="Repairs, PMs, etc." style={IS}/></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeNotes(!includeNotes)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeNotes?B.cyan:B.border),background:includeNotes?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeNotes&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include completion notes / work descriptions</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeParts(!includeParts)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeParts?B.cyan:B.border),background:includeParts?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeParts&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include parts / materials ({"$"+partsTotal.toLocaleString()})</span>
          </label>
          {includeParts&&partsCost>0&&<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:28}}>
            <span style={{fontSize:11,color:B.textDim}}>Markup:</span>
            <input value={markupPct} onChange={e=>setMarkupPct(parseFloat(e.target.value)||0)} type="number" step="5" style={{...IS,width:65,padding:"4px 8px",fontSize:12,fontFamily:M,textAlign:"center"}}/>
            <span style={{fontSize:11,color:B.textDim}}>%</span>
            <span style={{fontSize:10,color:B.textDim}}>{"($"+partsCost.toLocaleString()+" cost → $"+partsTotal.toLocaleString()+" billed)"}</span>
          </div>}
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setIncludeBreakdown(!includeBreakdown)}>
            <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(includeBreakdown?B.cyan:B.border),background:includeBreakdown?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{includeBreakdown&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
            <span style={{fontSize:12,color:B.text}}>Include PM/CM/EM breakdown ({breakdown.pm.hours.toFixed(1)}h PM, {breakdown.cm.hours.toFixed(1)}h CM, {breakdown.em.hours.toFixed(1)}h EM)</span>
          </label>
        </div>
        {/* Preview */}
        <div style={{background:B.bg,borderRadius:8,padding:14,marginTop:4}}>
          <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:8}}>PREVIEW</div>
          {tiers.filter(t=>(t.hours||0)>0).map(t=><div key={t.name} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.text,padding:"3px 0"}}><span>{t.name}: {(t.hours||0).toFixed(1)}h × ${t.rate}</span><span style={{fontFamily:M}}>${((t.hours||0)*t.rate).toFixed(2)}</span></div>)}
          {includeParts&&partsTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.text,padding:"3px 0"}}><span>Parts / Materials</span><span style={{fontFamily:M}}>{"$"+partsTotal.toFixed(2)}</span></div>}
          {customItems.filter(it=>it.description&&it.amount>0).map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.purple,padding:"3px 0"}}><span>{it.description}</span><span style={{fontFamily:M}}>${it.amount.toFixed(2)}</span></div>)}
          <div style={{borderTop:"1px solid "+B.border,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,color:B.green}}><span>Total</span><span style={{fontFamily:M}}>{"$"+(tiers.reduce((s,t)=>s+(t.rate||0)*(t.hours||0),0)+(includeParts?partsTotal:0)+customTotal).toFixed(2)}</span></div>
          {includeBreakdown&&<div style={{borderTop:"1px solid "+B.border,marginTop:6,paddingTop:6}}>
            <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:4}}>BREAKDOWN</div>
            {breakdown.pm.hours>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.text,padding:"2px 0"}}><span>Preventative maintenance — {breakdown.pm.hours.toFixed(2)}h</span></div>}
            {breakdown.cm.hours>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.text,padding:"2px 0"}}><span>Corrective maintenance — {breakdown.cm.hours.toFixed(2)}h</span></div>}
            {breakdown.em.hours>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:B.text,padding:"2px 0"}}><span>Emergency service — {breakdown.em.hours.toFixed(2)}h</span></div>}
          </div>}
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setSaveToDrive(!saveToDrive)}>
          <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(saveToDrive?B.green:B.border),background:saveToDrive?B.green:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{saveToDrive&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
          <span style={{fontSize:12,color:B.text}}>Auto-save to Google Drive</span>
        </label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setStep(2)} style={{...BS,flex:1}}>Back</button>
          <button onClick={generateXLSX} disabled={generating} style={{...BP,flex:1,opacity:generating?.6:1}}>{generating?"Generating...":"📊 Excel"}</button>
          <button onClick={generatePDF} disabled={generating} style={{...BP,flex:1,background:B.purple,opacity:generating?.6:1}}>{generating?"Generating...":"📄 PDF"}</button>
        </div>
        <button onClick={generateAndSend} disabled={generating} style={{...BP,width:"100%",background:"linear-gradient(135deg,#00D4F5,#7C3AED)",marginTop:4,opacity:generating?.6:1}}>{generating?"Generating...":"📧 Generate & Send Invoice"}</button>
      </div>
    </Card>}
    {showSendModal&&lastInvoiceData&&<SendInvoiceModal data={lastInvoiceData} onClose={()=>setShowSendModal(false)} msg={msg} emailTemplates={emailTemplates} currentUser={currentUser}/>}
  </div>);
}

// ── Email variation templates for natural-sounding invoices ──
const EMAIL_VARIANTS=[
  {greeting:"Good morning, I hope everyone had a good weekend!",closing:"Please feel free to contact me with any questions or concerns."},
  {greeting:"Hi team, hope you're having a great start to the week!",closing:"Don't hesitate to reach out if you have any questions."},
  {greeting:"Good morning! Hope all is well.",closing:"Please let me know if you need anything else or have questions."},
  {greeting:"Hello everyone, I hope you're doing well!",closing:"As always, feel free to reach out with any questions or concerns."},
  {greeting:"Good morning, hope you had a great week!",closing:"Let me know if you have any questions about the attached invoice."},
];

function buildInvoiceEmailHTML(d,variant,driveLink){
  const LOGO="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
  const laborTotal=d.tiers.reduce((s,t)=>s+(t.hours||0)*(t.rate||0),0);
  const total=laborTotal+(d.partsTotal||0);
  const dateRange=d.dateFrom&&d.dateTo?(d.dateFrom.replace(/-/g,"/")+" - "+d.dateTo.replace(/-/g,"/")):"";

  let tiersHTML=d.tiers.filter(t=>(t.hours||0)>0).map(t=>`<tr><td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;">${(t.hours||0).toFixed(2)}</td><td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;">${t.name}</td><td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;text-align:right;">$${(t.rate||0).toFixed(2)}</td><td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;text-align:right;font-weight:bold;">$${((t.hours||0)*(t.rate||0)).toFixed(2)}</td></tr>`).join("");

  let breakdownHTML="";
  if(d.breakdownData){
    const bd=d.breakdownData;
    breakdownHTML=`<table style="border-collapse:collapse;width:100%;margin:12px 0;"><tr style="background:#f0f7ff;"><td colspan="2" style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;font-size:12px;color:#333;">Breakdown:</td></tr>`+
    (bd.pm_hours>0?`<tr><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;">Preventative maintenance</td><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;">${bd.pm_hours.toFixed(2)}h — $${bd.pm_total.toFixed(2)}</td></tr>`:"")+
    (bd.cm_hours>0?`<tr><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;">Corrective maintenance</td><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;">${bd.cm_hours.toFixed(2)}h — $${bd.cm_total.toFixed(2)}</td></tr>`:"")+
    (bd.em_hours>0?`<tr><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;">Emergency service</td><td style="padding:6px 12px;border:1px solid #ddd;font-size:12px;text-align:right;font-weight:bold;">${bd.em_hours.toFixed(2)}h — $${bd.em_total.toFixed(2)}</td></tr>`:"")+
    `</table>`;
  }

  const viewBtn=driveLink?`<div style="text-align:center;margin:20px 0;"><a href="${driveLink}" style="display:inline-block;padding:14px 32px;background:#00D4F5;color:#101214;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Full Invoice</a></div>`:"";

  return `<div style="font-family:Calibri,Arial,sans-serif;max-width:640px;margin:0 auto;color:#333;">
<div style="text-align:center;padding:16px 0;border-bottom:3px solid #00D4F5;">
  <img src="${LOGO}" alt="3C Refrigeration" style="width:160px;height:auto;"/>
</div>
<div style="padding:20px;">
  <p style="font-size:14px;line-height:1.6;">${variant.greeting}</p>
  <p style="font-size:14px;line-height:1.6;">Below I've attached the invoice for work completed through the following dates ${dateRange}.</p>

  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr style="background:#00D4F5;color:#fff;">
      <td style="padding:10px 12px;font-weight:bold;font-size:12px;border:1px solid #00B7E8;">Invoice #</td>
      <td style="padding:10px 12px;font-weight:bold;font-size:12px;border:1px solid #00B7E8;">Date</td>
      <td style="padding:10px 12px;font-weight:bold;font-size:12px;border:1px solid #00B7E8;">Due Date</td>
      <td style="padding:10px 12px;font-weight:bold;font-size:12px;border:1px solid #00B7E8;text-align:right;">Amount</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;border:1px solid #ddd;font-size:14px;font-weight:bold;">${d.invoiceNum}</td>
      <td style="padding:10px 12px;border:1px solid #ddd;font-size:13px;">${d.date}</td>
      <td style="padding:10px 12px;border:1px solid #ddd;font-size:13px;">${d.dueDate}</td>
      <td style="padding:10px 12px;border:1px solid #ddd;font-size:16px;font-weight:bold;text-align:right;color:#00B050;">$${total.toFixed(2)}</td>
    </tr>
  </table>

  <table style="border-collapse:collapse;width:100%;margin:12px 0;">
    <tr style="background:#f5f7fc;">
      <th style="padding:8px 12px;border:1px solid #ddd;font-size:11px;text-align:left;color:#666;">QTY</th>
      <th style="padding:8px 12px;border:1px solid #ddd;font-size:11px;text-align:left;color:#666;">DESCRIPTION</th>
      <th style="padding:8px 12px;border:1px solid #ddd;font-size:11px;text-align:right;color:#666;">RATE</th>
      <th style="padding:8px 12px;border:1px solid #ddd;font-size:11px;text-align:right;color:#666;">AMOUNT</th>
    </tr>
    ${tiersHTML}
    <tr style="background:#f0f7ff;">
      <td colspan="3" style="padding:10px 12px;border:1px solid #ddd;font-weight:bold;text-align:right;font-size:14px;">Total</td>
      <td style="padding:10px 12px;border:1px solid #ddd;font-weight:bold;text-align:right;font-size:16px;color:#00B050;">$${total.toFixed(2)}</td>
    </tr>
  </table>

  ${breakdownHTML}
  ${viewBtn}

  <p style="font-size:14px;line-height:1.6;">${variant.closing}</p>
  <p style="font-size:14px;line-height:1.6;">Thank you.</p>
</div>
<div style="border-top:2px solid #eee;padding:16px 20px;font-size:11px;color:#999;text-align:center;">
  3C Refrigeration LLC &nbsp;|&nbsp; 336-264-0935 &nbsp;|&nbsp; service@3crefrigeration.com
</div>
</div>`;
}

function SendInvoiceModal({data,onClose,msg,emailTemplates,currentUser}){
  const d=data;
  const[emailTo,setEmailTo]=useState(d.customerEmail||""),[emailCC,setEmailCC]=useState((d.ccEmails||[]).join(", "));
  const dateRange=d.dateFrom&&d.dateTo?(d.dateFrom.replace(/-/g,"/").replace(/^20/,"")+" - "+d.dateTo.replace(/-/g,"/").replace(/^20/,"")):"";
  const defaultSubject=d.invoiceNum+" "+(d.customerDisplayName||"")+" PM & Repairs Invoice "+dateRange;
  const[subject,setSubject]=useState(defaultSubject);
  const[variantIdx,setVariantIdx]=useState(()=>Math.floor(Math.random()*EMAIL_VARIANTS.length));
  const[customBody,setCustomBody]=useState("");
  const[useCustom,setUseCustom]=useState(false);
  const[scheduleEnabled,setScheduleEnabled]=useState(true);
  // Random time between 5:30 AM and 7:00 AM tomorrow
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const randHr=5+Math.floor(Math.random()*2);const randMin=randHr===5?30+Math.floor(Math.random()*30):Math.floor(Math.random()*60);
  const[scheduleDate,setScheduleDate]=useState(tomorrow.toISOString().slice(0,10));
  const[scheduleTime,setScheduleTime]=useState(String(randHr).padStart(2,"0")+":"+String(randMin).padStart(2,"0"));
  const[sending,setSending]=useState(false);
  const[contacts,setContacts]=useState([]);
  useEffect(()=>{sb().from("email_contacts").select("*").order("last_used",{ascending:false}).then(({data:c})=>{if(c)setContacts(c);});},[]);

  const variant=EMAIL_VARIANTS[variantIdx];
  const driveLink=d.driveFileId?"https://drive.google.com/file/d/"+d.driveFileId+"/preview":null;
  const emailHTML=useCustom?customBody:buildInvoiceEmailHTML(d,variant,driveLink);

  const saveContact=async(email)=>{if(!email)return;const existing=contacts.find(c=>c.email.toLowerCase()===email.toLowerCase());if(existing){await sb().from("email_contacts").update({last_used:new Date().toISOString()}).eq("id",existing.id);}else{await sb().from("email_contacts").insert({email:email.toLowerCase()});}};

  const send=async()=>{
    if(!emailTo.trim()||sending)return;setSending(true);
    try{
      // Build signature
      const u=currentUser||{};
      const sigHTML='<div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;font-family:Calibri,sans-serif;font-size:13px;color:#333;"><strong>'+(u.name||"Alex Clapp")+'</strong><br/>Manager<br/>(336) 264-0935<br/><img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C Refrigeration" style="width:120px;height:auto;margin-top:6px;display:block;"/></div>';
      const fullBody='<div style="font-family:Calibri,sans-serif;">'+emailHTML+sigHTML+'</div>';

      // Save contacts
      emailTo.split(",").map(e=>e.trim()).filter(Boolean).forEach(em=>saveContact(em));
      if(emailCC)emailCC.split(",").map(e=>e.trim()).filter(Boolean).forEach(em=>saveContact(em));

      if(scheduleEnabled){
        // Save to scheduled_emails table
        const sendAt=new Date(scheduleDate+"T"+scheduleTime+":00");
        await sb().from("scheduled_emails").insert({
          to_emails:emailTo.trim(),cc_emails:emailCC.trim()||null,subject,body:fullBody,
          attachment_name:d.pdfName||null,attachment_base64:d.pdfB64||null,
          drive_file_id:d.driveFileId||null,send_at:sendAt.toISOString(),status:"pending"
        });
        msg("Invoice scheduled for "+sendAt.toLocaleString()+"!");
      }else{
        // Send immediately
        const payload={to:emailTo.trim(),cc:emailCC.trim()||undefined,subject,body:fullBody};
        if(d.pdfB64&&d.pdfName)payload.attachment={name:d.pdfName,content:d.pdfB64,type:"application/pdf"};
        const resp=await fetch(SUPABASE_URL+"/functions/v1/send-email",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify(payload)});
        const result=await resp.json();
        if(result.success)msg("Invoice sent!");else msg("Error: "+(result.error||"Failed"));
      }
      onClose();
    }catch(e){msg("Error: "+e.message);console.error(e);}
    setSending(false);
  };

  return(<Modal title="Send Invoice Email" onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:B.bg,borderRadius:6,padding:10,border:"1px solid "+B.border,fontSize:12,color:B.textMuted}}>
        Sending invoice <strong style={{color:B.cyan}}>#{d.invoiceNum}</strong> to <strong>{d.customerDisplayName}</strong> with PDF attachment from <span style={{color:B.cyan}}>service@3crefrigeration.com</span>
      </div>

      <div><label style={LS}>To <span style={{color:B.red}}>*</span></label><input value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="customer@example.com" style={{...IS,fontSize:14,padding:12}}/></div>
      <div><label style={LS}>CC <span style={{color:B.textDim,fontWeight:400}}>(optional)</span></label><input value={emailCC} onChange={e=>setEmailCC(e.target.value)} placeholder="boss@example.com" style={{...IS,fontSize:14,padding:12}}/></div>
      <div><label style={LS}>Subject</label><input value={subject} onChange={e=>setSubject(e.target.value)} style={{...IS,fontSize:14,padding:12}}/></div>

      {/* Email style picker */}
      <div>
        <label style={LS}>Email Style</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {EMAIL_VARIANTS.map((v,i)=><button key={i} onClick={()=>{setVariantIdx(i);setUseCustom(false);}} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(variantIdx===i&&!useCustom?B.cyan:B.border),background:variantIdx===i&&!useCustom?B.cyanGlow:"transparent",color:variantIdx===i&&!useCustom?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Style {i+1}</button>)}
          <button onClick={()=>setUseCustom(true)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(useCustom?B.cyan:B.border),background:useCustom?B.cyanGlow:"transparent",color:useCustom?B.cyan:B.textDim,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Custom</button>
        </div>
      </div>

      {/* Preview or custom editor */}
      {useCustom?<div><label style={LS}>Custom Email Body (HTML)</label><textarea value={customBody} onChange={e=>setCustomBody(e.target.value)} rows={6} style={{...IS,resize:"vertical",fontSize:11,fontFamily:M}}/></div>
      :<div style={{background:"#fff",borderRadius:8,padding:16,border:"1px solid "+B.border,maxHeight:300,overflowY:"auto"}}>
        <div style={{fontSize:10,fontWeight:700,color:B.textDim,marginBottom:8}}>EMAIL PREVIEW</div>
        <div style={{fontSize:13,color:"#333",lineHeight:1.6}}>
          <p>{variant.greeting}</p>
          <p>Below I've attached the invoice for work completed through the following dates {dateRange}.</p>
          <div style={{background:"#f5f7fc",borderRadius:6,padding:12,margin:"8px 0",fontSize:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontWeight:700}}>Invoice #{d.invoiceNum}</span><span style={{fontWeight:700,color:"#00B050"}}>${(d.tiers.reduce((s,t)=>s+(t.hours||0)*(t.rate||0),0)+(d.partsTotal||0)).toFixed(2)}</span></div>
            {d.tiers.filter(t=>(t.hours||0)>0).map(t=><div key={t.name} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#555"}}><span>{(t.hours||0).toFixed(2)}h {t.name} @ ${t.rate}</span><span>${((t.hours||0)*(t.rate||0)).toFixed(2)}</span></div>)}
            {d.breakdownData&&<div style={{borderTop:"1px solid #ddd",marginTop:6,paddingTop:6,fontSize:11,color:"#555"}}>
              {d.breakdownData.pm_hours>0&&<div>PM: {d.breakdownData.pm_hours.toFixed(2)}h — ${d.breakdownData.pm_total.toFixed(2)}</div>}
              {d.breakdownData.cm_hours>0&&<div>CM: {d.breakdownData.cm_hours.toFixed(2)}h — ${d.breakdownData.cm_total.toFixed(2)}</div>}
              {d.breakdownData.em_hours>0&&<div>EM: {d.breakdownData.em_hours.toFixed(2)}h — ${d.breakdownData.em_total.toFixed(2)}</div>}
            </div>}
          </div>
          <p>{variant.closing}</p>
          <p>Thank you.</p>
        </div>
      </div>}

      {/* Schedule send */}
      <div style={{background:B.bg,borderRadius:8,padding:14,border:"1px solid "+B.border}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:scheduleEnabled?10:0}} onClick={()=>setScheduleEnabled(!scheduleEnabled)}>
          <span style={{width:20,height:20,borderRadius:4,border:"2px solid "+(scheduleEnabled?B.cyan:B.border),background:scheduleEnabled?B.cyan:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{scheduleEnabled&&<span style={{color:B.bg,fontSize:12}}>✓</span>}</span>
          <span style={{fontSize:12,color:B.text,fontWeight:600}}>Schedule send (randomized morning delivery)</span>
        </label>
        {scheduleEnabled&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={LS}>Date</label><input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={IS}/></div>
          <div><label style={LS}>Time</label><input type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} style={IS}/></div>
          <div style={{gridColumn:"1/-1",fontSize:10,color:B.textDim}}>Default: random time between 5:30-7:00 AM tomorrow. Adjust as needed.</div>
        </div>}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{...BS,flex:1}}>Cancel</button>
        <button onClick={send} disabled={sending||!emailTo.trim()} style={{...BP,flex:1,background:"linear-gradient(135deg,#00D4F5,#7C3AED)",opacity:sending?.6:1}}>{sending?"Sending...":(scheduleEnabled?"📅 Schedule Send":"📧 Send Now")}</button>
      </div>
    </div>
  </Modal>);
}

export { InvoiceDashboard, InvoiceGenerator, buildInvoiceExcel, buildInvoicePDF, uploadInvoiceToDrive };
