-- Phase 3a: Social Content Engine

-- Note: images are stored as fal.ai CDN URLs directly in image_url.
-- No Supabase Storage bucket is required.

-- Google OAuth columns on accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_location_name TEXT;

-- content_posts table
CREATE TABLE IF NOT EXISTS content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  prompt_data JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  captions JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_date DATE,
  google_posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_posts_account_date
  ON content_posts(account_id, scheduled_date);

-- RLS for content_posts
ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own content posts"
ON content_posts FOR ALL
USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- content_cadence_settings table
CREATE TABLE IF NOT EXISTS content_cadence_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  instagram_per_week INT NOT NULL DEFAULT 3,
  facebook_per_week INT NOT NULL DEFAULT 2,
  google_per_week INT NOT NULL DEFAULT 1,
  reminder_type TEXT NOT NULL DEFAULT 'dashboard',
  preferred_days JSONB NOT NULL DEFAULT '{"instagram":[1,3,5],"facebook":[2,4],"google_business":[3]}'
);

-- RLS for content_cadence_settings
ALTER TABLE content_cadence_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own cadence settings"
ON content_cadence_settings FOR ALL
USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
