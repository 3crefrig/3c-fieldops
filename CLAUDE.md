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

## Status Values

- **WO status**: `pending` (orange), `in_progress` (cyan), `completed` (green)
- **PO status**: `pending` (orange), `approved` (green), `rejected` (red), `revised` (purple)
- **Roles**: `admin`, `manager`, `technician` — each with distinct color gradients and dashboard views

## Supabase Credentials
- Project ID: gwwijjkahwieschfdfbq
- URL: https://gwwijjkahwieschfdfbq.supabase.co
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3d2lqamthaHdpZXNjaGZkZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjI1NzYsImV4cCI6MjA4ODIzODU3Nn0.c79jtEZv9CQ8P2CC6NXyrKqax510530tAMhLnNt75TI
- Management API Token: sbp_7527fb74ced99be31e87380e5cf76c78c9156b03
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
