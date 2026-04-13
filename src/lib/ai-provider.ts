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
  const promptDataStr = Object.entries(params.promptData)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const prompt = `You are a social media copywriter for small service businesses.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Post type: ${params.templateType.replace(/_/g, ' ')}
Details:
${promptDataStr}

Write three separate social media captions for this post — one for each platform. Each caption should be tailored to the norms of that platform:
- Instagram: conversational, emoji-friendly, 5-10 relevant hashtags at the end, 150-280 chars of body text
- Facebook: slightly longer and more conversational, 1-2 emoji max, no hashtags, 150-300 chars
- Google Business: short, factual, professional, no emoji, no hashtags, 100-150 chars

Respond with valid JSON only in this exact format:
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
    instagram: 'conversational, emoji-friendly, 5-10 relevant hashtags at the end, 150-280 chars of body text',
    facebook: 'slightly longer and more conversational, 1-2 emoji max, no hashtags, 150-300 chars',
    google_business: 'short, factual, professional, no emoji, no hashtags, 100-150 chars',
  }

  const prompt = `You are a social media copywriter for small service businesses.

Business: ${params.businessName}
Industry: ${params.industry}
Brand voice: ${params.brandVoice}
Post type: ${params.templateType.replace(/_/g, ' ')}
Details:
${promptDataStr}

Write a fresh ${params.platform.replace(/_/g, ' ')} caption. Style: ${platformGuides[params.platform]}

Respond with valid JSON only in this exact format:
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
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) throw new Error('FAL_API_KEY is not set')

  const templatePrompts: Record<SocialTemplateType, string> = {
    promotion: `promotional offer graphic for "${params.businessName}". Bold text overlay showing the offer: ${params.promptData.offer ?? ''}. Clean, modern design.`,
    tip: `professional tip or advice graphic for "${params.businessName}". Clean layout with tip text: ${params.promptData.tip ?? ''}. Minimal, modern style.`,
    customer_spotlight: `customer testimonial or review graphic for "${params.businessName}". Warm, trustworthy feel. Quote-style layout.`,
    behind_scenes: `behind the scenes photo-style graphic for "${params.businessName}". Authentic, candid feel showing the business in action.`,
    seasonal: `seasonal themed graphic for "${params.businessName}". ${params.promptData.season ?? 'seasonal'} theme. Festive and professional.`,
    about_business: `brand story graphic for "${params.businessName}". Professional, welcoming. Shows the business values and identity.`,
  }

  const imagePrompt = `Social media square post (1:1). ${templatePrompts[params.templateType]} No faces or people. Professional photography style. Clean white or light background. Business colors: ${params.primaryColor}.`

  // Direct REST call — more reliable than the SDK in Vercel serverless
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: imagePrompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`fal.ai ${res.status}: ${errText}`)
  }

  const data = await res.json() as { images?: { url: string }[] }
  if (!data.images || data.images.length === 0) throw new Error('fal.ai returned no images')
  return data.images[0].url
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
