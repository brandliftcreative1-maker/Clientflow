'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ContactSegment } from '@/types'

const contactSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  segment: z.enum(['lead', 'new_customer', 'repeat_customer', 'vip', 'cold', 'lost']).default('lead'),
  tags: z.string().optional(),
})

export interface ContactResult {
  error?: string
  success?: boolean
}

async function getAccountId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('accounts').select('id').eq('user_id', user.id).single()
  return data?.id ?? null
}

export async function addContact(formData: FormData): Promise<ContactResult> {
  const parsed = contactSchema.safeParse({
    email: formData.get('email'),
    first_name: formData.get('first_name') || undefined,
    last_name: formData.get('last_name') || undefined,
    phone: formData.get('phone') || undefined,
    birthday: formData.get('birthday') || undefined,
    segment: formData.get('segment') || 'lead',
    tags: formData.get('tags') || undefined,
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const tags = parsed.data.tags
    ? parsed.data.tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const { data: contact, error } = await supabase.from('contacts').upsert({
    account_id: accountId,
    email: parsed.data.email.toLowerCase().trim(),
    first_name: parsed.data.first_name ?? null,
    last_name: parsed.data.last_name ?? null,
    phone: parsed.data.phone ?? null,
    birthday: parsed.data.birthday ?? null,
    segment: parsed.data.segment,
    tags: tags.length > 0 ? tags : null,
  }, { onConflict: 'account_id,email' }).select('id').single()

  if (error) return { error: error.message }

  // Auto-enroll in any active 'new_contact' sequences
  if (contact?.id) {
    const { autoEnrollContact } = await import('@/actions/enrollment')
    await autoEnrollContact(contact.id, accountId, 'new_contact')
  }

  return { success: true }
}

export async function updateContactSegment(
  contactId: string,
  segment: ContactSegment
): Promise<ContactResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ segment })
    .eq('id', contactId)
    .eq('account_id', accountId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function addTagToContacts(
  contactIds: string[],
  tag: string
): Promise<ContactResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()

  // Fetch existing tags for each contact and append
  for (const id of contactIds) {
    const { data } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()

    const existingTags = data?.tags ?? []
    if (!existingTags.includes(tag)) {
      await supabase
        .from('contacts')
        .update({ tags: [...existingTags, tag] })
        .eq('id', id)
        .eq('account_id', accountId)
    }
  }

  return { success: true }
}

export async function deleteContact(contactId: string): Promise<ContactResult> {
  const accountId = await getAccountId()
  if (!accountId) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('account_id', accountId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getContacts(params: {
  search?: string
  segment?: string
  tag?: string
  page?: number
  pageSize?: number
}) {
  const accountId = await getAccountId()
  if (!accountId) return { contacts: [], total: 0 }

  const supabase = await createClient()
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.search) {
    query = query.or(`email.ilike.%${params.search}%,first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%`)
  }
  if (params.segment) {
    query = query.eq('segment', params.segment)
  }
  if (params.tag) {
    query = query.contains('tags', [params.tag])
  }

  const { data, count, error } = await query
  if (error) return { contacts: [], total: 0 }
  return { contacts: data ?? [], total: count ?? 0 }
}
