# Brand Settings Design
**Date:** 2026-04-16
**Scope:** New Brand Settings page + expanded brand context injected into AI prompts
**Goal:** Let users manage their full brand profile (voice + contact info) in one place so AI-generated posts include accurate CTAs and sound like their business.

---

## Problem

Today the AI only knows four things about a business: name, industry, brand voice, and a short description — all captured once during onboarding and never editable afterwards. That creates two concrete gaps:

1. **Captions can't use real contact info.** The AI can't say "Call (555) 123-4567" or "Book at example.com" because it doesn't have those values. Google Business posts especially suffer — the platform's entire purpose is to drive local calls/visits/bookings, but generated captions end with generic filler like "Contact us today."
2. **Voice drift.** The AI takes cues from a single brand-voice dropdown. It has no examples of what the user's real posts sound like, no knowledge of words the user refuses to use, and no room for a richer brand description.

---

## Solution

Add a Brand Settings page in `/dashboard/settings` (new tab or subpage) with eight fields. Inject all eight into every caption-generating prompt in `src/lib/ai-provider.ts` via a new BRAND CONTEXT block, and add platform-specific CTA rules so the AI uses real contact info where appropriate.

No new tables. Add columns to `accounts`. No changes to post generation UX — the CTA field on Create a Post still overrides per-post.

---

## Data Model

### New columns on `accounts` table

| Column | Type | Notes |
|---|---|---|
| `website_url` | `TEXT` | nullable |
| `phone` | `TEXT` | nullable, free-form (no format enforcement) |
| `address` | `TEXT` | nullable, free-form single line |
| `booking_url` | `TEXT` | nullable — Calendly, Square Appointments, etc. |
| `topics_to_avoid` | `TEXT` | nullable, free-form (comma-separated or sentence) |
| `example_posts` | `TEXT` | nullable, free-form; users paste 1–5 sample posts separated by blank lines |

Existing columns stay as-is: `business_name`, `industry`, `brand_voice`, `description`.

### Migration file

`supabase/migrations/006_brand_settings.sql` — `ALTER TABLE accounts ADD COLUMN` statements. RLS already scopes `accounts` by `user_id`; no new policies needed.

---

## UI: Brand Settings section

**Location:** Added as a new `<section>` on the existing `/dashboard/settings` page (follows the current pattern — the page already has Google Business + Posting Preferences as stacked sections). No new route, no tabs.

**Layout:** One section block, four titled subsections, one Save button at the bottom of the section.

### Section 1 — Business basics
- Business name (text input, required)
- Industry (text input, required)
- Short description (textarea, 2 rows)

### Section 2 — Voice
- Brand voice (dropdown, same options used today: Friendly, Professional, Exciting, Inspirational, Humorous, Urgent)
- Topics or words to avoid (textarea, 2 rows, placeholder: "e.g. 'cheap', 'discount', 'guaranteed'")
- Example posts you love (textarea, 6 rows, placeholder: "Paste 1–5 posts that sound like your brand. Separate with blank lines.")

### Section 3 — Contact info
- Website URL (text input, type=url)
- Phone (text input, free-form)
- Address (text input, free-form single line)
- Booking link (text input, type=url, placeholder: "e.g. calendly.com/yourbrand")

### Section 4 — Save
- "Save brand settings" button → `saveBrandSettings` server action → toast on success/error

All fields except business name and industry are optional. Field validation is minimal — trim whitespace, accept anything else. No client-side URL regex; AI handles empty vs. present.

### Loading & empty states
- On mount, fetch current values via `getBrandSettings` server action and hydrate the form
- Show a spinner while loading (match existing settings page pattern)
- If a field is empty in DB, the input shows empty

---

## Server Actions

Both live in `src/actions/brand.ts` (new file).

### `getBrandSettings(): Promise<BrandSettings>`
Returns the current account's brand fields. Uses `getAccountAndUser` helper like other actions. Returns defaults (empty strings) when no account.

### `saveBrandSettings(settings: BrandSettings): Promise<{ error?: string }>`
Updates the `accounts` row for the authenticated user. Returns `{ error }` on failure.

### Type

```typescript
export interface BrandSettings {
  business_name: string
  industry: string
  description: string
  brand_voice: string
  topics_to_avoid: string
  example_posts: string
  website_url: string
  phone: string
  address: string
  booking_url: string
}
```

---

## AI Prompt Integration

All four caption-generating functions in `src/lib/ai-provider.ts` accept a new optional field on their params: the full `BrandSettings` record (or the subset currently passed plus the new fields). The functions are:

- `generateSocialCaptions`
- `getWeeklyContent`
- `getWeekendPost`
- `regeneratePlatformCaption`

The callers in `src/actions/content.ts` fetch the full brand profile (already fetched for `businessName`/`industry`/`brandVoice` — just extend the query) and pass it in.

### New prompt block — BRAND CONTEXT

Injected after the existing "Business: ... / Industry: ... / Brand voice: ..." lines. Only includes fields with values; omits lines where the field is empty.

Example (all fields filled):
```
BRAND CONTEXT:
- Website: https://example.com
- Phone: (555) 123-4567
- Address: 123 Main St, Anytown USA
- Booking link: https://calendly.com/example
- Topics/words to avoid: cheap, discount, guaranteed
- Example posts in our voice:
  [first example post text]

  [second example post text]
```

If `example_posts` is present, append a line: `Mirror the voice and rhythm of the example posts above.`

If `topics_to_avoid` is present, append a line: `Do not use these words or topics in the caption.`

### New prompt block — CTA RULES

Injected once in each of the four functions, after the PLATFORM RULES block (so the AI sees platform norms first, then CTA priorities).

```
CTA RULES — apply per platform using the BRAND CONTEXT above:

INSTAGRAM: Soft CTA. Prefer "DM us", "Link in bio", or "Call {phone}" if phone exists. Do NOT paste raw URLs in the caption body — Instagram doesn't make them clickable in posts. End of caption, one line.

FACEBOOK: Medium-strength CTA. Use booking_url or website_url if present — URLs ARE clickable here. Phone is acceptable. One line at the end of the body (before hashtags if any).

GOOGLE BUSINESS: MANDATORY concrete CTA using real contact info. Priority order for what to use:
  1. booking_url → "Book at {booking_url}"
  2. phone → "Call {phone}"
  3. website_url → "Learn more at {website_url}"
  4. address → "Visit us at {address}"
  5. none of the above → "Contact us to get started."

The caption must end with the selected CTA. Never end a Google Business post without one of these concrete actions.
```

### Per-post CTA override

The existing `cta` parameter on `generateSocialCaptions` (passed from the Create a Post UI) continues to work. When `cta` is provided, it overrides the automatic CTA selection. Add one line to the prompt:

```
If a specific call to action is provided below, use it exactly as written and ignore the CTA priority order.
Call to action: {cta}
```

---

## Platform Behavior Details

### Instagram
- Never paste clickable URLs (Instagram strips them from the caption body)
- Phone acceptable if phone field is set
- Otherwise soft CTA ("DM us", "Link in bio")

### Facebook
- URLs are clickable and expected
- Prefer booking link over website for conversion-oriented posts (promotion template)
- Prefer website over booking for awareness posts (about_business, behind_scenes, tip)

### Google Business
- Google Business Profile posts already support Action Buttons (Book, Call, Learn More) but our posts go out as text-only — so the CTA must be in the text
- This is the only platform where the AI must never generate a caption without a concrete CTA

---

## Functions Affected

| File | Change |
|---|---|
| `supabase/migrations/006_brand_settings.sql` | New — ADD COLUMN statements on accounts |
| `src/actions/brand.ts` | New — `getBrandSettings`, `saveBrandSettings`, `BrandSettings` type |
| `src/actions/content.ts` | Modify — fetch brand profile in existing actions that call AI functions; pass to `ai-provider` functions |
| `src/lib/ai-provider.ts` | Modify — extend params types, add BRAND CONTEXT + CTA RULES blocks in 4 functions |
| `src/app/(dashboard)/dashboard/settings/page.tsx` | Modify — add Brand section (form with 10 fields, getBrandSettings hydrate, saveBrandSettings on submit) |

---

## What Does Not Change

- Onboarding flow (still collects name, industry, voice, description to minimize friction)
- Create a Post UI (still has a per-post CTA field that overrides)
- JSON response shapes from AI functions
- Scheduling / publishing pipeline
- Any other settings section

---

## Success Criteria

- A user can edit business name, industry, voice, description after onboarding (today they can't)
- A user can add phone, website, address, booking link and see them appear in generated captions
- Google Business captions always end with a concrete CTA when at least one contact field is set
- Instagram captions never contain raw URLs when a website is set (uses soft CTA instead)
- "Topics to avoid" values do not appear in generated captions
- Captions with example posts filled in take on the voice rhythm of those examples

---

## Out of Scope

- Website URL auto-scraping
- PDF / Markdown / TXT brand guideline upload
- Multi-brand / multi-account management
- Phone number or URL format validation
- Brand asset management (logos, colors) — separate from this spec, ties into media library work later
