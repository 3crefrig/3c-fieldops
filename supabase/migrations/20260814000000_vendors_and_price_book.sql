-- ============================================================
-- Vendors + Price Book — additive migration
--
-- Purpose: make "what does this part cost, and from whom" answerable.
-- Today the PO vendor is a free-text notes field holding values like
-- 'ACR', 'ACR, Grainger' and 'De-humidifier repair allowance for
-- Nan-Duke Project', so no per-vendor number can be trusted.
--
--  * vendors      — one row per supply house, with a normalized name so
--                   'ACR', 'A.C.R.' and 'acr supply' collapse together.
--  * parts        — one row per part number, keyed on a normalized form
--                   (alphanumerics only) so OCR dashes/spaces don't split
--                   the same part into several catalog entries.
--  * part_prices  — every price ever OBSERVED for a part, from any source.
--
-- Design notes:
--  * part_prices.source separates what we PAID from what a part WOULD
--    cost elsewhere. 3C buys almost exclusively from ACR, so a price book
--    fed only by purchases could never answer "is ACR expensive?" —
--    'reference' and 'quote' rows carry competitor pricing so the
--    comparison report works before a single order is placed elsewhere.
--  * The book fills itself: triggers on po_ticket_items and
--    vendor_bill_items write a 'purchase' row on insert. No data entry.
--  * Pricing is manager+ (technicians never see cost — same rule the
--    RFQ migration applies to rfq_items). parts/vendors are readable by
--    any registered user so techs can still search the catalog.
--  * Strictly additive: CREATE / ADD COLUMN IF NOT EXISTS only. No
--    existing column is altered or dropped.
-- ============================================================

-- ── Normalization helpers ─────────────────────────────────────
-- Part numbers arrive from OCR with inconsistent punctuation and case:
-- '4a5309-01', '4A5309 01' and '4A530901' are one part. Compare on
-- alphanumerics only.
create or replace function public.norm_key(txt text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(txt, ''), '[^a-zA-Z0-9]', '', 'g')), '');
$$;

-- Vendor names are typed by hand at the counter and in PO notes.
-- Strip punctuation and the common suffixes so they collapse.
create or replace function public.norm_vendor(txt text)
returns text
language sql
immutable
as $$
  -- \y is PostgreSQL's word boundary. \b would mean a backspace character
  -- here and silently match nothing.
  select nullif(
    regexp_replace(
      regexp_replace(upper(coalesce(txt, '')), '\y(CO|INC|LLC|LTD|CORP|COMPANY|SUPPLY|SUPPLIES)\y', '', 'g'),
      '[^A-Z0-9]', '', 'g'
    ), '');
$$;

-- ── Vendors ───────────────────────────────────────────────────
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  norm_name text generated always as (public.norm_vendor(name)) stored,
  account_number text,
  phone text,
  email text,
  website text,
  -- Where they sit in the sourcing strategy: 'primary' (default supply
  -- house), 'secondary' (used when primary is out or expensive),
  -- 'reference' (not bought from — tracked only for price comparison).
  role text not null default 'secondary',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists vendors_norm_name_key on public.vendors (norm_name);
create index if not exists vendors_active_idx on public.vendors (active) where active;

-- ── Parts catalog ─────────────────────────────────────────────
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  part_no text not null,
  part_key text generated always as (public.norm_key(part_no)) stored,
  description text,
  category text,
  uom text,                      -- each, box, foot, lb — guards against
                                 -- comparing a 1 lb price to a 5 lb price
  manufacturer text,
  preferred_vendor_id uuid references public.vendors(id) on delete set null,
  -- Rolled forward by the trigger below so the common lookups
  -- ("what did we last pay") don't have to scan price history.
  last_cost numeric,
  last_cost_vendor_id uuid references public.vendors(id) on delete set null,
  last_cost_at timestamptz,
  stocked boolean not null default false,   -- on the truck/shop short list
  min_qty numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parts_part_key_key on public.parts (part_key);
create index if not exists parts_desc_idx on public.parts using gin (to_tsvector('english', coalesce(description, '')));
create index if not exists parts_stocked_idx on public.parts (stocked) where stocked;

-- ── Observed prices ───────────────────────────────────────────
create table if not exists public.part_prices (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  unit_price numeric not null,
  qty numeric,
  uom text,
  -- purchase  = we paid this (from a scanned ticket or vendor bill)
  -- quote     = a vendor quoted it (RFQ response)
  -- reference = looked up elsewhere for comparison; never bought
  -- manual    = typed in by hand
  source text not null default 'purchase',
  source_ref text,               -- ticket #, bill #, quote #, or a URL
  source_item_id uuid,           -- po_ticket_items.id / vendor_bill_items.id
  observed_at timestamptz not null default now(),
  created_by uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists part_prices_part_idx on public.part_prices (part_id, observed_at desc);
create index if not exists part_prices_vendor_idx on public.part_prices (vendor_id);
create index if not exists part_prices_source_idx on public.part_prices (source);
-- One row per source line item, so replaying a ticket import can't
-- double-count the same purchase.
create unique index if not exists part_prices_source_item_key
  on public.part_prices (source_item_id) where source_item_id is not null;

-- ── Link vendors to the documents that already exist ──────────
alter table public.purchase_orders add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
alter table public.po_tickets      add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
alter table public.vendor_bills    add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists purchase_orders_vendor_idx on public.purchase_orders (vendor_id);
create index if not exists po_tickets_vendor_idx on public.po_tickets (vendor_id);

-- ── Find-or-create helpers ────────────────────────────────────
create or replace function public.upsert_vendor(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.norm_vendor(p_name);
  v_id  uuid;
begin
  if v_key is null then return null; end if;
  select id into v_id from public.vendors where norm_name = v_key;
  if v_id is null then
    insert into public.vendors (name) values (btrim(p_name))
    on conflict (norm_name) do update set name = public.vendors.name
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.upsert_part(p_part_no text, p_desc text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.norm_key(p_part_no);
  v_id  uuid;
begin
  if v_key is null then return null; end if;
  select id into v_id from public.parts where part_key = v_key;
  if v_id is null then
    insert into public.parts (part_no, description) values (btrim(p_part_no), nullif(btrim(coalesce(p_desc,'')), ''))
    on conflict (part_key) do update set part_no = public.parts.part_no
    returning id into v_id;
  elsif p_desc is not null and p_desc <> '' then
    -- Backfill a description if the first sighting of the part had none.
    update public.parts set description = p_desc, updated_at = now()
    where id = v_id and (description is null or description = '');
  end if;
  return v_id;
end;
$$;

-- Record an observed price and roll the part's last-cost forward.
create or replace function public.record_part_price(
  p_part_no text, p_desc text, p_vendor_name text, p_unit_price numeric,
  p_qty numeric, p_source text, p_source_ref text, p_source_item_id uuid,
  p_observed_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part uuid; v_vendor uuid; v_id uuid;
begin
  if p_unit_price is null or p_unit_price <= 0 then return null; end if;
  v_part := public.upsert_part(p_part_no, p_desc);
  if v_part is null then return null; end if;
  v_vendor := public.upsert_vendor(p_vendor_name);

  -- The dedupe index is partial, so ON CONFLICT has to repeat its
  -- predicate or Postgres won't match it to the arbiter index.
  insert into public.part_prices (part_id, vendor_id, unit_price, qty, source, source_ref, source_item_id, observed_at)
  values (v_part, v_vendor, p_unit_price, p_qty, coalesce(p_source,'purchase'), p_source_ref, p_source_item_id, coalesce(p_observed_at, now()))
  on conflict (source_item_id) where source_item_id is not null do nothing
  returning id into v_id;

  -- Only a real purchase moves last_cost; a reference price from a
  -- competitor is not what this job costs us.
  if coalesce(p_source,'purchase') = 'purchase' then
    update public.parts
       set last_cost = p_unit_price, last_cost_vendor_id = v_vendor,
           last_cost_at = coalesce(p_observed_at, now()), updated_at = now()
     where id = v_part
       and (last_cost_at is null or last_cost_at <= coalesce(p_observed_at, now()));
  end if;
  return v_id;
end;
$$;

-- ── The book fills itself ─────────────────────────────────────
create or replace function public.tg_ticket_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_vendor text; v_ref text; v_when timestamptz;
begin
  if new.unit_price is null or new.unit_price <= 0 then return new; end if;
  select coalesce(t.vendor_name, ''), t.ticket_number, coalesce(t.ticket_date::timestamptz, t.created_at)
    into v_vendor, v_ref, v_when
    from public.po_tickets t where t.id = new.ticket_id;
  perform public.record_part_price(new.part_no, new.description, v_vendor, new.unit_price,
                                   new.qty, 'purchase', v_ref, new.id, v_when);
  return new;
end;
$$;

drop trigger if exists ticket_item_price on public.po_ticket_items;
create trigger ticket_item_price after insert on public.po_ticket_items
  for each row execute function public.tg_ticket_item_price();

create or replace function public.tg_bill_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_vendor text; v_ref text; v_when timestamptz;
begin
  if new.unit_price is null or new.unit_price <= 0 then return new; end if;
  select coalesce(b.vendor_name, ''), b.bill_number, coalesce(b.bill_date::timestamptz, b.created_at)
    into v_vendor, v_ref, v_when
    from public.vendor_bills b where b.id = new.bill_id;
  perform public.record_part_price(new.part_no, new.description, v_vendor, new.unit_price,
                                   new.qty, 'purchase', v_ref, new.id, v_when);
  return new;
end;
$$;

drop trigger if exists bill_item_price on public.vendor_bill_items;
create trigger bill_item_price after insert on public.vendor_bill_items
  for each row execute function public.tg_bill_item_price();

-- ── Comparison view: what we pay vs the best price on record ──
create or replace view public.part_price_compare as
with paid as (
  select pp.part_id, pp.vendor_id, avg(pp.unit_price) avg_price, min(pp.unit_price) min_price,
         max(pp.unit_price) max_price, count(*) buys, max(pp.observed_at) last_seen
    from public.part_prices pp
   where pp.source = 'purchase'
   group by pp.part_id, pp.vendor_id
),
alt as (
  select pp.part_id, min(pp.unit_price) best_alt, count(*) alt_quotes
    from public.part_prices pp
   where pp.source in ('quote','reference')
   group by pp.part_id
)
select p.id part_id, p.part_no, p.description, p.uom, p.stocked,
       v.id vendor_id, v.name vendor_name,
       round(paid.avg_price, 2) avg_paid, paid.min_price, paid.max_price, paid.buys, paid.last_seen,
       round(alt.best_alt, 2) best_alternative, alt.alt_quotes,
       case when alt.best_alt is not null and paid.avg_price > 0
            then round(((paid.avg_price - alt.best_alt) / paid.avg_price) * 100, 1) end pct_cheaper_elsewhere,
       case when paid.min_price > 0
            then round(((paid.max_price - paid.min_price) / paid.min_price) * 100, 1) end own_spread_pct
  from paid
  join public.parts p on p.id = paid.part_id
  left join public.vendors v on v.id = paid.vendor_id
  left join alt on alt.part_id = paid.part_id;

-- ── Grants + RLS ──────────────────────────────────────────────
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.parts to authenticated;
grant select, insert, update, delete on public.part_prices to authenticated;
grant select on public.part_price_compare to authenticated;

alter table public.vendors enable row level security;
alter table public.parts enable row level security;
alter table public.part_prices enable row level security;

-- Vendors + catalog: any registered user may read (techs search parts);
-- only manager/admin may change them.
drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors for select to authenticated
  using (public.current_app_role() is not null);
drop policy if exists vendors_write on public.vendors;
create policy vendors_write on public.vendors for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

drop policy if exists parts_select on public.parts;
create policy parts_select on public.parts for select to authenticated
  using (public.current_app_role() is not null);
drop policy if exists parts_write on public.parts;
create policy parts_write on public.parts for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));

-- Prices are cost data — manager/admin only, matching invoices and
-- rfq_items. The SECURITY DEFINER trigger still writes rows when a
-- technician captures a pickup ticket; they just can't read them back.
drop policy if exists part_prices_mgr on public.part_prices;
create policy part_prices_mgr on public.part_prices for all to authenticated
  using (public.current_app_role() in ('manager','admin'))
  with check (public.current_app_role() in ('manager','admin'));
