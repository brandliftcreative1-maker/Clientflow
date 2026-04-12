-- Phase 2: Sequences Engine additions

-- Birthday field on contacts (required for birthday trigger)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;

-- Partial index for cron processor — only active enrollments with a scheduled send
CREATE INDEX IF NOT EXISTS idx_enrollments_due
  ON sequence_enrollments (next_send_at)
  WHERE status = 'active';

-- Birthday lookup index (match by month + day, ignore year)
CREATE INDEX IF NOT EXISTS idx_contacts_birthday_md
  ON contacts (EXTRACT(MONTH FROM birthday), EXTRACT(DAY FROM birthday))
  WHERE birthday IS NOT NULL;
