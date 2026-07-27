-- Table-level SELECT masks column-level revokes. Revoke the table grant, then
-- grant SELECT only on the non-sensitive columns (everything except the rates).
revoke select on public.users from authenticated;
grant select (id, name, email, role, active, created_at, title, phone, available_hours_week)
  on public.users to authenticated;
