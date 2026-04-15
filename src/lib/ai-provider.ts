'use server'

import type {
  GenerateEmailParams,
  GenerateEmailResult,
  GenerateSequenceParams,
  GenerateSequenceResult,
  ImproveEmailParams,
  ImproveEmailResult,
  EmailVariation,
  SequenceStepDraft,
} from '@/types'

const PROVIDER = 'groq' as const

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set in environment variables')

  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })
  return completion.choices[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const start = text.search(/[\[{]/)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (start !== -1 && end !== -1) return text.slice(start, end + 1)
  return text.trim()
}

async function callGroqWithJSON<T>(prompt: string): Promise<T> {
  let raw: string
  try {
    raw = await callGroq(prompt)
    return JSON.parse(extractJSON(raw)) as T
  } catch {
    // Retry once with stricter instruction
    raw = await callGroq(prompt + '\n\nIMPORTANT: Respond with valid JSON only, no explanation or markdown.')
    try {
      return JSON.parse(extractJSON(raw)) as T
    } catch {
      throw new Error(`Groq returned invalid JSON after retry. Raw response: ${raw?.slice(0, 300)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// generateEmail — returns 3 variations
// ---------------------------------------------------------------------------

export async function generateEmail(params: GenerateEmailParams): Promise<GenerateEmailResult> {
  const prompt = `
You are an expert email copywriter for small service businesses.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Recipient type: ${params.recipientType}
Email purpose: ${params.purpose}
${params.context ? `Additional context: ${params.context}` : ''}
Tone for this email: ${params.tone}

Write 3 different email variations for this purpose. Each variation should take a different angle or approach while achieving the same goal.

Use these personalization tokens where appropriate: [First Name], [Business Name], [Your Name]

Respond with JSON in this exact format:
{
  "variations": [
    {
      "subject": "subject line here",
      "body": "full email body here (plain text, use line breaks for paragraphs)",
      "previewText": "preview text here (50-90 chars)"
    },
    {
      "subject": "...",
      "body": "...",
      "previewText": "..."
    },
    {
      "subject": "...",
      "body": "...",
      "previewText": "..."
    }
  ]
}
`

  const result = await callGroqWithJSON<{ variations: EmailVariation[] }>(prompt)

  if (!result.variations || result.variations.length < 3) {
    throw new Error('Groq did not return 3 email variations')
  }

  return { variations: result.variations.slice(0, 3), provider: PROVIDER }
}

// ---------------------------------------------------------------------------
// generateSequence — returns full sequence steps
// ---------------------------------------------------------------------------

export async function generateSequence(params: GenerateSequenceParams): Promise<GenerateSequenceResult> {
  const prompt = `
You are an expert email sequence writer for small service businesses.

Business industry: ${params.industry}
Business name: ${params.businessName}
Brand voice: ${params.brandVoice}
Sequence type/goal: ${params.sequenceType}
Number of steps: ${params.stepCount}

Write a complete email sequence with ${params.stepCount} steps. Each step should naturally follow from the previous one.

Use these personalization tokens where appropriate: [First Name], [Business Name], [Your Name]

The "day" field means "days after the previous step was sent" (first step is day 0).

Respond with JSON in this exact format:
{
  "steps": [
    {
      "day": 0,
      "subject": "subject line",
      "body": "full email body (plain text, use line breaks for paragraphs)",
      "previewText": "preview text (50-90 chars)"
    }
  ]
}
`

  const result = await callGroqWithJSON<{ steps: SequenceStepDraft[] }>(prompt)

  if (!result.steps || result.steps.length === 0) {
    throw new Error('Groq did not return sequence steps')
  }

  return { steps: result.steps, provider: PROVIDER }
}

// ---------------------------------------------------------------------------
// improveEmail — takes existing email and an instruction
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Social content types
// ---------------------------------------------------------------------------

export interface SocialCaptions {
  instagram: string
  facebook: string
  google_business: string
}

export type SocialPlatform = 'instagram' | 'facebook' | 'google_business'

export type SocialTemplateType =
  | 'promotion'
  | 'tip'
  | 'customer_spotlight'
  | 'behind_scenes'
  | 'seasonal'
  | 'about_business'
  | 'custom'

// ---------------------------------------------------------------------------
// Post recommendation type
// ---------------------------------------------------------------------------

export interface PostRecommendation {
  templateType: SocialTemplateType
  emoji: string
  headline: string
  description: string
  promptData: Record<string, string>
  suggestedTone: string
  reason: string
}

// ---------------------------------------------------------------------------
// getPostRecommendations — AI-generated post ideas for a business
// ---------------------------------------------------------------------------

export async function getPostRecommendations(params: {
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
}): Promise<PostRecommendation[]> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const prompt = `You are a social media strategist for small service businesses. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}

Generate 6 highly specific, timely, and relevant social media post ideas for this business. Each should feel tailor-made — not generic. Mix different post types. Consider the current season, what customers of this type of business care about, and what drives engagement.

For each idea include the exact prompt data fields needed to generate the post.

Respond with valid JSON only:
{
  "recommendations": [
    {
      "templateType": "promotion|tip|customer_spotlight|behind_scenes|seasonal|about_business|custom",
      "emoji": "single emoji",
      "headline": "short catchy title for this post idea (max 8 words)",
      "description": "one sentence describing what this post will say and why it works",
      "promptData": { "key": "value — specific details for this post" },
      "suggestedTone": "Friendly|Professional|Exciting|Inspirational|Humorous|Urgent",
      "reason": "one sentence on why this post is timely or relevant right now"
    }
  ]
}`

  const result = await callGroqWithJSON<{ recommendations: PostRecommendation[] }>(prompt)
  return result.recommendations ?? []
}

// ---------------------------------------------------------------------------
// WeeklyPost — one strategically-placed post per weekday
// ---------------------------------------------------------------------------

export interface WeeklyPost {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  dayLabel: string
  pillar: string        // e.g. "Build Authority"
  pillarEmoji: string
  headline: string
  reason: string
  templateType: SocialTemplateType
  promptData: Record<string, string>
  tone: string
  captions: SocialCaptions
  imageUrl?: string | null
}

export async function getWeeklyContent(params: {
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
}): Promise<WeeklyPost[]> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

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

  const result = await callGroqWithJSON<{ posts: WeeklyPost[] }>(prompt)
  return result.posts ?? []
}

// ---------------------------------------------------------------------------
// getWeekendPost — single optional weekend post on demand
// ---------------------------------------------------------------------------

export async function getWeekendPost(params: {
  day: 'saturday' | 'sunday'
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
}): Promise<WeeklyPost> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const pillars = {
    saturday: { pillar: 'Fun & Engage', pillarEmoji: '🎉', purpose: 'SATURDAY — Fun & Engage: a lighthearted, interactive post that builds community (fun fact, question, poll idea, or behind-the-scenes moment)' },
    sunday: { pillar: 'Inspire & Preview', pillarEmoji: '✨', purpose: 'SUNDAY — Inspire & Preview: an inspirational or motivational post that energises followers for the week ahead, or previews something exciting coming up' },
  }

  const { pillar, pillarEmoji, purpose } = pillars[params.day]

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

  const result = await callGroqWithJSON<WeeklyPost>(prompt)
  return result
}

// ---------------------------------------------------------------------------
// ReadyPost — fully-written post with captions ready to copy
// ---------------------------------------------------------------------------

export interface ReadyPost {
  category: 'timely' | 'trust' | 'action'
  categoryLabel: string
  categoryEmoji: string
  headline: string
  reason: string
  templateType: SocialTemplateType
  promptData: Record<string, string>
  tone: string
  captions: SocialCaptions
  imageUrl?: string | null
}

// ---------------------------------------------------------------------------
// getReadyToPostContent — 3 fully-written posts, one per strategic category
// ---------------------------------------------------------------------------

export async function getReadyToPostContent(params: {
  businessName: string
  industry: string
  description: string | null
  brandVoice: string
}): Promise<ReadyPost[]> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const prompt = `You are an expert social media strategist for small service businesses. Today is ${today}.

Business: ${params.businessName}
Industry: ${params.industry}
Description: ${params.description ?? 'A local service business'}
Brand voice: ${params.brandVoice}

Generate exactly 3 ready-to-post social media recommendations. Each must be a DIFFERENT strategic category:
1. TIMELY — tap into the current season, upcoming holiday, or a timely topic relevant to this industry right now
2. TRUST — build credibility (a specific customer win, demonstration of expertise, or authentic behind-the-scenes)
3. ACTION — drive bookings or inquiries (specific offer, clear urgency, direct call to action)

Rules:
- Be SPECIFIC to this business — no generic filler. Write as if you know this business personally.
- Each post must be COMPLETE and READY TO COPY — not a template, an actual post.
- Captions must sound natural, not marketing-speak.

For each post write all three platform captions:
- instagram: conversational tone, relevant emojis, 5-8 hashtags at end, 150-250 chars body
- facebook: warm and conversational, 1-2 emojis max, no hashtags, 150-280 chars
- google_business: short, direct, professional, no emojis, no hashtags, 80-140 chars

Respond with valid JSON only:
{
  "posts": [
    {
      "category": "timely",
      "categoryLabel": "Trending This Week",
      "categoryEmoji": "🔥",
      "headline": "6-8 word catchy headline for this post",
      "reason": "One compelling sentence explaining why this post will perform well right now — be specific.",
      "templateType": "seasonal|promotion|tip|customer_spotlight|behind_scenes|about_business|custom",
      "tone": "Friendly|Professional|Exciting|Inspirational|Humorous|Urgent",
      "promptData": { "relevant_key": "specific detail about this post" },
      "captions": {
        "instagram": "full ready-to-post instagram caption including hashtags",
        "facebook": "full ready-to-post facebook caption",
        "google_business": "short ready-to-post google business text"
      }
    },
    {
      "category": "trust",
      "categoryLabel": "Build Credibility",
      "categoryEmoji": "⭐",
      "headline": "...",
      "reason": "...",
      "templateType": "...",
      "tone": "...",
      "promptData": {},
      "captions": { "instagram": "...", "facebook": "...", "google_business": "..." }
    },
    {
      "category": "action",
      "categoryLabel": "Drive Business",
      "categoryEmoji": "🚀",
      "headline": "...",
      "reason": "...",
      "templateType": "...",
      "tone": "...",
      "promptData": {},
      "captions": { "instagram": "...", "facebook": "...", "google_business": "..." }
    }
  ]
}`

  const result = await callGroqWithJSON<{ posts: ReadyPost[] }>(prompt)
  return result.posts ?? []
}

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

// ---------------------------------------------------------------------------
// generateSocialCaptions — all three platforms in one call
// ---------------------------------------------------------------------------

export async function generateSocialCaptions(params: {
  templateType: SocialTemplateType
  promptData: Record<string, string>
  businessName: string
  industry: string
  brandVoice: string
}): Promise<SocialCaptions> {
  // Separate tone from the rest of the fields for cleaner prompting
  const { tone, audience, cta, ...contentFields } = params.promptData
  const contentStr = Object.entries(contentFields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')

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

  return callGroqWithJSON<SocialCaptions>(prompt)
}

// ---------------------------------------------------------------------------
// regeneratePlatformCaption — re-run for one platform only
// ---------------------------------------------------------------------------

export async function regeneratePlatformCaption(params: {
  platform: SocialPlatform
  templateType: SocialTemplateType
  promptData: Record<string, string>
  businessName: string
  industry: string
  brandVoice: string
}): Promise<string> {
  const promptDataStr = Object.entries(params.promptData)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

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

  const result = await callGroqWithJSON<{ caption: string }>(prompt)
  return result.caption
}

// ---------------------------------------------------------------------------
// generateSocialImage — builds a prompt and calls fal.ai FLUX
// ---------------------------------------------------------------------------

export async function generateSocialImage(params: {
  templateType: SocialTemplateType
  promptData: Record<string, string>
  businessName: string
  primaryColor: string
}): Promise<string> {
  const templatePrompts: Record<SocialTemplateType, string> = {
    promotion: `abstract sale promotion concept, bold geometric shapes, colorful ribbons and stars, vibrant gradient background, modern minimalist digital art`,
    tip: `abstract lightbulb glowing concept, clean geometric shapes, soft blue and yellow gradient, professional minimalist digital art`,
    customer_spotlight: `abstract five gold stars floating, warm orange and yellow gradient background, clean geometric layout, modern minimalist digital art`,
    behind_scenes: `abstract office workspace flat illustration, geometric desk shapes, soft neutral colors, professional minimalist digital art`,
    seasonal: `abstract ${params.promptData.season ?? 'seasonal'} concept, seasonal color palette, geometric decorative shapes, festive modern digital art`,
    about_business: `abstract professional trust concept, geometric handshake shapes, clean blue and white gradient, modern minimalist digital art`,
    custom: `abstract professional social media graphic, clean geometric shapes, modern gradient background, minimalist digital art`,
  }

  const imagePrompt = `${templatePrompts[params.templateType]}, letterless, textless, wordless, signless, no typography, no letters, no numbers, no words, no text of any kind, pure abstract shapes only`

  // Pollinations.ai — free, no API key required
  const seed = Math.floor(Math.random() * 99999)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`
}

// ---------------------------------------------------------------------------
// improveEmail — takes existing email and an instruction
// ---------------------------------------------------------------------------

export async function improveEmail(params: ImproveEmailParams): Promise<ImproveEmailResult> {
  const prompt = `
You are an expert email copywriter. Improve the following email based on the instruction.

Current email:
Subject: ${params.existingEmail.subject}
Preview text: ${params.existingEmail.previewText}
Body:
${params.existingEmail.body}

Instruction: ${params.instruction}

Keep personalization tokens like [First Name], [Business Name], [Your Name] intact.

Respond with JSON in this exact format:
{
  "subject": "improved subject line",
  "body": "improved email body (plain text, use line breaks for paragraphs)",
  "previewText": "improved preview text (50-90 chars)"
}
`

  const result = await callGroqWithJSON<{ subject: string; body: string; previewText: string }>(prompt)

  return { ...result, provider: PROVIDER }
}
