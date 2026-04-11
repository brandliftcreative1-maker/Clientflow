# Phase 2: Sequences Engine — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Sequences manager UI, enrollment engine, automated email sending, unsubscribe handling

---

## Strategic Context

ClientFlow targets small service businesses that need marketing done *for them*, not just tools to do it themselves. The sequences engine is the core delivery mechanism — it sends the right email at the right time without the owner thinking about it. Phase 3 will add AI image and video generation (a Content Studio) that feeds content into these sequences. Phase 2 builds the pipeline; Phase 3 fills it with rich content.

---

## What's Being Built

Four layers, built in order (UI → enrollment → sending → unsubscribe):

1. **Sequences Manager UI** — list and full-page step editor
2. **Enrollment** — manual bulk enroll, manual trigger fire, auto-enroll on trigger
3. **Cron Sending Engine** — portable API route that sends due emails via Resend
4. **Unsubscribe** — JWT-based one-click opt-out

---

## Architecture

### Build order (UI-first approach)

```
Sequences CRUD UI   →   Enrollment logic   →   Cron processor   →   Unsubscribe
(visible, testable)      (wires contacts)       (sends emails)      (opt-out flow)
```

Each layer is independently testable before the next is wired in.

### Deployment

The sending endpoint (`POST /api/cron/process-sequences`) is a plain Next.js API route protected by a secret token header. Any scheduler can call it — Vercel Cron, Upstash, pg_cron, or a manual test button in the UI. No scheduler is bundled with the app.

---

## Section 1: Sequences Manager UI

### Pages

**`/dashboard/sequences`** — List page (replaces current placeholder)

- Table columns: Name / description, Trigger badge, Step count, Enrolled count, Active toggle, Edit link
- Toolbar: sequence count summary, "AI Generate" button, "+ New Sequence" button
- Trigger badges are color-coded: blue = new_contact, green = job_completed, purple = birthday, gray = manual/custom
- Active toggle calls a server action to flip `sequences.is_active`

**`/dashboard/sequences/[id]`** — Full-page editor

- Header: sequence name (editable inline), description, trigger selector, Save button
- Left panel (240px): ordered step list — each card shows step number, day offset, subject line. Selected step is highlighted blue.
- Right panel: step editor for the selected step — delay_days input, subject, preview_text, body textarea
- "✨ Regenerate with AI" button on each step calls the existing `generateSequence` action
- "+ Add step" at the bottom of the step list
- Delete step (trash icon on hover)
- Step reorder via up/down arrow buttons (no drag-and-drop — keeps implementation simple)

### Trigger types

Predefined triggers (maps to existing `TriggerType` enum):
- `new_contact` — New contact added
- `job_completed` — Job completed
- `estimate_sent` — Estimate sent
- `no_purchase` — No purchase (30 days)
- `birthday` — Birthday (requires birthday field on contact)
- `review_requested` — Review requested
- `manual` — Manual only

Custom trigger:
- Selecting "Custom…" in the trigger dropdown reveals a free-text input
- Stored as-is in `sequences.trigger_type` (e.g., `"After consultation call"`)
- Any trigger_type value that doesn't match the predefined list is treated as a custom trigger

### Server actions (new file: `src/actions/sequences.ts`)

```
getSequences()             — list all sequences for account
getSequence(id)            — fetch sequence + steps
createSequence(formData)   — insert sequence row
updateSequence(id, data)   — update name/description/trigger/is_active
deleteSequence(id)         — delete sequence + cascade steps + cancel enrollments
createStep(sequenceId, data)
updateStep(id, data)
deleteStep(id)
reorderSteps(sequenceId, orderedIds)
```

---

## Section 2: Enrollment

### Manual bulk enrollment (Contacts page)

- When 1+ contacts are selected, a bulk action bar appears at the top of the contacts table
- Bar contains: "X contacts selected", "Change segment", "▶ Enroll in sequence", "Delete"
- "Enroll in sequence" opens an inline dropdown to pick a sequence → "Enroll now" submits
- Server action: `enrollContacts(contactIds, sequenceId)` — inserts `sequence_enrollments` rows, skips already-enrolled contacts, sets `next_send_at = now() + step1.delay_days`

### Manual trigger fire (single contact)

- Each contact row in the table gets an action menu (three-dot or inline button)
- "Fire trigger…" opens a small dropdown listing **all active sequences** for the account — trigger_type is used for auto-enrollment only; any sequence can be manually enrolled into
- Selecting a sequence calls `enrollContacts([contactId], sequenceId)`
- Contact profile area (shown inline in the table row expand or a future contact detail page) shows active enrollment badges: "▶ New Client Welcome · Step 2 of 3"

### Auto-enrollment (server-side, no UI)

Two triggers fire automatically:

**`new_contact`** — In the `addContact` and `importContacts` server actions, after inserting the contact, query for active sequences with `trigger_type = 'new_contact'` belonging to the same account and call `enrollContacts`.

**`birthday`** — The cron processor checks daily (or on every run) for contacts whose `birthday` month+day matches today, and auto-enrolls them in any active sequence with `trigger_type = 'birthday'`.

### Enrollment deduplication

`enrollContacts` checks for an existing active enrollment before inserting. Contacts already enrolled in the same sequence are skipped silently.

---

## Section 3: Cron Sending Engine

### Endpoint

```
POST /api/cron/process-sequences
Authorization: Bearer <CRON_SECRET>
```

Returns `{ processed: N, errors: [] }`.

### Processing loop

1. **Find due enrollments** — `sequence_enrollments` where `status = 'active'` AND `next_send_at <= now()`, joined with contact (for email + first_name + status) and sequence (for account + is_active)
2. **Skip unsubscribed contacts** — if `contact.status = 'unsubscribed'`, mark enrollment cancelled, continue
3. **Skip paused sequences** — if `sequence.is_active = false`, skip (don't cancel — owner may reactivate)
4. **Fetch step content** — get `sequence_steps` row for `current_step`
5. **Replace tokens** — `[First Name]` → contact.first_name, `[Business Name]` → account.business_name, `[Your Name]` → account.from_name
6. **Append unsubscribe footer** — generate signed JWT token, append footer with unsubscribe link
7. **Send via Resend** — from `account.from_email` (or fallback to `onboarding@resend.dev` — Resend's shared sender, works without domain verification), reply-to `account.reply_to_email`
8. **Log to `email_logs`** — type = 'sequence', resend_id, status = 'sent'
9. **Advance enrollment** — if more steps: `current_step++`, `next_send_at = now() + next_step.delay_days * 86400s`. If last step: `status = 'completed'`, `completed_at = now()`

### Error handling

- Per-email errors are caught and logged to `{ errors[] }` in the response — one failed send does not abort the batch
- Resend rate limits: process max 50 enrollments per run to avoid hitting limits (configurable via `CRON_BATCH_SIZE` env var)

### Token format

`CRON_SECRET` env var — any string, checked with `===` comparison. Return 401 if missing or wrong.

---

## Section 4: Unsubscribe

### Link generation

Each outbound sequence email gets this footer appended:

```
---
You received this email because you're a contact of [Business Name].
Unsubscribe | [Business Name]
```

The unsubscribe URL is: `/unsubscribe?token=<jwt>`

JWT payload: `{ contactId, accountId, iat }`, signed with `UNSUBSCRIBE_SECRET` env var (HS256, no expiry — tokens stay valid permanently).

### Unsubscribe page

**`/unsubscribe`** — public page (no auth required)

- Verifies JWT signature
- Sets `contacts.status = 'unsubscribed'`
- Cancels all active `sequence_enrollments` for the contact (`status = 'cancelled'`)
- Shows: ✅ "You've been unsubscribed — You won't receive any more emails from [Business Name]."
- No re-subscribe option in Phase 2

---

## Schema Changes (new migration: `004_phase2.sql`)

```sql
-- Birthday support on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;

-- Index for birthday cron check (month + day, ignoring year)
CREATE INDEX IF NOT EXISTS idx_contacts_birthday
  ON contacts (EXTRACT(MONTH FROM birthday), EXTRACT(DAY FROM birthday));

-- Index for cron processor
CREATE INDEX IF NOT EXISTS idx_enrollments_next_send
  ON sequence_enrollments (next_send_at)
  WHERE status = 'active';
```

Note: `sequences.trigger_type` is already `TEXT` so custom trigger names are stored as-is. No schema change needed for custom triggers.

---

## New Environment Variables

```
CRON_SECRET=<random string>        # protects the cron endpoint
UNSUBSCRIBE_SECRET=<random string> # signs unsubscribe JWT tokens
```

Both should be added to `.env.local` and to production environment config.

---

## Files Changed / Created

| File | Change |
|------|--------|
| `src/app/(dashboard)/dashboard/sequences/page.tsx` | Rewrite — sequences list |
| `src/app/(dashboard)/dashboard/sequences/[id]/page.tsx` | New — sequence editor |
| `src/actions/sequences.ts` | New — all sequence + step CRUD |
| `src/actions/enrollment.ts` | New — enrollContacts, auto-enrollment hooks |
| `src/app/api/cron/process-sequences/route.ts` | New — cron endpoint |
| `src/app/unsubscribe/page.tsx` | New — unsubscribe page |
| `src/actions/contacts.ts` | Update — add auto-enroll call in addContact/importContacts; add birthday field |
| `src/app/(dashboard)/dashboard/contacts/page.tsx` | Update — bulk action bar, fire trigger, birthday field in add form |
| `src/types/index.ts` | Update — add birthday to Contact insert type |
| `supabase/migrations/004_phase2.sql` | New — birthday column + indexes |

---

## Out of Scope (Phase 3+)

- AI image generation for email content
- Video generation (Remotion)
- Content Studio UI
- Webhook-based triggers
- Re-subscribe flow
- Email open/click tracking (Resend webhooks)
- Sequence analytics dashboard

---

## Phase 3 Preview: Content Studio

Phase 3 will build a dedicated "Content Studio" where business owners generate marketing images and short videos using AI — then insert them directly into sequence steps or campaigns. This is the core differentiator vs. Constant Contact: content done *for* you, not just delivered by you.
