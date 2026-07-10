-- Fix duplicate daily-sweep notifications: the client-side SELECT-then-INSERT
-- dedupe races when two devices open the app simultaneously (observed 26 dup
-- pairs in prod). A partial unique index makes the day-level dedupe atomic;
-- the sweep inserts don't check errors, so the race loser now fails silently.

-- 1) Remove existing duplicate rows (keep the earliest of each type+message+day).
delete from public.notifications a
using public.notifications b
where a.type=b.type and a.message is not distinct from b.message
  and timezone('utc',a.created_at)::date=timezone('utc',b.created_at)::date
  and a.id<>b.id and a.created_at>b.created_at;

-- 2) Atomic per-day dedupe for system sweep alerts only (user-event types like
--    wo_assigned may legitimately repeat in a day and are left alone).
--    timezone('utc',...) keeps the expression IMMUTABLE as required for indexes.
create unique index if not exists notif_daily_dedupe
  on public.notifications (type, message, ((timezone('utc',created_at))::date))
  where type in ('wo_needs_invoice','wo_past_due','wo_unassigned','po_approval_stale',
                 'wo_completion_gap','invoice_draft_stale','deadline_warning',
                 'warranty_expiring','wo_overdue');
