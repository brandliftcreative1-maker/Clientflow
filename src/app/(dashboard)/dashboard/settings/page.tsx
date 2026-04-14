'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import {
  getCadenceSettings,
  saveCadenceSettings,
  getGoogleAuthUrl,
  disconnectGoogle,
  type CadenceSettings,
} from '@/actions/content'
import { createClient } from '@/lib/supabase/client'

const PLATFORMS = [
  { key: 'instagram' as const, label: 'Instagram', color: 'bg-[#e1306c]', abbr: 'IG' },
  { key: 'facebook' as const, label: 'Facebook', color: 'bg-[#1877f2]', abbr: 'FB' },
  { key: 'google_business' as const, label: 'Google Business', color: 'bg-[#f97316]', abbr: 'G' },
]

const REMINDER_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard nudge', desc: "Show 'Time to post!' card when you're due" },
  { value: 'email', label: 'Email reminder', desc: 'Send an email on your posting days' },
  { value: 'pre_generate', label: 'Pre-generate drafts', desc: 'Auto-generate a draft post — just review and publish' },
]

const FREQ_KEYS = {
  instagram: 'instagram_per_week' as const,
  facebook: 'facebook_per_week' as const,
  google_business: 'google_per_week' as const,
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const googleParam = searchParams.get('google')
  const googleReason = searchParams.get('reason')

  const [cadence, setCadence] = useState<CadenceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(true)

  useEffect(() => {
    if (googleParam === 'connected') toast.success('Google Business connected!')
    if (googleParam === 'error') {
      toast.error(`Google connection failed${googleReason ? `: ${googleReason}` : ''}. Try again.`, { duration: 10000 })
    }
  }, [googleParam, googleReason])

  useEffect(() => {
    getCadenceSettings().then(setCadence)

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoadingGoogle(false); return }
      const { data } = await supabase
        .from('accounts')
        .select('google_refresh_token')
        .eq('user_id', user.id)
        .single()
      setGoogleConnected(!!(data as { google_refresh_token: string | null } | null)?.google_refresh_token)
      setLoadingGoogle(false)
    })
  }, [])

  const handleFreqChange = (platform: 'instagram' | 'facebook' | 'google_business', delta: number) => {
    if (!cadence) return
    const key = FREQ_KEYS[platform]
    const newVal = Math.max(0, Math.min(7, cadence[key] + delta))
    setCadence(prev => prev ? { ...prev, [key]: newVal } : prev)
  }

  const handleSave = async () => {
    if (!cadence) return
    setSaving(true)
    const { error } = await saveCadenceSettings(cadence)
    setSaving(false)
    if (error) toast.error(error)
    else toast.success('Preferences saved')
  }

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    const url = await getGoogleAuthUrl()
    window.location.href = url
  }

  const handleDisconnectGoogle = async () => {
    const { error } = await disconnectGoogle()
    if (error) toast.error(error)
    else { setGoogleConnected(false); toast.success('Google Business disconnected') }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your integrations and content preferences</p>
      </div>

      {/* Google Business */}
      <section className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Google Business Profile</h2>
          <p className="text-xs text-gray-500 mt-0.5">Connect to enable auto-posting directly to your Google Business page</p>
        </div>
        <div className="px-5 py-4">
          {loadingGoogle ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : googleConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-700">Connected</span>
                <span className="text-xs text-gray-400">Auto-posting is enabled</span>
              </div>
              <button onClick={handleDisconnectGoogle} className="text-xs text-red-500 hover:underline">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-gray-300" />
                <span className="text-sm text-gray-500">Not connected</span>
              </div>
              <Button onClick={handleConnectGoogle} disabled={connectingGoogle} size="sm" className="flex items-center gap-2">
                {connectingGoogle && <Loader2 size={14} className="animate-spin" />}
                Connect Google Business
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Posting Cadence */}
      <section className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Posting Preferences</h2>
          <p className="text-xs text-gray-500 mt-0.5">How often you want to post on each platform</p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-6">
          {cadence ? (
            <>
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Posts per week</Label>
                <div className="flex flex-col gap-3">
                  {PLATFORMS.map(({ key, label, color, abbr }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`${color} text-white text-xs px-2 py-0.5 rounded font-semibold`}>{abbr}</span>
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleFreqChange(key, -1)} className="border border-gray-200 rounded-md px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-50">−</button>
                        <span className="text-sm font-semibold text-gray-900 w-20 text-center">{cadence[FREQ_KEYS[key]]}× / week</span>
                        <button onClick={() => handleFreqChange(key, 1)} className="border border-gray-200 rounded-md px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-50">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">How to remind you</Label>
                <div className="flex flex-col gap-3">
                  {REMINDER_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="reminder"
                        value={opt.value}
                        checked={cadence.reminder_type === opt.value}
                        onChange={() => setCadence(prev => prev ? { ...prev, reminder_type: opt.value } : prev)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-fit flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save preferences
              </Button>
            </>
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
