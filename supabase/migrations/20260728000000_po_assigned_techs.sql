-- ============================================================
-- Tie technicians to purchase orders (2026-07-28). Additive.
--
-- Mirrors the work-order "crew" / project "assigned_techs" pattern: a text[]
-- of user names so a PO can be tagged with whoever is picking the parts up.
--
-- RLS note: pos_select was manager/admin OR requested_by = me. Without
-- widening it, assigning a tech to a PO they didn't request would be useless —
-- they still couldn't see it. SELECT now also matches assigned_techs.
-- UPDATE/DELETE are deliberately left alone: being assigned lets you SEE the
-- PO (and capture a pickup ticket against it), not edit or approve it.
-- ============================================================

alter table public.purchase_orders
  add column if not exists assigned_techs text[] not null default '{}';

drop policy if exists pos_select on public.purchase_orders;
create policy pos_select on public.purchase_orders for select to authenticated
  using (
    public.current_app_role() in ('admin','manager')
    or requested_by = (select u.name from public.users u where u.id = public.current_app_user_id())
    or (select u.name from public.users u where u.id = public.current_app_user_id()) = any (assigned_techs)
  );
