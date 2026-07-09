# 3C Refrigeration FieldOps Pro — Claude Code Migration Plan

## Current Architecture
- **Frontend:** Single React SPA (`App.jsx` ~1,425 lines)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Hosting:** Vercel (auto-deploys from GitHub)
- **Repo:** GitHub → StackBlitz → Vercel
- **File Storage:** Google Drive (via Edge Function)
- **Email:** Gmail API (via Edge Function)

## GitHub Repo Structure (current)
```
3c-fieldops/
├── src/
│   └── App.jsx          ← entire app in one file
├── package.json
└── index.html
```

## Target Structure (after migration)
```
3c-fieldops/
├── src/
│   ├── App.jsx              ← main entry, router, auth
│   ├── config.js            ← Supabase URL, keys, theme
│   ├── theme.js             ← dark/light theme colors
│   ├── utils/
│   │   ├── supabase.js      ← client init
│   │   ├── profanity.js     ← filter
│   │   └── helpers.js       ← genPO, haptic, etc.
│   ├── components/
│   │   ├── ui/              ← Card, Badge, Modal, Toast, StatCard, Spinner, Logo
│   │   ├── SignaturePad.jsx
│   │   ├── CameraUpload.jsx
│   │   └── NotifBell.jsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── LoginScreen.jsx
│   │   │   └── FirstSetup.jsx
│   │   ├── shell/
│   │   │   └── Shell.jsx
│   │   ├── workorders/
│   │   │   ├── WODetail.jsx
│   │   │   ├── WOList.jsx
│   │   │   ├── WOOverview.jsx
│   │   │   ├── CreateWO.jsx
│   │   │   └── ActivityLog.jsx
│   │   ├── purchasing/
│   │   │   ├── POReqModal.jsx
│   │   │   ├── POEditForm.jsx
│   │   │   └── POMgmt.jsx
│   │   ├── billing/
│   │   │   ├── BillingExport.jsx
│   │   │   └── InvoiceGenerator.jsx
│   │   ├── projects/
│   │   │   ├── ProjectList.jsx
│   │   │   ├── ProjectDetail.jsx
│   │   │   └── Projects.jsx
│   │   ├── knowledge/
│   │   │   └── KnowledgeBase.jsx
│   │   ├── settings/
│   │   │   ├── UserMgmt.jsx
│   │   │   ├── CustomerMgmt.jsx
│   │   │   ├── RecurringPM.jsx
│   │   │   └── Settings.jsx
│   │   └── dashboards/
│   │       ├── TechDash.jsx
│   │       ├── MgrDash.jsx
│   │       ├── AdminDash.jsx
│   │       └── DashAnalytics.jsx
│   ├── hooks/
│   │   ├── useData.js       ← data loading, realtime, targeted reloads
│   │   └── useActions.js    ← CRUD operations, withSync, withTableSync
│   └── styles/
│       └── index.css        ← global styles, animations
├── supabase/
│   └── functions/
│       ├── send-email/
│       │   └── index.ts
│       ├── drive-upload/
│       │   └── index.ts
│       └── generate-invoice/
│           └── index.ts
├── package.json
├── vite.config.js
└── .env                     ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## Supabase Project Details
- **Project ID:** gwwijjkahwieschfdfbq
- **URL:** https://gwwijjkahwieschfdfbq.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3d2lqamthaHdpZXNjaGZkZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NzYsImV4cCI6MjA4ODIzODU3Nn0.c79jtEZv9CQ8P2CC6NXyrKqax510530tAMhLnNt75TI
- **Service Account:** fieldops-mailer@c-field-ops.iam.gserviceaccount.com

## Database Tables (all current)
- work_orders, purchase_orders, time_entries, photos, users
- schedule, recurring_templates, notifications, customers
- email_templates, email_contacts, projects
- project_chambers, project_milestones, project_parts
- project_notes, project_photos, project_drawings
- wo_activity, kb_articles, kb_files

## Edge Functions Deployed
1. send-email (Gmail API)
2. drive-upload (Google Drive API)
3. generate-invoice (Excel generation)

## Secrets Set in Supabase
- GOOGLE_SERVICE_EMAIL
- GOOGLE_IMPERSONATE_EMAIL
- GOOGLE_PRIVATE_KEY

## Migration Steps (SAFE — zero downtime)

### Step 1: Set up Claude Code environment
- Install Claude Code CLI
- Clone the GitHub repo
- Set up .env with Supabase credentials
- Install dependencies

### Step 2: Split App.jsx into components (NO functionality changes)
- Extract each component to its own file
- Add proper imports/exports
- Verify build compiles
- Test on Vercel preview (not production)

### Step 3: Verify everything works identically
- Test every feature on preview URL
- Compare against production
- Only merge to main when 100% verified

### Step 4: Continue development in Claude Code
- All future changes happen in proper component files
- Git history for every change
- Compile-time error checking

## Recommended MCPs for Claude Code
1. **Supabase MCP** — query DB, manage tables, deploy functions directly
2. **GitHub MCP** — commit, push, create branches, PRs
3. **Vercel MCP** — check deployments, view logs, manage preview URLs
4. **File System** — already built into Claude Code

## Recommended Claude Code Skills/Tools
- ESLint for catching React errors before deploy
- Vite dev server for local testing
- Supabase CLI for Edge Function development
- TypeScript migration (optional, future)
