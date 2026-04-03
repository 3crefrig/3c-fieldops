-- ============================================================
-- BATCH 4: Customer Health Scores
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score integer;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score_updated_at timestamptz;
