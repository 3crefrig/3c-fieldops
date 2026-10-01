-- Receive / close a PO once the parts are picked up. received_at already
-- existed (unused); add who received it. Additive only.
alter table public.purchase_orders
  add column if not exists received_by text;
