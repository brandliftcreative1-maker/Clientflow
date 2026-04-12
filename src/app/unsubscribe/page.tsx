import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'
import { createServiceClient } from '@/lib/supabase/server'

interface Props {
  searchParams: { token?: string }
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const token = searchParams.token

  if (!token) {
    return <UnsubscribeLayout status="invalid" message="This unsubscribe link is invalid." />
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return <UnsubscribeLayout status="invalid" message="This unsubscribe link is invalid or has been tampered with." />
  }

  const supabase = await createServiceClient()

  // Fetch contact + account name
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, status')
    .eq('id', payload.contactId)
    .eq('account_id', payload.accountId)
    .single()

  if (!contact) {
    return <UnsubscribeLayout status="invalid" message="Contact not found." />
  }

  if (contact.status === 'unsubscribed') {
    return <UnsubscribeLayout status="already" message="You've already been unsubscribed." />
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('business_name')
    .eq('id', payload.accountId)
    .single()

  // Mark contact as unsubscribed
  await supabase
    .from('contacts')
    .update({ status: 'unsubscribed' })
    .eq('id', payload.contactId)

  // Cancel all active enrollments
  await supabase
    .from('sequence_enrollments')
    .update({ status: 'cancelled' })
    .eq('contact_id', payload.contactId)
    .eq('status', 'active')

  const businessName = account?.business_name ?? 'this business'

  return (
    <UnsubscribeLayout
      status="success"
      message={`You've been unsubscribed from emails from ${businessName}.`}
    />
  )
}

function UnsubscribeLayout({ status, message }: { status: 'success' | 'already' | 'invalid'; message: string }) {
  const icon = status === 'success' ? '✅' : status === 'already' ? 'ℹ️' : '⚠️'
  const title = status === 'success'
    ? 'Unsubscribed'
    : status === 'already'
    ? 'Already unsubscribed'
    : 'Invalid link'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md w-full">
        <div className="text-4xl mb-4">{icon}</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 text-sm">{message}</p>
        {status === 'success' && (
          <p className="text-gray-400 text-xs mt-4">
            You won't receive any more emails. If this was a mistake, contact the business directly.
          </p>
        )}
      </div>
    </div>
  )
}
