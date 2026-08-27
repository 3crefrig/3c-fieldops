import{serve}from"https://deno.land/std@0.177.0/http/server.ts";
import{create,getNumericDate}from"https://deno.land/x/djwt@v2.8/mod.ts";
import{decode as b64d,encode as b64e}from"https://deno.land/std@0.177.0/encoding/base64.ts";
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const SE=Deno.env.get("GOOGLE_SERVICE_EMAIL")||"";
const PK=(Deno.env.get("GOOGLE_PRIVATE_KEY")||"").replace(/\\n/g,"\n");
const IE=Deno.env.get("GOOGLE_IMPERSONATE_EMAIL")||"service@3crefrigeration.com";
// Google token cache — edge instances are reused; skip the OAuth roundtrip when
// a token from a previous invocation is still fresh (60 min validity, refresh @50).
let _gtok="";let _gtokExp=0;
async function gat(){
if(_gtok&&Date.now()<_gtokExp)return _gtok;
const p=PK.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"");
const k=await crypto.subtle.importKey("pkcs8",b64d(p),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
const j=await create({alg:"RS256",typ:"JWT"},{iss:SE,sub:IE,scope:"https://www.googleapis.com/auth/drive.file",aud:"https://oauth2.googleapis.com/token",iat:getNumericDate(0),exp:getNumericDate(3600)},k);
const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion="+j});
const d=await r.json();
if(d.error)throw new Error(d.error_description);
_gtok=d.access_token;_gtokExp=Date.now()+50*60*1000;
return _gtok;
}
// Folder-path → Drive folder id cache. The old code walked the full path
// ("3C FieldOps/Invoices/2026/August" = 4+ sequential Drive API calls) on EVERY
// upload. Folder ids are stable; if a cached folder was deleted the upload 404s
// and the caller re-walks once (see below).
const _folderCache=new Map<string,string>();
async function resolveFolder(token:string,folderPath:string,skipCache=false):Promise<string>{
  if(!skipCache){const c=_folderCache.get(folderPath);if(c)return c;}
  let pid:string|null=null;
  for(const pt of folderPath.split("/")){pid=await fof(token,pt,pid);}
  if(pid)_folderCache.set(folderPath,pid);
  return pid as string;
}
// Escape single-quotes/backslashes/control chars in a Drive query string literal —
// a folder name segment could otherwise break out of the q filter (query injection).
function dq(s){return String(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/[\r\n\t]+/g," ");}
async function fof(token,name,pid){
const q=encodeURIComponent("name='"+dq(name)+"' and mimeType='application/vnd.google-apps.folder'"+(pid?" and '"+dq(pid)+"' in parents":"")+" and trashed=false");
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
  // 5-min pass cache — skips the users-table roundtrip on repeat calls from the
  // same (gateway-verified) token.
  const hit=__okCache.get(token);
  if(hit&&Date.now()<hit)return null;
  try{
    const base=Deno.env.get("SUPABASE_URL")||"";
    const q=await fetch(base+"/rest/v1/users?select=role&active=not.is.false&email=ilike."+encodeURIComponent(email),{headers:{apikey:svc,Authorization:"Bearer "+svc}});
    const rows=await q.json();
    if(!Array.isArray(rows)||rows.length===0)return deny(403,"not a registered user");
    if(__okCache.size>200)__okCache.clear();
    __okCache.set(token,Date.now()+5*60*1000);
    return null;
  }catch(_e){return deny(401,"auth check failed");}
}
const __okCache=new Map<string,number>();

serve(async(req)=>{
  const __d=await __guard(req, true); if(__d) return __d;
if(req.method==="OPTIONS")return new Response("ok",{headers:C});
try{
const _payload=await req.json();

// ── Image read-back mode ──────────────────────────────────────────────────
// drive.google.com serves thumbnails with no Access-Control-Allow-Origin, so
// the browser can't read their bytes to embed a photo in a generated PDF
// (service tickets). Uploaded files are already world-readable, so this just
// relays them back as data URIs. Ids only — never an arbitrary URL — so there
// is no SSRF surface.
if(_payload.fetchIds){
  const ids=(Array.isArray(_payload.fetchIds)?_payload.fetchIds:[]).filter((id:unknown)=>typeof id==="string"&&/^[A-Za-z0-9_-]{10,120}$/.test(id)).slice(0,40);
  const size=Math.min(2000,Math.max(100,parseInt(_payload.size)||900));
  const images:Record<string,string>={};
  await Promise.all(ids.map(async(id:string)=>{
    try{
      const r=await fetch("https://drive.google.com/thumbnail?id="+id+"&sz=w"+size,{redirect:"follow"});
      if(!r.ok)return;
      const ct=(r.headers.get("content-type")||"").split(";")[0]||"image/jpeg";
      if(!ct.startsWith("image/"))return;
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(!bytes.length||bytes.length>5_000_000)return;
      images[id]="data:"+ct+";base64,"+b64e(bytes);
    }catch(_e){/* one unreadable photo shouldn't fail the whole document */}
  }));
  return new Response(JSON.stringify({success:true,images}),{headers:{...C,"Content-Type":"application/json"}});
}

const{fileBase64,fileName,mimeType,folderPath}=_payload;
if(!fileBase64||!fileName)return new Response(JSON.stringify({error:"Missing file"}),{status:400,headers:{...C,"Content-Type":"application/json"}});
const token=await gat();
const path=(folderPath||"3C FieldOps");
const fb=b64d(fileBase64);
const enc=new TextEncoder();
const doUpload=async(pid:string)=>{
  const bn="b_"+Date.now();
  const mt=JSON.stringify({name:fileName,parents:[pid]});
  const hd=enc.encode("--"+bn+"\r\nContent-Type: application/json\r\n\r\n"+mt+"\r\n--"+bn+"\r\nContent-Type: "+(mimeType||"image/jpeg")+"\r\n\r\n");
  const ft=enc.encode("\r\n--"+bn+"--");
  const body=new Uint8Array(hd.length+fb.length+ft.length);
  body.set(hd,0);body.set(fb,hd.length);body.set(ft,hd.length+fb.length);
  const up=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"multipart/related; boundary="+bn},body:body});
  return await up.json();
};
const hadCache=_folderCache.has(path);
let file=await doUpload(await resolveFolder(token,path));
if(file.error&&hadCache){
  // Cached folder may have been deleted/moved in Drive — re-walk the path once.
  _folderCache.delete(path);
  file=await doUpload(await resolveFolder(token,path,true));
}
if(file.error)return new Response(JSON.stringify({error:file.error.message}),{status:400,headers:{...C,"Content-Type":"application/json"}});
await fetch("https://www.googleapis.com/drive/v3/files/"+file.id+"/permissions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({role:"reader",type:"anyone"})});
const thumb="https://drive.google.com/thumbnail?id="+file.id+"&sz=w400";
return new Response(JSON.stringify({success:true,fileId:file.id,webViewLink:file.webViewLink,thumbnailUrl:thumb}),{headers:{...C,"Content-Type":"application/json"}});
}catch(e){
return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...C,"Content-Type":"application/json"}});
}
});