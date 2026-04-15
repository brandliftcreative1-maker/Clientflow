# AI Prompt Strategy Redesign
**Date:** 2026-04-15  
**Scope:** `src/lib/ai-provider.ts` — prompt text only  
**Goal:** Replace generic caption instructions with platform-proven content strategies that drive views, engagement, and conversions.

---

## Problem

Current prompts produce generic, marketing-speak output:
> "Save big on auto insurance! New customers get 20% off at Ben Owens State Farm Agency until April 30! #AutoInsurance #InsuranceDiscount"

This reads like a billboard. Nobody stops scrolling for it. The issue is not the AI model — it is the prompting strategy. The current instructions tell the AI what format to use (char count, hashtag count, emoji count) but say nothing about *how to write* engaging content.

---

## Solution

Inject a content strategy into every caption-generating prompt that:
1. Defines a structural pattern suited to each template type (hook → body → CTA)
2. Bans generic patterns explicitly (no leading with business name, no "excited to announce")
3. Tightens platform-specific writing norms beyond just character counts

No code architecture changes. No new functions. No UI changes. JSON response format stays identical.

---

## Content Strategies by Template

### Promotion / Offer — Pain Point First
**Pattern:** Problem/pain → solution framing → offer as relief → urgency CTA  
**Why:** Discount announcements are ignored. Content that names a problem the reader has gets read.  
**Banned:** Leading with the price, the percentage, or the business name.

### Tip / Advice — Counterintuitive Hook
**Pattern:** Surprising or counterintuitive statement → explanation of why the common assumption is wrong → the correct insight → soft CTA  
**Why:** "Here are 3 tips" is invisible. A statement that challenges what the reader believes creates a curiosity gap.  
**Banned:** Numbered list openings, "Here are X tips", starting with "Did you know".

### Customer Spotlight — Transformation Story
**Pattern:** Before state (the problem/frustration) → turning point (contacting the business) → after state (the result) → customer quote as confirmation → soft CTA  
**Why:** A quote in a box is forgettable. A mini-story with emotional arc is shareable and credible.  
**Banned:** Leading with the quote, generic "our customer loved us" framing.

### Behind the Scenes — Curiosity Gap
**Pattern:** "What nobody sees" / "What most people don't know" opener → reveal the process or detail → connect to brand values → soft CTA  
**Why:** Ordinary process becomes insider access when framed as something hidden. Authenticity outperforms polish.  
**Banned:** "Here's our team!", generic cheerful announcements about daily work.

### Seasonal / Holiday — Timely Relevance
**Pattern:** Connect the season/event to a specific customer problem right now → bridge to the business's service → optional offer → CTA  
**Why:** "Happy Spring!" is noise. Content that names what customers are actually experiencing this time of year earns attention.  
**Banned:** Generic holiday greetings with no relevance to the business or customer.

### About Business — Origin / Values Story
**Pattern:** Founding moment or personal "why" → what that experience led to → what the business stands for today → community/relationship CTA  
**Why:** People buy from people. A real story with a real reason outperforms any list of credentials.  
**Banned:** "Family-owned for X years", leading with years in business or certifications.

### Custom — Storytelling Hook (default)
**Pattern:** Hook (question, bold statement, or relatable scenario) → insight or story body → value delivered → CTA  
**Why:** Since the user provides their own idea, the broadly effective storytelling structure is the best default.

---

## Platform Writing Norms (tightened)

### Instagram
- First line must function as a standalone hook — it shows before "more" cutoff
- Short punchy sentences, one idea per line, line breaks between thoughts
- Emojis used contextually (to punctuate meaning), not decoratively
- 4–7 hashtags at the end, on their own line
- 150–250 chars of body text (not counting hashtags)

### Facebook
- Written like a message to a neighbor — warm, personal, no corporate tone
- First sentence must earn the "see more" click
- Full paragraphs acceptable, but keep sentences short
- 1–2 emojis max, used sparingly
- No hashtags
- 150–300 chars

### Google Business
- Reads like a useful search result snippet, not a social post
- Leads with the service or benefit, not a story
- Clear CTA (call, book, visit)
- No emojis, no hashtags
- 80–140 chars

---

## Weekly Plan Strategy (per pillar)

The 5-day plan already assigns a pillar per day. Each pillar maps to a content strategy:

| Day | Pillar | Strategy |
|-----|--------|----------|
| Monday | Educate & Inspire | Counterintuitive Hook (same as Tip) |
| Tuesday | Real Story | Transformation Story (same as Customer Spotlight) |
| Wednesday | Behind the Scenes | Curiosity Gap |
| Thursday | Drive Action | Pain Point First (same as Promotion) |
| Friday | Brand & Community | Origin / Values Story |
| Saturday | Fun & Engage | Light question or relatable scenario — conversational, no hard sell |
| Sunday | Inspire & Preview | Forward-looking motivational hook — what's coming, what's possible |

---

## Functions Affected

All changes are prompt text only inside `src/lib/ai-provider.ts`:

| Function | Change |
|----------|--------|
| `generateSocialCaptions` | Add template-specific strategy block + tightened platform norms |
| `getWeeklyContent` | Add per-pillar strategy instructions + tightened platform norms |
| `getWeekendPost` | Add Saturday/Sunday-specific tone and structure |
| `regeneratePlatformCaption` | Add template strategy + platform norms to match the above |

`getReadyToPostContent` and `getPostRecommendations` already have decent "no generic filler" instructions and are not the primary content output — leave them unchanged for now.

---

## What Does Not Change

- Function signatures
- JSON response shapes
- Any UI component
- Database schema
- Any other file

---

## Success Criteria

Generated captions should:
- Open with a hook that does not name the business or lead with a price
- Tell a story or deliver an insight rather than announce
- Sound like a human wrote it for a specific business, not a template
- Still include the correct platform norms (hashtags, length, emoji rules)
