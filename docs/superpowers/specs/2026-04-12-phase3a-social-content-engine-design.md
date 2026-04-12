# Phase 3a: Social Content Engine — Design Spec

**Date:** 2026-04-12  
**Status:** Approved  
**Project:** ClientFlow Marketing Tool

---

## Overview

Phase 3a adds a Social Content Engine that generates ready-to-post social media content (image + captions) for small businesses. The core differentiator is that content is done *for* the business owner — they pick a template, fill in minimal details, and get a complete post package for Instagram, Facebook, and Google Business. A content calendar gives them visibility into their posting history and upcoming schedule.

---

## Features

### 1. Content Studio (`/dashboard/content`)

**Template Picker**

Six post templates displayed as a grid:
- Promotion / Offer
- Tip or Advice
- Customer Spotlight
- Behind the Scenes
- Seasonal / Holiday
- About the Business

Selecting a template reveals a small form below the grid. Fields vary by template — a Promotion asks for offer text and expiry date; a Tip asks for the topic. A tone selector (Friendly / Professional / Exciting) defaults to the account's saved brand voice.

Clicking "Generate post" triggers a Server Action that calls fal.ai (image) and Groq (captions) in parallel. Both use the template type, form data, and the account's `business_name` and brand voice.

**Generated Result**

Slides in below the form (same page). Layout: image panel on the left, captions panel on the right.

- **Image panel**: generated image (square), Download button, "New image" button (regenerates image only), "Save to library" button.
- **Captions panel**: one editable textarea per platform (Instagram, Facebook, Google Business), each with a character counter and a per-platform "✨ Regenerate" button that re-runs Groq for that caption only without touching the others. A "Copy" button per platform. Google Business has an "Auto-post ON/OFF" toggle (requires Google OAuth — shows a "Connect Google Business" prompt in Settings if not connected).
- **Publish button**: posts to Google Business automatically (if connected and toggle is ON); other platforms show captions as copied to clipboard.

Platform color coding throughout:
- Instagram: `#e1306c` (pink/red)
- Facebook: `#1877f2` (blue)
- Google Business: `#f97316` (orange)

### 2. Content Calendar (`/dashboard/content/calendar`)

Monthly calendar grid. Each day cell shows all posts for that day as color-coded pills (platform dot + truncated title). Days with more than two posts show a "+N more" link.

**Post states:**
- **Published** (green background pill) — post was published
- **Scheduled / Draft** (amber background pill) — created but not yet published
- **Suggested** (dashed border pill) — no post created yet; slot computed from cadence settings
- **Today** (amber cell border) — current date highlighted, suggested slots show "✨ Create post"

Clicking any pill opens a right-side detail panel (300px) showing:
- Generated image thumbnail with download button
- Status + date
- Per-platform status row (Published / Scheduled / Auto-posted) with View link
- Instagram caption preview (truncated, "See all captions" link expands)
- Duplicate and Delete actions

Clicking a "Suggested" or "Create post" pill opens Content Studio with the date pre-filled.

**Summary strip** below the calendar: Scheduled count, Published count, Drafts count, On-track percentage.

### 3. Cadence Settings (in Content Studio header or Settings page)

Per-platform posting frequency (Instagram, Facebook, Google Business), configured as times per week with +/− controls. Preferred posting days are computed automatically from frequency (e.g. 3×/week → Mon/Wed/Fri).

Reminder type options:
- **Dashboard nudge** — shows a "Time to post!" card on the dashboard when a posting day arrives
- **Email reminder** — sends an email on posting days
- **Pre-generate drafts** — auto-generates a draft post on scheduled days via cron; user reviews and publishes

---

## Data Model

### `content_posts`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid | FK → accounts |
| template_type | text | `promotion`, `tip`, `customer_spotlight`, `behind_scenes`, `seasonal`, `about_business` |
| prompt_data | jsonb | form field values (offer text, expiry, topic, etc.) |
| image_url | text | Supabase Storage public URL |
| captions | jsonb | `{ instagram: string, facebook: string, google_business: string }` |
| status | text | `draft` \| `scheduled` \| `published` |
| scheduled_date | date | which calendar day this post belongs to |
| published_platforms | jsonb | `{ instagram: bool, facebook: bool, google_business: bool }` |
| created_at | timestamptz | |

### `content_cadence_settings`

| column | type | notes |
|---|---|---|
| account_id | uuid PK | one row per account |
| instagram_per_week | int | default 3 |
| facebook_per_week | int | default 2 |
| google_per_week | int | default 1 |
| reminder_type | text | `dashboard` \| `email` \| `pre_generate` |
| preferred_days | jsonb | `[1,3,5]` — day-of-week numbers, computed from frequency |

### `accounts` (additions)

| column | type | notes |
|---|---|---|
| google_refresh_token | text | stored after Google OAuth |
| google_location_id | text | Google Business Profile location ID |

---

## Architecture

### Image Generation — fal.ai (FLUX)

Server Action builds a prompt from template type + form data → calls fal.ai FLUX API → downloads the returned image → uploads to Supabase Storage (`content-images/{account_id}/{post_id}.png`) → saves public URL to `content_posts.image_url`.

Cost: ~$0.003–0.006 per image. No expiring URLs — image is owned in Supabase Storage.

"New image" button calls the same Server Action in image-only mode (skips Groq, reuses existing captions).

### Caption Generation — Groq

Same Server Action runs in parallel with fal.ai call. Uses `llama-3.3-70b-versatile`. System prompt includes the account's `business_name` and brand voice. Returns structured JSON: `{ instagram, facebook, google_business }`.

Per-platform regenerate hits a separate Server Action with a platform-specific system prompt (e.g. Instagram version emphasizes hashtags and emoji; Google Business version is short and factual).

### Google Business Auto-post

One-time OAuth flow in Settings → stores `google_refresh_token` and `google_location_id` on `accounts`. On Publish (when auto-post toggle is ON), a Server Action:
1. Exchanges refresh token for access token
2. Calls Google Business Profile API: `POST /v1/accounts/{account}/locations/{location}/localPosts`
3. Sends Google Business caption + Supabase Storage image URL

If the account has no Google credentials, the auto-post toggle is hidden and a "Connect Google Business" prompt is shown.

### Cadence Suggestions

Suggested calendar slots are computed client-side from `content_cadence_settings.preferred_days` — no cron required. The calendar component counts existing posts for the current week per platform and fills remaining slots with "Suggested" pills.

For `pre_generate` reminder type: a lightweight addition to the existing `/api/cron/process-sequences` endpoint checks `content_cadence_settings` for accounts with `reminder_type = 'pre_generate'` and calls the Groq caption + fal.ai image generation for due slots, saving results as `status = 'draft'`.

### Navigation

Sidebar gains "Social Content" between Contacts and Sequences. Two routes:
- `/dashboard/content` — Content Studio (template picker + generated result)
- `/dashboard/content/calendar` — Calendar view

---

## Routes & Server Actions

| Route / Action | Purpose |
|---|---|
| `GET /dashboard/content` | Content Studio page |
| `GET /dashboard/content/calendar` | Calendar page |
| `generatePost(templateType, promptData)` | Calls fal.ai + Groq in parallel, saves to content_posts |
| `regenerateCaption(postId, platform)` | Re-runs Groq for one platform caption |
| `regenerateImage(postId)` | Re-runs fal.ai for image only |
| `publishPost(postId)` | Posts to Google Business if connected; marks published_platforms |
| `savePost(postId, captions)` | Saves edited captions to content_posts |
| `deletePost(postId)` | Deletes post + removes image from Supabase Storage |
| `duplicatePost(postId)` | Clones post as new draft |
| `getCalendarPosts(accountId, month, year)` | Fetches posts for calendar view |
| `saveCadenceSettings(settings)` | Upserts content_cadence_settings |
| `initiateGoogleOAuth()` | Starts Google OAuth flow |
| `handleGoogleOAuthCallback(code)` | Exchanges code for tokens, saves to accounts |

---

## Out of Scope (Phase 3a)

- Direct posting to Instagram or Facebook via API (copy-to-clipboard only for those platforms)
- Video generation (Phase 3b — Remotion)
- Post performance analytics / engagement metrics
- Scheduling posts to publish at a future time automatically (manual publish only in 3a)
- TikTok or other platforms

---

## Environment Variables Required

```
FAL_API_KEY=                  # fal.ai API key
GOOGLE_CLIENT_ID=             # Google OAuth client ID
GOOGLE_CLIENT_SECRET=         # Google OAuth client secret
NEXT_PUBLIC_APP_URL=          # already required from Phase 2
```

`GROQ_API_KEY` is already set up from prior work.
