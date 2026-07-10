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
const j=await create({alg:"RS256",typ:"JWT"},{iss:SE,sub:IE,scope:"https://www.googleapis.com/auth/drive.file",aud:"https://oauth2.googleapis.com/token",iat:getNumericDate(0),exp:getNumericDate(3600)},k);
const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion="+j});
const d=await r.json();
if(d.error)throw new Error(d.error_description);
return d.access_token;
}
async function fof(token,name,pid){
const q=encodeURIComponent("name='"+name+"' and mimeType='application/vnd.google-apps.folder'"+(pid?" and '"+pid+"' in parents":"")+" and trashed=false");
const r=await fetch("https://www.googleapis.com/drive/v3/files?q="+q+"&fields=files(id)",{headers:{Authorization:"Bearer "+token}});
const d=await r.json();
if(d.files&&d.files.length>0)return d.files[0].id;
const m={name:name,mimeType:"application/vnd.google-apps.folder"};
if(pid)m.parents=[pid];
const c=await fetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(m)});
const f=await c.json();
return f.id;
}

// ── Auth guard (2026-07-10 security hardening): service-role callers or
//    registered app users only. OPTIONS passes through to the CORS handler.
const __CORS_G={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
async function __guard(req: Request, allowUser=true): Promise<Response|null>{
  if(req.method==="OPTIONS")return null;
  const hdr=(req.headers.get("Authorization")||"").trim();
  const token=hdr.replace(/^[Bb]earer[ ]+/,"").trim();
  const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const deny=(s: number,m: string)=>new Response(JSON.stringify({error:m}),{status:s,headers:{...__CORS_G,"Content-Type":"application/json"}});
  if(!token)return deny(401,"auth required");
  if(svc&&token===svc)return null;
  let claims: any=null;
  try{const seg=(token.split(".")[1]||"").replace(/-/g,"+").replace(/_/g,"/");claims=JSON.parse(atob(seg+"=".repeat((4-seg.length%4)%4)));}catch(_x){}
  if(!claims)return deny(401,"invalid token");
  if(claims.role==="service_role")return null;
  if(!allowUser)return deny(401,"service credential required");
  if(claims.role!=="authenticated")return deny(401,"invalid token");
  const email=String(claims.email||"").toLowerCase();
  if(!email)return deny(401,"invalid token");
  try{
    const base=Deno.env.get("SUPABASE_URL")||"";
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
const{fileBase64,fileName,mimeType,folderPath}=await req.json();
if(!fileBase64||!fileName)return new Response(JSON.stringify({error:"Missing file"}),{status:400,headers:{...C,"Content-Type":"application/json"}});
const token=await gat();
const parts=(folderPath||"3C FieldOps").split("/");
let pid=null;
for(const pt of parts){pid=await fof(token,pt,pid);}
const fb=b64d(fileBase64);
const bn="b_"+Date.now();
const mt=JSON.stringify({name:fileName,parents:[pid]});
const enc=new TextEncoder();
const hd=enc.encode("--"+bn+"\r\nContent-Type: application/json\r\n\r\n"+mt+"\r\n--"+bn+"\r\nContent-Type: "+(mimeType||"image/jpeg")+"\r\n\r\n");
const ft=enc.encode("\r\n--"+bn+"--");
const body=new Uint8Array(hd.length+fb.length+ft.length);
body.set(hd,0);body.set(fb,hd.length);body.set(ft,hd.length+fb.length);
const up=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"multipart/related; boundary="+bn},body:body});
const file=await up.json();
if(file.error)return new Response(JSON.stringify({error:file.error.message}),{status:400,headers:{...C,"Content-Type":"application/json"}});
await fetch("https://www.googleapis.com/drive/v3/files/"+file.id+"/permissions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({role:"reader",type:"anyone"})});
const thumb="https://drive.google.com/thumbnail?id="+file.id+"&sz=w400";
return new Response(JSON.stringify({success:true,fileId:file.id,webViewLink:file.webViewLink,thumbnailUrl:thumb}),{headers:{...C,"Content-Type":"application/json"}});
}catch(e){
return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...C,"Content-Type":"application/json"}});
}
});