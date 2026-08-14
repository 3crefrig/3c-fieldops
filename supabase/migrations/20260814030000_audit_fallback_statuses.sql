-- ============================================================
-- Allow the price-book fallback statuses on vendor bill lines — additive
--
-- auditBill() can now resolve a line with no pickup ticket against purchase
-- history instead of always returning 'no_ticket'. The original CHECK
-- constraint predates those statuses and rejects them on insert.
--
--   price_high_vs_history  — billed above the most we have ever paid
--   unverified_high_value  — no ticket and material enough to confirm
--   no_ticket_price_ok     — no ticket, but the price matches history
-- ============================================================

alter table public.vendor_bill_items
  drop constraint if exists vendor_bill_items_match_status_check;

alter table public.vendor_bill_items
  add constraint vendor_bill_items_match_status_check
  check (match_status = any (array[
    'matched', 'price_mismatch', 'qty_over', 'qty_under', 'no_ticket',
    'price_unverified', 'accepted',
    'price_high_vs_history', 'unverified_high_value', 'no_ticket_price_ok'
  ]));
