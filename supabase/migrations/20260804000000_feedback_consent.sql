-- Feedback revamp (2026-08-04): reviewer identity + explicit website-use consent.
-- Additive only.
alter table feedback add column if not exists respondent_company text;
alter table feedback add column if not exists respondent_position text;
alter table feedback add column if not exists consent_website boolean default false;
comment on column feedback.consent_website is 'Reviewer explicitly agreed their review (with name/company/position) may be shown on the 3C website. Unticked by default on the public form.';
