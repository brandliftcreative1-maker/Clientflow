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
