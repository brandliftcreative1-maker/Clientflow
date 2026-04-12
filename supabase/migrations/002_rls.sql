-- Row Level Security Policies
-- Run AFTER 001_schema.sql

-- ============================================================
-- Helper function: get current user's account_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM accounts WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- ACCOUNTS RLS
-- ============================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account"
  ON accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own account"
  ON accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own account"
  ON accounts FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- CONTACTS RLS
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their contacts"
  ON contacts FOR SELECT
  USING (account_id = get_account_id());

CREATE POLICY "Users can insert their contacts"
  ON contacts FOR INSERT
  WITH CHECK (account_id = get_account_id());

CREATE POLICY "Users can update their contacts"
  ON contacts FOR UPDATE
  USING (account_id = get_account_id());

CREATE POLICY "Users can delete their contacts"
  ON contacts FOR DELETE
  USING (account_id = get_account_id());

-- ============================================================
-- SEQUENCES RLS
-- ============================================================
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- Templates (account_id IS NULL) are readable by everyone authenticated
CREATE POLICY "Users can view their sequences and all templates"
  ON sequences FOR SELECT
  USING (account_id IS NULL OR account_id = get_account_id());

CREATE POLICY "Users can insert their sequences"
  ON sequences FOR INSERT
  WITH CHECK (account_id = get_account_id());

CREATE POLICY "Users can update their sequences"
  ON sequences FOR UPDATE
  USING (account_id = get_account_id());

CREATE POLICY "Users can delete their sequences"
  ON sequences FOR DELETE
  USING (account_id = get_account_id());

-- ============================================================
-- SEQUENCE STEPS RLS
-- ============================================================
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps for their sequences"
  ON sequence_steps FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM sequences
      WHERE account_id IS NULL OR account_id = get_account_id()
    )
  );

CREATE POLICY "Users can insert steps for their sequences"
  ON sequence_steps FOR INSERT
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM sequences WHERE account_id = get_account_id()
    )
  );

CREATE POLICY "Users can update steps for their sequences"
  ON sequence_steps FOR UPDATE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE account_id = get_account_id()
    )
  );

CREATE POLICY "Users can delete steps for their sequences"
  ON sequence_steps FOR DELETE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE account_id = get_account_id()
    )
  );

-- ============================================================
-- SEQUENCE ENROLLMENTS RLS
-- ============================================================
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their enrollments"
  ON sequence_enrollments FOR SELECT
  USING (account_id = get_account_id());

CREATE POLICY "Users can insert their enrollments"
  ON sequence_enrollments FOR INSERT
  WITH CHECK (account_id = get_account_id());

CREATE POLICY "Users can update their enrollments"
  ON sequence_enrollments FOR UPDATE
  USING (account_id = get_account_id());

-- ============================================================
-- CAMPAIGNS RLS
-- ============================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their campaigns"
  ON campaigns FOR SELECT
  USING (account_id = get_account_id());

CREATE POLICY "Users can insert their campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (account_id = get_account_id());

CREATE POLICY "Users can update their campaigns"
  ON campaigns FOR UPDATE
  USING (account_id = get_account_id());

CREATE POLICY "Users can delete their campaigns"
  ON campaigns FOR DELETE
  USING (account_id = get_account_id());

-- ============================================================
-- EMAIL LOGS RLS
-- ============================================================
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their email logs"
  ON email_logs FOR SELECT
  USING (account_id = get_account_id());

CREATE POLICY "Users can insert their email logs"
  ON email_logs FOR INSERT
  WITH CHECK (account_id = get_account_id());

-- ============================================================
-- REVIEW REQUESTS RLS
-- ============================================================
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their review requests"
  ON review_requests FOR SELECT
  USING (account_id = get_account_id());

CREATE POLICY "Users can insert their review requests"
  ON review_requests FOR INSERT
  WITH CHECK (account_id = get_account_id());

CREATE POLICY "Users can update their review requests"
  ON review_requests FOR UPDATE
  USING (account_id = get_account_id());
