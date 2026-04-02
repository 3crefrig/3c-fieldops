-- ═══════════════════════════════════════════
-- Phase 1: KPI Dashboard support
-- ═══════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS available_hours_week numeric DEFAULT 40;

CREATE INDEX IF NOT EXISTS idx_wo_customer_completed
  ON work_orders(customer, date_completed)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_invoices_status_dates
  ON invoices(status, date_issued, date_paid);

-- ═══════════════════════════════════════════
-- Phase 2: Client Feedback & Testimonials
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id),
  invoice_num text,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  respondent_name text,
  respondent_email text,
  star_rating integer CHECK (star_rating BETWEEN 1 AND 5),
  nps_score integer CHECK (nps_score BETWEEN 0 AND 10),
  nps_feedback text,
  testimonial_text text,
  testimonial_approved boolean DEFAULT false,
  testimonial_public boolean DEFAULT false,
  private_feedback text,
  feedback_type text DEFAULT 'invoice',
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_name);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(star_rating);
CREATE INDEX IF NOT EXISTS idx_feedback_testimonial ON feedback(testimonial_approved, testimonial_public);

CREATE TABLE IF NOT EXISTS feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id),
  customer_name text NOT NULL,
  sent_to text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  token text UNIQUE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feedback_requests_token ON feedback_requests(token);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_key_account boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS feedback_email text;

-- ═══════════════════════════════════════════
-- Phase 3: Proposals & Estimates
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_num text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  project_id uuid REFERENCES projects(id),
  title text NOT NULL,
  scope_of_work text,
  ai_generated_content text,
  user_edits text,
  estimate_id uuid,
  status text DEFAULT 'draft',
  sent_to text,
  sent_at timestamptz,
  approval_token text UNIQUE,
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  drive_file_id text,
  drive_file_url text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals(customer_name);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_token ON proposals(approval_token);

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_num text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  proposal_id uuid REFERENCES proposals(id),
  tier_data jsonb DEFAULT '[]',
  parts_data jsonb DEFAULT '[]',
  labor_total numeric DEFAULT 0,
  parts_total numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  job_description text,
  notes text,
  valid_until date,
  payment_terms text,
  status text DEFAULT 'draft',
  approval_token text UNIQUE,
  approved_at timestamptz,
  converted_wo_id text,
  converted_invoice_id uuid,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_name);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_token ON estimates(approval_token);

-- ═══════════════════════════════════════════
-- Phase 4: Visual Workflow Builder
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  active boolean DEFAULT false,
  created_by text NOT NULL,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_data jsonb,
  status text DEFAULT 'running',
  current_node_id text,
  execution_log jsonb DEFAULT '[]',
  resume_at timestamptz,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_resume ON workflow_runs(resume_at)
  WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  nodes jsonb NOT NULL,
  edges jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
