# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

3C FieldOps Pro — a field operations management app for 3C Refrigeration. Manages work orders, purchase orders, time tracking, invoicing, and project management. Built for three user roles: Admin, Manager, Technician, plus a customer portal.

## Tech Stack

- **React 18** (Create React App) — pure JavaScript, no TypeScript
- **Supabase** — auth, database, realtime subscriptions, storage, edge functions
- **No external UI library** — all components use inline CSS-in-JS style objects
- **No routing library** — manual hash-based routing (`/#/portal/{slug}` for customer portal, tab state for main nav)
- **No state management library** — React hooks + localStorage only

## Build Commands

```bash
npm start        # Dev server
npm run build    # Production build
npm test         # Run tests (jest/react-scripts, no tests written yet)
```

## Architecture

**The entire application lives in `src/App.jsx` (~1400 lines).** This is a single monolithic component containing all business logic, UI components, and styling. There are no separate component files.

### Key architectural patterns:
- **Supabase client** instantiated at module top with hardcoded URL/anon key
- **Theme system**: dark/light themes stored in localStorage (`fieldops-theme`), colors defined as `DARK`/`LIGHT` objects
- **Style constants**: `IS` (input), `LS` (label), `BP` (button primary), `BS` (button secondary) — reused across all components
- **Fonts**: `F` = Barlow (UI), `M` = JetBrains Mono (data/mono)
- **Data shape**: single `data` state object with keys: `wos`, `pos`, `time`, `photos`, `users`, `schedule`, `templates`, `notifs`, `customers`, `emailTemplates`, `projects`
- **Realtime sync**: Supabase channel subscription on all public tables + 30s polling fallback
- **Profanity filter**: `hasProfanity()` / `cleanText()` applied to user-facing text inputs

### Major internal components (all in App.jsx):
- `Shell` — main app wrapper with tab navigation
- `LoginScreen` / `FirstSetup` — auth flow
- `TechDash` / `MgrDash` / `AdminDash` — role-based dashboards
- `WOList` / `WODetail` / `CreateWO` / `WOOverview` — work order CRUD
- `POReqModal` / `POEditForm` / `POMgmt` — purchase orders
- `TimeLog` / `BillingExport` / `InvoiceGenerator` — billing
- `ProjectList` / `ProjectDetail` / `Projects` — project management
- `CustomerPortal` — public customer-facing portal
- `SignaturePad` / `CameraUpload` — canvas signature and image capture with compression

### Supabase Edge Functions:
- `/functions/v1/drive-upload` — uploads files to Google Drive, returns thumbnail
- `/functions/v1/send-email` — sends emails with optional XLSX attachment

### ID generation:
PO/WO IDs use `YYMM` prefix + zero-padded sequence number (e.g., `2503001`).

## Database Tables

Core: `work_orders`, `purchase_orders`, `time_entries`, `photos`, `users`, `customers`, `projects`, `project_chambers`, `project_milestones`, `project_parts`, `project_notes`, `project_photos`, `project_drawings`

Supporting: `schedule`, `recurring_templates`, `notifications`, `email_templates`, `email_contacts`, `wo_activity`

RFQ: `rfqs`, `rfq_items`, `rfq_specs` (+ `rfq_items_public` view — price-free)

## RFQ Automation (Request for Quotation)

Upstream of POs: a manager/tech drafts a part-pricing request to a vendor, it renders as a branded `.docx`, and a manager reviews → approves → emails it to the vendor. Migration `20260708000000_rfq_automation.sql`.

- **Tables**: `rfqs` (rfq_ref unique, vendor, status draft→pending_approval→sent→quoted→closed, docx_path, created_by/approved_by), `rfq_items` (line items; `unit_price` blank on request, vendor fills), `rfq_specs` (optional label/value).
- **Role enforcement is at the DB layer, not just UI**:
  - `current_app_role()` / `current_app_user_id()` — SECURITY DEFINER helpers that resolve the caller's app role/id from `public.users` by JWT email (roles are NOT in the JWT).
  - Base `rfq_items` (with `unit_price`) is SELECT-able only by managers/admins. Technicians read their own items through the `rfq_items_public` view, which omits `unit_price` entirely.
  - Technicians can create/edit/delete only their own `draft` RFQs and cannot advance status (send is manager-gated in RLS *and* in the `send-rfq` function).
- **Edge functions** (in `supabase/functions/`, must be deployed — see below):
  - `generate-rfq-docx` — Deno + `npm:docx`. Renders the exact 3C RFQ format, uploads to the public `rfq-docs` Storage bucket, writes `rfqs.docx_path`. Fetches the letterhead logo and **fails loudly (502)** if it can't be loaded.
  - `send-rfq` — verifies the caller is manager/admin from their JWT, requires the RFQ to be approved + have a vendor email + docx, then emails the `.docx` via the existing `send-email` function and sets status `sent` + `sent_at`. Called with the user's **access token** (not the anon key).
- **RFQ ref format**: `3C-RFQ-<descriptor>` (slugified tag) or `3C-RFQ-0042` (zero-padded sequence) when no tag; `-2/-3…` on collision (`genRfqRef` in `shared.js`).

### Manual steps to finish deploying RFQs
1. **Deploy the edge functions** (not auto-deployed): `npx supabase functions deploy generate-rfq-docx` and `npx supabase functions deploy send-rfq` (with `SUPABASE_ACCESS_TOKEN` set), or via the Management API.
2. **Logo — DONE**: the rectangular R1 letterhead logo (8.72:1, autocropped transparent) is uploaded to `rfq-docs/assets/logo.png` (public) and the `RFQ_LOGO_URL` secret points at it. The docx letterhead renders it at 260px wide. To swap logos later: re-upload that path (or repoint the secret) and redeploy `generate-rfq-docx`.
3. **Secrets**: `send-rfq` and `generate-rfq-docx` reuse existing secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`). Outbound email reuses the already-wired `send-email` (Gmail). Only optional new secret: `RFQ_LOGO_URL`.
4. The migration is already applied to project `gwwijjkahwieschfdfbq` (additive only — no existing table/data changed).

## Notifications & Alerts

- **In-app notifications** — `notifications` table + `NotifBell`; `notify(type,title,message,for_role)` inserts them.
- **Web Push (free)** — `push_subscriptions` table (RLS via `current_app_*`), `send-push` edge function (`jsr:@negrel/webpush` + VAPID; secret `VAPID_KEYS_JSON`). `sw.js` has `push`/`notificationclick` handlers. Client: `src/push.js` `registerPush(userId)` subscribes + stores; a Shell banner ("Turn on job alerts") prompts users, and App silently refreshes the subscription on login if already granted. **Each user must tap "Allow" once** (per-device; iOS needs 16.4+ and Add-to-Home-Screen).
- **`send-push` payload:** `{title, body, url?, userIds?, userNames?, roles?, emailFallback?}` — also `{action:"pubkey"}` returns the client key. It pushes to every subscribed device of the target users; users with **no** push subscription get a filterable **`[3C Alert]`** email instead (only when `emailFallback:true`), so push users get zero inbox clutter.
- **Wired events** (in App.jsx actions): WO created/assigned → assignee; PO approval-needed → managers/admins; PO approved/rejected → requester.
- **Gmail folder for `[3C Alert]` emails:** the sender can't set a recipient's folder, so each tech adds a one-time Gmail filter (search `subject:[3C Alert]` → Create filter → Apply label + Skip inbox). Workspace admins can push this as an org filter for @3crefrigeration.com accounts.

## Project Files

The project **Files** tab (ProjectDetail, tab key still `drawings` internally) lets managers/techs attach **any file type** (PDF, images, drawings, specs, manuals, submittals, contracts, permits) to a project so techs can open them on their phone. Migration `20260709020000_project_files.sql`.

- Uploads go to the **public `project-files` Storage bucket** (path `{project_id}/{ts}_{safeName}`, 25MB cap) → a direct public URL that opens on any device (no Google-Drive access wall — the old `drive-upload` `webViewLink` often forced a "request access" screen).
- Rows live in `project_drawings` (added columns `mime_type`, `size_bytes`, `category`). Old Drive-hosted drawings still render (generic icon, no category chip).
- `upFile(file)` client-side uploads via `sb().storage`; category chosen from a dropdown (`FILE_CATS`). Storage RLS: public read, authenticated insert/delete. List shows a type icon, category chip, size, uploader, date; managers can delete (also removes the storage object).
- **Photos** tab (camera → `drive-upload` → `project_photos`) is unchanged and separate.

## New-Tech Onboarding Email

`src/onboardingEmail.js` `buildOnboardingEmail(user, appUrl)` → branded HTML (sign-in, install-to-home-screen, enable notifications, what-you-can-do). Sent via `send-email`. **Auto-sends when a new technician is added** (App `addUser`); manual **"✉ Onboard"** button per user in User Management (`A.sendOnboardingEmail`).

## AI Models / Cost

All AI runs on the Anthropic API via edge functions. Model tiers (as of 2026-07-09):
- **Haiku 4.5** (`claude-haiku-4-5-20251001`, ~$1/$5 per MTok): `scan-document`, `scan-receipt`, `process-inbox`, `job-intelligence`, `predict-parts`, `summarize-work`, `email-to-proposal`.
- **Sonnet 4** (`claude-sonnet-4-20250514`, ~$3/$15, retires 2026-06-15): `ai-troubleshoot`, `generate-proposal` (kept on Sonnet for advice/proposal quality — migrate to `claude-sonnet-4-6` before retirement).
- All AI is **opt-in per action** (button taps / manual inbox scan). Actual spend is near $0/mo at current usage; projected only a few $/mo even at healthy usage. Keep new AI features on Haiku unless quality demands Sonnet ([[feedback_ai_token_budget]]).

## Staged: rename_tech()

`public.rename_tech(user_id, old_name, new_name, new_email)` (migration `20260709010000`) renames a user account and relabels ALL historical attribution (assignee/crew/technician/actor/requested_by/uploaded_by/assigned_techs/schedule/recurring across ~593 rows). Verified via dry-run+rollback. Staged for the Emanuel Segura → Javier switch — call it once Javier's Gmail + full name are known.

## Status Values

- **WO status**: `pending` (orange), `in_progress` (cyan), `completed` (green)
- **PO status**: `pending` (orange), `approved` (green), `rejected` (red), `revised` (purple)
- **Roles**: `admin`, `manager`, `technician` — each with distinct color gradients and dashboard views

## Supabase Credentials
- Project ID: gwwijjkahwieschfdfbq
- URL: https://gwwijjkahwieschfdfbq.supabase.co
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3d2lqamthaHdpZXNjaGZkZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NzYsImV4cCI6MjA4ODIzODU3Nn0.c79jtEZv9CQ8P2CC6NXyrKqax510530tAMhLnNt75TI
- Google Service Account: fieldops-mailer@c-field-ops.iam.gserviceaccount.com
- Logo URL: https://gwwijjkahwieschfdfbq.supabase.co/storage/v1/object/public/photos/Main%20Logo%20-%20Transparent%20Bg%201.png

## Edge Functions Deployed
1. send-email — Gmail API via service account impersonating service@3crefrigeration.com
2. drive-upload — Google Drive file upload with folder creation
3. generate-invoice — Excel invoice generation matching customer templates

## Role Visibility Rules
- Techs: see own WOs + crew assignments, can view projects but not edit, no pricing except own POs, no billing/invoices/settings
- Managers: see all WOs, POs, billing, projects with budgets, can approve KB articles and POs
- Admins: everything managers see plus invoices, labor cost/profit, billing/cost rates on users, settings

## Pending Items
1. Backup package
2. RLS security fix (proper role-based policies)
3. Fully loaded labor cost calculator
4. Invoice Excel template exact formatting match
5. Offline mode
6. Code splitting (currently 1,425 lines in single App.jsx)
7. Google Play Store APK OAuth fix

## Development Rules
- NEVER remove existing data or columns from the database
- Always use "add column IF NOT EXISTS" and "create table IF NOT EXISTS"
- Test builds locally before pushing to main
- The app auto-deploys to Vercel from the main branch
- Production URL: https://3c-fieldops.vercel.app

## Branch Rules (ALWAYS FOLLOW)
- ALWAYS create a new branch before making any code changes. Never commit directly to main.
- Branch naming: feature/description, fix/description, or refactor/description
- Only merge to main after Alex explicitly confirms the changes work
- If Alex forgets to mention a branch, create one anyway and tell him what you named it

## Skills & Conventions
- When working with React, Supabase, or any library, use Context7 to fetch current documentation before writing code
- For complex architectural decisions or debugging, use Sequential Thinking to reason through the problem step by step
- Always run a build check (npm run build) before committing any changes
- When creating UI components, prioritize mobile-first design since techs use this on phones in the field
- Keep the dark/light theme system working — test both modes
