-- ============================================================
-- Parts Sales — additive migration
-- Bill a customer for parts only (dropship supply), no work order.
--
--  * parts_sales — one row per parts sale. Line items live in the
--    `items` jsonb (description, part_no, qty, unit_cost, unit_price)
--    mirroring how invoices store tier_data/custom_items.
--  * The actual bill is a normal row in `invoices` (created by the
--    app with wo_ids=[] and the lines as custom_items), so payment
--    tracking, reminders, reports, and emails all work unchanged.
--    `invoice_num` links the two.
--  * `linked_po_ids` optionally ties the sale to vendor POs so the
--    cost side stays visible to Supply Audit workflows.
--  * Money data: manager/admin only, like invoices/vendor_bills.
--  * Strictly additive: CREATE IF NOT EXISTS only.
-- ============================================================

create table if not exists public.parts_sales (
  id uuid primary key default gen_random_uuid(),
  sale_ref text unique not null,           -- PS-YYMM## sequence
  customer text not null,
  customer_po text,
  ship_to text,                            -- dropship destination note
  items jsonb not null default '[]'::jsonb,
  cost_total numeric not null default 0,
  sell_total numeric not null default 0,
  markup_pct numeric,
  linked_po_ids uuid[] not null default '{}',
  invoice_num text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.parts_sales to authenticated;

alter table public.parts_sales enable row level security;

drop policy if exists parts_sales_all on public.parts_sales;
create policy parts_sales_all on public.parts_sales for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));
