-- Server-side scheduling (2026-07-10). Fixes the invisible-non-payment bug:
-- SendInvoiceModal defaults to "schedule" → rows in scheduled_emails, but NO
-- dispatcher was ever scheduled (cron.job was empty), so scheduled invoices
-- never sent. Auth uses the service_role_key stored in Supabase Vault (the
-- cron/service-only edge functions reject anything else). Requires pg_cron +
-- pg_net (already enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedules so this migration is re-runnable.
do $$ declare j text;
begin
  foreach j in array array['process-inbox-every-5min','send-scheduled-emails-5min','process-workflows-5min','daily-sweeps-7am'] loop
    if exists (select 1 from cron.job where jobname=j) then perform cron.unschedule(j); end if;
  end loop;
end $$;

-- Invoice email dispatcher — every 5 minutes.
select cron.schedule('send-scheduled-emails-5min','*/5 * * * *', $$
  select net.http_post(
    url := 'https://gwwijjkahwieschfdfbq.supabase.co/functions/v1/send-scheduled-emails',
    headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),'Content-Type','application/json'),
    body := '{}'::jsonb) $$);

-- Workflow wait-node resume — every 5 minutes.
select cron.schedule('process-workflows-5min','*/5 * * * *', $$
  select net.http_post(
    url := 'https://gwwijjkahwieschfdfbq.supabase.co/functions/v1/process-workflows',
    headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),'Content-Type','application/json'),
    body := '{}'::jsonb) $$);

-- Daily notification sweeps at 11:00 UTC (~7am ET) — replaces the checks that
-- ran in every browser on every app open. Guaranteed once/day even if nobody
-- opens the app.
select cron.schedule('daily-sweeps-11utc','0 11 * * *', $$
  select net.http_post(
    url := 'https://gwwijjkahwieschfdfbq.supabase.co/functions/v1/daily-sweeps',
    headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),'Content-Type','application/json'),
    body := '{}'::jsonb) $$);
