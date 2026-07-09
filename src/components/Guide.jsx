import React, { useState } from "react";
import { B, F, M, IS } from "../shared";
import { Card } from "./ui";

// ── Guide content ─────────────────────────────────────────────
// audience controls who sees a section: technicians see 'all'+'technician';
// managers also see 'manager'; admins see everything. Keep steps short and
// tied to the real tab names so it matches what the user is looking at.
const SECTIONS = [
  {
    id: "start", title: "Getting Started", icon: "🚀", audience: "all",
    intro: "A two-minute setup so the app works like a real app on your phone.",
    steps: [
      ["Sign in", "Tap “Sign in with Google” and choose your 3C email (the one your admin added). Use that exact account every time."],
      ["Add to your home screen", "iPhone (Safari): Share → Add to Home Screen. Android (Chrome): ⋮ menu → Install app. Now it opens full-screen and can send you alerts."],
      ["Turn on job alerts", "When the “Turn on job alerts” bar appears, tap Enable, then Allow. You’ll get a buzz when work is assigned to you or a deadline is near."],
      ["Find anything fast", "Use the 🔍 search at the top to jump to a work order, PO, customer, or piece of equipment."],
      ["Light or dark", "Tap the ☀️/🌙 button (top-right) to switch themes. Pull down on any list to refresh."],
    ],
  },
  {
    id: "myday", title: "Your Day & Work Orders", icon: "📋", audience: "technician",
    intro: "Everything you need for the jobs assigned to you.",
    steps: [
      ["My Day", "The “My Day” tab shows your active jobs, today’s hours, and anything that still needs time logged. Start here every morning."],
      ["Open a work order", "Tap any job card to see the full work order — location, contact, description, notes, photos, and time."],
      ["Week Plan", "The “Week Plan” tab lays out your upcoming jobs by day so you can see what’s coming."],
      ["Recent jobs", "Your most recently worked orders sit at the top of My Day for one-tap access."],
    ],
  },
  {
    id: "time", title: "Logging Your Hours", icon: "⏱", audience: "technician",
    intro: "Log time as you go so nothing gets missed at day’s end.",
    steps: [
      ["Quick Log", "Tap the floating ⏱ button (bottom-right of My Day). Pick the work order, enter hours and a short note, and save."],
      ["From a work order", "Open a job and add time right on it — this also flips a Pending job to In Progress automatically."],
      ["Review your hours", "The “Hours” tab lists everything you’ve logged; tap an entry to edit."],
      ["End-of-day check", "If it’s after 3pm and you have under 4 hours logged, My Day reminds you — don’t forget to log before you leave."],
    ],
  },
  {
    id: "photos", title: "Photos, Receipts & Parts", icon: "📷", audience: "technician",
    intro: "Document the work and capture what you bought.",
    steps: [
      ["Add photos", "On a work order, use the camera button to snap before/after photos. They’re compressed and saved automatically."],
      ["Scan a receipt", "When creating a purchase, tap “📷 Scan Receipt” — the app reads the vendor, amount, and items for you. Double-check before saving."],
      ["Request a PO", "Need parts? Open the work order and request a Purchase Order. Leave the price blank if you don’t know it — a manager fills it in before approving."],
    ],
  },
  {
    id: "complete", title: "Completing a Job", icon: "✅", audience: "technician",
    intro: "Close out work orders cleanly.",
    steps: [
      ["Do the work write-up", "Fill in what you performed and any field notes on the work order before completing."],
      ["Two-step complete", "Marking a job complete is a two-step confirm so nothing closes by accident."],
      ["TMS toggle", "If the customer uses TMS, use the one-tap TMS toggle to mark it entered."],
    ],
  },
  {
    id: "equipmentkb", title: "Equipment & Knowledge Base", icon: "🔧", audience: "technician",
    intro: "Look things up in the field.",
    steps: [
      ["Equipment", "The “Equipment” tab lists customer units — model, serial, warranty, and service history. Search by model, serial, or asset tag."],
      ["Knowledge Base", "The “Knowledge” tab has how-to articles and reference docs approved by management."],
      ["RFQs", "Under “RFQs” you can draft a parts-pricing request to a vendor. (Pricing and sending are handled by managers.)"],
    ],
  },
  {
    id: "inbox", title: "Service Requests (Inbox)", icon: "📬", audience: "manager",
    intro: "Turn incoming emails into work orders.",
    steps: [
      ["Scan the inbox", "In “Requests”, tap Scan Inbox to pull new service emails. The app reads each one and drafts a work order (2-hour cooldown between scans)."],
      ["Review a draft", "Open a draft to see the original email and the AI-extracted fields. Fix anything, assign a tech, set a due date."],
      ["Approve into a WO", "Tap Approve & Create WO to turn it into a real work order. You can bulk-approve or bulk-reject multiple requests at once."],
    ],
  },
  {
    id: "managewo", title: "Assigning & Managing Work Orders", icon: "🗂", audience: "manager",
    intro: "Keep the board moving.",
    steps: [
      ["All work orders", "The “Work Orders” tab shows everything. Filter by status/customer and use bulk actions on multiple orders."],
      ["Assign a tech", "Open a WO and set the assignee — the tech gets a push (or an email if they haven’t enabled push)."],
      ["Week Plan", "Use “Week Plan” to see and balance the crew’s schedule across the week."],
      ["Repeat failures", "The Overview flags equipment/locations with 3+ corrective jobs in 90 days so you can plan a replacement."],
    ],
  },
  {
    id: "pos", title: "Purchase Orders & RFQs", icon: "🧾", audience: "manager",
    intro: "Approve spend and request vendor pricing.",
    steps: [
      ["Approve/reject POs", "In “PO Mgmt”, set an amount if the tech left it blank, then Approve or Reject. The requester gets notified."],
      ["Create an RFQ", "In “RFQs”, click New RFQ, add the vendor, line items, and notes. The app builds a branded .docx request."],
      ["Review & send", "Open an RFQ → Review & Send → Approve, then Send to Vendor. It emails the vendor the document. Record their quoted prices when they reply."],
    ],
  },
  {
    id: "billing", title: "Billing & Invoices", icon: "💰", audience: "manager",
    intro: "Get paid for completed work.",
    steps: [
      ["Billing export", "The “Billing” tab exports timesheets/customer summaries (Excel + email)."],
      ["Invoices", "The “Invoices” tab lists all invoices with status. Click an invoice to preview the PDF right in the app; you can also send or mark paid."],
      ["From a project", "On a project’s Invoices tab, tap any invoice to preview its PDF inline."],
    ],
  },
  {
    id: "projects", title: "Projects", icon: "🏗️", audience: "manager",
    intro: "Run larger multi-part jobs.",
    steps: [
      ["Project detail", "Open a project for chambers, milestones, parts, photos, drawings, notes, team, POs, and invoices."],
      ["Budget tracker", "Managers see budget vs. actual with labor cost roll-ups."],
      ["Link work", "Create work orders and POs directly from a project so everything rolls up in one place."],
    ],
  },
  {
    id: "reports", title: "Reports, Customers & More", icon: "📈", audience: "manager",
    intro: "The numbers and the relationships.",
    steps: [
      ["Overview / KPIs", "The Overview tab has first-time-fix rate, utilization, revenue, AR, and 8-week trends."],
      ["Reports", "The “Reports” tab breaks performance down by tech, customer, and job type."],
      ["Customers", "Manage customers, contacts, rates, and billing settings under “Customers”."],
      ["Agreements & Equipment", "Track service agreements (with renewal reminders) and customer equipment (with warranty alerts)."],
      ["Team", "The “Team” tab shows each tech’s active/done counts, hours, and who’s online."],
    ],
  },
  {
    id: "users", title: "Users & Onboarding", icon: "👤", audience: "manager",
    intro: "Add and manage people.",
    steps: [
      ["Add a user", "In “Users”, tap + New User. Enter their name, exact Google email, and role. New technicians get a welcome email automatically."],
      ["Resend onboarding", "Use the “✉ Onboard” button next to anyone to (re)send the getting-started email."],
      ["Activate / deactivate", "Deactivate someone to block login without deleting their history."],
    ],
  },
  {
    id: "adminextra", title: "Admin: Proposals, PM & Settings", icon: "⚙️", audience: "admin",
    intro: "Owner/admin-only tools.",
    steps: [
      ["Proposals", "The “Proposals” tab generates branded proposals (AI-assisted) you can send for e-approval."],
      ["PM Schedule", "Under “PM Schedule”, set recurring maintenance templates — the app auto-generates the work orders when they’re due."],
      ["Settings & rates", "The “Settings” tab holds company settings, email templates, PO auto-approve threshold, daily-hour limits, and billing/cost rates."],
      ["Feedback", "The “Feedback” tab collects customer ratings from invoice follow-ups."],
    ],
  },
  {
    id: "alerts", title: "Notifications & Alerts", icon: "🔔", audience: "all",
    intro: "How the app reaches you.",
    steps: [
      ["Push notifications", "After you tap Enable + Allow, you get a phone notification when work is assigned or a PO decision is made — even with the app closed."],
      ["Email fallback", "If a tech hasn’t enabled push, the same alert arrives as a “[3C Alert]” email instead."],
      ["Keep alert emails tidy", "In Gmail, make a filter for “subject: [3C Alert]” → apply a label + skip inbox, so alerts land in their own folder."],
      ["The bell", "The 🔔 at the top shows recent notifications; managers can quick-approve POs right from it."],
    ],
  },
];

function canSee(audience, role) {
  if (role === "admin") return true;
  if (role === "manager") return audience === "all" || audience === "technician" || audience === "manager";
  return audience === "all" || audience === "technician";
}

function HelpGuide({ userRole, userName }) {
  const [open, setOpen] = useState("start");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const visible = SECTIONS.filter((s) => canSee(s.audience, userRole)).filter((s) => {
    if (!query) return true;
    if (s.title.toLowerCase().includes(query) || s.intro.toLowerCase().includes(query)) return true;
    return s.steps.some(([t, d]) => (t + " " + d).toLowerCase().includes(query));
  });
  const roleLabel = userRole === "admin" ? "Admin" : userRole === "manager" ? "Manager" : "Technician";

  return (
    <div>
      <Card style={{ padding: "16px 18px", marginBottom: 14, borderLeft: "3px solid " + B.cyan }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: B.text }}>📘 Guide {userName ? "— " + (userName.split(" ")[0]) : ""}</div>
        <div style={{ fontSize: 12.5, color: B.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          A quick how-to for everything you’ll use, tailored to your <strong style={{ color: B.cyan }}>{roleLabel}</strong> access. Tap a section to expand. New here? Start with <em>Getting Started</em>.
        </div>
      </Card>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide…" style={{ ...IS, marginBottom: 12, padding: "9px 12px", fontSize: 13 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.length === 0 && <div style={{ textAlign: "center", padding: 30, color: B.textDim, fontSize: 12 }}>No guide topics match “{q}”.</div>}
        {visible.map((s) => {
          const isOpen = open === s.id || !!query;
          return (
            <Card key={s.id} style={{ padding: 0, overflow: "hidden" }}>
              <div onClick={() => setOpen(isOpen && !query ? null : s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", cursor: "pointer", userSelect: "none" }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: B.textDim, marginTop: 1 }}>{s.intro}</div>
                </div>
                <span style={{ color: B.textDim, fontSize: 11, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
              </div>
              {isOpen && (
                <div style={{ padding: "4px 16px 14px", borderTop: "1px solid " + B.border }}>
                  {s.steps.map(([t, d], i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < s.steps.length - 1 ? "1px solid " + B.border + "60" : "none" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: B.cyan + "22", color: B.cyan, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: M }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{t}</div>
                        <div style={{ fontSize: 12.5, color: B.textMuted, lineHeight: 1.5, marginTop: 2 }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        <div style={{ textAlign: "center", fontSize: 11, color: B.textDim, marginTop: 8, lineHeight: 1.5 }}>
          Still stuck? Call the office at (336) 264-0935 or email service@3crefrigeration.com.
        </div>
      </div>
    </div>
  );
}

export { HelpGuide };
