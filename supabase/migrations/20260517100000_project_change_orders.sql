-- Project Change Orders
-- Tracks contract changes (scope/price/schedule) against a project.
-- Manager-only feature (RLS handled at app layer for now, matching other tables).

create table if not exists project_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  chamber_id uuid references project_chambers(id) on delete set null,
  co_number text not null,
  description text not null,
  amount numeric(12,2) not null default 0,
  schedule_impact_days integer default 0,
  customer_po_ref text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  pdf_drive_url text,
  notes text,
  requested_by text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  invoiced boolean not null default false,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_change_orders_project_idx on project_change_orders(project_id);
create index if not exists project_change_orders_status_idx on project_change_orders(status);
create unique index if not exists project_change_orders_co_number_per_project_idx
  on project_change_orders(project_id, co_number);

alter table project_change_orders enable row level security;

drop policy if exists "change_orders_all_authenticated" on project_change_orders;
create policy "change_orders_all_authenticated"
  on project_change_orders for all
  to authenticated
  using (true)
  with check (true);
