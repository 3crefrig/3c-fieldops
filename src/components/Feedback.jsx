import React, { useState, useEffect } from "react";
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY, B, F, M, IS, LS, BP, BS } from "../shared";
import { Card, Badge, StatCard, Modal, Toast, Spinner } from "./ui";

function Logo({size,onClick}){const h=size==="large"?56:32;return(<img src="https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png" alt="3C Refrigeration" style={{height:h,display:"block",cursor:onClick?"pointer":"default",transition:"opacity .2s"}} onClick={onClick}/>);}

function FeedbackForm({token}){
  const[loading,setLoading]=useState(true);const[request,setRequest]=useState(null);const[error,setError]=useState(null);
  const[step,setStep]=useState(1);const[stars,setStars]=useState(0);const[hoverStar,setHoverStar]=useState(0);
  const[npsScore,setNpsScore]=useState(null);const[npsFeedback,setNpsFeedback]=useState("");
  const[testimonial,setTestimonial]=useState("");const[privateFb,setPrivateFb]=useState("");
  const[name,setName]=useState("");const[email,setEmail]=useState("");
  const[submitting,setSubmitting]=useState(false);const[done,setDone]=useState(false);

  useEffect(()=>{(async()=>{const{data,error:e}=await sb().from("feedback_requests").select("*").eq("token",token).single();
    if(e||!data){setError("This feedback link is invalid or has expired.");setLoading(false);return;}
    if(data.completed){setError("Feedback has already been submitted. Thank you!");setLoading(false);return;}
    // Check if customer is key account
    const{data:cust}=await sb().from("customers").select("is_key_account").eq("name",data.customer_name).single();
    setRequest({...data,isKeyAccount:cust?.is_key_account||false});setLoading(false);
  })();},[token]);

  const submit=async()=>{if(!stars||submitting)return;setSubmitting(true);
    try{const resp=await fetch(SUPABASE_URL+"/functions/v1/submit-feedback",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({token,star_rating:stars,nps_score:npsScore,nps_feedback:npsFeedback||null,testimonial_text:testimonial||null,private_feedback:privateFb||null,respondent_name:name||null,respondent_email:email||null})});
      const result=await resp.json();if(result.success)setDone(true);else setError(result.error||"Failed to submit");
    }catch(e){setError("Network error. Please try again.");}setSubmitting(false);};

  const bg=B.bg,sf=B.surface;
  if(loading)return<div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
  if(error)return<div style={{minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,color:B.text,padding:40,textAlign:"center"}}><Logo/><div style={{marginTop:20,fontSize:15,fontWeight:600}}>{error}</div></div>;
  if(done)return<div style={{minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:F,color:B.text,padding:40,textAlign:"center"}}><div style={{fontSize:64,marginBottom:16}}>🙏</div><h2 style={{fontSize:22,fontWeight:800,margin:"0 0 8px"}}>Thank you!</h2><p style={{fontSize:14,color:B.textMuted,maxWidth:400}}>Your feedback helps us improve our service. We truly appreciate your time.</p><div style={{marginTop:24}}><Logo/></div></div>;

  return(<div style={{minHeight:"100vh",background:bg,fontFamily:F,color:B.text}}>
    <div style={{background:sf,padding:"14px 20px",borderBottom:"1px solid "+B.border,display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo/><div style={{fontSize:12,color:B.textDim}}>Service Feedback</div></div>
    <div style={{maxWidth:500,margin:"0 auto",padding:24}}>
      <h2 style={{fontSize:18,fontWeight:800,marginBottom:4}}>How did we do?</h2>
      <p style={{fontSize:13,color:B.textMuted,marginBottom:24}}>We'd love to hear about your experience with 3C Refrigeration.</p>

      {/* Step 1: Star Rating */}
      {step>=1&&<Card style={{padding:20,marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Rate Our Service</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:8}}>
          {[1,2,3,4,5].map(s=><button key={s} onClick={()=>{setStars(s);if(step===1)setTimeout(()=>setStep(2),300);}}
            onMouseEnter={()=>setHoverStar(s)} onMouseLeave={()=>setHoverStar(0)}
            style={{background:"none",border:"none",fontSize:40,cursor:"pointer",transform:(hoverStar>=s||stars>=s)?"scale(1.15)":"scale(1)",transition:"transform .15s",filter:(hoverStar>=s||stars>=s)?"none":"grayscale(0.8) opacity(0.4)"}}>
            {(hoverStar>=s||stars>=s)?"⭐":"☆"}
          </button>)}
        </div>
        {stars>0&&<div style={{fontSize:12,fontWeight:600,color:stars>=4?B.green:stars>=3?B.orange:B.red}}>
          {stars===5?"Excellent!":stars===4?"Great!":stars===3?"Good":stars===2?"Could be better":stars===1?"We're sorry to hear that":""}
        </div>}
      </Card>}

      {/* Step 2: NPS (key accounts) or feedback */}
      {step>=2&&stars>0&&<Card style={{padding:20,marginBottom:16,animation:"slideUp .25s ease-out"}}>
        {request.isKeyAccount&&<>
          <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>How likely are you to recommend us? (0-10)</div>
          <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {Array.from({length:11},(_, i)=>i).map(n=><button key={n} onClick={()=>{setNpsScore(n);if(step===2)setTimeout(()=>setStep(3),300);}}
              style={{width:36,height:36,borderRadius:8,border:"1px solid "+(npsScore===n?B.cyan:B.border),background:npsScore===n?B.cyanGlow:"transparent",color:npsScore===n?B.cyan:B.textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:M}}>{n}</button>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:B.textDim,marginBottom:8}}><span>Not likely</span><span>Extremely likely</span></div>
        </>}
        {(!request.isKeyAccount||npsScore!==null)&&<>
          {stars>=4?<>
            <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8,marginTop:request.isKeyAccount?12:0}}>Would you share a testimonial?</div>
            <p style={{fontSize:12,color:B.textMuted,marginBottom:8}}>Your words help other organizations choose the right service partner.</p>
            <textarea value={testimonial} onChange={e=>setTestimonial(e.target.value)} placeholder="Tell us what stood out about our service..." rows={3} style={{...IS,resize:"vertical",minHeight:80}}/>
          </>:<>
            <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8,marginTop:request.isKeyAccount?12:0}}>What could we improve?</div>
            <p style={{fontSize:12,color:B.textMuted,marginBottom:8}}>This feedback goes directly to our management team.</p>
            <textarea value={privateFb} onChange={e=>setPrivateFb(e.target.value)} placeholder="Tell us what we could do better..." rows={3} style={{...IS,resize:"vertical",minHeight:80}}/>
          </>}
          {step===2&&<button onClick={()=>setStep(3)} style={{...BP,width:"100%",marginTop:12}}>Continue</button>}
        </>}
      </Card>}

      {/* Step 3: Contact info + Submit */}
      {step>=3&&<Card style={{padding:20,marginBottom:16,animation:"slideUp .25s ease-out"}}>
        <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Your Information (Optional)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div><label style={LS}>Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={IS}/></div>
          <div><label style={LS}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={IS}/></div>
        </div>
        <button onClick={submit} disabled={submitting} style={{...BP,width:"100%",padding:16,fontSize:15,opacity:submitting?.6:1}}>
          {submitting?"Submitting...":"Submit Feedback"}
        </button>
      </Card>}
    </div>
  </div>);
}

// ═══════════════════════════════════════════
// FEEDBACK DASHBOARD — Admin/Manager tab
// ═══════════════════════════════════════════
function FeedbackDashboard({D}){
  const[feedback,setFeedback]=useState([]);const[loading,setLoading]=useState(true);const[toast,setToast]=useState("");const[tab,setTab]=useState("all");
  const msg=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const load=async()=>{const{data}=await sb().from("feedback").select("*").order("submitted_at",{ascending:false});setFeedback(data||[]);setLoading(false);};
  useEffect(()=>{load();},[]);

  const toggleApprove=async(fb)=>{await sb().from("feedback").update({testimonial_approved:!fb.testimonial_approved}).eq("id",fb.id);await load();msg(fb.testimonial_approved?"Unapproved":"Approved for display");};
  const togglePublic=async(fb)=>{await sb().from("feedback").update({testimonial_public:!fb.testimonial_public}).eq("id",fb.id);await load();msg(fb.testimonial_public?"Removed from website":"Added to website");};

  // Calculate metrics
  const avgRating=feedback.length>0?(feedback.reduce((s,f)=>s+(f.star_rating||0),0)/feedback.length).toFixed(1):0;
  const npsResponses=feedback.filter(f=>f.nps_score!==null);
  const npsScore=npsResponses.length>0?(()=>{const promo=npsResponses.filter(f=>f.nps_score>=9).length;const detract=npsResponses.filter(f=>f.nps_score<=6).length;return Math.round(((promo-detract)/npsResponses.length)*100);})():null;
  const testimonials=feedback.filter(f=>f.testimonial_text&&f.testimonial_text.trim());
  const lowRatings=feedback.filter(f=>f.star_rating<=2);
  const distribution=[1,2,3,4,5].map(s=>({star:s,count:feedback.filter(f=>f.star_rating===s).length}));
  const maxDist=Math.max(...distribution.map(d=>d.count),1);

  const filtered=tab==="testimonials"?testimonials:tab==="low"?lowRatings:feedback;

  return(<div><Toast msg={toast}/>
    {/* Metrics Row */}
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Avg Rating" value={avgRating+"★"} icon="⭐" color={parseFloat(avgRating)>=4?B.green:parseFloat(avgRating)>=3?B.orange:B.red}/>
      <StatCard label="Responses" value={feedback.length} icon="📊" color={B.cyan}/>
      {npsScore!==null&&<StatCard label="NPS Score" value={npsScore} icon="📈" color={npsScore>=50?B.green:npsScore>=0?B.orange:B.red}/>}
      <StatCard label="Testimonials" value={testimonials.length} icon="💬" color={B.purple}/>
    </div>

    {/* Rating Distribution */}
    <Card style={{padding:"16px 18px",marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>Rating Distribution</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[5,4,3,2,1].map(s=>{const d=distribution.find(x=>x.star===s);return(
          <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,fontFamily:M,color:B.textDim,width:16,textAlign:"right"}}>{s}</span>
            <span style={{fontSize:14}}>⭐</span>
            <div style={{flex:1,height:8,borderRadius:4,background:B.border,overflow:"hidden"}}>
              <div style={{width:(d.count/maxDist*100)+"%",height:"100%",borderRadius:4,background:s>=4?B.green:s===3?B.orange:B.red,transition:"width .4s"}}/>
            </div>
            <span style={{fontSize:11,fontFamily:M,color:B.textMuted,width:24,textAlign:"right"}}>{d.count}</span>
          </div>);})}
      </div>
    </Card>

    {/* Tabs */}
    <div style={{display:"flex",gap:4,marginBottom:14}}>
      {[["all","All ("+feedback.length+")"],["testimonials","Testimonials ("+testimonials.length+")"],["low","Needs Attention ("+lowRatings.length+")"]].map(([k,l])=>
        <button key={k} onClick={()=>setTab(k)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(tab===k?B.cyan:B.border),background:tab===k?B.cyanGlow:"transparent",color:tab===k?B.cyan:B.textDim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>)}
    </div>

    {/* Feedback List */}
    {loading&&<div style={{textAlign:"center",padding:40}}><Spinner/></div>}
    {!loading&&filtered.length===0&&<Card style={{textAlign:"center",padding:30,color:B.textDim}}><div style={{fontSize:24,marginBottom:6}}>📭</div><div style={{fontSize:13}}>No feedback yet.</div></Card>}
    {filtered.map(fb=><Card key={fb.id} style={{padding:"14px 16px",marginBottom:8,borderLeft:"3px solid "+(fb.star_rating>=4?B.green:fb.star_rating===3?B.orange:B.red)}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:14}}>{Array.from({length:fb.star_rating},(_,i)=>"⭐").join("")}</span>
            {fb.nps_score!==null&&<Badge color={fb.nps_score>=9?B.green:fb.nps_score>=7?B.cyan:B.red}>NPS: {fb.nps_score}</Badge>}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:B.text}}>{fb.customer_name}</div>
          {fb.respondent_name&&<div style={{fontSize:11,color:B.textDim}}>{fb.respondent_name}{fb.respondent_email&&" · "+fb.respondent_email}</div>}
          <div style={{fontSize:10,color:B.textDim,marginTop:2}}>{new Date(fb.submitted_at).toLocaleDateString()}{fb.invoice_num&&" · INV-"+fb.invoice_num}</div>
        </div>
      </div>
      {fb.testimonial_text&&<div style={{marginTop:8,padding:"10px 12px",background:B.bg,borderRadius:6,borderLeft:"2px solid "+B.purple}}>
        <div style={{fontSize:12,color:B.text,fontStyle:"italic",lineHeight:1.5}}>"{fb.testimonial_text}"</div>
        <div style={{display:"flex",gap:6,marginTop:8}}>
          <button onClick={()=>toggleApprove(fb)} style={{...BS,padding:"4px 10px",fontSize:10,color:fb.testimonial_approved?B.green:B.textMuted,borderColor:fb.testimonial_approved?B.green+"40":B.border}}>{fb.testimonial_approved?"✓ Approved":"Approve"}</button>
          {fb.testimonial_approved&&<button onClick={()=>togglePublic(fb)} style={{...BS,padding:"4px 10px",fontSize:10,color:fb.testimonial_public?B.cyan:B.textMuted,borderColor:fb.testimonial_public?B.cyan+"40":B.border}}>{fb.testimonial_public?"On Website":"Add to Website"}</button>}
        </div>
      </div>}
      {fb.private_feedback&&<div style={{marginTop:8,padding:"10px 12px",background:B.red+"08",borderRadius:6,borderLeft:"2px solid "+B.red}}>
        <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",marginBottom:4}}>Private Feedback</div>
        <div style={{fontSize:12,color:B.text,lineHeight:1.5}}>{fb.private_feedback}</div>
      </div>}
      {fb.nps_feedback&&<div style={{marginTop:6,fontSize:12,color:B.textMuted,fontStyle:"italic"}}>{fb.nps_feedback}</div>}
    </Card>)}
  </div>);
}

export { FeedbackForm, FeedbackDashboard };
