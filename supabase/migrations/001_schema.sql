-- ClientFlow Schema Migration
-- Run this in your Supabase SQL editor

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  brand_voice TEXT DEFAULT 'professional',
  primary_color TEXT DEFAULT '#2563eb',
  logo_url TEXT,
  from_email TEXT,
  from_name TEXT,
  reply_to_email TEXT,
  resend_domain_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  segment TEXT DEFAULT 'lead',
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, email)
);

-- ============================================================
-- SEQUENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  trigger_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEQUENCE STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences NOT NULL,
  step_number INTEGER NOT NULL,
  delay_days INTEGER DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  preview_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEQUENCE ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences NOT NULL,
  contact_id UUID REFERENCES contacts NOT NULL,
  account_id UUID REFERENCES accounts NOT NULL,
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  preview_text TEXT,
  segment TEXT,
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EMAIL LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts NOT NULL,
  contact_id UUID REFERENCES contacts,
  campaign_id UUID REFERENCES campaigns,
  sequence_id UUID REFERENCES sequences,
  sequence_step_id UUID REFERENCES sequence_steps,
  email_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_id TEXT,
  status TEXT DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REVIEW REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts NOT NULL,
  contact_id UUID REFERENCES contacts NOT NULL,
  platform TEXT DEFAULT 'google',
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  clicked_at TIMESTAMPTZ,
  review_url TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_segment ON contacts(segment);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account_id ON sequence_enrollments(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_send ON sequence_enrollments(next_send_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_account_id ON email_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_sequences_account_id ON sequences(account_id);
CREATE INDEX IF NOT EXISTS idx_sequences_is_template ON sequences(is_template);
