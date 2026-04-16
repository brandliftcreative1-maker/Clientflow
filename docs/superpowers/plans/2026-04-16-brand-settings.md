# Brand Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Brand section in Settings that lets users manage voice + contact info after onboarding, and inject everything into caption-generating prompts so posts include accurate CTAs using real contact details.

**Architecture:** Add 3 new nullable columns to the existing `accounts` table (`booking_url`, `topics_to_avoid`, `example_posts`). Create a `src/actions/brand.ts` with `getBrandSettings` / `saveBrandSettings` server actions. Add a new `<section>` to the existing Settings page with a 10-field form. Extend the four caption-generating functions in `ai-provider.ts` (`generateSocialCaptions`, `getWeeklyContent`, `getWeekendPost`, `regeneratePlatformCaption`) to accept brand context params and inject them into prompts with platform-specific CTA rules. Update the callers in `src/actions/content.ts` to fetch the brand fields and pass them through.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (Postgres + SSR client), Groq SDK (`llama-3.3-70b-versatile`), React Server Actions, Tailwind CSS

---

## File Structure Overview

Files created:
- `supabase/migrations/006_brand_settings.sql` — ALTER TABLE adding 3 columns
- `src/actions/brand.ts` — `BrandSettings` type, `getBrandSettings`, `saveBrandSettings`

Files modified:
- `src/types/database.ts` — add 3 new columns to accounts Row/Insert/Update types
- `src/app/(dashboard)/dashboard/settings/page.tsx` — add Brand section with 10-field form
- `src/lib/ai-provider.ts` — add shared `BrandContext` type + `buildBrandContextBlock` + `buildCtaRulesBlock` helpers; extend 4 caption functions to accept and inject brand context
- `src/actions/content.ts` — extend `getAccountAndUser` select list; pass brand context to all callers of the 4 caption functions

---

### Task 1: DB migration — add brand columns to `accounts`

**Files:**
- Create: `supabase/migrations/006_brand_settings.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/006_brand_settings.sql` with the following content:

```sql
-- Phase 3b: Brand Settings
-- Adds columns used by the Brand Settings UI and AI prompts.
-- Existing columns reused as-is: business_name, industry, description, website, phone, address, brand_voice.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS topics_to_avoid TEXT,
  ADD COLUMN IF NOT EXISTS example_posts TEXT;
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase SQL editor for the project and paste the entire contents of `supabase/migrations/006_brand_settings.sql`. Click Run.

Verify by running this query in the SQL editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN ('booking_url', 'topics_to_avoid', 'example_posts');
```

Expected: 3 rows returned.

- [ ] **Step 3: Commit**

```bash
cd clientflow
git add supabase/migrations/006_brand_settings.sql
git commit -m "Add booking_url, topics_to_avoid, example_posts columns for Brand Settings"
```

---

### Task 2: Update `database.ts` types

**Files:**
- Modify: `src/types/database.ts` — `accounts` Row, Insert, Update types

- [ ] **Step 1: Open the file and locate the accounts table types**

Open `src/types/database.ts`. Find the `accounts` entry inside `Database['public']['Tables']`. It has three sub-types: `Row`, `Insert`, `Update`. The Row type currently ends with fields around line ~20 (right after `created_at`).

- [ ] **Step 2: Add the three new fields to the Row type**

Find the `accounts` → `Row` type. Add these three lines just before `created_at: string` (keep alphabetical-ish placement with other nullable text fields):

```typescript
          booking_url: string | null
          topics_to_avoid: string | null
          example_posts: string | null
```

- [ ] **Step 3: Add the three new fields to the Insert type**

Find the `accounts` → `Insert` type (same table, Insert key). Add the same three fields as optional:

```typescript
          booking_url?: string | null
          topics_to_avoid?: string | null
          example_posts?: string | null
```

- [ ] **Step 4: Add the three new fields to the Update type**

Find the `accounts` → `Update` type. Add the same optional fields:

```typescript
          booking_url?: string | null
          topics_to_avoid?: string | null
          example_posts?: string | null
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "Add brand columns to accounts types"
```

---

### Task 3: Create `src/actions/brand.ts`

**Files:**
- Create: `src/actions/brand.ts`

- [ ] **Step 1: Create the file**

Create `src/actions/brand.ts` with this exact content:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export interface BrandSettings {
  business_name: string
  industry: string
  description: string
  brand_voice: string
  topics_to_avoid: string
  example_posts: string
  website: string
  phone: string
  address: string
  booking_url: string
}

const EMPTY: BrandSettings = {
  business_name: '',
  industry: '',
  description: '',
  brand_voice: 'Friendly',
  topics_to_avoid: '',
  example_posts: '',
  website: '',
  phone: '',
  address: '',
  booking_url: '',
}

export async function getBrandSettings(): Promise<BrandSettings> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const { data } = await supabase
    .from('accounts')
    .select('business_name, industry, description, brand_voice, topics_to_avoid, example_posts, website, phone, address, booking_url')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return EMPTY

  return {
    business_name: data.business_name ?? '',
    industry: data.industry ?? '',
    description: data.description ?? '',
    brand_voice: data.brand_voice ?? 'Friendly',
    topics_to_avoid: data.topics_to_avoid ?? '',
    example_posts: data.example_posts ?? '',
    website: data.website ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
    booking_url: data.booking_url ?? '',
  }
}

export async function saveBrandSettings(
  settings: BrandSettings
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trim = (s: string) => s.trim()
  const nullIfEmpty = (s: string) => (s.trim() === '' ? null : s.trim())

  if (!trim(settings.business_name)) return { error: 'Business name is required' }
  if (!trim(settings.industry)) return { error: 'Industry is required' }

  const { error } = await supabase
    .from('accounts')
    .update({
      business_name: trim(settings.business_name),
      industry: trim(settings.industry),
      description: nullIfEmpty(settings.description),
      brand_voice: trim(settings.brand_voice) || 'Friendly',
      topics_to_avoid: nullIfEmpty(settings.topics_to_avoid),
      example_posts: nullIfEmpty(settings.example_posts),
      website: nullIfEmpty(settings.website),
      phone: nullIfEmpty(settings.phone),
      address: nullIfEmpty(settings.address),
      booking_url: nullIfEmpty(settings.booking_url),
    })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/brand.ts
git commit -m "Add brand settings server actions (get, save)"
```

---

### Task 4: Add Brand section to Settings page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/settings/page.tsx` — add form section + state + handler

- [ ] **Step 1: Add imports**

Open `src/app/(dashboard)/dashboard/settings/page.tsx`. Find the existing import block at the top. Add these imports (after the existing actions imports):

```typescript
import { getBrandSettings, saveBrandSettings, type BrandSettings } from '@/actions/brand'
```

- [ ] **Step 2: Add brand state and loading flag near the other state hooks**

Find the block where existing `useState` hooks live (e.g., `const [cadence, setCadence] = useState<CadenceSettings | null>(null)`). Immediately after that line, add:

```typescript
  const [brand, setBrand] = useState<BrandSettings | null>(null)
  const [savingBrand, setSavingBrand] = useState(false)
```

- [ ] **Step 3: Hydrate brand on mount**

Find the `useEffect` that loads cadence (look for `getCadenceSettings`). Immediately after the existing cadence-loading call inside that effect (or add a new effect if the existing one is not mounted-once), add:

```typescript
    getBrandSettings().then(setBrand)
```

If there is no mount-once useEffect, add this one just after the existing hooks:

```typescript
  useEffect(() => {
    getBrandSettings().then(setBrand)
  }, [])
```

(Import `useEffect` from 'react' if not already imported.)

- [ ] **Step 4: Add brand field change helper and save handler**

Below the existing `handleSave` (which saves cadence), add:

```typescript
  const handleBrandChange = (field: keyof BrandSettings, value: string) => {
    setBrand(prev => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSaveBrand = async () => {
    if (!brand) return
    setSavingBrand(true)
    const { error } = await saveBrandSettings(brand)
    setSavingBrand(false)
    if (error) toast.error(error)
    else toast.success('Brand settings saved')
  }
```

- [ ] **Step 5: Add the Brand section JSX**

Find the closing `</section>` of the last existing settings section (Posting Preferences) inside the returned JSX. Immediately after that closing `</section>`, before the outer `</div>` of the page, add this block:

```tsx
      {/* Brand Settings */}
      <section className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Brand</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tell the AI about your business so posts sound like you</p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-6">
          {brand ? (
            <>
              {/* Business basics */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Business basics</Label>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Business name</label>
                  <input
                    type="text"
                    value={brand.business_name}
                    onChange={e => handleBrandChange('business_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Industry</label>
                  <input
                    type="text"
                    value={brand.industry}
                    onChange={e => handleBrandChange('industry', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Short description</label>
                  <textarea
                    rows={2}
                    value={brand.description}
                    onChange={e => handleBrandChange('description', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Voice */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Voice</Label>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Brand voice</label>
                  <select
                    value={brand.brand_voice}
                    onChange={e => handleBrandChange('brand_voice', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="Friendly">Friendly</option>
                    <option value="Professional">Professional</option>
                    <option value="Exciting">Exciting</option>
                    <option value="Inspirational">Inspirational</option>
                    <option value="Humorous">Humorous</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Topics or words to avoid</label>
                  <textarea
                    rows={2}
                    value={brand.topics_to_avoid}
                    onChange={e => handleBrandChange('topics_to_avoid', e.target.value)}
                    placeholder="e.g. cheap, discount, guaranteed"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Example posts you love</label>
                  <textarea
                    rows={6}
                    value={brand.example_posts}
                    onChange={e => handleBrandChange('example_posts', e.target.value)}
                    placeholder="Paste 1–5 posts that sound like your brand. Separate with blank lines."
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Contact info</Label>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Website URL</label>
                  <input
                    type="url"
                    value={brand.website}
                    onChange={e => handleBrandChange('website', e.target.value)}
                    placeholder="https://example.com"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Phone</label>
                  <input
                    type="text"
                    value={brand.phone}
                    onChange={e => handleBrandChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Address</label>
                  <input
                    type="text"
                    value={brand.address}
                    onChange={e => handleBrandChange('address', e.target.value)}
                    placeholder="123 Main St, Anytown USA"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Booking link</label>
                  <input
                    type="url"
                    value={brand.booking_url}
                    onChange={e => handleBrandChange('booking_url', e.target.value)}
                    placeholder="e.g. calendly.com/yourbrand"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <Button onClick={handleSaveBrand} disabled={savingBrand} className="w-fit flex items-center gap-2">
                {savingBrand && <Loader2 size={14} className="animate-spin" />}
                Save brand settings
              </Button>
            </>
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </section>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual visual check**

Start the dev server (if not running):

```bash
cd clientflow && npm run dev
```

Open http://localhost:3000/dashboard/settings in a browser. Expected:
- Existing Google Business + Posting Preferences sections still render
- New "Brand" section appears below them
- Business name + industry + existing description/voice populate from DB
- Clicking Save brand settings shows "Brand settings saved" toast
- Refresh the page → values persist

- [ ] **Step 8: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/settings/page.tsx
git commit -m "Add Brand section to Settings (voice + contact fields)"
```

---

### Task 5: Add `BrandContext` helpers to `ai-provider.ts`

**Files:**
- Modify: `src/lib/ai-provider.ts` — add shared type + helpers near the top (before `generateSocialCaptions`)

- [ ] **Step 1: Locate insertion point**

Open `src/lib/ai-provider.ts`. Find the `CONTENT_STRATEGIES` constant block (starts around line 477 with the comment `// Content strategies — injected per template type into caption prompts`). Immediately AFTER the closing `}` of the `CONTENT_STRATEGIES` object (and its closing blank line), insert the helpers in Step 2.

- [ ] **Step 2: Insert the BrandContext type and two helper functions**

Insert this exact block:

```typescript
// ---------------------------------------------------------------------------
// Brand context — shared across all caption-generating functions
// ---------------------------------------------------------------------------

export interface BrandContext {
  website?: string | null
  phone?: string | null
  address?: string | null
  booking_url?: string | null
  topics_to_avoid?: string | null
  example_posts?: string | null
}

function buildBrandContextBlock(ctx?: BrandContext): string {
  if (!ctx) return ''
  const lines: string[] = []
  if (ctx.website?.trim()) lines.push(`- Website: ${ctx.website.trim()}`)
  if (ctx.phone?.trim()) lines.push(`- Phone: ${ctx.phone.trim()}`)
  if (ctx.address?.trim()) lines.push(`- Address: ${ctx.address.trim()}`)
  if (ctx.booking_url?.trim()) lines.push(`- Booking link: ${ctx.booking_url.trim()}`)
  if (ctx.topics_to_avoid?.trim()) lines.push(`- Topics/words to avoid: ${ctx.topics_to_avoid.trim()}`)
  if (ctx.example_posts?.trim()) {
    lines.push(`- Example posts in our voice:\n${ctx.example_posts.trim().split('\n').map(l => '  ' + l).join('\n')}`)
  }

  if (lines.length === 0) return ''

  let block = `BRAND CONTEXT:\n${lines.join('\n')}`
  if (ctx.example_posts?.trim()) {
    block += `\n\nMirror the voice, rhythm, and vocabulary of the example posts above.`
  }
  if (ctx.topics_to_avoid?.trim()) {
    block += `\n\nDo not use these words or topics in any caption.`
  }
  return block
}

function buildCtaRulesBlock(ctx?: BrandContext): string {
  return `CTA RULES — apply per platform using the BRAND CONTEXT above:

INSTAGRAM: Soft CTA. Prefer "DM us", "Link in bio", or "Call {phone}" if phone is available. Do NOT paste raw URLs in the caption body — Instagram doesn't make them clickable in posts. One CTA line at the end of the body (before hashtags).

FACEBOOK: Medium-strength CTA. URLs ARE clickable — use booking link or website if available. Phone is acceptable. One line at the end of the body.

GOOGLE BUSINESS: MANDATORY concrete CTA using real contact info. Priority order:
  1. booking_url → "Book at {booking_url}"
  2. phone → "Call {phone}"
  3. website → "Learn more at {website}"
  4. address → "Visit us at {address}"
  5. none of the above → "Contact us to get started."
The caption MUST end with the selected CTA. Never end a Google Business post without one of these concrete actions.`
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors. (Helpers are defined but not yet used; TypeScript may warn about unused helpers depending on strictness. The existing codebase compiles cleanly with unused declarations — verified in prior work. If you see a "declared but never read" error, proceed to Task 6 which will wire them in.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Add BrandContext type and prompt-block helpers"
```

---

### Task 6: Wire `BrandContext` into `generateSocialCaptions`

**Files:**
- Modify: `src/lib/ai-provider.ts` — extend params + inject blocks in `generateSocialCaptions`

- [ ] **Step 1: Extend the params type**

Find the `generateSocialCaptions` function (search for `export async function generateSocialCaptions`). Change its params type to include `brandContext`:

```typescript
export async function generateSocialCaptions(params: {
  templateType: SocialTemplateType
  promptData: Record<string, string>
  businessName: string
  industry: string
  brandVoice: string
  brandContext?: BrandContext
}): Promise<SocialCaptions> {
```

- [ ] **Step 2: Build the two blocks inside the function body**

Immediately after the existing line `const strategy = CONTENT_STRATEGIES[params.templateType]`, add:

```typescript
  const brandBlock = buildBrandContextBlock(params.brandContext)
  const ctaBlock = buildCtaRulesBlock(params.brandContext)
```

- [ ] **Step 3: Update the prompt string to include both blocks**

Replace the entire `const prompt = ...` template literal with this version. The only changes vs. current: `${brandBlock ? '\n' + brandBlock + '\n' : ''}` inserted right after the `Call to action:` line, and `${ctaBlock}` inserted right after the platform rules (before the JSON response instruction):

```typescript
  const prompt = `You are an expert social media copywriter for small service businesses. Your goal is to write content that stops the scroll, earns engagement, and drives real business results — not content that sounds like an ad.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Tone: ${tone ?? 'Friendly'}
Post type: ${params.templateType.replace(/_/g, ' ')}
${contentStr ? `Post details:\n${contentStr}` : ''}
${audience ? `Target audience: ${audience}` : ''}
${cta ? `Call to action: ${cta}` : ''}
${brandBlock ? '\n' + brandBlock + '\n' : ''}
${strategy}

PLATFORM RULES — apply exactly:

INSTAGRAM: First line MUST work as a standalone hook (shows before "more" cutoff). Short punchy sentences, one idea per line, line breaks between thoughts. Emojis used contextually to punctuate meaning — not decoration. End with 4–7 relevant hashtags on their own line. Body 150–250 chars (not counting hashtags).

FACEBOOK: Write like a message to a neighbor — warm, personal, zero corporate tone. First sentence must earn the "see more" click. 1–2 emojis max. No hashtags. 150–300 chars.

GOOGLE BUSINESS: Write like a useful search result snippet. Lead with the service or benefit. Clear CTA (call, book, visit). No emojis, no hashtags. 80–140 chars.

${ctaBlock}
${cta ? `\nIf a specific call to action is provided above, use it exactly as written and ignore the CTA priority order.` : ''}

Respond with valid JSON only:
{
  "instagram": "full instagram caption including hashtags",
  "facebook": "full facebook caption",
  "google_business": "short google business post text"
}`
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Wire BrandContext into generateSocialCaptions"
```

---

### Task 7: Wire `BrandContext` into `getWeeklyContent`

**Files:**
- Modify: `src/lib/ai-provider.ts` — extend params + inject blocks in `getWeeklyContent`

- [ ] **Step 1: Extend the params type**

Find `export async function getWeeklyContent`. Change its params type:

```typescript
export async function getWeeklyContent(params: {
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
  brandContext?: BrandContext
}): Promise<WeeklyPost[]> {
```

- [ ] **Step 2: Build blocks in the body**

Immediately after the existing line `const today = new Date().toLocaleDateString(...)`, add:

```typescript
  const brandBlock = buildBrandContextBlock(params.brandContext)
  const ctaBlock = buildCtaRulesBlock(params.brandContext)
```

- [ ] **Step 3: Update the prompt string**

Replace the entire `const prompt = ...` template literal in `getWeeklyContent` with:

```typescript
  const prompt = `You are a strategic social media planner for small service businesses. Your goal is to create content that drives real engagement — not generic filler that gets ignored. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}
${brandBlock ? '\n' + brandBlock + '\n' : ''}
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

${ctaBlock}

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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Wire BrandContext into getWeeklyContent"
```

---

### Task 8: Wire `BrandContext` into `getWeekendPost`

**Files:**
- Modify: `src/lib/ai-provider.ts` — extend params + inject blocks in `getWeekendPost`

- [ ] **Step 1: Extend the params type**

Find `export async function getWeekendPost`. Change its params type:

```typescript
export async function getWeekendPost(params: {
  day: 'saturday' | 'sunday'
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
  brandContext?: BrandContext
}): Promise<WeeklyPost> {
```

- [ ] **Step 2: Build blocks in the body**

Immediately after the existing line `const { pillar, pillarEmoji, purpose } = pillars[params.day]`, add:

```typescript
  const brandBlock = buildBrandContextBlock(params.brandContext)
  const ctaBlock = buildCtaRulesBlock(params.brandContext)
```

- [ ] **Step 3: Update the prompt string**

Replace the entire `const prompt = ...` template literal in `getWeekendPost` with:

```typescript
  const prompt = `You are a strategic social media planner for small service businesses. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}
${brandBlock ? '\n' + brandBlock + '\n' : ''}
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

${ctaBlock}

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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Wire BrandContext into getWeekendPost"
```

---

### Task 9: Wire `BrandContext` into `regeneratePlatformCaption`

**Files:**
- Modify: `src/lib/ai-provider.ts` — extend params + inject blocks in `regeneratePlatformCaption`

- [ ] **Step 1: Extend the params type**

Find `export async function regeneratePlatformCaption`. Change its params type:

```typescript
export async function regeneratePlatformCaption(params: {
  platform: SocialPlatform
  templateType: SocialTemplateType
  promptData: Record<string, string>
  businessName: string
  industry: string
  brandVoice: string
  brandContext?: BrandContext
}): Promise<string> {
```

- [ ] **Step 2: Build blocks in the body**

Immediately after the existing `const platformGuides: Record<SocialPlatform, string> = { ... }` block (or immediately before the `const prompt = ...` line if easier to locate), add:

```typescript
  const brandBlock = buildBrandContextBlock(params.brandContext)
  const ctaBlock = buildCtaRulesBlock(params.brandContext)
```

- [ ] **Step 3: Update the prompt string**

Replace the entire `const prompt = ...` template literal in `regeneratePlatformCaption` with:

```typescript
  const prompt = `You are an expert social media copywriter for small service businesses. Rewrite the ${params.platform.replace(/_/g, ' ')} caption using the strategy and platform rules below.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Post type: ${params.templateType.replace(/_/g, ' ')}
Details:
${promptDataStr}
${brandBlock ? '\n' + brandBlock + '\n' : ''}
${CONTENT_STRATEGIES[params.templateType]}

PLATFORM RULE for ${params.platform.replace(/_/g, ' ')}:
${platformGuides[params.platform]}

${ctaBlock}

Respond with valid JSON only:
{ "caption": "the caption text here" }`
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts
git commit -m "Wire BrandContext into regeneratePlatformCaption"
```

---

### Task 10: Pass brand context from `content.ts` callers

**Files:**
- Modify: `src/actions/content.ts` — extend account select list + pass `brandContext` to all 4 caption functions

- [ ] **Step 1: Extend the `getAccountAndUser` select list**

Open `src/actions/content.ts`. Find the `getAccountAndUser` function. Replace its `select(...)` call with this wider list that pulls the 6 brand-related fields:

```typescript
    .select('id, business_name, industry, description, brand_voice, primary_color, google_refresh_token, google_location_name, website, phone, address, booking_url, topics_to_avoid, example_posts')
```

- [ ] **Step 2: Add a shared brandContext helper near the imports**

At the top of the file, just below the existing imports, add:

```typescript
import type { BrandContext } from '@/lib/ai-provider'

function buildBrandContext(account: {
  website?: string | null
  phone?: string | null
  address?: string | null
  booking_url?: string | null
  topics_to_avoid?: string | null
  example_posts?: string | null
}): BrandContext {
  return {
    website: account.website ?? null,
    phone: account.phone ?? null,
    address: account.address ?? null,
    booking_url: account.booking_url ?? null,
    topics_to_avoid: account.topics_to_avoid ?? null,
    example_posts: account.example_posts ?? null,
  }
}
```

- [ ] **Step 3: Pass `brandContext` to every call site of the 4 caption functions**

Find every call to `generateSocialCaptions(`, `getWeeklyContent(`, `getWeekendPost(`, and `regeneratePlatformCaption(` in this file. For each, add a `brandContext: buildBrandContext(account),` line inside the params object.

Example — before:

```typescript
const captions = await generateSocialCaptions({
  templateType: params.templateType,
  promptData: params.promptData,
  businessName: account.business_name,
  industry: account.industry,
  brandVoice: account.brand_voice,
})
```

After:

```typescript
const captions = await generateSocialCaptions({
  templateType: params.templateType,
  promptData: params.promptData,
  businessName: account.business_name,
  industry: account.industry,
  brandVoice: account.brand_voice,
  brandContext: buildBrandContext(account),
})
```

Apply the same transform to every call site. Based on prior grep, there are multiple call sites across ~7 exported functions.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clientflow && npx tsc --noEmit
```

Expected: no errors. If you see errors about missing fields on `account`, double-check Step 1 — the select list must include `website, phone, address, booking_url, topics_to_avoid, example_posts`.

- [ ] **Step 5: Commit**

```bash
git add src/actions/content.ts
git commit -m "Pass brand context from content actions into caption generators"
```

---

### Task 11: Full build + manual smoke test

**Files:** none

- [ ] **Step 1: Run full production build**

```bash
cd clientflow && npm run build
```

Expected: `Compiled successfully`. The pre-existing `Google OAuth callback` dynamic-server-usage notice is expected and not an error.

- [ ] **Step 2: Start the dev server**

```bash
cd clientflow && npm run dev
```

- [ ] **Step 3: Manual smoke test — Brand Settings**

In a browser, open http://localhost:3000/dashboard/settings. Expected:
1. The new Brand section renders between existing sections (or below them)
2. The Business name + Industry fields show existing values
3. Enter a phone (e.g. "(555) 123-4567"), booking URL, and "Topics to avoid: cheap, discount"
4. Click "Save brand settings" → toast "Brand settings saved"
5. Refresh → values persist

- [ ] **Step 4: Manual smoke test — AI uses the brand context**

Open http://localhost:3000/dashboard/content. Generate a new post (Create a Post or This Week). Check the generated captions:
- Google Business caption should end with a concrete CTA using the phone or booking URL you entered (e.g. "Call (555) 123-4567 to book.")
- Instagram caption should not include the raw website URL in the body
- None of the captions should contain the words from "Topics to avoid"

If results don't match expectations, do NOT mark step complete. Inspect the actual prompt by adding a temporary `console.log(prompt)` in `ai-provider.ts`, re-run generation, and confirm the BRAND CONTEXT block appears in the prompt with the fields you saved.

- [ ] **Step 5: Push**

```bash
git push origin main
```

Expected: all commits from Tasks 1–10 pushed; Vercel auto-deploys.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task(s) |
|---|---|
| Add `booking_url`, `topics_to_avoid`, `example_posts` to `accounts` | Task 1 |
| `BrandSettings` type with 10 fields | Task 3 |
| `getBrandSettings` / `saveBrandSettings` server actions | Task 3 |
| Brand section on `/dashboard/settings` with 4 subsections | Task 4 |
| All fields editable after onboarding | Task 4 |
| Business name + industry required, all others optional | Task 3 (validation), Task 4 (form) |
| BRAND CONTEXT block injected into 4 caption functions | Tasks 5–9 |
| CTA RULES block with per-platform logic | Tasks 5–9 |
| Per-post CTA override still works | Task 6 Step 3 (conditional override line) |
| Instagram never includes raw URL when website set | Task 5 `buildCtaRulesBlock` |
| Google Business mandatory CTA with priority order | Task 5 `buildCtaRulesBlock` |
| Topics-to-avoid respected by AI | Task 5 `buildBrandContextBlock` (appends instruction) |
| Example posts mirrored by AI | Task 5 `buildBrandContextBlock` (appends instruction) |
| No changes to onboarding, JSON response shapes, or Create a Post UI | By omission — none of these are modified |

All requirements covered.

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every code block is complete. Every command has expected output. No "similar to Task N" references.

**Type consistency check:**
- `BrandSettings` interface defined once in `src/actions/brand.ts` (Task 3) — used only in the Settings page (Task 4). Correct.
- `BrandContext` interface defined once in `src/lib/ai-provider.ts` (Task 5) — used in all 4 caption functions (Tasks 6–9) and imported into `content.ts` (Task 10). Field names consistent throughout: `website`, `phone`, `address`, `booking_url`, `topics_to_avoid`, `example_posts`.
- Helper function names consistent: `buildBrandContextBlock`, `buildCtaRulesBlock` (Task 5) — called in Tasks 6–9 with the exact same names.
- `buildBrandContext` in `content.ts` (Task 10) maps account row → `BrandContext` — field names match.
