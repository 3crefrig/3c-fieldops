import{serve}from"https://deno.land/std@0.177.0/http/server.ts";
import{create,getNumericDate}from"https://deno.land/x/djwt@v2.8/mod.ts";
import{decode as b64d}from"https://deno.land/std@0.177.0/encoding/base64.ts";
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const SE=Deno.env.get("GOOGLE_SERVICE_EMAIL")||"";
const PK=(Deno.env.get("GOOGLE_PRIVATE_KEY")||"").replace(/\\n/g,"\n");
const IE=Deno.env.get("GOOGLE_IMPERSONATE_EMAIL")||"service@3crefrigeration.com";
async function gat(){
const p=PK.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"");
const k=await crypto.subtle.importKey("pkcs8",b64d(p),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
const j=await create({alg:"RS256",typ:"JWT"},{iss:SE,sub:IE,scope:"https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file",aud:"https://oauth2.googleapis.com/token",iat:getNumericDate(0),exp:getNumericDate(3600)},k);
const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion="+j});
const d=await r.json();
if(d.error)throw new Error(d.error_description);
return d.access_token;
}
function be(to,cc,subj,body,att){
const bn="b_"+Date.now();
let e="From: "+IE+"\r\nTo: "+to+"\r\n";
if(cc)e+="Cc: "+cc+"\r\n";
e+="Subject: "+subj+"\r\nMIME-Version: 1.0\r\n";
if(att){
e+='Content-Type: multipart/mixed; boundary="'+bn+'"\r\n\r\n';
e+="--"+bn+"\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n"+body+"\r\n\r\n";
e+="--"+bn+"\r\nContent-Type: "+att.type+'; name="'+att.name+'"\r\n';
e+='Content-Disposition: attachment; filename="'+att.name+'"\r\n';
e+="Content-Transfer-Encoding: base64\r\n\r\n"+att.content+"\r\n--"+bn+"--";
}else{
e+='Content-Type: text/html; charset="UTF-8"\r\n\r\n'+body;
}
return btoa(unescape(encodeURIComponent(e))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

// ── Auth guard (2026-07-10 security hardening): service-role callers or
//    registered app users only. OPTIONS passes through to the CORS handler.
const __CORS_G={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
async function __guard(req: Request, allowUser=true): Promise<Response|null>{
  if(req.method==="OPTIONS")return null;
  const token=(req.headers.get("Authorization")||"").replace(/^Bearers+/i,"").trim();
  const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const deny=(s: number,m: string)=>new Response(JSON.stringify({error:m}),{status:s,headers:{...__CORS_G,"Content-Type":"application/json"}});
  if(token&&svc&&token===svc)return null;
  if(!allowUser)return deny(401,"service credential required");
  if(!token)return deny(401,"auth required");
  try{
    const base=Deno.env.get("SUPABASE_URL")||"";
    const u=await fetch(base+"/auth/v1/user",{headers:{Authorization:"Bearer "+token,apikey:Deno.env.get("SUPABASE_ANON_KEY")||""}});
    if(!u.ok)return deny(401,"invalid token");
    const user=await u.json();
    const email=(user?.email||"").toLowerCase();
    if(!email)return deny(401,"invalid token");
    const q=await fetch(base+"/rest/v1/users?select=role&active=not.is.false&email=ilike."+encodeURIComponent(email),{headers:{apikey:svc,Authorization:"Bearer "+svc}});
    const rows=await q.json();
    if(!Array.isArray(rows)||rows.length===0)return deny(403,"not a registered user");
    return null;
  }catch(_e){return deny(401,"auth check failed");}
}

serve(async(req)=>{
  const __d=await __guard(req, true); if(__d) return __d;
if(req.method==="OPTIONS")return new Response("ok",{headers:C});
try{
const{to,cc,subject,body,attachment}=await req.json();
if(!to||!subject)return new Response(JSON.stringify({error:"Missing to/subject"}),{status:400,headers:{...C,"Content-Type":"application/json"}});
const t=await gat();
const raw=be(to,cc||"",subject,body||"",attachment||null);
const g=await fetch("https://gmail.googleapis.com/gmail/v1/users/"+IE+"/messages/send",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({raw})});
const res=await g.json();
if(res.error)return new Response(JSON.stringify({error:res.error.message}),{status:400,headers:{...C,"Content-Type":"application/json"}});
return new Response(JSON.stringify({success:true,messageId:res.id}),{headers:{...C,"Content-Type":"application/json"}});
}catch(err){
return new Response(JSON.stringify({error:err.message}),{status:500,headers:{...C,"Content-Type":"application/json"}});
}
});