-- ============================================================
-- Cron job: Call process-inbox Edge Function every 5 minutes
-- Requires pg_cron and pg_net extensions (enabled in Supabase dashboard)
-- ============================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the edge function call every 5 minutes
-- NOTE: Replace <SERVICE_ROLE_KEY> with the actual service role key
-- You can set this via Supabase SQL Editor after copying the key from Settings > API
SELECT cron.schedule(
  'process-inbox-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gwwijjkahwieschfdfbq.supabase.co/functions/v1/process-inbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check cron job status:
-- SELECT * FROM cron.job;
--
-- To see recent runs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- To remove the job:
-- SELECT cron.unschedule('process-inbox-every-5min');
