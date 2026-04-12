-- Seed pre-built sequence templates
-- Run AFTER 001_schema.sql and 002_rls.sql
-- These are global templates (account_id = NULL) available to all users

-- ============================================================
-- SALON & BEAUTY
-- ============================================================

-- New Client Welcome
WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'New Client Welcome', 'Warm welcome series for new salon clients', 'Salon & Beauty', 'new_contact', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT
  seq.id,
  step_number,
  delay_days,
  subject,
  body,
  preview_text
FROM seq, (VALUES
  (1, 0,
   'Welcome to [Business Name], [First Name]!',
   E'Hi [First Name],\n\nWelcome to [Business Name]! We''re so glad you chose us, and we want to make sure your first visit is everything you hoped for.\n\nHere''s what to expect:\n- Our team will greet you and walk you through your service\n- We''ll take a few minutes to understand exactly what you''re looking for\n- You''ll leave feeling amazing — guaranteed\n\nIf you have any questions before your appointment, don''t hesitate to reach out at [Phone] or simply reply to this email.\n\nWe can''t wait to meet you!\n\n[Your Name]\n[Business Name]',
   'Can''t wait to see you — here''s what to expect'),
  (2, 3,
   'How was your first visit, [First Name]?',
   E'Hi [First Name],\n\nWe hope you loved your experience at [Business Name]!\n\nWe''d love to hear how everything went. Your feedback helps us keep getting better, and honestly — it means the world to us.\n\nIf you had a great experience, we''d be so grateful if you took 2 minutes to leave us a quick review. It helps other clients find us and supports our small business more than you know.\n\nReply to this email anytime — we''re always here.\n\n[Your Name]\n[Business Name]',
   'We''d love to know how your first visit went'),
  (3, 14,
   'Time to treat yourself again, [First Name]',
   E'Hi [First Name],\n\nIt''s been a couple of weeks — are you ready to treat yourself again? 😊\n\nOur schedule fills up fast, so if you''d like to come back in, now''s a great time to book. We''d love to see you!\n\nReply to this email or call us at [Phone] to get on the calendar.\n\n[Your Name]\n[Business Name]',
   'Ready for your next appointment?')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- Post-Visit Follow Up
WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Post-Visit Follow Up', 'Thank clients after their appointment and request a review', 'Salon & Beauty', 'job_completed', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 1,
   'Thanks for coming in, [First Name]!',
   E'Hi [First Name],\n\nThank you so much for visiting [Business Name] yesterday! We hope you''re loving your results.\n\nIt was wonderful having you in — our team truly enjoyed working with you. We hope to see you again soon!\n\nIf there''s anything we can do to make your next visit even better, just let us know.\n\n[Your Name]\n[Business Name]',
   'Hope you''re loving your results!'),
  (2, 2,
   'Love your new look? Share it! ⭐',
   E'Hi [First Name],\n\nWe''re so glad you came in! If you''re happy with your results, we''d be incredibly grateful if you left us a quick review.\n\nIt only takes 2 minutes and makes a huge difference for our small business.\n\nLeave us a review → [Review Link]\n\nThank you so much — we truly appreciate your support!\n\n[Your Name]\n[Business Name]',
   'A quick review would mean so much to us')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- Lapsed Client Win-Back
WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Lapsed Client Win-Back', 'Re-engage clients who haven''t visited in 60+ days', 'Salon & Beauty', 'no_purchase', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 0,
   'We miss you, [First Name]!',
   E'Hi [First Name],\n\nWe noticed it''s been a while since we''ve seen you at [Business Name], and we just wanted to reach out.\n\nWe''ve added some new services and we''d love to have you back. As a thank-you for being a past client, we''d love to take care of you.\n\nWhenever you''re ready to book, just reply to this email or call [Phone].\n\n[Your Name]\n[Business Name]',
   'It''s been a while — we''d love to see you again'),
  (2, 7,
   'Still thinking about it, [First Name]?',
   E'Hi [First Name],\n\nJust a gentle follow-up in case my last email got buried!\n\nWe''d love to see you back at [Business Name]. Booking is easy — just reply here or call us at [Phone] and we''ll get you on the calendar.\n\nNo pressure at all — just know we''re here when you''re ready!\n\n[Your Name]\n[Business Name]',
   'We''re here whenever you''re ready')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- ============================================================
-- CONTRACTOR & TRADES
-- ============================================================

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Estimate Follow-Up', 'Follow up after sending a project estimate', 'Contractor & Trades', 'estimate_sent', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 1,
   'Your estimate from [Business Name]',
   E'Hi [First Name],\n\nI wanted to follow up on the estimate I sent over. I know these decisions take some thought, and I''m happy to answer any questions you might have.\n\nAt [Business Name], we pride ourselves on quality work and clear communication throughout every project. You can count on us to show up on time and deliver exactly what we promised.\n\nFeel free to reply to this email or call me at [Phone] — I''m happy to chat.\n\n[Your Name]\n[Business Name]',
   'Any questions about your estimate?'),
  (2, 4,
   'Still interested, [First Name]?',
   E'Hi [First Name],\n\nJust checking in on the estimate I sent a few days ago. I want to make sure you have everything you need to make a decision.\n\nIf cost is a concern, I''m happy to talk through different options or phasing. If you have questions about the timeline or approach, I''m an open book.\n\nWe''d love to earn your business. Reply here or call [Phone] anytime.\n\n[Your Name]\n[Business Name]',
   'Happy to answer any questions'),
  (3, 10,
   'Last check-in on your project, [First Name]',
   E'Hi [First Name],\n\nI don''t want to be a bother, so this will be my last follow-up on the estimate.\n\nIf the timing isn''t right or you''ve gone in a different direction, no worries at all — I completely understand. If things change down the road, please don''t hesitate to reach out.\n\nWishing you all the best!\n\n[Your Name]\n[Business Name]',
   'No pressure — just leaving the door open')
) AS steps(step_number, delay_days, subject, body, preview_text);

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Job Completion + Referral', 'Thank clients and ask for referrals after completing a job', 'Contractor & Trades', 'job_completed', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 1,
   'Your project is complete — thank you!',
   E'Hi [First Name],\n\nThank you for trusting [Business Name] with your project! It was a pleasure working with you.\n\nI hope you''re happy with the results. If there''s anything that needs attention or any questions come up down the road, please don''t hesitate to reach out.\n\n[Your Name]\n[Business Name]\n[Phone]',
   'It was a pleasure working with you'),
  (2, 3,
   'Happy with the work? Leave us a review ⭐',
   E'Hi [First Name],\n\nI hope you''re enjoying the completed project! If you''re happy with our work, a Google review would mean the world to us.\n\nIt takes just 2 minutes and helps other homeowners find a contractor they can trust.\n\nLeave a review → [Review Link]\n\nThank you so much for your support!\n\n[Your Name]\n[Business Name]',
   'A quick review helps us so much'),
  (3, 21,
   'Know someone who needs help with a project?',
   E'Hi [First Name],\n\nHope all is well! I''m reaching out because referrals from happy clients like you are how we grow our business.\n\nIf you know anyone who needs [service type] work done, we''d be grateful for the introduction. As a thank-you, we offer a referral reward for every new client you send our way.\n\nJust reply to this email or pass along my number: [Phone]\n\nThank you again — it''s been great working with you!\n\n[Your Name]\n[Business Name]',
   'Know someone who could use our help?')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- ============================================================
-- CLEANING SERVICE
-- ============================================================

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'New Client Welcome', 'Welcome new cleaning clients and set expectations', 'Cleaning Service', 'new_contact', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 0,
   'Welcome to [Business Name], [First Name]!',
   E'Hi [First Name],\n\nWelcome to [Business Name]! We''re looking forward to taking care of your home.\n\nHere''s what to expect for your first clean:\n- Our team will arrive during your scheduled window\n- We bring all our own supplies and equipment\n- We''ll do a walkthrough when we''re done so you can check everything\n\nIf you have any special requests or areas to focus on, just let us know!\n\nSee you soon,\n[Your Name]\n[Business Name]\n[Phone]',
   'Here''s what to expect for your first clean'),
  (2, 1,
   'How was your first clean, [First Name]?',
   E'Hi [First Name],\n\nJust wanted to check in — how did everything look after your first clean with us?\n\nYour feedback is incredibly important to us. If anything wasn''t quite right, please tell us and we''ll make it right. If everything was great, we''d love to hear that too!\n\nReply to this email anytime.\n\n[Your Name]\n[Business Name]',
   'How did we do?'),
  (3, 2,
   'Love a clean home? Share the love! ⭐',
   E'Hi [First Name],\n\nSo glad to have you as a client! If you''re happy with your clean, would you consider leaving us a quick review?\n\nIt helps other people find a cleaning service they can trust, and it supports our small local business.\n\nLeave a review → [Review Link]\n\nThank you so much!\n\n[Your Name]\n[Business Name]',
   'A review would mean so much to us')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- ============================================================
-- CONSULTANT
-- ============================================================

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Discovery Call Follow-Up', 'Follow up after a discovery or sales call', 'Consultant', 'manual', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 0,
   'Great connecting with you, [First Name]',
   E'Hi [First Name],\n\nThank you for taking the time to connect today — I really enjoyed our conversation.\n\nTo recap what we discussed:\n- Your current challenges and goals\n- How [Business Name] can help\n- Next steps\n\nI''ll have a proposal over to you within [timeframe]. In the meantime, feel free to reply with any questions.\n\nLooking forward to the possibility of working together!\n\n[Your Name]\n[Business Name]',
   'Great talking today — here''s what''s next'),
  (2, 2,
   'Proposal for [First Name]',
   E'Hi [First Name],\n\nAs promised, I''ve put together a proposal based on our conversation.\n\nPlease review it when you have a chance and let me know if you have any questions or if you''d like to adjust anything. I want to make sure this feels right for you.\n\nI''m available for a quick call anytime this week if that would help.\n\n[Your Name]\n[Business Name]',
   'Your proposal is ready to review'),
  (3, 5,
   'Any questions about the proposal?',
   E'Hi [First Name],\n\nJust checking in to see if you''ve had a chance to review the proposal and if any questions came up.\n\nI know these decisions take time, and I''m happy to jump on a quick call to walk through anything. No pressure at all — I just want to make sure you have everything you need.\n\n[Your Name]\n[Business Name]',
   'Happy to walk through any questions')
) AS steps(step_number, delay_days, subject, body, preview_text);

-- ============================================================
-- UNIVERSAL (all industries)
-- ============================================================

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Review Request', 'Ask happy clients to leave a review', NULL, 'manual', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 2,
   'Could you leave us a quick review, [First Name]?',
   E'Hi [First Name],\n\nWe hope you''re having a great experience with [Business Name]!\n\nWe''d be so grateful if you took 2 minutes to leave us a review. Reviews help other people find us and mean the world to our small team.\n\nLeave a review → [Review Link]\n\nThank you so much!\n\n[Your Name]\n[Business Name]',
   'Your review would mean so much to us'),
  (2, 5,
   'Just one more ask, [First Name]',
   E'Hi [First Name],\n\nI know life gets busy! Just wanted to send one last reminder about leaving us a review.\n\nIt takes less than 2 minutes and truly makes a difference for our business.\n\nLeave a review → [Review Link]\n\nThank you for your support!\n\n[Your Name]\n[Business Name]',
   'Just a gentle reminder')
) AS steps(step_number, delay_days, subject, body, preview_text);

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Win-Back Campaign', 'Re-engage contacts who haven''t heard from you in 90+ days', NULL, 'no_purchase', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 0,
   'We miss you, [First Name]!',
   E'Hi [First Name],\n\nIt''s been a while since we''ve been in touch, and we just wanted to say — we miss you!\n\nA lot has been happening at [Business Name] and we''d love to reconnect. Is there anything we can help you with?\n\nReply to this email anytime.\n\n[Your Name]\n[Business Name]',
   'We''d love to reconnect'),
  (2, 10,
   'Is everything okay, [First Name]?',
   E'Hi [First Name],\n\nJust reaching out one more time to check in. We want to make sure we didn''t drop the ball somewhere.\n\nIf there''s anything we can do better, we genuinely want to know. And if there''s anything we can help you with right now, we''re here.\n\n[Your Name]\n[Business Name]',
   'Just checking in'),
  (3, 20,
   'One last note, [First Name]',
   E'Hi [First Name],\n\nThis is my last message for a while — I don''t want to fill up your inbox!\n\nIf you ever need [Business Name] in the future, we''re always here. I wish you all the best.\n\n[Your Name]\n[Business Name]',
   'Wishing you all the best')
) AS steps(step_number, delay_days, subject, body, preview_text);

WITH seq AS (
  INSERT INTO sequences (account_id, name, description, industry, trigger_type, is_active, is_template)
  VALUES (NULL, 'Birthday Greeting', 'Send a personal birthday message', NULL, 'birthday', false, true)
  RETURNING id
)
INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body, preview_text)
SELECT seq.id, step_number, delay_days, subject, body, preview_text
FROM seq, (VALUES
  (1, 0,
   'Happy Birthday, [First Name]! 🎂',
   E'Hi [First Name],\n\nHappy Birthday from all of us at [Business Name]!\n\nWe hope your day is full of joy and celebration. You''re a valued client and we''re grateful for you.\n\nAs a small birthday treat, [offer or warm wishes].\n\nWishing you a wonderful year ahead!\n\n[Your Name]\n[Business Name]',
   'Wishing you a wonderful birthday!')
) AS steps(step_number, delay_days, subject, body, preview_text);
