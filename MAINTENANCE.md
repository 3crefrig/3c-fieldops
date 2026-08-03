# 3C FieldOps — Maintenance Runbook

For whoever has to keep this running when Alex (or the AI assistant) isn't around.
Written 2026-08-03. Companion to CLAUDE.md (which is architecture; this is operations).

## The moving parts

| Thing | Where | Notes |
|---|---|---|
| Frontend | Vercel, auto-deploys from `main` on GitHub (`3crefrig/3c-fieldops`) | https://3c-fieldops.vercel.app |
| Database/Auth/Storage | Supabase project `gwwijjkahwieschfdfbq` | Free tier — egress cap 5GB/mo (fixed Aug 2026, watch the dashboard) |
| Edge functions | `supabase/functions/*` in this repo | Deploy: `SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy <name> --project-ref gwwijjkahwieschfdfbq` |
| Email sending | `send-email` fn → Gmail API, service account impersonating service@3crefrigeration.com | Google Cloud project `c-field-ops` |
| Push alerts | `send-push` fn, VAPID keys in function secrets (`VAPID_KEYS_JSON`) | |
| AI features | Anthropic API, key in function secrets | Haiku for scans, Sonnet for troubleshoot/proposals; auto-reload $100 at $10 |

## Scheduled jobs (pg_cron — check `select * from cron.job`)

| Job | Schedule (UTC) | What it does |
|---|---|---|
| `send-scheduled-emails-5min` | */5 min | Sends scheduled invoice emails; flips invoice → sent via `invoice_id` |
| `process-workflows-5min` | */5 min | Resumes workflow wait-nodes |
| `daily-sweeps-11utc` | 11:00 (7am ET) | Overdue/unassigned/stale notifications |
| `notifications-prune-daily` | 11:45 | Deletes notifications older than 60 days |
| `nightly-backup-9utc` | 09:00 (5am ET) | Full DB snapshot → private `backups` bucket, keeps 14 |

Job history: `select * from cron.job_run_details order by start_time desc limit 20;`

## Backups & restore

**What exists:** every night, `nightly-backup` writes `fieldops-YYYY-MM-DD.json.gz`
(every table, gzipped JSON) to the **private** `backups` storage bucket. 14 kept.

**To download one:** Supabase dashboard → Storage → backups → ⋯ → Download.
(Bucket is private; public URLs intentionally return 400.)

**To restore a table** (example: work_orders):
1. `gunzip fieldops-2026-08-03.json.gz` → JSON with `{data:{work_orders:[...]}}`
2. In the SQL editor, or via a script with the service key:
   for each row, `insert into work_orders ... on conflict (id) do update set ...`
   (Simplest path: ask the AI assistant to write the restore script against the
   snapshot — the format is one array per table, column names match exactly.)
3. Order matters only for FK-less name joins (none enforced), so per-table
   restore is safe in any order.

**Manual backup right now:** POST to the function with the service key:
`curl -X POST https://gwwijjkahwieschfdfbq.supabase.co/functions/v1/nightly-backup -H "Authorization: Bearer <SERVICE_ROLE_KEY>"`

## Deploying the frontend

1. Never commit to `main` directly — branch, build (`npm run build` must pass), merge.
2. Push to `main` → Vercel builds automatically (~60-90s).
3. If Vercel emails a failed deployment: the previous version stays live; fix and re-push.
4. The app is a PWA — users may need a hard refresh (the service worker updates on next load).

## Secrets inventory (never commit these)

- Supabase service-role key: Vault (`vault.decrypted_secrets`, name `service_role_key`) + function env
- Supabase Management PAT: local AI memory only, expires 2027-01-31
- Google service account JSON: `send-email`/`drive-upload` function secrets
- Anthropic API key: function secrets
- VAPID push keys: `VAPID_KEYS_JSON` function secret

## Common issues

- **"Something went wrong" screen:** a frontend crash. Refresh App button reloads;
  check Vercel for the last deploy; revert the last merge if it correlates.
- **Emails not sending:** check `cron.job_run_details` for send-scheduled-emails;
  then the function logs in the Supabase dashboard.
- **AI buttons erroring:** usually a retired Anthropic model name — check the model
  ids in `supabase/functions/*/index.ts` against current Anthropic docs.
- **Egress warning email from Supabase:** almost certainly a new unbounded query
  or a fat column added to `WO_COLS` — see shared.js comments; check the Usage
  dashboard's Database egress graph.
- **A tech's evening time entries land on the wrong day:** someone reintroduced
  `new Date().toISOString().slice(0,10)` — use `todayLocal()` from shared.js.

## Tests

`npm test -- --watchAll=false` runs the money-path suite (`src/shared.test.js`):
rates, markup, date handling, overdue/ready-to-invoice rules, ID formats.
Run it before merging anything that touches shared.js or billing.
