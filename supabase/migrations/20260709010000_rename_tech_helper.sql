-- Staged helper for the Emanuel Segura → Javier account switch.
-- Renames the user account (email + display name) and relabels ALL historical
-- attribution from the old name to the new name across every table that carries
-- a technician name. Idempotent; safe to re-run. Additive (function only) — it
-- does NOT run the rename until called explicitly with real values.
--
-- Usage (once Javier's Gmail + full name are known):
--   select public.rename_tech(
--     '310150c1-d745-4633-b658-c801db41e479'::uuid,  -- esegura account id
--     'Emanuel Segura',                               -- old display name
--     'Javier <Lastname>',                            -- new display name
--     'javier@example.com'                            -- Javier's Google login email
--   );

create or replace function public.rename_tech(
  p_user_id uuid,
  p_old_name text,
  p_new_name text,
  p_new_email text
) returns jsonb
language plpgsql
as $$
declare result jsonb;
begin
  -- 1. Repoint the account to Javier (login email + display name).
  update public.users
    set name = p_new_name, email = lower(p_new_email)
    where id = p_user_id;

  -- 2. Relabel plain-text name columns.
  update public.work_orders    set assignee     = p_new_name where assignee     = p_old_name;
  update public.time_entries   set technician   = p_new_name where technician   = p_old_name;
  update public.wo_activity    set actor        = p_new_name where actor        = p_old_name;
  update public.purchase_orders set requested_by = p_new_name where requested_by = p_old_name;
  update public.photos         set uploaded_by  = p_new_name where uploaded_by  = p_old_name;
  update public.schedule       set assigned_to  = p_new_name where assigned_to  = p_old_name;
  update public.recurring_templates set assignee = p_new_name where assignee    = p_old_name;

  -- 3. Relabel jsonb string-array columns (replace the matching element only).
  update public.work_orders w
    set crew = (select jsonb_agg(case when el = p_old_name then p_new_name else el end)
                from jsonb_array_elements_text(w.crew) el)
    where w.crew @> to_jsonb(array[p_old_name]::text[]);

  update public.projects p
    set assigned_techs = (select jsonb_agg(case when el = p_old_name then p_new_name else el end)
                          from jsonb_array_elements_text(p.assigned_techs) el)
    where p.assigned_techs @> to_jsonb(array[p_old_name]::text[]);

  -- 4. Report the new totals under Javier's name.
  select jsonb_build_object(
    'wo_assignee', (select count(*) from public.work_orders where assignee = p_new_name),
    'wo_crew',     (select count(*) from public.work_orders where crew @> to_jsonb(array[p_new_name]::text[])),
    'time',        (select count(*) from public.time_entries where technician = p_new_name),
    'activity',    (select count(*) from public.wo_activity where actor = p_new_name),
    'projects',    (select count(*) from public.projects where assigned_techs @> to_jsonb(array[p_new_name]::text[])),
    'photos',      (select count(*) from public.photos where uploaded_by = p_new_name),
    'new_email',   (select email from public.users where id = p_user_id)
  ) into result;

  return result;
end;
$$;
