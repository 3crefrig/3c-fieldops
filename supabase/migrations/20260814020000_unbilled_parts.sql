-- ============================================================
-- Unbilled parts — additive, view only
--
-- The invoice generator already prices parts (approved PO spend on the
-- WO x the customer's markup), and the ticket roll-up shipped earlier
-- today makes those PO amounts reflect what was actually bought. What
-- nothing catches is a purchase that never reached an invoice at all —
-- which is the likeliest explanation for $197,893 of invoices carrying
-- only $3,800 of parts.
--
-- wo_unbilled_parts lists completed work orders that cost money in parts
-- and either were never invoiced, or were invoiced with materially less
-- parts value than they cost.
--
-- Deliberately excludes:
--  * project work orders (parts sit inside a lump-sum contract)
--  * the project-billed customers that don't invoice per order, matching
--    isInvoiceExcludedCustomer() in shared.js
-- ============================================================

create or replace view public.wo_unbilled_parts as
with po_cost as (
  select p.wo_id, sum(p.amount::numeric) parts_cost, count(*) po_count,
         string_agg(distinct p.po_id, ', ') po_ids
    from public.purchase_orders p
   where p.wo_id is not null and p.status = 'approved' and coalesce(p.amount,0) > 0
   group by p.wo_id
),
inv as (
  -- An invoice can cover several work orders; spread its parts value over
  -- them so a multi-WO invoice isn't credited in full to each one.
  -- wo_ids is text[], and historic rows aren't guaranteed to hold valid
  -- uuids, so guard the cast rather than letting one bad row kill the view.
  select w.wo_id::uuid wo_id,
         sum(i.parts_total::numeric / greatest(array_length(i.wo_ids,1),1)) billed_parts,
         string_agg(distinct i.invoice_num, ', ') invoice_nums
    from public.invoices i
    cross join lateral unnest(i.wo_ids) as w(wo_id)
   where w.wo_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   group by w.wo_id::uuid
)
select wo.id wo_id, wo.wo_id wo_number, wo.customer, wo.title,
       wo.date_completed, wo.invoiced,
       round(c.parts_cost, 2) parts_cost, c.po_count, c.po_ids,
       round(coalesce(i.billed_parts, 0), 2) billed_parts,
       i.invoice_nums,
       round(c.parts_cost - coalesce(i.billed_parts, 0), 2) gap,
       coalesce(cu.parts_markup, 35) markup_pct,
       -- What the gap is worth once the customer's markup is applied.
       round((c.parts_cost - coalesce(i.billed_parts, 0)) * (1 + coalesce(cu.parts_markup, 35)/100.0), 2) gap_at_markup
  from public.work_orders wo
  join po_cost c on c.wo_id = wo.id
  left join inv i on i.wo_id = wo.id
  left join public.customers cu on cu.name = wo.customer
 where wo.status = 'completed'
   and wo.project_id is null
   and coalesce(wo.customer,'') <> ''
   and lower(wo.customer) not like '%school of medicine%'
   and not (lower(wo.customer) like '%duke%' and lower(wo.customer) like '%facilities maintenance%')
   -- Only flag a real shortfall, not rounding.
   and c.parts_cost - coalesce(i.billed_parts, 0) > 1.00;

grant select on public.wo_unbilled_parts to authenticated;
