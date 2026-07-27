-- ============================================================
-- Security sweep hardening (2026-07-26) — additive only.
--
--  * invoices.invoice_num unique index: the client generates the
--    next number by scanning existing rows, so two concurrent
--    creators (or auto-invoice racing a manual one) could mint the
--    same number. Duplicate numbers on customer-facing bills are an
--    integrity problem; verified zero existing duplicates before
--    adding. NULLs remain allowed (unique index ignores them).
-- ============================================================

create unique index if not exists invoices_invoice_num_uniq
  on public.invoices (invoice_num);
