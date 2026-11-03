-- Customer Purchase Orders
-- One master list of every PO number a customer has issued to 3C: monthly retainers,
-- blanket/fiscal-year POs, project POs, one-off POs. Feeds the PO dropdown in the
-- invoice generator so nothing has to be copy/pasted. Project POs are mirrored here
-- (projects.customer_po stays as a denormalized cache the project screen writes).

create table if not exists customer_pos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  customer_name text not null,                    -- app joins customers by name everywhere
  po_number text not null,
  label text,                                     -- "SOM Retainer FY26", "Chamber 4 rebuild"
  kind text not null default 'blanket' check (kind in ('retainer','project','blanket','one_time')),
  amount numeric(12,2),                           -- authorized amount (optional) → remaining balance
  start_date date,
  end_date date,                                  -- fiscal-year POs expire; hidden from picker after this
  project_id uuid references projects(id) on delete set null,
  is_default boolean not null default false,      -- auto-selected on new invoices for this customer
  status text not null default 'active' check (status in ('active','closed')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_pos_customer_name_idx on customer_pos(customer_name);
create index if not exists customer_pos_project_idx on customer_pos(project_id);
-- one master row per project
create unique index if not exists customer_pos_project_uniq on customer_pos(project_id) where project_id is not null;

-- Which daily-sweep alerts have already fired for this PO ({"expiring":true,"90":true,...}).
-- Cleared by saveCustomerPO() when the authorized amount or expiry changes, so a
-- renewed/raised PO alerts again when it next crosses a threshold.
alter table customer_pos add column if not exists alert_flags jsonb not null default '{}'::jsonb;

-- RLS: every signed-in user can read (PO numbers print on invoices techs already
-- see); only managers/admins create, edit, or delete. current_app_role() is the
-- SECURITY DEFINER helper from the RFQ migration (resolves role by JWT email).
alter table customer_pos enable row level security;
drop policy if exists "customer_pos_all_authenticated" on customer_pos;
drop policy if exists "customer_pos_read" on customer_pos;
drop policy if exists "customer_pos_write" on customer_pos;
drop policy if exists "customer_pos_update" on customer_pos;
drop policy if exists "customer_pos_delete" on customer_pos;
create policy "customer_pos_read" on customer_pos for select to authenticated using (true);
create policy "customer_pos_write" on customer_pos for insert to authenticated
  with check (public.current_app_role() in ('manager','admin'));
create policy "customer_pos_update" on customer_pos for update to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));
create policy "customer_pos_delete" on customer_pos for delete to authenticated
  using (public.current_app_role() in ('manager','admin'));

-- Invoices remember which saved PO they were billed against (po_number text stays
-- as the printed value, so PDFs/Excel and old invoices are unchanged).
alter table invoices add column if not exists customer_po_id uuid references customer_pos(id) on delete set null;
create index if not exists invoices_customer_po_idx on invoices(customer_po_id);

-- Backfill 1: every project that already has a customer PO
insert into customer_pos (customer_id, customer_name, po_number, label, kind, project_id, created_by)
select c.id, p.customer, trim(p.customer_po), p.name, 'project', p.id, 'migration'
from projects p
left join customers c on c.name = p.customer
where p.customer_po is not null and trim(p.customer_po) <> ''
  and p.customer is not null
  and not exists (select 1 from customer_pos x where x.project_id = p.id);

-- Backfill 2: the hidden invoice_settings.default_po setting (never had a UI)
insert into customer_pos (customer_id, customer_name, po_number, label, kind, is_default, created_by)
select c.id, c.name, trim(c.invoice_settings->>'default_po'), 'Default PO', 'blanket', true, 'migration'
from customers c
where coalesce(trim(c.invoice_settings->>'default_po'), '') <> ''
  and not exists (select 1 from customer_pos x where x.customer_name = c.name and x.po_number = trim(c.invoice_settings->>'default_po'));

-- Backfill 3: link existing invoices to a saved PO when the printed number matches
update invoices i
set customer_po_id = x.id
from customer_pos x
where i.customer_po_id is null
  and i.customer = x.customer_name
  and trim(coalesce(i.po_number, '')) = x.po_number;

-- Realtime (no-op if the table is already in the publication)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_pos'
  ) then
    alter publication supabase_realtime add table customer_pos;
  end if;
end $$;
