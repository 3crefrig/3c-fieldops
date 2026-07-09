// Branded onboarding email for new technicians. Returns an HTML string suitable
// for the send-email edge function. Inline styles only (email-client safe).
const LOGO = "https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
const CYAN = "#00B7E8";
const NAVY = "#1B3A5C";

export function buildOnboardingEmail(user, appUrl) {
  const first = (user?.name || "").trim().split(/\s+/)[0] || "there";
  const url = appUrl || "https://3c-fieldops.vercel.app";
  const step = (n, title, body) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #eef1f4;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="width:34px;vertical-align:top;">
              <div style="width:26px;height:26px;border-radius:50%;background:${CYAN};color:#fff;font-weight:800;font-size:13px;text-align:center;line-height:26px;font-family:Arial,sans-serif;">${n}</div>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:15px;font-weight:700;color:${NAVY};font-family:Arial,sans-serif;margin-bottom:3px;">${title}</div>
              <div style="font-size:13px;color:#444;line-height:1.5;font-family:Arial,sans-serif;">${body}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return `
  <div style="background:#f5f6f8;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e6ea;">
      <tr>
        <td style="background:${NAVY};padding:22px 28px;text-align:center;">
          <img src="${LOGO}" alt="3C Refrigeration" style="height:34px;max-width:260px;display:inline-block;"/>
        </td>
      </tr>
      <tr>
        <td style="height:4px;background:${CYAN};"></td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;">
          <div style="font-size:20px;font-weight:800;color:${NAVY};">Welcome to the team, ${first}! 👋</div>
          <div style="font-size:14px;color:#444;line-height:1.6;margin-top:8px;">
            You've been set up in <strong>3C FieldOps Pro</strong> — the app we use in the field for work orders, time, photos, and more. Here's how to get going. It takes about 2 minutes.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 4px;">
          <a href="${url}" style="display:block;background:${CYAN};color:#ffffff;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:8px;font-family:Arial,sans-serif;">Open 3C FieldOps →</a>
          <div style="font-size:11px;color:#8a8f96;text-align:center;margin-top:6px;">${url.replace(/^https?:\/\//, "")}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 28px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            ${step(1, "Sign in with Google", `Tap <strong>Sign in with Google</strong> and choose <strong>${user?.email || "your work email"}</strong>. Use that exact account — it's the one we added for you.`)}
            ${step(2, "Add it to your home screen", `<strong>iPhone (Safari):</strong> tap the Share icon → <em>Add to Home Screen</em>. <strong>Android (Chrome):</strong> tap the ⋮ menu → <em>Install app</em>. This makes it open like a real app and lets it send you job alerts.`)}
            ${step(3, "Turn on notifications", `When the app asks, tap <strong>Allow</strong>. You'll get a buzz on your phone when a work order is assigned to you or a deadline is coming up — no need to keep checking.`)}
            ${step(4, "You're ready", `From <strong>My Day</strong> you can see your jobs, log your hours, snap photos, scan receipts, and look things up in the Knowledge Base.`)}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 28px 24px;">
          <div style="background:#f0f9fd;border:1px solid #cdeef9;border-radius:8px;padding:12px 14px;font-size:12.5px;color:#345;line-height:1.6;">
            <strong style="color:${NAVY};">Need a hand?</strong> Reply to this email or call the office at <strong>(336) 264-0935</strong>. We're glad to have you aboard.
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#fafbfc;border-top:1px solid #eef1f4;padding:14px 28px;text-align:center;font-size:11px;color:#9aa0a6;">
          3C Refrigeration LLC · Elon, NC · service@3crefrigeration.com
        </td>
      </tr>
    </table>
  </div>`;
}
