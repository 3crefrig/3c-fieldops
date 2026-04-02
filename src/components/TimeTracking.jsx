import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, B, F, M, IS, LS, BP, BS, calcWOHours } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner, SkeletonLoader, EmptyState, CustomSelect } from "./ui";

function TimeLog({timeEntries,wos}){const tot=timeEntries.reduce((s,e)=>s+parseFloat(e.hours||0),0);return(<div><div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}><StatCard label="Total" value={tot.toFixed(1)+"h"} icon="⏱" color={B.cyan}/><StatCard label="Entries" value={timeEntries.length} icon="📝" color={B.green}/></div>{timeEntries.length===0&&<div style={{textAlign:"center",padding:40,color:B.textDim}}>No entries yet</div>}{timeEntries.map((e,i)=>{const wo=wos.find(o=>o.id===e.wo_id);return <Card key={i} style={{padding:"10px 14px",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:M,fontSize:11,color:B.textDim,minWidth:70}}>{e.logged_date}</span><span style={{fontFamily:M,fontSize:13,fontWeight:700,color:B.cyan,minWidth:35}}>{e.hours}h</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description}</div>{wo&&<div style={{fontSize:10,color:B.textDim}}>{wo.wo_id} — {wo.title}</div>}</div></div></Card>;})}</div>);}

export { TimeLog };
