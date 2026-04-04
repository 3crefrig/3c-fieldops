-- Scope snippet library for token-efficient proposal generation
CREATE TABLE IF NOT EXISTS scope_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- refrigeration, hvac, controls, general, project
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE scope_snippets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read snippets
CREATE POLICY "scope_snippets_select" ON scope_snippets FOR SELECT TO authenticated USING (true);

-- Only admin/manager can manage snippets
CREATE POLICY "scope_snippets_insert" ON scope_snippets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','manager')));
CREATE POLICY "scope_snippets_update" ON scope_snippets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','manager')));
CREATE POLICY "scope_snippets_delete" ON scope_snippets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','manager')));

-- Seed standard snippets from 3C's actual proposal structure
INSERT INTO scope_snippets (name, category, content) VALUES

('Refrigeration Systems Maintenance', 'refrigeration',
'Refrigeration Systems Maintenance — Conduct scheduled inspections of all refrigeration systems including walk-in coolers, freezers, and cold rooms. Services include coil cleaning, refrigerant level testing, compressor performance evaluation, condenser and evaporator inspection, lubrication of moving parts, and verification of operating temperatures and pressures. Ensure full compliance with relevant safety and performance standards.'),

('Controls Inspection & Service', 'controls',
'Controls Inspection & Service — Inspect and service all temperature, humidity, and pressure control systems including digital controllers, alarm systems, control panels, sensors, and associated wiring. Verify proper calibration, test alarm functionality, and ensure accurate monitoring of environmental conditions critical to operations.'),

('Components Inspection & Service', 'refrigeration',
'Components Inspection & Service — Inspect and service chamber and unit components including doors, gaskets, seals, hinges, door heaters, latches, and structural elements. Check for corrosion, wear, and damage. Replace or repair components as needed to maintain proper seal integrity and operational efficiency.'),

('Reporting & Documentation', 'general',
'Reporting & Documentation — Provide comprehensive service reports following each visit, including findings, actions taken, and recommendations for future maintenance or upgrades. Maintain detailed records of all service activities, parts used, and system performance data.'),

('Emergency Response', 'general',
'Emergency Response — Provide priority response for critical equipment failures and alarm conditions. On-call support available during normal operating hours (7:30 AM – 4:00 PM). After-hours emergency service available 24/7 subject to emergency rate scheduling and a 4-hour minimum charge.'),

('Primary Retrofit Work', 'project',
'Primary Retrofit/Installation Work — Remove and properly dispose of existing equipment. Install new systems including condensing units, evaporators, and associated refrigerant piping. Perform nitrogen pressure testing, system evacuation, and refrigerant charging per manufacturer specifications. Verify all connections and ensure compliance with applicable codes and standards.'),

('Commissioning & Startup', 'project',
'Commissioning — Perform final system testing including temperature pull-down verification, refrigerant charge confirmation, control system programming, and alarm threshold configuration. Coordinate startup with other contractors and building management as needed. Document all commissioning results.'),

('Quality Assurance & Review', 'project',
'Quality Assurance & Client Review — Conduct a final walkthrough with the client to review all completed work, demonstrate system operation, and address any concerns. Make adjustments as needed to ensure full client satisfaction and operational readiness. Provide as-built documentation and maintenance recommendations.');

-- Track last email refresh per user to enforce 2hr cooldown
CREATE TABLE IF NOT EXISTS email_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  refreshed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_refresh_own" ON email_refresh_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
