-- Portal security fix (2026-08-04): the customer portal was keyed on the guessable
-- customer NAME (security sweep 2026-07-26 finding #2, HIGH). Anyone who guessed
-- "Duke University..." could read that customer's WO history anonymously.
-- Replace with an unguessable per-customer token, same pattern as proposals.
-- NOTE: this breaks previously shared name-based portal links by design.

alter table customers add column if not exists portal_token text unique;

update customers
  set portal_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where portal_token is null or portal_token = '';

-- Future customers get a token automatically.
alter table customers alter column portal_token
  set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

create or replace function public.portal_data_by_token(tok text)
returns jsonb language sql security definer set search_path=public as $$
  select case when c.id is null then null else jsonb_build_object(
    'name', c.name,
    'wos', coalesce((select jsonb_agg(jsonb_build_object(
        'id',w.id,'wo_id',w.wo_id,'customer_wo',w.customer_wo,'title',w.title,
        'status',w.status,'wo_type',w.wo_type,'location',w.location,'building',w.building,
        'due_date',w.due_date,'date_completed',w.date_completed,'work_performed',w.work_performed,
        'customer',w.customer)
        order by w.date_completed desc nulls last)
      from public.work_orders w where w.customer = c.name), '[]'::jsonb),
    'time', coalesce((select jsonb_agg(jsonb_build_object('wo_id',t.wo_id,'hours',t.hours))
      from public.time_entries t
      where t.wo_id in (select id from public.work_orders where customer = c.name)), '[]'::jsonb)
  ) end
  from public.customers c
  where tok is not null and length(tok) >= 20 and c.portal_token = tok;
$$;
grant execute on function public.portal_data_by_token(text) to anon, authenticated;

-- Kill the vulnerable name-based entry point.
drop function if exists public.portal_customer_data(text);
