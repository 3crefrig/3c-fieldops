// send-push — Supabase Edge Function
// Sends Web Push notifications to a target audience (by user id, name, or role),
// and exposes the VAPID application server key for client subscription.
//
// Actions (POST JSON):
//   { "action": "pubkey" }                                  → { applicationServerKey }
//   { "title", "body", "url"?, "userIds"?, "userNames"?, "roles"? } → { sent, removed, targets }
//
// Secrets: VAPID_KEYS_JSON, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LOGO = "https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
function alertEmailHtml(title: string, msg: string, url: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f6f8;padding:20px 0;">
    <table role="presentation" style="max-width:480px;width:100%;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e6ea;">
      <tr><td style="background:#1B3A5C;padding:14px;text-align:center;"><img src="${LOGO}" alt="3C" style="height:26px;"/></td></tr>
      <tr><td style="height:3px;background:#00B7E8;"></td></tr>
      <tr><td style="padding:22px 24px;">
        <div style="font-size:16px;font-weight:800;color:#1B3A5C;">${title}</div>
        <div style="font-size:14px;color:#333;margin-top:8px;line-height:1.5;">${msg || ""}</div>
        <a href="${url}" style="display:inline-block;margin-top:16px;background:#00B7E8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:6px;">Open in 3C FieldOps →</a>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#fafbfc;border-top:1px solid #eef1f4;text-align:center;font-size:11px;color:#9aa0a6;">
        3C Refrigeration · Tip: add a Gmail filter for <strong>subject: [3C Alert]</strong> to auto-file these in their own folder.
      </td></tr>
    </table>
  </div>`;
}

// Lazily build the ApplicationServer once per warm instance.
let _appServer: any = null;
let _pubKey: string | null = null;
async function getServer() {
  if (_appServer) return _appServer;
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get("VAPID_KEYS_JSON")!));
  _pubKey = await webpush.exportApplicationServerKey(vapidKeys);
  _appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:service@3crefrigeration.com",
    vapidKeys,
  });
  return _appServer;
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

serve(async (req) => {
  const __d=await __guard(req, true); if(__d) return __d;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const appServer = await getServer();
    const body = await req.json().catch(() => ({}));

    if (body.action === "pubkey") {
      return json({ applicationServerKey: _pubKey });
    }

    const { title, body: message, url, userIds = [], userNames = [], roles = [], emailFallback = false } = body;
    if (!title && !message) return json({ error: "title/body required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolve target user records from ids + names + roles.
    const ids = new Set<string>(userIds);
    if (userNames.length) {
      const { data } = await db.from("users").select("id").in("name", userNames);
      (data || []).forEach((u: any) => ids.add(u.id));
    }
    if (roles.length) {
      const { data } = await db.from("users").select("id").in("role", roles).neq("active", false);
      (data || []).forEach((u: any) => ids.add(u.id));
    }
    if (ids.size === 0) return json({ sent: 0, removed: 0, emailed: 0, targets: 0 });

    const { data: targetUsers } = await db.from("users").select("id, name, email").in("id", [...ids]);
    const { data: subs } = await db.from("push_subscriptions").select("*").in("user_id", [...ids]);
    const subsByUser = new Map<string, any[]>();
    for (const s of subs || []) {
      const arr = subsByUser.get(s.user_id) || [];
      arr.push(s);
      subsByUser.set(s.user_id, arr);
    }

    const payload = JSON.stringify({ title: title || "3C FieldOps", body: message || "", url: url || "/" });
    let sent = 0, removed = 0, emailed = 0;

    for (const u of targetUsers || []) {
      const userSubs = subsByUser.get(u.id) || [];
      if (userSubs.length > 0) {
        // Device(s) subscribed → push (no email, keeps inbox clean).
        for (const s of userSubs) {
          try {
            await appServer.subscribe(s.subscription).pushTextMessage(payload, {});
            sent++;
          } catch (e: any) {
            const status = e?.response?.status ?? 0;
            const msg = String(e?.message || e);
            if (status === 404 || status === 410 || /410|404|gone|expired/i.test(msg)) {
              await db.from("push_subscriptions").delete().eq("id", s.id);
              removed++;
            } else {
              console.error("push send error:", status, msg);
            }
          }
        }
      } else if (emailFallback && u.email) {
        // No push on any device → send a filterable [3C Alert] email instead.
        try {
          const resp = await fetch(SUPABASE_URL + "/functions/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + ANON },
            body: JSON.stringify({
              to: u.email,
              subject: "[3C Alert] " + (title || "3C FieldOps"),
              body: alertEmailHtml(title || "3C FieldOps", message || "", url || "https://3c-fieldops.vercel.app"),
            }),
          });
          if (resp.ok) emailed++;
        } catch (e) {
          console.error("alert email error:", String(e));
        }
      }
    }
    return json({ sent, removed, emailed, targets: ids.size });
  } catch (err) {
    console.error("send-push error:", err);
    return json({ error: String(err) }, 500);
  }
});
