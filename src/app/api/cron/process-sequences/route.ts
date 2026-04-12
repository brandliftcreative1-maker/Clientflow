import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { replaceTokens } from '@/lib/email-tokens'
import { signUnsubscribeToken } from '@/lib/unsubscribe-token'

const BATCH_SIZE = Number(process.env.CRON_BATCH_SIZE ?? 50)

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const processed: string[] = []
  const errors: { enrollmentId: string; error: string }[] = []

  // 1. Fetch due enrollments
  const { data: enrollments, error: fetchError } = await supabase
    .from('sequence_enrollments')
    .select('id, sequence_id, contact_id, account_id, current_step')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(BATCH_SIZE)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ processed: 0, errors: [] })
  }

  // 2. Batch-fetch sequences, contacts, accounts to avoid N+1
  const seqIds = Array.from(new Set(enrollments.map(e => e.sequence_id)))
  const contactIds = Array.from(new Set(enrollments.map(e => e.contact_id)))
  const accountIds = Array.from(new Set(enrollments.map(e => e.account_id)))

  const [{ data: sequences }, { data: contacts }, { data: accounts }] = await Promise.all([
    supabase.from('sequences').select('id, is_active, name').in('id', seqIds),
    supabase.from('contacts').select('id, email, first_name, status').in('id', contactIds),
    supabase.from('accounts').select('id, business_name, from_email, from_name, reply_to_email').in('id', accountIds),
  ])

  // Fetch all steps for relevant sequences
  const { data: allSteps } = await supabase
    .from('sequence_steps')
    .select('id, sequence_id, step_number, delay_days, subject, body, preview_text')
    .in('sequence_id', seqIds)
    .order('step_number', { ascending: true })

  const seqMap = Object.fromEntries((sequences ?? []).map(s => [s.id, s]))
  const contactMap = Object.fromEntries((contacts ?? []).map(c => [c.id, c]))
  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))
  const stepsMap: Record<string, typeof allSteps> = {}
  for (const step of allSteps ?? []) {
    if (!stepsMap[step.sequence_id]) stepsMap[step.sequence_id] = []
    stepsMap[step.sequence_id]!.push(step)
  }

  // 3. Process each enrollment
  for (const enrollment of enrollments) {
    const seq = seqMap[enrollment.sequence_id]
    const contact = contactMap[enrollment.contact_id]
    const account = accountMap[enrollment.account_id]
    const steps = stepsMap[enrollment.sequence_id] ?? []

    try {
      // Skip if sequence deactivated
      if (!seq?.is_active) continue

      // Cancel if contact unsubscribed
      if (contact?.status === 'unsubscribed') {
        await supabase
          .from('sequence_enrollments')
          .update({ status: 'cancelled' })
          .eq('id', enrollment.id)
        continue
      }

      if (!contact || !account) continue

      // Find current step
      const step = steps.find(s => s.step_number === enrollment.current_step)
      if (!step) continue

      // Replace tokens
      const tokenData = {
        firstName: contact.first_name,
        businessName: account.business_name,
        yourName: account.from_name,
      }
      const subject = replaceTokens(step.subject, tokenData)
      const bodyText = replaceTokens(step.body, tokenData)

      // Build unsubscribe URL
      const unsubToken = signUnsubscribeToken(contact.id, account.id)
      const unsubUrl = `${appUrl}/unsubscribe?token=${unsubToken}`

      const htmlBody = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${bodyText.split('\n').map(line => line.trim() === '' ? '<br>' : `<p style="margin:0 0 12px">${line}</p>`).join('')}
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="font-size:12px;color:#9ca3af">
          You received this email from ${account.business_name}.<br>
          <a href="${unsubUrl}" style="color:#9ca3af">Unsubscribe</a>
        </p>
      </div>`

      // Send via Resend
      const fromEmail = account.from_email ?? 'onboarding@resend.dev'
      const fromName = account.from_name ?? account.business_name
      const { data: sendData, error: sendError } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: contact.email,
        subject,
        html: htmlBody,
        ...(account.reply_to_email ? { replyTo: account.reply_to_email } : {}),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
      })

      if (sendError) throw new Error(sendError.message)

      // Log email
      await supabase.from('email_logs').insert({
        account_id: enrollment.account_id,
        contact_id: enrollment.contact_id,
        sequence_id: enrollment.sequence_id,
        sequence_step_id: step.id,
        email_type: 'sequence',
        to_email: contact.email,
        subject,
        resend_id: sendData?.id ?? null,
        status: 'sent',
      })

      // Advance enrollment
      const nextStep = steps.find(s => s.step_number === enrollment.current_step + 1)
      if (nextStep) {
        const nextSendAt = new Date(Date.now() + nextStep.delay_days * 86400 * 1000).toISOString()
        await supabase
          .from('sequence_enrollments')
          .update({ current_step: enrollment.current_step + 1, next_send_at: nextSendAt })
          .eq('id', enrollment.id)
      } else {
        await supabase
          .from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id)
      }

      // Update last_contacted_at on contact
      await supabase
        .from('contacts')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', enrollment.contact_id)

      processed.push(enrollment.id)
    } catch (err) {
      errors.push({ enrollmentId: enrollment.id, error: String(err) })
    }
  }

  // Birthday auto-enrollment check (runs on every cron call)
  await checkBirthdayEnrollments()

  return NextResponse.json({ processed: processed.length, errors })
}

async function checkBirthdayEnrollments() {
  const supabase = await createServiceClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Find contacts with today's birthday
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, account_id')
    .eq('status', 'active')
    .not('birthday', 'is', null)
    .filter('birthday', 'like', `%-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)

  if (!contacts || contacts.length === 0) return

  for (const contact of contacts) {
    const { data: sequences } = await supabase
      .from('sequences')
      .select('id')
      .eq('account_id', contact.account_id)
      .eq('trigger_type', 'birthday')
      .eq('is_active', true)
      .eq('is_template', false)

    for (const seq of sequences ?? []) {
      // Check not already enrolled this year
      const thisYear = now.getFullYear()
      const { count } = await supabase
        .from('sequence_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', contact.id)
        .eq('sequence_id', seq.id)
        .gte('enrolled_at', `${thisYear}-01-01`)

      if (!count || count === 0) {
        await supabase.from('sequence_enrollments').insert({
          sequence_id: seq.id,
          contact_id: contact.id,
          account_id: contact.account_id,
          current_step: 1,
          status: 'active',
          next_send_at: new Date().toISOString(),
        })
      }
    }
  }
}
