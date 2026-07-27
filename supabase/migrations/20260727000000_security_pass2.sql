-- ============================================================
-- Security sweep — pass 2 (2026-07-27). Additive / privilege-only.
--
--  1. Hide users.billing_rate / users.cost_rate from the REST API.
--     users_select RLS is using(true) (every authenticated user can read
--     all rows) which is fine for names/roles the whole app needs, but it
--     also exposed everyone's pay + bill rates to technicians. Column-level
--     privileges are the right lever: revoke SELECT on those two columns
--     from `authenticated` so PostgREST's `select=*` simply omits them.
--     Managers/admins read them through the SECURITY DEFINER RPC below.
--     UPDATE/INSERT column grants are untouched — the users_update /
--     users_insert RLS policies already gate writes to admins.
--
--  2. photos Storage bucket: "Anyone can upload" applied to the public
--     role (anon included). No client uploads to this bucket (photos go
--     through drive-upload; only branding assets live here), so require a
--     registered user to insert. Public READ is preserved (logos, etc.).
-- ============================================================

-- ── 1. Rate-column lockdown ───────────────────────────────────
-- A table-level SELECT grant covers every column and masks a column-level
-- revoke, so revoke the table grant and re-grant only the non-sensitive
-- columns. PostgREST's select=* then returns just these nine.
revoke select on public.users from authenticated;
grant select (id, name, email, role, active, created_at, title, phone, available_hours_week)
  on public.users to authenticated;

create or replace function public.user_rates()
returns table(id uuid, billing_rate numeric, cost_rate numeric)
language sql
security definer
set search_path = public
as $$
  select u.id, u.billing_rate, u.cost_rate
  from public.users u
  where public.current_app_role() in ('manager','admin');
$$;

revoke all on function public.user_rates() from public, anon;
grant execute on function public.user_rates() to authenticated;

-- ── 2. photos bucket: authenticated upload only ───────────────
drop policy if exists "Anyone can upload photos" on storage.objects;
create policy "photos_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos');
-- "Anyone can view photos" (public SELECT) is intentionally left in place.
