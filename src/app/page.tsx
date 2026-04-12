import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()
    redirect(account ? '/dashboard' : '/onboarding')
  }

  redirect('/login')
}
