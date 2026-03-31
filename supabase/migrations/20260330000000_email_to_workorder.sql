-- ============================================================
-- Email-to-Work-Order Automation: Database Migration
-- Creates wo_drafts and email_processing_log tables
-- ============================================================

-- Draft work orders extracted from incoming emails
CREATE TABLE IF NOT EXISTS wo_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original email metadata
  email_id text UNIQUE NOT NULL,          -- Gmail message ID (dedup key)
  email_from text,                        -- sender email address
  email_from_name text,                   -- sender display name
  email_subject text,                     -- original subject line
  email_body text,                        -- original body text
  email_date timestamptz,                 -- when the email was sent

  -- AI-extracted fields
  customer_name text,                     -- extracted customer name
  customer_id uuid REFERENCES customers(id),  -- matched customer FK
  customer_wo text,                       -- external WO# (e.g., TMS 1637295)
  title text,                             -- AI-generated WO title
  location text,                          -- extracted room/location
  building text,                          -- extracted building code/name
  description text,                       -- extracted issue description
  priority text DEFAULT 'medium',         -- high, medium, low
  contact_name text,                      -- requesting person's name
  contact_email text,                     -- requesting person's email

  -- Attachments stored in Google Drive
  attachments jsonb DEFAULT '[]'::jsonb,  -- [{url, name, type}]

  -- Review workflow
  status text DEFAULT 'pending_review',   -- pending_review, approved, rejected
  reviewed_by uuid,                       -- user who approved/rejected
  reviewed_at timestamptz,
  reject_reason text,                     -- optional reason if rejected
  created_wo_id text,                     -- wo_id if approved into real WO

  -- AI metadata
  ai_confidence real,                     -- 0-1 extraction confidence
  ai_raw jsonb,                           -- full Claude response for debugging

  created_at timestamptz DEFAULT now()
);

-- Index for quick pending draft lookups (dashboard badge)
CREATE INDEX IF NOT EXISTS idx_wo_drafts_status ON wo_drafts(status);

-- Index for dedup check on each polling run
CREATE INDEX IF NOT EXISTS idx_wo_drafts_email_id ON wo_drafts(email_id);

-- Edge function run log for observability
CREATE TABLE IF NOT EXISTS email_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz DEFAULT now(),
  emails_found int DEFAULT 0,
  drafts_created int DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb
);
