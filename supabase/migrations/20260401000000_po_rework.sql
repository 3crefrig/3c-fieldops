-- PO System Rework: add vendor, quantity, urgency, and lifecycle tracking columns
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_name text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_contact text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS special_instructions text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_to_vendor boolean DEFAULT false;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_to_vendor_at timestamptz;
