-- Time off (vacation / PTO / sick) on the crew schedule + company calendar.
-- Additive only. A time-off entry is a schedule row with kind='time_off' that
-- spans date..end_date inclusive (end_date null = single day). `task` holds the
-- type label (Vacation, PTO, Sick, Personal); `note` is optional detail.
--
-- No policy changes: the existing schedule RLS already fits — every registered
-- user can read, technicians can insert only rows assigned to themselves, and
-- update/delete is limited to the creator or a manager/admin.

alter table public.schedule add column if not exists kind text not null default 'task';
alter table public.schedule add column if not exists end_date text;
alter table public.schedule add column if not exists note text;

create index if not exists schedule_kind_date_idx on public.schedule (kind, date);
