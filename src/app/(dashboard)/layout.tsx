import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import { Toaster } from 'react-hot-toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Redirect to onboarding if account not set up
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!account) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <Toaster position="top-right" />
    </div>
  )
}
