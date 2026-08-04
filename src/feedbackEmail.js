// Branded "how did we do?" review-request email. Returns {subject, body} for the
// send-email edge function. Inline styles only (email-client safe) — same visual
// system as onboardingEmail.js (navy header, cyan stripe, white card).
const LOGO = "https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png";
const CYAN = "#00B7E8";
const NAVY = "#1B3A5C";

const GOLD = "#F5A623";

export function buildFeedbackEmail({ customerName, invoiceNum, feedbackUrl }) {
  // Tapping a star lands on the review form with that rating preselected.
  // Text ★ glyphs, not emoji — consistent across mail clients and not cartoonish.
  const starLink = (n) => `
    <td style="text-align:center;padding:0 2px;">
      <a href="${feedbackUrl}?s=${n}" style="text-decoration:none;color:${GOLD};font-size:36px;line-height:1;display:inline-block;padding:4px 6px;font-family:Arial,sans-serif;">&#9733;</a>
      <div style="font-size:10px;color:#9aa0a6;font-family:Arial,sans-serif;">${n}</div>
    </td>`;

  const body = `
  <div style="background:#f5f6f8;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e6ea;">
      <tr>
        <td style="background:${NAVY};padding:22px 28px;text-align:center;">
          <img src="${LOGO}" alt="3C Refrigeration" style="height:34px;max-width:260px;display:inline-block;"/>
        </td>
      </tr>
      <tr><td style="height:4px;background:${CYAN};"></td></tr>
      <tr>
        <td style="padding:30px 28px 6px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:${NAVY};">How did we do?</div>
          <div style="font-size:14px;color:#444;line-height:1.6;margin-top:10px;text-align:left;">
            Thanks for having us out${customerName ? `, <strong>${customerName}</strong>` : ""}.
            If you have 30 seconds, let us know how the job went${invoiceNum ? ` (Invoice ${invoiceNum})` : ""}. It goes straight to our team.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px 4px;text-align:center;">
          <div style="font-size:12px;color:#8a8f96;margin-bottom:6px;">Tap a star to get started</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>${[1, 2, 3, 4, 5].map(starLink).join("")}</tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 8px;">
          <a href="${feedbackUrl}" style="display:block;background:${CYAN};color:#ffffff;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:8px;font-family:Arial,sans-serif;">Leave a review</a>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 28px 24px;text-align:center;">
          <div style="font-size:12px;color:#8a8f96;line-height:1.6;">
            Prefer to just reply to this email? That works too.
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#fafbfc;border-top:1px solid #eef1f4;padding:14px 28px;text-align:center;font-size:11px;color:#9aa0a6;">
          3C Refrigeration LLC · Elon, NC · (336) 264-0935 · service@3crefrigeration.com
        </td>
      </tr>
    </table>
  </div>`;

  return { subject: "How did we do? - 3C Refrigeration", body };
}
