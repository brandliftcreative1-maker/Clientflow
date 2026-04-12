import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Mail, Send, Wand2, Plus, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

async function getDashboardData(accountId: string) {
  const supabase = await createClient()

  const [
    { count: totalContacts },
    { count: activeSequences },
    { data: recentEmails },
    { data: activeEnrollments },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'active'),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).eq('account_id', accountId).eq('is_active', true),
    supabase.from('email_logs').select('id, to_email, subject, status, sent_at, email_type').eq('account_id', accountId).order('sent_at', { ascending: false }).limit(10),
    supabase.from('sequence_enrollments').select('sequence_id, sequences(name)').eq('account_id', accountId).eq('status', 'active').limit(5),
  ])

  // Emails sent this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count: emailsSentThisMonth } = await supabase
    .from('email_logs')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('sent_at', startOfMonth.toISOString())

  return {
    totalContacts: totalContacts ?? 0,
    activeSequences: activeSequences ?? 0,
    emailsSentThisMonth: emailsSentThisMonth ?? 0,
    recentEmails: recentEmails ?? [],
    activeEnrollments: activeEnrollments ?? [],
  }
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-gray-100 text-gray-700',
  delivered: 'bg-blue-100 text-blue-700',
  opened: 'bg-green-100 text-green-700',
  clicked: 'bg-purple-100 text-purple-700',
  bounced: 'bg-red-100 text-red-700',
  complained: 'bg-orange-100 text-orange-700',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!account) redirect('/onboarding')

  const { totalContacts, activeSequences, emailsSentThisMonth, recentEmails, activeEnrollments } =
    await getDashboardData(account.id)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getTimeOfDay()}, {account.from_name?.split(' ')[0] ?? account.business_name}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with {account.business_name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Contacts</p>
                <p className="text-3xl font-bold mt-1">{totalContacts}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={22} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Sequences</p>
                <p className="text-3xl font-bold mt-1">{activeSequences}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <Mail className="text-green-600" size={22} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Emails This Month</p>
                <p className="text-3xl font-bold mt-1">{emailsSentThisMonth}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Send className="text-purple-600" size={22} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/dashboard/contacts?action=add">
              <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                <Plus size={18} />
                <span className="text-xs">Add Contact</span>
              </Button>
            </Link>
            <Link href="/dashboard/campaigns?action=new">
              <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                <Send size={18} />
                <span className="text-xs">Send Campaign</span>
              </Button>
            </Link>
            <Link href="/dashboard/reviews">
              <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1">
                <Star size={18} />
                <span className="text-xs">Request Reviews</span>
              </Button>
            </Link>
            <Link href="/dashboard/ai-writer">
              <Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                <Wand2 size={18} />
                <span className="text-xs">Write with AI</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent email activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Mail size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No emails sent yet</p>
                <Link href="/dashboard/ai-writer">
                  <Button size="sm" className="mt-3">Write your first email</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEmails.map((log: any) => (
                  <div key={log.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{log.subject}</p>
                      <p className="text-xs text-gray-400">{log.to_email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[log.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {log.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sequence health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active sequences</CardTitle>
          </CardHeader>
          <CardContent>
            {activeEnrollments.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <p className="text-sm">No active enrollments</p>
                <Link href="/dashboard/sequences">
                  <Button size="sm" variant="outline" className="mt-3">Set up sequences</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEnrollments.map((e: any) => (
                  <div key={e.sequence_id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <span className="text-sm truncate">{(e.sequences as any)?.name}</span>
                    <Badge variant="secondary" className="text-xs ml-2">active</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
