-- Email logs table for tracking sent emails
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  status text NOT NULL,
  recipient_email text,
  sent_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_message text
);

-- Index for daily stats queries
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs (sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_order ON email_logs (order_id);
