-- ============================================================
-- Supply House Audit — additive migration
-- 3-way match for vendor billing: PO ↔ pickup tickets ↔ vendor bill.
--
--  * po_tickets / po_ticket_items — counter pickup tickets captured
--    (photo + OCR) against a purchase order as parts leave the branch.
--  * vendor_bills / vendor_bill_items — the supplier's invoice, scanned
--    and line-matched against the tickets; mismatches become exceptions.
--
-- Design notes:
--  * Follows the RFQ migration pattern: current_app_role() /
--    current_app_user_id() SECURITY DEFINER helpers already exist.
--  * Tickets: managers/admins see all; technicians see + capture their own.
--  * Bills are money/audit data: manager+ only (like invoices).
--  * Duplicate guards: a vendor can't be captured twice for the same
--    ticket #, and a bill # can't be entered twice for the same vendor —
--    catches double-billing and double-entry.
--  * Strictly additive: CREATE IF NOT EXISTS only.
-- ============================================================

-- ── Pickup tickets ────────────────────────────────────────────
create table if not exists public.po_tickets (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references public.purchase_orders(id) on delete cascade,
  vendor_name text,
  ticket_number text,
  ticket_date date,
  image_url text,
  subtotal numeric,
  tax numeric,
  total numeric,
  notes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.po_ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.po_tickets(id) on delete cascade,
  line_no int,
  part_no text,
  description text,
  qty numeric,
  unit_price numeric,
  amount numeric,
  created_at timestamptz not null default now()
);

-- ── Vendor bills (supplier invoices under audit) ──────────────
create table if not exists public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references public.purchase_orders(id) on delete set null,
  vendor_name text,
  bill_number text,
  bill_date date,
  due_date date,
  image_url text,
  subtotal numeric,
  tax numeric,
  total numeric,
  status text not null default 'review'
    check (status in ('review','clean','disputed','resolved')),
  audit_json jsonb,                 -- match summary: counts, variance $
  notes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.vendor_bills(id) on delete cascade,
  line_no int,
  part_no text,
  description text,
  qty numeric,
  unit_price numeric,
  amount numeric,
  match_status text
    check (match_status in ('matched','price_mismatch','qty_over','qty_under','no_ticket','price_unverified','accepted')),
  matched_ticket_item_id uuid references public.po_ticket_items(id) on delete set null,
  expected_price numeric,           -- what the tickets say it should cost
  expected_qty numeric,             -- what the tickets say was picked up
  variance numeric,                 -- $ overbilled on this line (0 when fine)
  resolution text,                  -- note when a flagged line is accepted
  created_at timestamptz not null default now()
);

create index if not exists po_tickets_po_idx on public.po_tickets(po_id);
create index if not exists po_ticket_items_ticket_idx on public.po_ticket_items(ticket_id);
create index if not exists vendor_bills_po_idx on public.vendor_bills(po_id);
create index if not exists vendor_bills_status_idx on public.vendor_bills(status);
create index if not exists vendor_bill_items_bill_idx on public.vendor_bill_items(bill_id);

-- Duplicate guards (vendor-scoped, only when a number was captured)
create unique index if not exists po_tickets_dupe_guard
  on public.po_tickets (lower(coalesce(vendor_name,'')), ticket_number)
  where ticket_number is not null and ticket_number <> '';
create unique index if not exists vendor_bills_dupe_guard
  on public.vendor_bills (lower(coalesce(vendor_name,'')), bill_number)
  where bill_number is not null and bill_number <> '';

-- ── Grants (RLS filters below) ────────────────────────────────
grant select, insert, update, delete on public.po_tickets to authenticated;
grant select, insert, update, delete on public.po_ticket_items to authenticated;
grant select, insert, update, delete on public.vendor_bills to authenticated;
grant select, insert, update, delete on public.vendor_bill_items to authenticated;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.po_tickets enable row level security;
alter table public.po_ticket_items enable row level security;
alter table public.vendor_bills enable row level security;
alter table public.vendor_bill_items enable row level security;

-- Tickets: managers/admins all; technicians their own captures.
drop policy if exists po_tickets_select on public.po_tickets;
create policy po_tickets_select on public.po_tickets for select to authenticated
  using (
    public.current_app_role() in ('manager','admin')
    or created_by = public.current_app_user_id()
  );

drop policy if exists po_tickets_insert on public.po_tickets;
create policy po_tickets_insert on public.po_tickets for insert to authenticated
  with check (
    public.current_app_role() in ('manager','admin')
    or (public.current_app_role() is not null and created_by = public.current_app_user_id())
  );

drop policy if exists po_tickets_update on public.po_tickets;
create policy po_tickets_update on public.po_tickets for update to authenticated
  using (
    public.current_app_role() in ('manager','admin')
    or created_by = public.current_app_user_id()
  )
  with check (
    public.current_app_role() in ('manager','admin')
    or created_by = public.current_app_user_id()
  );

drop policy if exists po_tickets_delete on public.po_tickets;
create policy po_tickets_delete on public.po_tickets for delete to authenticated
  using (
    public.current_app_role() in ('manager','admin')
    or created_by = public.current_app_user_id()
  );

-- Ticket items: access follows the parent ticket.
drop policy if exists po_ticket_items_all on public.po_ticket_items;
create policy po_ticket_items_all on public.po_ticket_items for all to authenticated
  using (
    exists (
      select 1 from public.po_tickets t
      where t.id = po_ticket_items.ticket_id
        and (
          public.current_app_role() in ('manager','admin')
          or t.created_by = public.current_app_user_id()
        )
    )
  )
  with check (
    exists (
      select 1 from public.po_tickets t
      where t.id = po_ticket_items.ticket_id
        and (
          public.current_app_role() in ('manager','admin')
          or t.created_by = public.current_app_user_id()
        )
    )
  );

-- Bills: manager/admin only (money + audit trail).
drop policy if exists vendor_bills_all on public.vendor_bills;
create policy vendor_bills_all on public.vendor_bills for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

drop policy if exists vendor_bill_items_all on public.vendor_bill_items;
create policy vendor_bill_items_all on public.vendor_bill_items for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

-- ── Storage bucket for ticket/bill images & PDFs ──────────────
insert into storage.buckets (id, name, public)
values ('vendor-docs', 'vendor-docs', true)
on conflict (id) do nothing;

drop policy if exists "vd_insert" on storage.objects;
create policy "vd_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-docs' and public.current_app_role() is not null);
drop policy if exists "vd_delete" on storage.objects;
create policy "vd_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-docs' and public.current_app_role() in ('admin','manager'));

-- ── Realtime: live cross-device updates (tech captures a ticket in the
--    field → manager's audit tab refreshes). The supabase_realtime
--    publication is NOT "for all tables" in this project, so new tables
--    must be added explicitly or the client subscriptions never fire.
do $$
begin
  begin
    alter publication supabase_realtime add table public.po_tickets;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.po_ticket_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.vendor_bills;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.vendor_bill_items;
  exception when duplicate_object then null;
  end;
end $$;
