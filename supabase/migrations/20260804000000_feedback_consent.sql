-- Feedback revamp (2026-08-04): reviewer identity + explicit website-use consent.
-- Additive only.
alter table feedback add column if not exists respondent_company text;
alter table feedback add column if not exists respondent_position text;
alter table feedback add column if not exists consent_website boolean default false;
comment on column feedback.consent_website is 'Reviewer explicitly agreed their review (with name/company/position) may be shown on the 3C website. Unticked by default on the public form.';

-- The app has always inserted invoice_num into feedback_requests but the column
-- never existed — the insert failed silently and every emailed feedback link was
-- dead (0 rows in this table as of 2026-08-04). Add the missing column.
alter table feedback_requests add column if not exists invoice_num text;
