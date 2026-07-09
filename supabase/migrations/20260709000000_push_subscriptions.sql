-- ============================================================
-- Web Push subscriptions — additive migration
-- Stores each device's PushSubscription so send-push can deliver
-- OS-level notifications. Role-aware RLS reuses current_app_* helpers.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,          -- full browser PushSubscription {endpoint, keys:{p256dh,auth}}
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

alter table public.push_subscriptions enable row level security;

-- Users manage their own device subscriptions; managers/admins may read all.
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions for select to authenticated
  using (user_id = public.current_app_user_id() or public.current_app_role() in ('manager','admin'));

drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = public.current_app_user_id());

drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions for update to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions for delete to authenticated
  using (user_id = public.current_app_user_id() or public.current_app_role() in ('manager','admin'));
