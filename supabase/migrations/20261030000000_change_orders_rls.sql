-- Project change orders: UI ships 2026-10-30 (Projects tab → Change Orders).
-- The table (migration 20260517100000) was created with a using(true) policy for every
-- authenticated user, which let technicians read and write CO pricing. Managers/admins only,
-- matching invoices/estimates. Additive: no columns or data touched.

alter table public.project_change_orders enable row level security;

drop policy if exists "change_orders_all_authenticated" on public.project_change_orders;
drop policy if exists project_change_orders_mgr_all on public.project_change_orders;

create policy project_change_orders_mgr_all on public.project_change_orders
  for all to authenticated
  using (current_app_role() in ('admin','manager'))
  with check (current_app_role() in ('admin','manager'));

-- updated_at bookkeeping (the column exists but nothing maintained it).
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists project_change_orders_touch on public.project_change_orders;
create trigger project_change_orders_touch
  before update on public.project_change_orders
  for each row execute function public.touch_updated_at();
