import React, { useState, useEffect, useRef } from "react";
import { sb, B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, Modal, Toast, Spinner } from "./ui";

const WF_TRIGGERS=[{key:"wo_created",label:"Work Order Created",icon:"📋",fields:["customer","priority","wo_type","assignee"]},{key:"wo_completed",label:"WO Completed",icon:"✅",fields:["customer","priority","wo_type","assignee"]},{key:"wo_status_changed",label:"WO Status Changed",icon:"🔄",fields:["customer","priority","status","assignee"]},{key:"wo_overdue",label:"WO Overdue (48h+)",icon:"🚨",fields:["customer","priority","assignee","wo_id","title"]},{key:"invoice_sent",label:"Invoice Sent",icon:"📧",fields:["customer","amount","status"]},{key:"invoice_overdue",label:"Invoice Overdue (30d)",icon:"⚠️",fields:["customer","amount"]},{key:"po_requested",label:"PO Requested",icon:"📄",fields:["amount","customer"]},{key:"po_approved",label:"PO Approved",icon:"✅",fields:["amount","customer"]},{key:"feedback_received",label:"Feedback Received",icon:"⭐",fields:["customer_name","star_rating","nps_score"]},{key:"customer_created",label:"Customer Created",icon:"🏢",fields:["name","email"]},{key:"warranty_expiring",label:"Warranty Expiring (30d)",icon:"🛡",fields:["model","serial_number","customer_name","warranty_expiration"]}];
const WF_ACTIONS=[{key:"send_email",label:"Send Email",icon:"📧",fields:["to_email","subject","body"]},{key:"create_notification",label:"Create Notification",icon:"🔔",fields:["title","message","for_role"]},{key:"change_wo_status",label:"Change WO Status",icon:"🔄",fields:["new_status"]},{key:"send_feedback_request",label:"Send Feedback Request",icon:"⭐",fields:[]},{key:"log_activity",label:"Log Activity",icon:"📝",fields:["message"]},{key:"wait",label:"Wait / Delay",icon:"⏳",fields:["delay_hours"]}];
const WF_OPERATORS=[{key:"equals",label:"="},{key:"not_equals",label:"!="},{key:">",label:">"},{key:"<",label:"<"},{key:">=",label:">="},{key:"<=",label:"<="},{key:"contains",label:"contains"}];

function WorkflowBuilder({D,userName}){
  const[workflows,setWorkflows]=useState([]);const[loading,setLoading]=useState(true);const[toast,setToast]=useState("");
  const[editing,setEditing]=useState(null);const[runs,setRuns]=useState([]);const[view,setView]=useState("list");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const load=async()=>{const[{data:wf},{data:wr}]=await Promise.all([sb().from("workflows").select("*").order("created_at",{ascending:false}),sb().from("workflow_runs").select("*").order("started_at",{ascending:false}).limit(50)]);setWorkflows(wf||[]);setRuns(wr||[]);setLoading(false);};
  useEffect(()=>{load();},[]);

  const toggleActive=async(wf)=>{await sb().from("workflows").update({active:!wf.active}).eq("id",wf.id);await load();msg(wf.active?"Deactivated":"Activated");};
  const del=async(id)=>{if(!window.confirm("Delete this workflow?"))return;await sb().from("workflows").delete().eq("id",id);await load();msg("Deleted");};

  if(editing)return<WorkflowCanvas workflow={editing} onSave={async(wf)=>{if(wf.id){await sb().from("workflows").update({name:wf.name,description:wf.description,nodes:wf.nodes,edges:wf.edges,updated_by:userName,updated_at:new Date().toISOString()}).eq("id",wf.id);}else{await sb().from("workflows").insert({...wf,created_by:userName});}await load();setEditing(null);msg("Workflow saved!");}} onCancel={()=>setEditing(null)}/>;

  return(<div><Toast msg={toast}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h3 style={{margin:0,fontSize:15,fontWeight:800,color:B.text}}>Workflow Automations</h3>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setView(view==="list"?"runs":"list")} style={{...BS,fontSize:11,padding:"6px 12px"}}>{view==="list"?"📋 Run Log":"← Workflows"}</button>
        <button onClick={()=>setEditing({name:"",description:"",nodes:[],edges:[],active:false})} style={{...BP,fontSize:12}}>+ New Workflow</button>
      </div>
    </div>

    {view==="runs"&&<div>
      <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>Recent Workflow Runs</div>
      {runs.length===0&&<Card style={{textAlign:"center",padding:20,color:B.textDim}}><div style={{fontSize:13}}>No workflow runs yet.</div></Card>}
      {runs.map(r=>{const wf=workflows.find(w=>w.id===r.workflow_id);return(
        <Card key={r.id} style={{padding:"10px 14px",marginBottom:6,borderLeft:"3px solid "+(r.status==="completed"?B.green:r.status==="waiting"?B.orange:r.status==="failed"?B.red:B.cyan)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><span style={{fontSize:12,fontWeight:600,color:B.text}}>{wf?.name||"Unknown"}</span><span style={{fontSize:10,color:B.textDim,marginLeft:8}}>{r.trigger_type}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Badge color={r.status==="completed"?B.green:r.status==="waiting"?B.orange:r.status==="failed"?B.red:B.cyan}>{r.status}</Badge>
              <span style={{fontSize:10,color:B.textDim}}>{new Date(r.started_at).toLocaleString()}</span>
            </div>
          </div>
          {r.execution_log&&r.execution_log.length>0&&<div style={{marginTop:6,fontSize:10,color:B.textDim}}>{r.execution_log.length} steps executed</div>}
        </Card>);})}
    </div>}

    {view==="list"&&<>
      {loading&&<div style={{textAlign:"center",padding:40}}><Spinner/></div>}
      {!loading&&workflows.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:36,marginBottom:8}}>⚡</div><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>No workflows yet</div><div style={{fontSize:12}}>Create your first automation to get started.</div></Card>}
      {workflows.map(wf=>{const triggerNode=wf.nodes?.find(n=>n.type==="trigger");const actionNodes=(wf.nodes||[]).filter(n=>n.type==="action");const recentRuns=runs.filter(r=>r.workflow_id===wf.id).length;
        return(<Card key={wf.id} style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+(wf.active?B.green:B.textDim),opacity:wf.active?1:0.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,fontWeight:700,color:B.text}}>{wf.name}</span>
                <Badge color={wf.active?B.green:B.textDim}>{wf.active?"Active":"Inactive"}</Badge>
              </div>
              {wf.description&&<div style={{fontSize:11,color:B.textDim,marginTop:2}}>{wf.description}</div>}
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                {triggerNode&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:B.cyan+"18",color:B.cyan,fontWeight:600}}>When: {WF_TRIGGERS.find(t=>t.key===triggerNode.config?.event)?.label||triggerNode.config?.event}</span>}
                {actionNodes.map((n,i)=><span key={i} style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:B.purple+"18",color:B.purple,fontWeight:600}}>→ {WF_ACTIONS.find(a=>a.key===n.config?.action_type)?.label||n.config?.action_type}</span>)}
              </div>
              <div style={{fontSize:10,color:B.textDim,marginTop:4}}>{(wf.nodes||[]).length} nodes · {recentRuns} runs</div>
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>toggleActive(wf)} style={{...BS,padding:"5px 10px",fontSize:10,color:wf.active?B.red:B.green,borderColor:(wf.active?B.red:B.green)+"40"}}>{wf.active?"Pause":"Activate"}</button>
              <button onClick={()=>setEditing(wf)} style={{...BS,padding:"5px 10px",fontSize:10}}>Edit</button>
              <button onClick={()=>del(wf.id)} style={{...BS,padding:"5px 10px",fontSize:10,color:B.red,borderColor:B.red+"40"}}>✕</button>
            </div>
          </div>
        </Card>);})}

      {/* Pre-built templates */}
      {workflows.length===0&&<div style={{marginTop:20}}>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>Quick Start Templates</div>
        {[{name:"Payment Reminder",desc:"Send reminders when invoices go unpaid",nodes:[{id:"t1",type:"trigger",x:50,y:50,config:{event:"invoice_sent"}},{id:"w1",type:"wait",x:50,y:140,config:{delay_hours:360}},{id:"c1",type:"condition",x:50,y:230,config:{field:"status",operator:"equals",value:"sent"}},{id:"a1",type:"action",x:50,y:320,config:{action_type:"send_email",subject:"Reminder: Invoice Payment",body:"This is a friendly reminder that your invoice is now 15 days old.",to_email:""}}],edges:[{id:"e1",source:"t1",target:"w1"},{id:"e2",source:"w1",target:"c1"},{id:"e3",source:"c1",target:"a1"}]},
          {name:"Feedback After Invoice",desc:"Send feedback request 3 days after invoice sent",nodes:[{id:"t1",type:"trigger",x:50,y:50,config:{event:"invoice_sent"}},{id:"w1",type:"wait",x:50,y:140,config:{delay_hours:72}},{id:"a1",type:"action",x:50,y:230,config:{action_type:"send_feedback_request"}}],edges:[{id:"e1",source:"t1",target:"w1"},{id:"e2",source:"w1",target:"a1"}]},
          {name:"New WO Alert",desc:"Notify when high-priority WO created",nodes:[{id:"t1",type:"trigger",x:50,y:50,config:{event:"wo_created"}},{id:"c1",type:"condition",x:50,y:140,config:{field:"priority",operator:"equals",value:"high"}},{id:"a1",type:"action",x:50,y:230,config:{action_type:"create_notification",title:"Urgent WO Created",message:"High-priority work order created",for_role:"manager"}}],edges:[{id:"e1",source:"t1",target:"c1"},{id:"e2",source:"c1",target:"a1"}]}
        ].map(tpl=><Card key={tpl.name} onClick={()=>setEditing({name:tpl.name,description:tpl.desc,nodes:tpl.nodes,edges:tpl.edges,active:false})} style={{padding:"12px 16px",marginBottom:6,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:13,fontWeight:600,color:B.text}}>{tpl.name}</div><div style={{fontSize:11,color:B.textDim}}>{tpl.desc}</div></div>
            <span style={{fontSize:11,color:B.cyan,fontWeight:600}}>Use →</span>
          </div>
        </Card>)}
      </div>}
    </>}
  </div>);
}

function WorkflowCanvas({workflow,onSave,onCancel}){
  const[name,setName]=useState(workflow.name||"");const[desc,setDesc]=useState(workflow.description||"");
  const[nodes,setNodes]=useState(workflow.nodes||[]);const[edges,setEdges]=useState(workflow.edges||[]);
  const[selected,setSelected]=useState(null);const[connecting,setConnecting]=useState(null);
  const[configNode,setConfigNode]=useState(null);const[dragNode,setDragNode]=useState(null);
  const[pan,setPan]=useState({x:0,y:0});const canvasRef=useRef(null);

  const addNode=(type,config={})=>{const id="n"+Date.now();const y=nodes.length>0?Math.max(...nodes.map(n=>n.y))+100:60;
    setNodes([...nodes,{id,type,x:100,y,config}]);};
  const removeNode=(id)=>{setNodes(nodes.filter(n=>n.id!==id));setEdges(edges.filter(e=>e.source!==id&&e.target!==id));setSelected(null);};
  const updateNodeConfig=(id,cfg)=>setNodes(nodes.map(n=>n.id===id?{...n,config:{...n.config,...cfg}}:n));
  const addEdge=(src,tgt)=>{if(src===tgt||edges.some(e=>e.source===src&&e.target===tgt))return;setEdges([...edges,{id:"e"+Date.now(),source:src,target:tgt}]);};
  const removeEdge=(id)=>setEdges(edges.filter(e=>e.id!==id));

  const nodeColors={trigger:B.cyan,condition:B.orange,action:B.purple,wait:B.textDim};
  const nodeIcons={trigger:"⚡",condition:"❓",action:"▶",wait:"⏳"};

  const handleMouseDown=(e,nodeId)=>{e.stopPropagation();if(connecting){addEdge(connecting,nodeId);setConnecting(null);return;}
    setSelected(nodeId);setDragNode({id:nodeId,startX:e.clientX,startY:e.clientY,origX:nodes.find(n=>n.id===nodeId).x,origY:nodes.find(n=>n.id===nodeId).y});};
  const handleMouseMove=(e)=>{if(!dragNode)return;const dx=e.clientX-dragNode.startX;const dy=e.clientY-dragNode.startY;
    setNodes(ns=>ns.map(n=>n.id===dragNode.id?{...n,x:dragNode.origX+dx,y:dragNode.origY+dy}:n));};
  const handleMouseUp=()=>setDragNode(null);

  const getNodeLabel=(n)=>{if(n.type==="trigger")return WF_TRIGGERS.find(t=>t.key===n.config?.event)?.label||"Select trigger";
    if(n.type==="action")return WF_ACTIONS.find(a=>a.key===n.config?.action_type)?.label||"Select action";
    if(n.type==="condition")return(n.config?.field||"field")+" "+(n.config?.operator||"=")+" "+(n.config?.value||"?");
    if(n.type==="wait")return"Wait "+(n.config?.delay_hours||24)+"h";return n.type;};

  return(<div style={{display:"flex",flexDirection:"column",height:"100%"}}>
    {/* Toolbar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+B.border,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={onCancel} style={{background:"none",border:"none",color:B.cyan,fontSize:12,cursor:"pointer",fontFamily:F}}>← Back</button>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Workflow name..." style={{...IS,width:200,padding:8,fontSize:13,fontWeight:700}}/>
      </div>
      <button onClick={()=>onSave({...workflow,name:name||"Untitled Workflow",description:desc,nodes,edges})} style={{...BP,fontSize:12,padding:"8px 16px"}}>Save Workflow</button>
    </div>
    <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description..." style={{...IS,marginBottom:12,padding:8,fontSize:12}}/>

    {/* Add Node Buttons */}
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      <button onClick={()=>addNode("trigger",{event:"wo_created"})} style={{...BS,padding:"6px 12px",fontSize:11,borderColor:B.cyan+"40",color:B.cyan}}>+ Trigger</button>
      <button onClick={()=>addNode("condition",{field:"",operator:"equals",value:""})} style={{...BS,padding:"6px 12px",fontSize:11,borderColor:B.orange+"40",color:B.orange}}>+ Condition</button>
      <button onClick={()=>addNode("action",{action_type:"create_notification"})} style={{...BS,padding:"6px 12px",fontSize:11,borderColor:B.purple+"40",color:B.purple}}>+ Action</button>
      <button onClick={()=>addNode("wait",{delay_hours:24})} style={{...BS,padding:"6px 12px",fontSize:11,color:B.textMuted}}>+ Wait</button>
      {connecting&&<span style={{fontSize:11,color:B.orange,fontWeight:600,padding:"6px 12px"}}>Click a node to connect...</span>}
    </div>

    {/* Canvas */}
    <div ref={canvasRef} style={{flex:1,minHeight:400,background:B.bg,border:"1px solid "+B.border,borderRadius:10,position:"relative",overflow:"hidden",cursor:dragNode?"grabbing":"default"}}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={()=>{setSelected(null);setConnecting(null);}}>
      {/* SVG edges */}
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
        {edges.map(e=>{const src=nodes.find(n=>n.id===e.source);const tgt=nodes.find(n=>n.id===e.target);if(!src||!tgt)return null;
          const x1=src.x+90,y1=src.y+30,x2=tgt.x+90,y2=tgt.y+10;const cy1=y1+(y2-y1)*0.5,cy2=y2-(y2-y1)*0.5;
          return<g key={e.id}><path d={`M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`} fill="none" stroke={B.textDim} strokeWidth="2" strokeDasharray="6 3"/>
            <circle cx={x2} cy={y2} r="3" fill={B.textDim}/></g>;})}
      </svg>

      {/* Nodes */}
      {nodes.map(n=>{const c=nodeColors[n.type];const isSelected=selected===n.id;return(
        <div key={n.id} style={{position:"absolute",left:n.x,top:n.y,width:180,background:B.surface,border:"2px solid "+(isSelected?c:B.border),borderRadius:10,padding:"10px 12px",cursor:"grab",boxShadow:isSelected?"0 4px 16px "+c+"30":"0 1px 4px rgba(0,0,0,0.1)",transition:"box-shadow .15s",zIndex:isSelected?10:1}}
          onMouseDown={e=>handleMouseDown(e,n.id)} onDoubleClick={(e)=>{e.stopPropagation();setConfigNode(n);}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:12}}>{nodeIcons[n.type]}</span>
              <span style={{fontSize:9,fontWeight:700,color:c,textTransform:"uppercase",letterSpacing:0.5}}>{n.type}</span>
            </div>
            <div style={{display:"flex",gap:2}}>
              <button onClick={e=>{e.stopPropagation();setConnecting(n.id);}} style={{background:B.cyan+"22",border:"none",color:B.cyan,width:18,height:18,borderRadius:4,fontSize:10,cursor:"pointer"}} title="Connect">→</button>
              <button onClick={e=>{e.stopPropagation();removeNode(n.id);}} style={{background:B.red+"22",border:"none",color:B.red,width:18,height:18,borderRadius:4,fontSize:10,cursor:"pointer"}}>×</button>
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:B.text,lineHeight:1.3}}>{getNodeLabel(n)}</div>
          <div style={{fontSize:9,color:B.textDim,marginTop:4}}>Double-click to configure</div>
        </div>);})}

      {nodes.length===0&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",color:B.textDim}}>
        <div style={{fontSize:36,marginBottom:8}}>⚡</div><div style={{fontSize:13}}>Add nodes to build your workflow</div>
        <div style={{fontSize:11,marginTop:4}}>Start with a Trigger, then add Conditions and Actions</div>
      </div>}
    </div>

    {/* Node Configuration Modal */}
    {configNode&&<Modal title={"Configure "+configNode.type.charAt(0).toUpperCase()+configNode.type.slice(1)} onClose={()=>setConfigNode(null)} wide>
      {configNode.type==="trigger"&&<div>
        <label style={LS}>When this happens:</label>
        <select value={configNode.config?.event||""} onChange={e=>{updateNodeConfig(configNode.id,{event:e.target.value});setConfigNode({...configNode,config:{...configNode.config,event:e.target.value}});}} style={{...IS,cursor:"pointer"}}>
          {WF_TRIGGERS.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
      </div>}
      {configNode.type==="condition"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label style={LS}>Field</label><select value={configNode.config?.field||""} onChange={e=>{updateNodeConfig(configNode.id,{field:e.target.value});setConfigNode({...configNode,config:{...configNode.config,field:e.target.value}});}} style={{...IS,cursor:"pointer"}}>
          <option value="">Select field</option>
          {["customer","priority","status","amount","wo_type","assignee","star_rating","nps_score"].map(f=><option key={f} value={f}>{f}</option>)}
        </select></div>
        <div><label style={LS}>Operator</label><select value={configNode.config?.operator||"equals"} onChange={e=>{updateNodeConfig(configNode.id,{operator:e.target.value});setConfigNode({...configNode,config:{...configNode.config,operator:e.target.value}});}} style={{...IS,cursor:"pointer"}}>
          {WF_OPERATORS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
        </select></div>
        <div><label style={LS}>Value</label><input value={configNode.config?.value||""} onChange={e=>{updateNodeConfig(configNode.id,{value:e.target.value});setConfigNode({...configNode,config:{...configNode.config,value:e.target.value}});}} style={IS} placeholder="Value to compare"/></div>
      </div>}
      {configNode.type==="action"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label style={LS}>Action Type</label><select value={configNode.config?.action_type||""} onChange={e=>{updateNodeConfig(configNode.id,{action_type:e.target.value});setConfigNode({...configNode,config:{...configNode.config,action_type:e.target.value}});}} style={{...IS,cursor:"pointer"}}>
          {WF_ACTIONS.filter(a=>a.key!=="wait").map(a=><option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
        </select></div>
        {configNode.config?.action_type==="send_email"&&<>
          <div><label style={LS}>To Email</label><input value={configNode.config?.to_email||""} onChange={e=>{updateNodeConfig(configNode.id,{to_email:e.target.value});setConfigNode({...configNode,config:{...configNode.config,to_email:e.target.value}});}} style={IS} placeholder="Leave blank to use customer email"/></div>
          <div><label style={LS}>Subject</label><input value={configNode.config?.subject||""} onChange={e=>{updateNodeConfig(configNode.id,{subject:e.target.value});setConfigNode({...configNode,config:{...configNode.config,subject:e.target.value}});}} style={IS}/></div>
          <div><label style={LS}>Body</label><textarea value={configNode.config?.body||""} onChange={e=>{updateNodeConfig(configNode.id,{body:e.target.value});setConfigNode({...configNode,config:{...configNode.config,body:e.target.value}});}} rows={3} style={{...IS,resize:"vertical"}}/></div>
        </>}
        {configNode.config?.action_type==="create_notification"&&<>
          <div><label style={LS}>Title</label><input value={configNode.config?.title||""} onChange={e=>{updateNodeConfig(configNode.id,{title:e.target.value});setConfigNode({...configNode,config:{...configNode.config,title:e.target.value}});}} style={IS}/></div>
          <div><label style={LS}>Message</label><input value={configNode.config?.message||""} onChange={e=>{updateNodeConfig(configNode.id,{message:e.target.value});setConfigNode({...configNode,config:{...configNode.config,message:e.target.value}});}} style={IS}/></div>
          <div><label style={LS}>For Role</label><select value={configNode.config?.for_role||""} onChange={e=>{updateNodeConfig(configNode.id,{for_role:e.target.value});setConfigNode({...configNode,config:{...configNode.config,for_role:e.target.value}});}} style={{...IS,cursor:"pointer"}}><option value="">All</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="technician">Technician</option></select></div>
        </>}
        {configNode.config?.action_type==="change_wo_status"&&<div><label style={LS}>New Status</label><select value={configNode.config?.new_status||""} onChange={e=>{updateNodeConfig(configNode.id,{new_status:e.target.value});setConfigNode({...configNode,config:{...configNode.config,new_status:e.target.value}});}} style={{...IS,cursor:"pointer"}}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div>}
        {configNode.config?.action_type==="log_activity"&&<div><label style={LS}>Activity Message</label><input value={configNode.config?.message||""} onChange={e=>{updateNodeConfig(configNode.id,{message:e.target.value});setConfigNode({...configNode,config:{...configNode.config,message:e.target.value}});}} style={IS}/></div>}
      </div>}
      {configNode.type==="wait"&&<div>
        <label style={LS}>Delay (hours)</label>
        <input value={configNode.config?.delay_hours||24} onChange={e=>{const v=parseFloat(e.target.value)||24;updateNodeConfig(configNode.id,{delay_hours:v});setConfigNode({...configNode,config:{...configNode.config,delay_hours:v}});}} type="number" style={{...IS,fontFamily:M}} placeholder="24"/>
        <div style={{fontSize:11,color:B.textDim,marginTop:6}}>Common: 24h (1 day), 72h (3 days), 168h (1 week), 360h (15 days), 720h (30 days)</div>
      </div>}
      <button onClick={()=>setConfigNode(null)} style={{...BP,width:"100%",marginTop:16}}>Done</button>
    </Modal>}
  </div>);
}

export { WF_TRIGGERS, WF_ACTIONS, WF_OPERATORS, WorkflowBuilder, WorkflowCanvas };
