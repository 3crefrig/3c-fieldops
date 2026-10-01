-- ============================================================
-- Purchase order form fields — additive migration
--
-- The PO PDF used to carry one description line, an amount and a free-text
-- "notes" field that doubled as the vendor name. A vendor-facing PO needs
-- the things a supply house counter and their AR desk look for: who the
-- vendor is (and our account with them), where the material goes, when it
-- is needed, the terms, and itemized lines with part numbers.
--
-- Strictly additive: ADD COLUMN IF NOT EXISTS only. Existing POs keep
-- working — the PDF falls back to notes/description when the new columns
-- are empty.
-- ============================================================

alter table public.purchase_orders
  add column if not exists vendor_name     text,                 -- display name (vendor_id may be null for one-off vendors)
  add column if not exists needed_by       date,                 -- required-by date
  add column if not exists delivery_method text,                 -- pickup | deliver_job | deliver_shop
  add column if not exists ship_to         text,                 -- destination address when delivering
  add column if not exists payment_terms   text,                 -- e.g. Net 30, Account, COD
  add column if not exists line_items      jsonb;                -- [{qty, unit, part_no, description, unit_price}]

-- Vendor master gets the fields that print in the VENDOR block.
alter table public.vendors
  add column if not exists address       text,
  add column if not exists contact_name  text,
  add column if not exists fax           text,
  add column if not exists payment_terms text;

comment on column public.purchase_orders.line_items is
  'Optional itemized lines: [{qty:number, unit:text, part_no:text, description:text, unit_price:number}]. When present, amount = sum(qty*unit_price).';
