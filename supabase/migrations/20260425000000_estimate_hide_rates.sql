-- Add hide_rates flag to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS hide_rates boolean DEFAULT false;
