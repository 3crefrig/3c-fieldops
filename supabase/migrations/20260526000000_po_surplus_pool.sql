-- Surplus parts pool: track POs whose material was purchased but never used,
-- so the cost can be recovered on a future invoice instead of being eaten as margin loss.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS surplus_pool BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS surplus_billed_invoice_id UUID;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS surplus_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_surplus
  ON purchase_orders(surplus_pool)
  WHERE surplus_pool = TRUE;

COMMENT ON COLUMN purchase_orders.surplus_pool IS
  'PO material was purchased but not used on the original WO; available to bill on a future job.';
COMMENT ON COLUMN purchase_orders.surplus_billed_invoice_id IS
  'Invoice ID where this surplus PO was eventually billed. Set when an invoice consumes the surplus.';
COMMENT ON COLUMN purchase_orders.surplus_notes IS
  'Free-text notes about the surplus material (e.g. "5 contactors left over", "stored on Truck 3").';
