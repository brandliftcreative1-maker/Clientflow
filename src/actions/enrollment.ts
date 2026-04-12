'use server'

import { createClient } from '@/lib/supabase/server'

export interface EnrollResult {
  error?: string
  success?: boolean
  enrolled?: number
  skipped?: number
}

async function getAccountId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('accounts').select('id').eq('user_id', user.id).single()
  return data?.id ?? null
}

// Enroll one or more contacts into a sequence.
// Skips contacts already actively enrolled. Skips unsubscribed contacts.
export async function enrollContacts(contactIds: string[], sequenceId: string): Promise<EnrollResult> {
  if (contactIds.length === 0) return { error: 'No contacts provided' }

  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()

  // Verify sequence belongs to this account
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', sequenceId)
    .eq('account_id', accountId)
    .single()
  if (!sequence) return { error: 'Sequence not found' }

  // Get first step delay to compute next_send_at
  const { data: firstStep } = await supabase
    .from('sequence_steps')
    .select('delay_days')
    .eq('sequence_id', sequenceId)
    .order('step_number', { ascending: true })
    .limit(1)
    .single()

  const delayDays = firstStep?.delay_days ?? 0
  const nextSendAt = new Date(Date.now() + delayDays * 86400 * 1000).toISOString()

  // Find contacts already actively enrolled
  const { data: existing } = await supabase
    .from('sequence_enrollments')
    .select('contact_id')
    .eq('sequence_id', sequenceId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .in('contact_id', contactIds)

  const alreadyEnrolled = new Set((existing ?? []).map(e => e.contact_id))

  // Find unsubscribed contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, status')
    .in('id', contactIds)
    .eq('account_id', accountId)

  const unsubscribed = new Set(
    (contacts ?? []).filter(c => c.status === 'unsubscribed').map(c => c.id)
  )

  const toEnroll = contactIds.filter(id => !alreadyEnrolled.has(id) && !unsubscribed.has(id))

  if (toEnroll.length === 0) {
    return { success: true, enrolled: 0, skipped: contactIds.length }
  }

  const rows = toEnroll.map(contactId => ({
    sequence_id: sequenceId,
    contact_id: contactId,
    account_id: accountId,
    current_step: 1,
    status: 'active',
    next_send_at: nextSendAt,
  }))

  const { error } = await supabase.from('sequence_enrollments').insert(rows)
  if (error) return { error: error.message }

  return {
    success: true,
    enrolled: toEnroll.length,
    skipped: contactIds.length - toEnroll.length,
  }
}

// Auto-enroll a single contact into all active sequences matching a trigger type.
// Used by addContact (trigger: 'new_contact') and the birthday cron check.
export async function autoEnrollContact(
  contactId: string,
  accountId: string,
  triggerType: string
): Promise<void> {
  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select('id')
    .eq('account_id', accountId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)
    .eq('is_template', false)

  for (const seq of sequences ?? []) {
    await enrollContacts([contactId], seq.id)
  }
}

// Get active enrollments for a contact (for display on contacts page)
export async function getEnrollmentsForContact(contactId: string) {
  const accountId = await getAccountId()
  if (!accountId) return []

  const supabase = await createClient()

  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('id, sequence_id, current_step, status, next_send_at')
    .eq('contact_id', contactId)
    .eq('account_id', accountId)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) return []

  const seqIds = enrollments.map(e => e.sequence_id)
  const { data: sequences } = await supabase
    .from('sequences')
    .select('id, name')
    .in('id', seqIds)

  const { data: stepCounts } = await supabase
    .from('sequence_steps')
    .select('sequence_id')
    .in('sequence_id', seqIds)

  const nameMap = Object.fromEntries((sequences ?? []).map(s => [s.id, s.name]))
  const countMap: Record<string, number> = {}
  for (const s of stepCounts ?? []) {
    countMap[s.sequence_id] = (countMap[s.sequence_id] ?? 0) + 1
  }

  return enrollments.map(e => ({
    ...e,
    sequenceName: nameMap[e.sequence_id] ?? 'Unknown',
    totalSteps: countMap[e.sequence_id] ?? 0,
  }))
}

// Get all active sequences for the account (used in enroll dropdown and fire trigger)
export async function getActiveSequences() {
  const accountId = await getAccountId()
  if (!accountId) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('sequences')
    .select('id, name, trigger_type')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .eq('is_template', false)
    .order('name', { ascending: true })

  return data ?? []
}
