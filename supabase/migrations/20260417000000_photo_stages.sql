-- ============================================================
-- BATCH 3: Photo Stages for Progress Documentation
-- ============================================================

ALTER TABLE photos ADD COLUMN IF NOT EXISTS photo_stage text DEFAULT 'general';
ALTER TABLE photos ADD COLUMN IF NOT EXISTS caption text;
