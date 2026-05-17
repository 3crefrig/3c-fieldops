-- ============================================================
-- Editable rows-based Field Notes for work orders
-- Replaces the append-only text blob in work_orders.field_notes
-- Old column is preserved (legacy display) — never dropped.
-- ============================================================

CREATE TABLE IF NOT EXISTS wo_field_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id       uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  author      text NOT NULL,
  author_id   uuid REFERENCES users(id),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz,
  edited_by   text
);

CREATE INDEX IF NOT EXISTS idx_wo_field_notes_wo
  ON wo_field_notes(wo_id, created_at DESC);

-- Helps the "Previous Notes from this unit" lookup that joins through
-- work_orders.equipment_id; the planner will hit idx_wo_equipment on
-- work_orders and then this index for ordering.
CREATE INDEX IF NOT EXISTS idx_wo_field_notes_created
  ON wo_field_notes(created_at DESC);

-- Realtime publication so the React client picks up live updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'wo_field_notes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE wo_field_notes';
  END IF;
END $$;
