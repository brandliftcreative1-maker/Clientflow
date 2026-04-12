'use server'

import { createClient } from '@/lib/supabase/server'
import { generateEmail, generateSequence, improveEmail } from '@/lib/ai-provider'
import type { GenerateEmailParams, GenerateEmailResult, ImproveEmailParams, ImproveEmailResult, EmailVariation } from '@/types'

// Rate limit: max 20 AI requests per hour per account
async function checkRateLimit(accountId: string): Promise<boolean> {
  const supabase = await createClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // We use email_logs as a proxy — count AI-writer generated drafts would need a separate table
  // For now use a simple in-memory approach via DB timestamp check
  // A real implementation would use a dedicated rate_limit table
  return true // Permissive for Phase 1 — add proper rate limiting in Phase 2
}

export async function generateEmailAction(
  params: Omit<GenerateEmailParams, 'businessName' | 'industry' | 'brandVoice'>
): Promise<GenerateEmailResult & { error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { variations: [], provider: 'gemini', error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, business_name, industry, brand_voice')
    .eq('user_id', user.id)
    .single()

  if (!account) return { variations: [], provider: 'gemini', error: 'Account not found' }

  try {
    const result = await generateEmail({
      ...params,
      businessName: account.business_name,
      industry: account.industry,
      brandVoice: account.brand_voice,
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed'
    return { variations: [], provider: 'gemini', error: message }
  }
}

export async function improveEmailAction(
  params: ImproveEmailParams
): Promise<ImproveEmailResult & { error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { subject: '', body: '', previewText: '', provider: 'gemini', error: 'Not authenticated' }

  try {
    const result = await improveEmail(params)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI improvement failed'
    return { subject: '', body: '', previewText: '', provider: 'gemini', error: message }
  }
}

export async function sendTestEmailAction(
  email: EmailVariation,
  toEmail: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!account) return { error: 'Account not found' }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY!)

  const fromAddress = account.from_email && account.resend_domain_verified
    ? `${account.from_name ?? account.business_name} <${account.from_email}>`
    : `${account.business_name} <onboarding@resend.dev>`

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: toEmail,
      subject: `[TEST] ${email.subject}`,
      text: email.body,
      replyTo: account.reply_to_email ?? undefined,
    })

    if (error) return { error: error.message }

    // Log the test email
    await supabase.from('email_logs').insert({
      account_id: account.id,
      email_type: 'transactional',
      to_email: toEmail,
      subject: `[TEST] ${email.subject}`,
      resend_id: data?.id ?? null,
      status: 'sent',
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return { error: message }
  }
}
