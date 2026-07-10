// Client-side Web Push registration. Subscribes the device to push and stores
// the subscription in push_subscriptions so the send-push function can reach it.
import { sb, SUPABASE_URL, SUPABASE_ANON_KEY , fnFetch } from "./shared";

function urlB64ToUint8(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

// Subscribe this device and persist the subscription for `userId`.
// promptIfNeeded=false skips the permission prompt (use for silent refresh).
export async function registerPush(userId, { promptIfNeeded = true } = {}) {
  try {
    if (!pushSupported() || !userId) return { ok: false, reason: "unsupported" };
    if (Notification.permission === "denied") return { ok: false, reason: "denied" };
    if (Notification.permission === "default") {
      if (!promptIfNeeded) return { ok: false, reason: "default" };
      const p = await Notification.requestPermission();
      if (p !== "granted") return { ok: false, reason: p };
    }
    const reg = await navigator.serviceWorker.ready;
    const resp = await fnFetch("send-push",{ action: "pubkey" });
    const { applicationServerKey } = await resp.json();
    if (!applicationServerKey) return { ok: false, reason: "no-key" };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(applicationServerKey),
      });
    }
    const subJson = sub.toJSON();
    const { error } = await sb()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subJson.endpoint,
          subscription: subJson,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    console.warn("registerPush error:", e);
    return { ok: false, reason: e.message };
  }
}

export async function disablePush() {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const ep = sub.endpoint;
      await sub.unsubscribe();
      await sb().from("push_subscriptions").delete().eq("endpoint", ep);
    }
  } catch (e) {
    /* ignore */
  }
}
