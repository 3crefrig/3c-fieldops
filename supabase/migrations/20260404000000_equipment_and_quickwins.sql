-- ============================================================
-- BATCH 1: Equipment/Asset History + Workflow Quick Wins
-- ============================================================

-- 1. Equipment / Asset table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  asset_tag text,
  model text,
  serial_number text,
  manufacturer text,
  equipment_type text DEFAULT 'other',
  refrigerant_type text,
  install_date date,
  warranty_expiration date,
  location text,
  location_detail text,
  notes text,
  status text DEFAULT 'active',
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_customer ON equipment(customer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_asset_tag ON equipment(asset_tag);
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty ON equipment(warranty_expiration) WHERE status = 'active';

-- 2. Link work orders to equipment (nullable)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES equipment(id);
CREATE INDEX IF NOT EXISTS idx_wo_equipment ON work_orders(equipment_id);

-- 3. Link photos to equipment (nullable, photos can belong to WO or equipment or both)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES equipment(id);

-- 4. Prep recurring_templates for service agreements (Batch 2)
ALTER TABLE recurring_templates ADD COLUMN IF NOT EXISTS agreement_id uuid;

-- 5. Workflow quick win templates
INSERT INTO workflow_templates (id, name, description, category, nodes, edges) VALUES
-- PO $0 reminder
(gen_random_uuid(), 'PO Amount Reminder', 'Alert when a PO is approved with $0 amount', 'finance',
 '[{"id":"t1","type":"trigger","config":{"event":"po_approved"},"position":{"x":100,"y":100}},{"id":"c1","type":"condition","config":{"field":"amount","operator":"<=","value":"0"},"position":{"x":100,"y":220}},{"id":"a1","type":"action","config":{"action_type":"create_notification","title":"PO Needs Amount","message":"PO approved with $0 — set amount before ordering","for_role":"manager"},"position":{"x":100,"y":340}}]'::jsonb,
 '[{"source":"t1","target":"c1"},{"source":"c1","target":"a1"}]'::jsonb),

-- Overdue WO escalation
(gen_random_uuid(), 'Overdue WO Escalation', 'Notify manager when a WO is pending for over 48 hours', 'operations',
 '[{"id":"t1","type":"trigger","config":{"event":"wo_overdue"},"position":{"x":100,"y":100}},{"id":"a1","type":"action","config":{"action_type":"create_notification","title":"Overdue Work Order","message":"WO has been pending for over 48 hours — needs attention","for_role":"manager"},"position":{"x":100,"y":220}}]'::jsonb,
 '[{"source":"t1","target":"a1"}]'::jsonb),

-- Invoice follow-up (7 days)
(gen_random_uuid(), 'Invoice Payment Reminder', 'Send email reminder 7 days after invoice sent', 'finance',
 '[{"id":"t1","type":"trigger","config":{"event":"invoice_overdue"},"position":{"x":100,"y":100}},{"id":"a1","type":"action","config":{"action_type":"send_email","subject":"Friendly Reminder: Outstanding Invoice","body":"This is a courtesy reminder that your invoice is now past due. Please remit payment at your earliest convenience.\\n\\nThank you,\\n3C Refrigeration","to_email":"{{customer_email}}"},"position":{"x":100,"y":220}}]'::jsonb,
 '[{"source":"t1","target":"a1"}]'::jsonb),

-- New customer welcome
(gen_random_uuid(), 'New Customer Welcome', 'Send welcome email when a customer is added', 'customer',
 '[{"id":"t1","type":"trigger","config":{"event":"customer_created"},"position":{"x":100,"y":100}},{"id":"a1","type":"action","config":{"action_type":"send_email","subject":"Welcome to 3C Refrigeration","body":"Thank you for choosing 3C Refrigeration! We look forward to serving your refrigeration and HVAC needs.\\n\\nIf you have any questions, feel free to reach us at service@3crefrigeration.com.\\n\\nBest regards,\\n3C Refrigeration Team","to_email":"{{email}}"},"position":{"x":100,"y":220}}]'::jsonb,
 '[{"source":"t1","target":"a1"}]'::jsonb),

-- Completion thank-you
(gen_random_uuid(), 'Job Completion Thank You', 'Send thank-you email with feedback link when WO completed', 'customer',
 '[{"id":"t1","type":"trigger","config":{"event":"wo_completed"},"position":{"x":100,"y":100}},{"id":"a1","type":"action","config":{"action_type":"send_email","subject":"Service Complete — Thank You!","body":"Your service has been completed. We hope everything meets your expectations!\\n\\nWe would love your feedback: {{feedback_link}}\\n\\nThank you for choosing 3C Refrigeration.","to_email":"{{customer_email}}"},"position":{"x":100,"y":220}}]'::jsonb,
 '[{"source":"t1","target":"a1"}]'::jsonb),

-- High-priority WO alert
(gen_random_uuid(), 'High Priority WO Alert', 'Notify manager immediately when a high-priority WO is created', 'operations',
 '[{"id":"t1","type":"trigger","config":{"event":"wo_created"},"position":{"x":100,"y":100}},{"id":"c1","type":"condition","config":{"field":"priority","operator":"equals","value":"high"},"position":{"x":100,"y":220}},{"id":"a1","type":"action","config":{"action_type":"create_notification","title":"URGENT: High Priority WO Created","message":"{{wo_id}}: {{title}} — Priority: HIGH","for_role":"manager"},"position":{"x":100,"y":340}}]'::jsonb,
 '[{"source":"t1","target":"c1"},{"source":"c1","target":"a1"}]'::jsonb),

-- Low rating follow-up
(gen_random_uuid(), 'Low Feedback Follow-Up', 'Create follow-up WO when customer gives 1-2 star rating', 'customer',
 '[{"id":"t1","type":"trigger","config":{"event":"feedback_received"},"position":{"x":100,"y":100}},{"id":"c1","type":"condition","config":{"field":"star_rating","operator":"<=","value":"2"},"position":{"x":100,"y":220}},{"id":"a1","type":"action","config":{"action_type":"create_notification","title":"Low Customer Feedback — Follow Up Required","message":"Customer {{customer_name}} rated service {{star_rating}}/5. Review and follow up.","for_role":"manager"},"position":{"x":100,"y":340}}]'::jsonb,
 '[{"source":"t1","target":"c1"},{"source":"c1","target":"a1"}]'::jsonb),

-- Auto-log status changes
(gen_random_uuid(), 'Auto-Log Status Changes', 'Log activity when WO status changes', 'operations',
 '[{"id":"t1","type":"trigger","config":{"event":"wo_status_changed"},"position":{"x":100,"y":100}},{"id":"a1","type":"action","config":{"action_type":"log_activity","message":"Status changed to {{status}}"},"position":{"x":100,"y":220}}]'::jsonb,
 '[{"source":"t1","target":"a1"}]'::jsonb)

ON CONFLICT DO NOTHING;
