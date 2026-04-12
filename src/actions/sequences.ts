'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export interface ActionResult {
  error?: string
  success?: boolean
}

// ---- Helpers ----

async function getAccountId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('accounts').select('id').eq('user_id', user.id).single()
  return data?.id ?? null
}

// ---- Sequences ----

export async function getSequences() {
  const accountId = await getAccountId()
  if (!accountId) return []

  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_template', false)
    .order('created_at', { ascending: true })

  if (!sequences || sequences.length === 0) return []

  // Step counts
  const { data: stepCounts } = await supabase
    .from('sequence_steps')
    .select('sequence_id')
    .in('sequence_id', sequences.map(s => s.id))

  // Active enrollment counts
  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('sequence_id')
    .eq('account_id', accountId)
    .eq('status', 'active')

  const stepsMap: Record<string, number> = {}
  for (const s of stepCounts ?? []) {
    stepsMap[s.sequence_id] = (stepsMap[s.sequence_id] ?? 0) + 1
  }

  const enrollMap: Record<string, number> = {}
  for (const e of enrollments ?? []) {
    enrollMap[e.sequence_id] = (enrollMap[e.sequence_id] ?? 0) + 1
  }

  return sequences.map(s => ({
    ...s,
    stepCount: stepsMap[s.id] ?? 0,
    enrolledCount: enrollMap[s.id] ?? 0,
  }))
}

export async function getSequence(id: string) {
  const accountId = await getAccountId()
  if (!accountId) return null

  const supabase = await createClient()

  const { data: sequence } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', id)
    .eq('account_id', accountId)
    .single()

  if (!sequence) return null

  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_number', { ascending: true })

  return { ...sequence, steps: steps ?? [] }
}

const sequenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  trigger_type: z.string().min(1, 'Trigger is required'),
})

export async function createSequence(formData: FormData): Promise<ActionResult & { id?: string }> {
  const parsed = sequenceSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    trigger_type: formData.get('trigger_type'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sequences')
    .insert({
      account_id: accountId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      trigger_type: parsed.data.trigger_type,
      is_active: false,
      is_template: false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { success: true, id: data.id }
}

export async function updateSequence(
  id: string,
  fields: { name?: string; description?: string | null; trigger_type?: string; is_active?: boolean }
): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sequences')
    .update(fields)
    .eq('id', id)
    .eq('account_id', accountId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteSequence(id: string): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()

  // Cancel active enrollments first
  await supabase
    .from('sequence_enrollments')
    .update({ status: 'cancelled' })
    .eq('sequence_id', id)
    .eq('account_id', accountId)
    .eq('status', 'active')

  const { error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId)

  if (error) return { error: error.message }
  return { success: true }
}

// ---- Steps ----

const stepSchema = z.object({
  delay_days: z.coerce.number().min(0).default(0),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  preview_text: z.string().optional(),
})

export async function createStep(sequenceId: string, formData: FormData): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const parsed = stepSchema.safeParse({
    delay_days: formData.get('delay_days') || 0,
    subject: formData.get('subject'),
    body: formData.get('body'),
    preview_text: formData.get('preview_text') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  // Verify sequence belongs to account
  const { data: seq } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', sequenceId)
    .eq('account_id', accountId)
    .single()
  if (!seq) return { error: 'Sequence not found' }

  // Get next step number
  const { count } = await supabase
    .from('sequence_steps')
    .select('*', { count: 'exact', head: true })
    .eq('sequence_id', sequenceId)

  const { error } = await supabase.from('sequence_steps').insert({
    sequence_id: sequenceId,
    step_number: (count ?? 0) + 1,
    delay_days: parsed.data.delay_days,
    subject: parsed.data.subject,
    body: parsed.data.body,
    preview_text: parsed.data.preview_text ?? null,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateStep(
  stepId: string,
  fields: { delay_days?: number; subject?: string; body?: string; preview_text?: string | null }
): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sequence_steps')
    .update(fields)
    .eq('id', stepId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStep(stepId: string, sequenceId: string): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('sequence_steps')
    .delete()
    .eq('id', stepId)

  if (error) return { error: error.message }

  // Renumber remaining steps
  const { data: remaining } = await supabase
    .from('sequence_steps')
    .select('id')
    .eq('sequence_id', sequenceId)
    .order('step_number', { ascending: true })

  for (let i = 0; i < (remaining ?? []).length; i++) {
    await supabase
      .from('sequence_steps')
      .update({ step_number: i + 1 })
      .eq('id', remaining![i].id)
  }

  return { success: true }
}

export async function moveStep(stepId: string, sequenceId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, step_number')
    .eq('sequence_id', sequenceId)
    .order('step_number', { ascending: true })

  if (!steps) return { error: 'Steps not found' }

  const idx = steps.findIndex(s => s.id === stepId)
  if (idx === -1) return { error: 'Step not found' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= steps.length) return { success: true }

  // Swap step numbers
  await supabase.from('sequence_steps').update({ step_number: steps[swapIdx].step_number }).eq('id', steps[idx].id)
  await supabase.from('sequence_steps').update({ step_number: steps[idx].step_number }).eq('id', steps[swapIdx].id)

  return { success: true }
}
