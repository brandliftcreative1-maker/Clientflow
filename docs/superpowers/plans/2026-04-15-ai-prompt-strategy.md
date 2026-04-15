# AI Prompt Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic caption instructions in `ai-provider.ts` with per-template content strategies and tightened platform writing rules that produce storytelling-style, engagement-driven social copy.

**Architecture:** Single file change — `src/lib/ai-provider.ts`. Add a `CONTENT_STRATEGIES` lookup map, then update prompt strings in four functions: `generateSocialCaptions`, `getWeeklyContent`, `getWeekendPost`, and `regeneratePlatformCaption`. No new functions, no UI changes, JSON response shapes stay identical.

**Tech Stack:** TypeScript, Groq SDK (`llama-3.3-70b-versatile`), Next.js server actions

---

### Task 1: Add CONTENT_STRATEGIES map

**Files:**
- Modify: `src/lib/ai-provider.ts` — add const before `generateSocialCaptions`

- [ ] **Step 1: Add the strategies map**

Insert this block directly above the `generateSocialCaptions` function (around line 477):

```typescript
// ---------------------------------------------------------------------------
// Content strategies — injected per template type into caption prompts
// ---------------------------------------------------------------------------

const CONTENT_STRATEGIES: Record<SocialTemplateType, string> = {
  promotion: `WRITING STRATEGY — Pain Point First:
Open with the problem or frustration the customer is facing right now — NOT the offer or price.
Structure: Name the customer's pain → position your service as the solution → present the offer as the relief → urgency CTA.
NEVER start with the business name, a percentage off, or "Save big on". Make the reader feel seen before you sell to them.`,

  tip: `WRITING STRATEGY — Counterintuitive Hook:
Open with a statement that challenges what the reader believes or reveals something surprising about the industry.
Structure: Surprising or counterintuitive opener → explain why the common assumption is wrong → deliver the correct insight → soft CTA.
NEVER start with "Here are X tips", "Did you know", or a numbered list. Create a curiosity gap that forces the reader to keep going.`,

  customer_spotlight: `WRITING STRATEGY — Transformation Story:
Tell the customer's experience as a mini-story with emotional arc — not a quote in a box.
Structure: Before state (the customer's problem or frustration) → turning point (how they found/used the business) → after state (the result) → customer quote as confirmation → soft CTA.
NEVER lead with the quote. NEVER write "Our customer loved us." Build the emotional arc first, then let the quote land.`,

  behind_scenes: `WRITING STRATEGY — Curiosity Gap:
Open with "what nobody sees" or "what most people don't know" framing to turn ordinary process into insider access.
Structure: Curiosity-gap opener → reveal the process, detail, or effort → connect to brand values → soft CTA.
NEVER open with "Here's our team!" or generic cheerful process announcements. Make it feel like the reader is getting access to something usually hidden.`,

  seasonal: `WRITING STRATEGY — Timely Relevance:
Connect the season or event to a specific problem or situation the customer is actually experiencing right now.
Structure: Timely hook naming the customer's current reality → bridge to how your business is relevant → value or offer → CTA.
NEVER write generic holiday greetings ("Happy Spring!") with no business relevance. The season must matter to the customer's life.`,

  about_business: `WRITING STRATEGY — Origin / Values Story:
Lead with the founding moment, a personal "why", or a specific belief — not credentials, years in business, or certifications.
Structure: Founding moment or personal motivation → what that experience created → what the business stands for today → community/relationship CTA.
NEVER start with "Family-owned for X years", years in business, or a credential list. People connect with stories, not resumes.`,

  custom: `WRITING STRATEGY — Storytelling Hook:
Open with a hook — a question, bold statement, or relatable scenario that immediately speaks to the reader.
Structure: Hook → insight or story that delivers real value → CTA.
Write as if a thoughtful human crafted this specifically for this business and this moment. Avoid anything that sounds templated or generic.`,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```
Expected: no errors

---

### Task 2: Rewrite `generateSocialCaptions` prompt

**Files:**
- Modify: `src/lib/ai-provider.ts` — replace prompt string in `generateSocialCaptions`

- [ ] **Step 1: Replace the prompt**

Find and replace the entire `const prompt = \`You are a social media copywriter...` block inside `generateSocialCaptions` with:

```typescript
  const strategy = CONTENT_STRATEGIES[params.templateType]

  const prompt = `You are an expert social media copywriter for small service businesses. Your goal is to write content that stops the scroll, earns engagement, and drives real business results — not content that sounds like an ad.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Tone: ${tone ?? 'Friendly'}
Post type: ${params.templateType.replace(/_/g, ' ')}
${contentStr ? `Post details:\n${contentStr}` : ''}
${audience ? `Target audience: ${audience}` : ''}
${cta ? `Call to action: ${cta}` : ''}

${strategy}

PLATFORM RULES — apply exactly:

INSTAGRAM: First line MUST work as a standalone hook (shows before "more" cutoff). Short punchy sentences, one idea per line, line breaks between thoughts. Emojis used contextually to punctuate meaning — not decoration. End with 4–7 relevant hashtags on their own line. Body 150–250 chars (not counting hashtags).

FACEBOOK: Write like a message to a neighbor — warm, personal, zero corporate tone. First sentence must earn the "see more" click. 1–2 emojis max. No hashtags. 150–300 chars.

GOOGLE BUSINESS: Write like a useful search result snippet. Lead with the service or benefit. Clear CTA (call, book, visit). No emojis, no hashtags. 80–140 chars.
${cta ? `\nAll three captions must include the call to action: ${cta}` : ''}

Respond with valid JSON only:
{
  "instagram": "full instagram caption including hashtags",
  "facebook": "full facebook caption",
  "google_business": "short google business post text"
}`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

---

### Task 3: Rewrite `getWeeklyContent` prompt

**Files:**
- Modify: `src/lib/ai-provider.ts` — replace prompt string in `getWeeklyContent`

- [ ] **Step 1: Replace the prompt**

Find and replace the entire `const prompt = \`You are a strategic social media planner...` block inside `getWeeklyContent` with:

```typescript
  const prompt = `You are a strategic social media planner for small service businesses. Your goal is to create content that drives real engagement — not generic filler that gets ignored. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}

Create a 5-day social media content plan (Monday–Friday). Each day has a strategic purpose and a specific writing strategy:

MONDAY — Educate & Inspire → COUNTERINTUITIVE HOOK:
Open with a statement that challenges what readers believe about this industry. Structure: surprising opener → explain why the assumption is wrong → deliver the insight → soft CTA. NEVER start with "Here are X tips".

TUESDAY — Real Story → TRANSFORMATION STORY:
Tell a customer experience as a mini-story. Structure: before state (their problem) → turning point (contacting the business) → after state (result) → quote as confirmation → soft CTA. NEVER lead with the quote.

WEDNESDAY — Behind the Scenes → CURIOSITY GAP:
Open with "what nobody sees" or "what most people don't know" framing. Structure: curiosity-gap opener → reveal the process → connect to brand values → soft CTA. NEVER open with "Here's our team!".

THURSDAY — Drive Action → PAIN POINT FIRST:
Open with the customer's problem — NOT the offer. Structure: name the pain → your service as solution → offer as relief → urgency CTA. NEVER start with a price, a percentage, or the business name.

FRIDAY — Brand & Community → ORIGIN / VALUES STORY:
Lead with a founding moment or personal "why" — not credentials. Structure: founding moment → what it created → what the business stands for → community CTA. NEVER start with "Family-owned for X years".

PLATFORM RULES — apply to every post:
INSTAGRAM: First line = standalone hook (shows before "more" cutoff). Short punchy sentences, line breaks between thoughts. Emojis contextual, not decorative. End with 4–7 hashtags on their own line. Body 150–250 chars (not counting hashtags).
FACEBOOK: Warm, personal, neighbor-tone. First sentence earns the "see more" click. 1–2 emojis max. No hashtags. 150–280 chars.
GOOGLE BUSINESS: Search result snippet style. Service + benefit + CTA. No emojis, no hashtags. 80–140 chars.

Make EVERY post specific to this exact business. The 5 posts together should feel like a coherent week from a real brand.

Respond with valid JSON only:
{
  "posts": [
    {
      "day": "monday",
      "dayLabel": "Monday",
      "pillar": "Build Authority",
      "pillarEmoji": "💡",
      "headline": "6-8 word headline",
      "reason": "One sentence on why this post works for Monday.",
      "templateType": "tip|customer_spotlight|behind_scenes|promotion|seasonal|about_business|custom",
      "tone": "Friendly|Professional|Exciting|Inspirational|Humorous|Urgent",
      "promptData": { "key": "value" },
      "captions": {
        "instagram": "full caption with hashtags",
        "facebook": "full caption",
        "google_business": "short text"
      }
    }
  ]
}`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

---

### Task 4: Rewrite `getWeekendPost` prompt

**Files:**
- Modify: `src/lib/ai-provider.ts` — replace prompt string in `getWeekendPost`

- [ ] **Step 1: Replace the prompt**

Find and replace the entire `const prompt = \`You are a strategic social media planner...` block inside `getWeekendPost` with:

```typescript
  const prompt = `You are a strategic social media planner for small service businesses. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}

Create ONE ${params.day} social media post. Strategic purpose: ${purpose}

${params.day === 'saturday'
  ? `SATURDAY WRITING STRATEGY — Relatable & Engaging:
Keep it lighter and more conversational than weekday posts. Use a question, fun observation, or relatable scenario as the hook. Weekend content has lower reach but higher engagement — write for connection, not conversion. No hard sells.`
  : `SUNDAY WRITING STRATEGY — Forward-Looking & Motivational:
Open with an inspiring or forward-looking hook that energises followers for the week ahead. Can preview something coming or share a belief/value. Write with warmth and optimism — no urgency, no promotions.`
}

PLATFORM RULES:
INSTAGRAM: First line = standalone hook. Short punchy sentences, line breaks between thoughts. Emojis contextual. End with 3–5 hashtags on their own line. Body 100–200 chars.
FACEBOOK: Warm and casual, like a weekend message to a friend. 1–2 emojis max. No hashtags. 100–200 chars.
GOOGLE BUSINESS: Short, friendly, no emojis, no hashtags. 60–100 chars.

Respond with valid JSON only:
{
  "day": "${params.day}",
  "dayLabel": "${params.day.charAt(0).toUpperCase() + params.day.slice(1)}",
  "pillar": "${pillar}",
  "pillarEmoji": "${pillarEmoji}",
  "headline": "6-8 word headline",
  "reason": "One sentence on why this post works for a ${params.day}.",
  "templateType": "tip|customer_spotlight|behind_scenes|promotion|seasonal|about_business|custom",
  "tone": "Friendly|Inspirational|Humorous",
  "promptData": { "key": "value" },
  "captions": {
    "instagram": "full caption with hashtags",
    "facebook": "full caption",
    "google_business": "short text"
  }
}`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

---

### Task 5: Rewrite `regeneratePlatformCaption` prompt

**Files:**
- Modify: `src/lib/ai-provider.ts` — replace prompt string and `platformGuides` map in `regeneratePlatformCaption`

- [ ] **Step 1: Replace `platformGuides` and the prompt**

Find and replace the `platformGuides` map and `const prompt` inside `regeneratePlatformCaption` with:

```typescript
  const platformGuides: Record<SocialPlatform, string> = {
    instagram: 'First line MUST work as a standalone hook (shows before "more" cutoff). Short punchy sentences, one idea per line, line breaks between thoughts. Emojis used contextually to punctuate meaning — not decoration. End with 4–7 relevant hashtags on their own line. Body 150–250 chars (not counting hashtags).',
    facebook: 'Write like a message to a neighbor — warm, personal, zero corporate tone. First sentence must earn the "see more" click. 1–2 emojis max. No hashtags. 150–300 chars.',
    google_business: 'Write like a useful search result snippet. Lead with the service or benefit. Clear CTA (call, book, visit). No emojis, no hashtags. 80–140 chars.',
  }

  const prompt = `You are an expert social media copywriter for small service businesses. Rewrite the ${params.platform.replace(/_/g, ' ')} caption using the strategy and platform rules below.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Post type: ${params.templateType.replace(/_/g, ' ')}
Details:
${promptDataStr}

${CONTENT_STRATEGIES[params.templateType]}

PLATFORM RULE for ${params.platform.replace(/_/g, ' ')}:
${platformGuides[params.platform]}

Respond with valid JSON only:
{ "caption": "the caption text here" }`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

---

### Task 6: Full build + commit

- [ ] **Step 1: Run full production build**

```bash
npm run build
```
Expected: Compiled successfully, no errors or warnings

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Rewrite AI prompts with per-template content strategies

- Add CONTENT_STRATEGIES map: Pain Point First, Counterintuitive Hook,
  Transformation Story, Curiosity Gap, Timely Relevance, Origin Story,
  Storytelling Hook — one per SocialTemplateType
- generateSocialCaptions: inject template strategy + tightened platform rules
- getWeeklyContent: per-pillar strategies replacing flat caption instructions
- getWeekendPost: Saturday (relatable/engaging) and Sunday (forward-looking)
  strategies replacing generic weekend instructions
- regeneratePlatformCaption: strategy + platform rules aligned with above

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
