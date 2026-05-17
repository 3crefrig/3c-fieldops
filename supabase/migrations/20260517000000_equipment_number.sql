-- ============================================================
-- Add customer-assigned Equipment # to equipment records
-- Distinct from asset_tag (physical scannable barcode).
-- e.g. "WIC-04", "Cooler #3", "RTU-7" — whatever the customer
-- calls the unit in their TMS/CMMS.
-- ============================================================

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS equipment_number text;

CREATE INDEX IF NOT EXISTS idx_equipment_number
  ON equipment(equipment_number) WHERE equipment_number IS NOT NULL;
