-- Scheduled email sends for invoice delivery
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  to_emails TEXT NOT NULL,
  cc_emails TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_name TEXT,
  attachment_base64 TEXT,
  drive_file_id TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Add breakdown data to invoices (PM/CM/EM hour and dollar breakdown)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS breakdown_data JSONB;

-- Add customer-specific invoice settings
ALTER TABLE customers ADD COLUMN IF NOT EXISTS invoice_settings JSONB;

-- Index for the cron job to efficiently find pending emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
  ON scheduled_emails (send_at)
  WHERE status = 'pending';
