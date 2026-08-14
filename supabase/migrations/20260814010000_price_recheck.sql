-- ============================================================
-- Price re-check scheduling — additive
--
-- A flat "re-quote everything every N months" doesn't survive contact
-- with a busy season, and it's the wrong shape anyway: 3C's own history
-- shows 7/8" copper running $105 -> $206 while Armacell fittings barely
-- moved. So the re-check interval is per-part, and there's an event
-- trigger on top of the calendar.
--
--  * parts.recheck_days  — 90 for commodity-linked (copper, refrigerant,
--    nitrogen/acetylene), 180 for everything else.
--  * parts.watch         — force a part into the re-check list.
--  * price_recheck_due   — what to re-quote now, worst first, skipping
--    parts too small to be worth an hour of anyone's time.
-- ============================================================

alter table public.parts add column if not exists recheck_days integer not null default 180;
alter table public.parts add column if not exists watch boolean not null default false;
alter table public.parts add column if not exists annual_spend numeric;

-- Commodity-linked parts move with markets, not price lists.
update public.parts
   set recheck_days = 90
 where recheck_days = 180
   and (
     description ~* '(COPPER|R-?404|R-?410|R-?134|R-?407|REFRIGERANT|NITROGEN|ACETYLENE|OXYGEN)'
     or part_no ~* '^(AC[0-9]|R-?[0-9]{3})'
   );

-- What needs re-quoting, and why. One row per part, worst first.
create or replace view public.price_recheck_due as
with stats as (
  select pp.part_id,
         count(*) filter (where pp.source = 'purchase')                      buys,
         sum(pp.unit_price * coalesce(pp.qty,1)) filter (where pp.source = 'purchase') spend,
         max(pp.observed_at) filter (where pp.source = 'purchase')           last_bought,
         max(pp.observed_at) filter (where pp.source in ('quote','reference')) last_checked,
         avg(pp.unit_price)  filter (where pp.source = 'purchase')           avg_paid,
         min(pp.unit_price)  filter (where pp.source in ('quote','reference')) best_alt
    from public.part_prices pp
   group by pp.part_id
),
recent as (
  -- Most recent purchase price, to spot a jump against the average.
  select distinct on (part_id) part_id, unit_price latest
    from public.part_prices where source = 'purchase'
   order by part_id, observed_at desc, id
)
select p.id part_id, p.part_no, p.description, p.recheck_days, p.watch,
       s.buys, round(s.spend,2) spend, s.last_bought, s.last_checked,
       round(s.avg_paid,2) avg_paid, round(s.best_alt,2) best_alt, r.latest latest_paid,
       case when s.avg_paid > 0 then round(((r.latest - s.avg_paid)/s.avg_paid)*100, 1) end jump_pct,
       case
         when s.last_checked is null then 'never checked'
         when s.last_checked < now() - (p.recheck_days || ' days')::interval then 'stale quote'
         else 'current'
       end check_status,
       -- Ordering weight: a big-spend part with a big jump floats up.
       round(coalesce(s.spend,0) * (1 + greatest(coalesce(((r.latest - s.avg_paid)/nullif(s.avg_paid,0))*100,0),0)/100), 2) priority
  from public.parts p
  join stats s on s.part_id = p.id
  left join recent r on r.part_id = p.id
 where s.buys >= 2
   and (p.watch
        or s.last_checked is null
        or s.last_checked < now() - (p.recheck_days || ' days')::interval
        or (s.avg_paid > 0 and r.latest > s.avg_paid * 1.15))
   -- Not worth an hour of anyone's time below this.
   and coalesce(s.spend,0) >= 100;

grant select on public.price_recheck_due to authenticated;
