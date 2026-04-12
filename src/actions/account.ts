'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { BrandVoice } from '@/types'

// ---- Schemas ----

const step1Schema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  industry: z.string().min(1, 'Industry is required'),
  description: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
})

const step2Schema = z.object({
  brand_voice: z.enum(['professional', 'friendly', 'casual', 'educational', 'inspirational']),
})

const step3Schema = z.object({
  from_name: z.string().optional(),
  from_email: z.string().email('Invalid email').optional().or(z.literal('')),
  reply_to_email: z.string().email('Invalid email').optional().or(z.literal('')),
})

export interface ActionResult {
  error?: string
  success?: boolean
}

// ---- Get current account ----

export async function getAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data
}

// ---- Save Step 1 ----

export async function saveStep1(formData: FormData): Promise<ActionResult> {
  const parsed = step1Schema.safeParse({
    business_name: formData.get('business_name'),
    industry: formData.get('industry'),
    description: formData.get('description') || undefined,
    website: formData.get('website') || '',
    phone: formData.get('phone') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('accounts')
    .upsert({
      user_id: user.id,
      business_name: parsed.data.business_name,
      industry: parsed.data.industry,
      description: parsed.data.description ?? null,
      website: parsed.data.website || null,
      phone: parsed.data.phone ?? null,
    }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  return { success: true }
}

// ---- Save Step 2 ----

export async function saveStep2(formData: FormData): Promise<ActionResult> {
  const parsed = step2Schema.safeParse({
    brand_voice: formData.get('brand_voice'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('accounts')
    .update({ brand_voice: parsed.data.brand_voice })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

// ---- Save Step 3 ----

export async function saveStep3(formData: FormData): Promise<ActionResult> {
  const parsed = step3Schema.safeParse({
    from_name: formData.get('from_name') || undefined,
    from_email: formData.get('from_email') || '',
    reply_to_email: formData.get('reply_to_email') || '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('accounts')
    .update({
      from_name: parsed.data.from_name ?? null,
      from_email: parsed.data.from_email || null,
      reply_to_email: parsed.data.reply_to_email || null,
    })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

// ---- Save Step 4: Import Contacts ----

export async function importContacts(contacts: Array<{
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  segment?: string
}>): Promise<ActionResult & { imported?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!account) return { error: 'Account not found' }

  const rows = contacts
    .filter(c => c.email && z.string().email().safeParse(c.email).success)
    .map(c => ({
      account_id: account.id,
      email: c.email.toLowerCase().trim(),
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      phone: c.phone ?? null,
      segment: c.segment ?? 'lead',
    }))

  if (rows.length === 0) return { error: 'No valid email addresses found' }

  const { error, data } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'account_id,email', ignoreDuplicates: true })
    .select('id')

  if (error) return { error: error.message }
  return { success: true, imported: data?.length ?? rows.length }
}

// ---- Activate sequence template ----

export async function activateSequenceTemplate(templateId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!account) return { error: 'Account not found' }

  // Fetch template
  const { data: template } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', templateId)
    .eq('is_template', true)
    .single()

  if (!template) return { error: 'Template not found' }

  // Fetch steps separately to avoid Relationships type issues
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('sequence_id', templateId)
    .order('step_number', { ascending: true })

  // Copy sequence to account
  const { data: newSeq, error: seqErr } = await supabase
    .from('sequences')
    .insert({
      account_id: account.id,
      name: template.name,
      description: template.description,
      industry: template.industry,
      trigger_type: template.trigger_type,
      is_active: true,
      is_template: false,
    })
    .select('id')
    .single()

  if (seqErr || !newSeq) return { error: seqErr?.message ?? 'Failed to create sequence' }

  const stepsList = steps ?? []
  if (stepsList.length > 0) {
    const { error: stepsErr } = await supabase.from('sequence_steps').insert(
      stepsList.map((s) => ({
        sequence_id: newSeq.id,
        step_number: s.step_number,
        delay_days: s.delay_days,
        subject: s.subject,
        body: s.body,
        preview_text: s.preview_text,
      }))
    )
    if (stepsErr) return { error: stepsErr.message }
  }

  return { success: true }
}

// ---- Get industry sequence templates ----

export async function getIndustryTemplates(industry: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('sequences')
    .select('*, sequence_steps(count)')
    .eq('is_template', true)
    .or(`industry.eq.${industry},industry.is.null`)
    .order('created_at', { ascending: true })

  return data ?? []
}
