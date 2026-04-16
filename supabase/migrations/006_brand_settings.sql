-- Phase 3b: Brand Settings
-- Adds columns used by the Brand Settings UI and AI prompts.
-- Existing columns reused as-is: business_name, industry, description, website, phone, address, brand_voice.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS topics_to_avoid TEXT,
  ADD COLUMN IF NOT EXISTS example_posts TEXT;
