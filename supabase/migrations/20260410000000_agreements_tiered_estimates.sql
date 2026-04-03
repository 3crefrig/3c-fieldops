-- ============================================================
-- BATCH 2: Service Agreements + Tiered Commercial Estimates
-- ============================================================

-- 1. Agreement Tiers (internal templates — customer never sees tier name)
CREATE TABLE IF NOT EXISTS agreement_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  visit_frequency text NOT NULL DEFAULT 'quarterly',
  visits_per_year integer DEFAULT 4,
  included_services jsonb DEFAULT '[]',
  response_time_hours integer DEFAULT 24,
  priority_level text DEFAULT 'medium',
  discount_pct numeric DEFAULT 0,
  base_monthly_rate numeric DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Service Agreements (customer-facing contracts)
CREATE TABLE IF NOT EXISTS service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_num text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  tier_id uuid REFERENCES agreement_tiers(id),
  tier_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  visit_frequency text NOT NULL DEFAULT 'quarterly',
  visits_per_year integer DEFAULT 4,
  visits_completed integer DEFAULT 0,
  included_services jsonb DEFAULT '[]',
  monthly_rate numeric DEFAULT 0,
  annual_value numeric DEFAULT 0,
  discount_pct numeric DEFAULT 0,
  priority_level text DEFAULT 'medium',
  response_time_hours integer DEFAULT 24,
  equipment_ids jsonb DEFAULT '[]',
  notes text,
  status text DEFAULT 'active',
  auto_renew boolean DEFAULT false,
  renewal_reminder_sent boolean DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_customer ON service_agreements(customer_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON service_agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_end_date ON service_agreements(end_date);

-- 3. Link WOs and invoices to agreements
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES service_agreements(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES service_agreements(id);

-- 4. Extend estimates for multi-option support
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS options jsonb;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS selected_option integer;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_type text DEFAULT 'standard';
