-- ============================================================
-- RFQ (Request for Quotation) Automation — additive migration
-- Creates rfqs, rfq_items, rfq_specs tables + role-aware RLS.
--
-- Design notes:
--  * Roles live in public.users (matched by email), NOT in the JWT,
--    so RLS uses SECURITY DEFINER helpers current_app_role() /
--    current_app_user_id() to resolve the caller's app identity.
--  * Unit pricing is hidden from technicians at the QUERY layer:
--    - Base rfq_items is SELECT-able only by managers/admins (RLS).
--    - Technicians read their own items through rfq_items_public,
--      a view that omits the unit_price column entirely.
--  * Strictly additive: only CREATE ... IF NOT EXISTS + new policies.
--    No drops or destructive changes to existing tables.
-- ============================================================

-- ── Role helpers (SECURITY DEFINER — resolve app identity from users) ──
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.active is distinct from false
  limit 1
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.active is distinct from false
  limit 1
$$;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.current_app_user_id() to anon, authenticated;

-- ── Tables ────────────────────────────────────────────────────
create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  rfq_ref text unique not null,
  to_vendor text,
  vendor_email text,
  account text,
  rfq_date date,
  prepared_by text,
  intro_text text,
  notes jsonb not null default '[]'::jsonb,          -- array of strings
  status text not null default 'draft'
    check (status in ('draft','pending_approval','sent','quoted','closed')),
  docx_path text,                                     -- Supabase Storage path
  created_by uuid,                                    -- users.id of author
  approved_by uuid,                                   -- users.id of approver
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  line_no int,
  item text,
  qty numeric,
  part_no text,
  description text,
  unit_price numeric,                                 -- blank on request; vendor fills
  created_at timestamptz not null default now()
);

create table if not exists public.rfq_specs (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  label text,
  value text,
  created_at timestamptz not null default now()
);

create index if not exists rfqs_status_idx on public.rfqs(status);
create index if not exists rfqs_created_by_idx on public.rfqs(created_by);
create index if not exists rfq_items_rfq_idx on public.rfq_items(rfq_id);
create index if not exists rfq_specs_rfq_idx on public.rfq_specs(rfq_id);

-- ── Table grants (RLS still filters rows/columns below) ───────
grant select, insert, update, delete on public.rfqs to authenticated;
grant select, insert, update, delete on public.rfq_items to authenticated;
grant select, insert, update, delete on public.rfq_specs to authenticated;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.rfqs enable row level security;
alter table public.rfq_items enable row level security;
alter table public.rfq_specs enable row level security;

-- rfqs: managers/admins see all; technicians see only their own
drop policy if exists rfqs_select on public.rfqs;
create policy rfqs_select on public.rfqs for select to authenticated
  using (
    public.current_app_role() in ('manager','admin')
    or created_by = public.current_app_user_id()
  );

-- Anyone authenticated may create, but must stamp themselves as author
-- and may only start a request in 'draft'.
drop policy if exists rfqs_insert on public.rfqs;
create policy rfqs_insert on public.rfqs for insert to authenticated
  with check (
    created_by = public.current_app_user_id()
    and status = 'draft'
  );

-- Managers/admins may update anything (approve, status changes, send).
drop policy if exists rfqs_update_mgr on public.rfqs;
create policy rfqs_update_mgr on public.rfqs for update to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

-- Technicians may edit their OWN request only while it is still a draft,
-- and it must remain a draft (they can't self-advance to sent/approved).
drop policy if exists rfqs_update_own_draft on public.rfqs;
create policy rfqs_update_own_draft on public.rfqs for update to authenticated
  using (created_by = public.current_app_user_id() and status = 'draft')
  with check (created_by = public.current_app_user_id() and status = 'draft');

-- Managers/admins delete any; technicians delete their own drafts.
drop policy if exists rfqs_delete on public.rfqs;
create policy rfqs_delete on public.rfqs for delete to authenticated
  using (
    public.current_app_role() in ('manager','admin')
    or (created_by = public.current_app_user_id() and status = 'draft')
  );

-- rfq_items: base table (INCLUDES unit_price) is readable ONLY by
-- managers/admins. Technicians get zero rows here — they must use the
-- price-free rfq_items_public view below. This is the query-layer hide.
drop policy if exists rfq_items_select_mgr on public.rfq_items;
create policy rfq_items_select_mgr on public.rfq_items for select to authenticated
  using (public.current_app_role() in ('manager','admin'));

-- Insert allowed for managers/admins, or the owning technician on their draft.
drop policy if exists rfq_items_insert on public.rfq_items;
create policy rfq_items_insert on public.rfq_items for insert to authenticated
  with check (
    exists (
      select 1 from public.rfqs r
      where r.id = rfq_items.rfq_id
        and (
          public.current_app_role() in ('manager','admin')
          or (r.created_by = public.current_app_user_id() and r.status = 'draft')
        )
    )
  );

-- Only managers/admins may update items (e.g. record the vendor's unit_price).
drop policy if exists rfq_items_update_mgr on public.rfq_items;
create policy rfq_items_update_mgr on public.rfq_items for update to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

drop policy if exists rfq_items_delete on public.rfq_items;
create policy rfq_items_delete on public.rfq_items for delete to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = rfq_items.rfq_id
        and (
          public.current_app_role() in ('manager','admin')
          or (r.created_by = public.current_app_user_id() and r.status = 'draft')
        )
    )
  );

-- rfq_specs: no pricing; visible to anyone who can see the parent RFQ.
drop policy if exists rfq_specs_select on public.rfq_specs;
create policy rfq_specs_select on public.rfq_specs for select to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = rfq_specs.rfq_id
        and (
          public.current_app_role() in ('manager','admin')
          or r.created_by = public.current_app_user_id()
        )
    )
  );

drop policy if exists rfq_specs_write on public.rfq_specs;
create policy rfq_specs_write on public.rfq_specs for all to authenticated
  using (
    exists (
      select 1 from public.rfqs r
      where r.id = rfq_specs.rfq_id
        and (
          public.current_app_role() in ('manager','admin')
          or (r.created_by = public.current_app_user_id() and r.status = 'draft')
        )
    )
  )
  with check (
    exists (
      select 1 from public.rfqs r
      where r.id = rfq_specs.rfq_id
        and (
          public.current_app_role() in ('manager','admin')
          or (r.created_by = public.current_app_user_id() and r.status = 'draft')
        )
    )
  );

-- ── Price-free view for technicians (and bulk client loads) ───
-- security_invoker = false → runs with the view owner's rights, so it can
-- read the base table regardless of the caller's RLS. Access is still
-- constrained by the WHERE clause below, and unit_price is simply absent.
drop view if exists public.rfq_items_public;
create view public.rfq_items_public
with (security_invoker = false) as
  select
    i.id,
    i.rfq_id,
    i.line_no,
    i.item,
    i.qty,
    i.part_no,
    i.description,
    i.created_at
  from public.rfq_items i
  join public.rfqs r on r.id = i.rfq_id
  where public.current_app_role() in ('manager','admin')
     or r.created_by = public.current_app_user_id();

grant select on public.rfq_items_public to anon, authenticated;

-- ── Storage bucket for generated RFQ .docx files ──────────────
insert into storage.buckets (id, name, public)
values ('rfq-docs', 'rfq-docs', true)
on conflict (id) do nothing;
