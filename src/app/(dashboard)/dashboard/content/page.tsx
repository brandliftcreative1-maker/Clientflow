'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Loader2, RefreshCw, Download, Copy, Check, PenLine, Calendar, Send, Trash2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  generatePost,
  regenerateCaption,
  regenerateImageDirect,
  savePost,
  publishPost,
  fetchMyPosts,
  fetchWeeklyContent,
  fetchWeekendPost,
  generatePostImage,
  scheduleReadyPost,
  publishReadyPost,
  getGoogleConnectionStatus,
  deletePost,
  type ContentPost,
  type WeeklyPost,
} from '@/actions/content'
import type { SocialPlatform } from '@/lib/ai-provider'

// ---- Constants ----

const TEMPLATES = [
  { type: 'promotion', emoji: '🎉', label: 'Promotion / Offer', desc: 'Announce a sale, discount, or special deal' },
  { type: 'tip', emoji: '💡', label: 'Tip or Advice', desc: 'Share expertise, how-to, or industry insight' },
  { type: 'customer_spotlight', emoji: '⭐', label: 'Customer Spotlight', desc: 'Share a review, testimonial, or success story' },
  { type: 'behind_scenes', emoji: '📸', label: 'Behind the Scenes', desc: 'Show your team, workspace, or process' },
  { type: 'seasonal', emoji: '🗓️', label: 'Seasonal / Holiday', desc: 'Timely posts around events and seasons' },
  { type: 'about_business', emoji: '🏢', label: 'About the Business', desc: 'Your story, values, what makes you different' },
  { type: 'custom', emoji: '✏️', label: 'Custom Post', desc: 'Write your own post idea from scratch' },
] as const

type TemplateType = typeof TEMPLATES[number]['type']

const PRESET_TONES = ['Friendly', 'Professional', 'Exciting', 'Inspirational', 'Humorous', 'Urgent'] as const

const PLATFORM_CONFIG = {
  instagram: { label: 'Instagram', abbr: 'IG', bg: 'bg-pink-50', border: 'border-pink-200', badgeBg: 'bg-[#e1306c]', regenBorder: 'border-[#e1306c]', regenText: 'text-[#e1306c]' },
  facebook: { label: 'Facebook', abbr: 'FB', bg: 'bg-blue-50', border: 'border-blue-200', badgeBg: 'bg-[#1877f2]', regenBorder: 'border-[#1877f2]', regenText: 'text-[#1877f2]' },
  google_business: { label: 'Google Business', abbr: 'G', bg: 'bg-orange-50', border: 'border-orange-200', badgeBg: 'bg-[#f97316]', regenBorder: 'border-[#f97316]', regenText: 'text-[#f97316]' },
} as const

const FORM_FIELDS: Record<TemplateType, { key: string; label: string; placeholder: string; textarea?: boolean }[]> = {
  promotion: [
    { key: 'offer', label: "What's the offer?", placeholder: '20% off spring cleaning' },
    { key: 'expiry', label: 'Valid until', placeholder: 'April 30th' },
    { key: 'audience', label: 'Who is this for? (optional)', placeholder: 'Homeowners, new customers, local residents...' },
    { key: 'cta', label: 'Call to action (optional)', placeholder: 'Call us, book online, visit our website...' },
  ],
  tip: [
    { key: 'tip', label: 'What tip or advice?', placeholder: 'How to keep your home clean between visits' },
    { key: 'audience', label: 'Who is this for? (optional)', placeholder: 'Homeowners, busy families, business owners...' },
    { key: 'extra', label: 'Anything else to include? (optional)', placeholder: 'Stats, common mistakes, step-by-step...' },
  ],
  customer_spotlight: [
    { key: 'quote', label: 'Customer quote or review', placeholder: '"Best service ever!" — Sarah M.' },
    { key: 'result', label: 'What result did they get? (optional)', placeholder: 'Saved 3 hours a week, saw 30% more leads...' },
    { key: 'cta', label: 'Call to action (optional)', placeholder: 'Try it yourself, book a free consult...' },
  ],
  behind_scenes: [
    { key: 'description', label: 'What are you showing?', placeholder: 'Our team preparing for a big job' },
    { key: 'message', label: 'Key message or takeaway (optional)', placeholder: 'We take pride in every detail...' },
  ],
  seasonal: [
    { key: 'season', label: 'Season or holiday', placeholder: 'Spring, Easter, Back to School...' },
    { key: 'message', label: 'Message', placeholder: 'Wishing all our customers a happy spring!' },
    { key: 'offer', label: 'Special offer tied to the season? (optional)', placeholder: 'Spring special — 15% off this week' },
  ],
  about_business: [
    { key: 'highlight', label: 'What to highlight?', placeholder: 'Family-owned for 10 years, serving the local community' },
    { key: 'differentiator', label: 'What makes you different? (optional)', placeholder: 'Same-day service, certified team, satisfaction guarantee...' },
    { key: 'cta', label: 'Call to action (optional)', placeholder: 'Call us today, visit our website...' },
  ],
  custom: [
    { key: 'topic', label: 'What do you want to post about?', placeholder: 'Describe your post idea in your own words...', textarea: true },
    { key: 'audience', label: 'Who is this for? (optional)', placeholder: 'Your target audience for this post' },
    { key: 'cta', label: 'Call to action (optional)', placeholder: 'What should people do after reading?' },
  ],
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-50 text-blue-700',
  published: 'bg-green-50 text-green-700',
}

const PLATFORM_TABS: { key: SocialPlatform; label: string; abbr: string; color: string }[] = [
  { key: 'instagram', label: 'Instagram', abbr: 'IG', color: 'bg-[#e1306c]' },
  { key: 'facebook', label: 'Facebook', abbr: 'FB', color: 'bg-[#1877f2]' },
  { key: 'google_business', label: 'Google Business', abbr: 'G', color: 'bg-[#f97316]' },
]

// ---- Main Page ----

export default function ContentStudioPage() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [activeTab, setActiveTab] = useState<'posts' | 'week' | 'create'>('posts')

  // My Posts state
  const [myPosts, setMyPosts] = useState<ContentPost[]>([])
  const [loadingMyPosts, setLoadingMyPosts] = useState(false)
  const [myPostsLoaded, setMyPostsLoaded] = useState(false)
  const [myPostsFilter, setMyPostsFilter] = useState<'all' | 'scheduled' | 'published' | 'draft'>('all')
  const [myPostCopied, setMyPostCopied] = useState<{ postId: string; platform: SocialPlatform } | null>(null)
  const [expandedCaption, setExpandedCaption] = useState<{ postId: string; platform: string } | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  // This Week state
  const [weeklyPosts, setWeeklyPosts] = useState<WeeklyPost[]>([])
  const [loadingWeekly, setLoadingWeekly] = useState(false)
  const [weeklyLoaded, setWeeklyLoaded] = useState(false)
  const [selectedDay, setSelectedDay] = useState<WeeklyPost['day']>('monday')
  const [weeklyImages, setWeeklyImages] = useState<Record<string, string | null>>({})
  const [weeklyImgLoading, setWeeklyImgLoading] = useState<Record<string, boolean>>({})
  const [weeklyImgError, setWeeklyImgError] = useState<Record<string, boolean>>({})
  const [weeklyImgRetries, setWeeklyImgRetries] = useState<Record<string, number>>({})
  const [weeklyPlatform, setWeeklyPlatform] = useState<Record<string, SocialPlatform>>({})
  const [weeklyCaptions, setWeeklyCaptions] = useState<Record<string, Record<SocialPlatform, string>>>({})
  const [weeklyCopied, setWeeklyCopied] = useState<{ day: string; platform: SocialPlatform } | null>(null)

  // Weekend (optional SAT/SUN) state
  const [weekendPosts, setWeekendPosts] = useState<Partial<Record<'saturday' | 'sunday', WeeklyPost>>>({})
  const [generatingWeekend, setGeneratingWeekend] = useState<Partial<Record<'saturday' | 'sunday', boolean>>>({})

  // Shared schedule + publish state (keyed by card id)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Record<string, string>>({})
  const [scheduleOpen, setScheduleOpen] = useState<Record<string, boolean>>({})
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({})
  const [scheduled, setScheduled] = useState<Record<string, string>>({})
  const [googlePublishing, setGooglePublishing] = useState<Record<string, boolean>>({})
  const [googlePosted, setGooglePosted] = useState<Record<string, boolean>>({})

  // Create tab state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  const [tone, setTone] = useState<string>('Friendly')
  const [customTone, setCustomTone] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [post, setPost] = useState<ContentPost | null>(null)
  const [captions, setCaptions] = useState<Record<SocialPlatform, string>>({ instagram: '', facebook: '', google_business: '' })
  const [regenLoading, setRegenLoading] = useState<SocialPlatform | null>(null)
  const [regenImageLoading, setRegenImageLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [copied, setCopied] = useState<SocialPlatform | null>(null)
  const [publishing, setPublishing] = useState(false)

  const todayISO = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getGoogleConnectionStatus().then(r => setGoogleConnected(r.connected))
    loadMyPosts()
  }, [])

  // ---- My Posts handlers ----

  const loadMyPosts = async () => {
    setLoadingMyPosts(true)
    const result = await fetchMyPosts()
    setMyPosts(result.posts)
    setMyPostsLoaded(true)
    setLoadingMyPosts(false)
  }

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId)
    const result = await deletePost(postId)
    if (result.error) toast.error(result.error)
    else setMyPosts(prev => prev.filter(p => p.id !== postId))
    setDeletingPostId(null)
  }

  const handleMyPostCopy = async (postId: string, platform: SocialPlatform, text: string) => {
    await navigator.clipboard.writeText(text)
    setMyPostCopied({ postId, platform })
    setTimeout(() => setMyPostCopied(null), 2000)
  }

  const filteredPosts = myPostsFilter === 'all'
    ? myPosts
    : myPosts.filter(p => p.status === myPostsFilter)

  // ---- This Week handlers ----

  const loadWeeklyContent = async () => {
    setLoadingWeekly(true)
    const result = await fetchWeeklyContent()
    if (result.error) {
      toast.error(result.error)
    } else {
      setWeeklyPosts(result.posts)
      const imgs: Record<string, string | null> = {}
      const imgLoad: Record<string, boolean> = {}
      const caps: Record<string, Record<SocialPlatform, string>> = {}
      const plat: Record<string, SocialPlatform> = {}
      result.posts.forEach(p => {
        imgs[p.day] = p.imageUrl ?? null
        imgLoad[p.day] = !!p.imageUrl
        caps[p.day] = { ...p.captions }
        plat[p.day] = 'instagram'
      })
      setWeeklyImages(imgs)
      setWeeklyImgLoading(imgLoad)
      setWeeklyCaptions(caps)
      setWeeklyPlatform(plat)
      setWeeklyImgError({})
      setWeeklyImgRetries({})
      if (result.posts.length > 0) setSelectedDay(result.posts[0].day)
      setWeeklyLoaded(true)
    }
    setLoadingWeekly(false)
  }

  const handleWeeklyNewImage = async (day: WeeklyPost['day'], wp: WeeklyPost) => {
    setWeeklyImgLoading(prev => ({ ...prev, [day]: true }))
    setWeeklyImgError(prev => ({ ...prev, [day]: false }))
    setWeeklyImgRetries(prev => ({ ...prev, [day]: 0 }))
    const result = await generatePostImage(wp.templateType, wp.promptData)
    if (result.error) { toast.error(result.error); setWeeklyImgLoading(prev => ({ ...prev, [day]: false })) }
    else { setWeeklyImages(prev => ({ ...prev, [day]: result.imageUrl })); setWeeklyImgLoading(prev => ({ ...prev, [day]: !!result.imageUrl })) }
  }

  const handleWeeklyImageError = (day: WeeklyPost['day'], wp: WeeklyPost) => {
    const retries = weeklyImgRetries[day] ?? 0
    setWeeklyImgLoading(prev => ({ ...prev, [day]: false }))
    if (retries < 2) {
      setWeeklyImgRetries(prev => ({ ...prev, [day]: retries + 1 }))
      setWeeklyImgLoading(prev => ({ ...prev, [day]: true }))
      setTimeout(() => handleWeeklyNewImage(day, wp), 1500)
    } else { setWeeklyImgError(prev => ({ ...prev, [day]: true })) }
  }

  const handleWeeklyCopy = async (day: string, platform: SocialPlatform) => {
    await navigator.clipboard.writeText(weeklyCaptions[day]?.[platform] ?? '')
    setWeeklyCopied({ day, platform })
    setTimeout(() => setWeeklyCopied(null), 2000)
  }

  const handleWeekendDayClick = async (day: 'saturday' | 'sunday') => {
    setSelectedDay(day)
    if (weekendPosts[day] || generatingWeekend[day]) return
    setGeneratingWeekend(prev => ({ ...prev, [day]: true }))
    const result = await fetchWeekendPost(day)
    if (result.error) {
      toast.error(result.error)
    } else if (result.post) {
      setWeekendPosts(prev => ({ ...prev, [day]: result.post! }))
      setWeeklyImages(prev => ({ ...prev, [day]: result.post!.imageUrl ?? null }))
      setWeeklyImgLoading(prev => ({ ...prev, [day]: !!result.post!.imageUrl }))
      setWeeklyCaptions(prev => ({ ...prev, [day]: { ...result.post!.captions } }))
      setWeeklyPlatform(prev => ({ ...prev, [day]: 'instagram' }))
      setWeeklyImgError(prev => ({ ...prev, [day]: false }))
    }
    setGeneratingWeekend(prev => ({ ...prev, [day]: false }))
  }

  // ---- Schedule + Publish ----

  const handleSchedule = async (
    cardId: string,
    params: { templateType: string; promptData: Record<string, string>; captions: Record<SocialPlatform, string>; imageUrl: string | null }
  ) => {
    const date = scheduleDate[cardId] ?? todayISO
    setScheduling(prev => ({ ...prev, [cardId]: true }))
    const result = await scheduleReadyPost({
      templateType: params.templateType,
      promptData: params.promptData,
      captions: params.captions as import('@/lib/ai-provider').SocialCaptions,
      imageUrl: params.imageUrl,
      scheduledDate: date,
    })
    setScheduling(prev => ({ ...prev, [cardId]: false }))
    if (result.error) { toast.error(result.error) }
    else {
      const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      setScheduled(prev => ({ ...prev, [cardId]: formatted }))
      setScheduleOpen(prev => ({ ...prev, [cardId]: false }))
      toast.success(`Scheduled for ${formatted}! Reminder email sent.`)
      if (myPostsLoaded) loadMyPosts()
    }
  }

  const handleGooglePublish = async (
    cardId: string,
    params: { templateType: string; promptData: Record<string, string>; captions: Record<SocialPlatform, string>; imageUrl: string | null }
  ) => {
    setGooglePublishing(prev => ({ ...prev, [cardId]: true }))
    const result = await publishReadyPost({
      templateType: params.templateType,
      promptData: params.promptData,
      captions: params.captions as import('@/lib/ai-provider').SocialCaptions,
      imageUrl: params.imageUrl,
    })
    setGooglePublishing(prev => ({ ...prev, [cardId]: false }))
    if (result.error) { toast.error(result.error) }
    else { setGooglePosted(prev => ({ ...prev, [cardId]: true })); toast.success('Posted to Google Business!') }
  }

  // ---- Card footer (Schedule + Google) — reused in This Week ----

  const renderCardFooter = (
    cardId: string,
    params: { templateType: string; promptData: Record<string, string>; captions: Record<SocialPlatform, string>; imageUrl: string | null },
    templateLabel: { emoji: string | undefined; label: string | undefined }
  ) => {
    const isScheduled = scheduled[cardId]
    const isGPosted = googlePosted[cardId]
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isScheduled ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
              <Check size={11} /> Scheduled for {isScheduled}
            </span>
          ) : scheduleOpen[cardId] ? (
            <div className="flex items-center gap-2">
              <input
                type="date" min={todayISO}
                value={scheduleDate[cardId] ?? todayISO}
                onChange={e => setScheduleDate(prev => ({ ...prev, [cardId]: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => handleSchedule(cardId, params)}
                disabled={scheduling[cardId]}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {scheduling[cardId] ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirm
              </button>
              <button onClick={() => setScheduleOpen(prev => ({ ...prev, [cardId]: false }))} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setScheduleOpen(prev => ({ ...prev, [cardId]: true }))}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <Calendar size={11} /> Schedule
            </button>
          )}
          {!scheduleOpen[cardId] && (
            isGPosted ? (
              <span className="flex items-center gap-1.5 text-xs text-orange-600 font-medium px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                <Check size={11} /> Posted to Google
              </span>
            ) : (
              <button
                onClick={() => googleConnected
                  ? handleGooglePublish(cardId, params)
                  : toast.error('Connect Google Business in Settings first.')}
                disabled={googlePublishing[cardId]}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${googleConnected ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                {googlePublishing[cardId] ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                {googleConnected ? 'Post to Google' : 'Google (not connected)'}
              </button>
            )
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{templateLabel.emoji} {templateLabel.label}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><PenLine size={10} /> Click caption to edit</span>
        </div>
      </div>
    )
  }

  // ---- Create tab handlers ----

  const handleGenerate = async () => {
    if (!selectedTemplate) return
    setGenerating(true)
    setPost(null)
    try {
      const effectiveTone = tone === 'Custom' ? (customTone.trim() || 'Friendly') : tone
      const result = await generatePost(selectedTemplate, { ...formData, tone: effectiveTone }, dateParam ?? undefined)
      if (result.error) { toast.error(result.error); return }
      if (result.post) {
        setPost(result.post)
        setCaptions(result.post.captions)
        setImageLoading(!!result.post.image_url)
        setImageError(false)
        if (result.imageError) toast.error(`Image failed: ${result.imageError}`, { duration: 6000 })
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Generation failed') }
    finally { setGenerating(false) }
  }

  const handleRegenerateCaption = async (platform: SocialPlatform) => {
    if (!post) return
    setRegenLoading(platform)
    try {
      const result = await regenerateCaption(post.id, platform)
      if (result.error) { toast.error(result.error); return }
      if (result.caption) { setCaptions(prev => ({ ...prev, [platform]: result.caption! })); toast.success(`${PLATFORM_CONFIG[platform].label} caption regenerated`) }
    } finally { setRegenLoading(null) }
  }

  const handleRegenerateImage = async () => {
    if (!post) return
    setRegenImageLoading(true)
    try {
      const result = await regenerateImageDirect(post.id, post.template_type, post.prompt_data)
      if (result.error) { toast.error(result.error); return }
      if (result.imageUrl) { setPost(prev => prev ? { ...prev, image_url: result.imageUrl! } : prev); setImageLoading(true); setImageError(false) }
    } finally { setRegenImageLoading(false) }
  }

  const handleCopy = async (platform: SocialPlatform) => {
    await navigator.clipboard.writeText(captions[platform])
    setCopied(platform)
    setTimeout(() => setCopied(null), 2000)
  }

  const handlePublish = async () => {
    if (!post) return
    setPublishing(true)
    try {
      await savePost(post.id, captions)
      const result = await publishPost(post.id, captions, false)
      if (result.error) toast.error(result.error)
      else { toast.success('Post saved! Copy each caption to post on your platforms.'); setPost(prev => prev ? { ...prev, status: 'published' } : prev) }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save post') }
    finally { setPublishing(false) }
  }

  // ---- Render ----

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Content Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate ready-to-post content for all your platforms</p>
        </div>
        <Link href="/dashboard/content/calendar">
          <Button variant="outline" className="flex items-center gap-2">
            <CalendarDays size={16} /> View Calendar
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('posts'); if (!myPostsLoaded) loadMyPosts() }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'posts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText size={15} /> My Posts
        </button>
        <button
          onClick={() => { setActiveTab('week'); if (!weeklyLoaded && !loadingWeekly) loadWeeklyContent() }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📅 This Week
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <PenLine size={15} /> Create a Post
        </button>
      </div>

      {/* ── My Posts Tab ── */}
      {activeTab === 'posts' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {(['all', 'scheduled', 'published', 'draft'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setMyPostsFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${myPostsFilter === f ? 'bg-gray-900 text-white' : 'text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {f === 'all' ? 'All Posts' : f}
                </button>
              ))}
            </div>
            <button
              onClick={loadMyPosts}
              disabled={loadingMyPosts}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              {loadingMyPosts ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>

          {loadingMyPosts ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-2xl mb-3">📝</p>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {myPostsFilter === 'all' ? 'No posts yet' : `No ${myPostsFilter} posts`}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {myPostsFilter === 'all'
                  ? 'Head to This Week or Create a Post to generate your first post.'
                  : `You don't have any ${myPostsFilter} posts.`}
              </p>
              {myPostsFilter === 'all' && (
                <button
                  onClick={() => { setActiveTab('week'); if (!weeklyLoaded && !loadingWeekly) loadWeeklyContent() }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View this week&apos;s plan →
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPosts.map(p => {
                const tmpl = TEMPLATES.find(t => t.type === p.template_type)
                const preview = (p.captions as { instagram?: string }).instagram ?? ''
                const dateLabel = p.scheduled_date
                  ? new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : null
                return (
                  <div key={p.id} className="border border-gray-100 rounded-xl p-4 bg-white hover:border-gray-200 transition-all flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <span className="text-xl">{tmpl?.emoji ?? '📄'}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}>
                          {p.status}
                        </span>
                        {dateLabel && <span className="text-xs text-gray-400">{dateLabel}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{tmpl?.emoji} {tmpl?.label}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">{preview}</p>
                      {/* Platform selector + delete */}
                      <div className="flex items-center gap-2">
                        {PLATFORM_TABS.map(pt => {
                          const isActive = expandedCaption?.postId === p.id && expandedCaption.platform === pt.key
                          const cap = (p.captions as unknown as Record<string, string>)[pt.key] ?? ''
                          return (
                            <button
                              key={pt.key}
                              disabled={!cap}
                              onClick={() =>
                                setExpandedCaption(isActive ? null : { postId: p.id, platform: pt.key })
                              }
                              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all border ${
                                isActive
                                  ? `${pt.color} text-white border-transparent`
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                              } disabled:opacity-30`}
                            >
                              {pt.abbr}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => handleDeletePost(p.id)}
                          disabled={deletingPostId === p.id}
                          className="ml-auto text-gray-300 hover:text-red-400 transition-colors p-1"
                        >
                          {deletingPostId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                      {/* Expanded caption */}
                      {expandedCaption?.postId === p.id && (() => {
                        const pt = PLATFORM_TABS.find(t => t.key === expandedCaption.platform)
                        const cap = (p.captions as unknown as Record<string, string>)[expandedCaption.platform] ?? ''
                        const isCopied = myPostCopied?.postId === p.id && myPostCopied.platform === expandedCaption.platform
                        return (
                          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 flex gap-2">
                            <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap leading-relaxed">{cap}</p>
                            <button
                              onClick={() => handleMyPostCopy(p.id, expandedCaption.platform as SocialPlatform, cap)}
                              className={`flex-shrink-0 flex items-center gap-1 self-start text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-all ${
                                isCopied
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : `${pt?.color ?? 'bg-gray-200'} text-white border-transparent hover:opacity-90`
                              }`}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── This Week Tab ── */}
      {activeTab === 'week' && (
        <div>
          {loadingWeekly ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <p className="text-sm text-gray-500">Building your week&apos;s content plan…</p>
              <p className="text-xs text-gray-400">This takes about 15 seconds</p>
            </div>
          ) : !weeklyLoaded ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-2xl mb-3">📅</p>
              <p className="text-sm font-medium text-gray-700 mb-1">Your strategic weekly content plan</p>
              <p className="text-xs text-gray-500 mb-5">5 posts across Monday–Friday, each with a different strategic purpose</p>
              <button onClick={loadWeeklyContent} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                Generate this week&apos;s plan
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500">Strategic 5-day plan — each day serves a different content purpose.</p>
                <button
                  onClick={() => { setWeeklyLoaded(false); loadWeeklyContent() }}
                  disabled={loadingWeekly}
                  className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw size={12} /> Refresh plan
                </button>
              </div>

              {/* Day selector */}
              <div className="grid grid-cols-7 gap-2 mb-6">
                {/* Weekdays */}
                {weeklyPosts.map(wp => {
                  const isSelected = selectedDay === wp.day
                  const colors: Record<string, { idle: string; active: string }> = {
                    monday:    { idle: 'border-violet-200 bg-violet-50',   active: 'border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-100' },
                    tuesday:   { idle: 'border-amber-200 bg-amber-50',     active: 'border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-100' },
                    wednesday: { idle: 'border-sky-200 bg-sky-50',         active: 'border-sky-400 bg-sky-600 text-white shadow-lg shadow-sky-100' },
                    thursday:  { idle: 'border-emerald-200 bg-emerald-50', active: 'border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-100' },
                    friday:    { idle: 'border-rose-200 bg-rose-50',       active: 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-100' },
                  }
                  const c = colors[wp.day] ?? colors.monday
                  return (
                    <button
                      key={wp.day}
                      onClick={() => setSelectedDay(wp.day)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${isSelected ? c.active : `${c.idle} hover:opacity-80`}`}
                    >
                      <span className="text-lg">{wp.pillarEmoji}</span>
                      <span className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-white' : 'text-gray-700'}`}>{wp.dayLabel.slice(0, 3)}</span>
                      <span className={`text-xs leading-tight text-center ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>{wp.pillar}</span>
                    </button>
                  )
                })}
                {/* Optional weekend days */}
                {(['saturday', 'sunday'] as const).map(day => {
                  const isSelected = selectedDay === day
                  const isLoading = generatingWeekend[day] ?? false
                  const isGenerated = !!weekendPosts[day]
                  const meta = { saturday: { abbr: 'SAT', emoji: '🎉', pillar: 'Fun & Engage' }, sunday: { abbr: 'SUN', emoji: '✨', pillar: 'Inspire & Preview' } }[day]
                  return (
                    <button
                      key={day}
                      onClick={() => handleWeekendDayClick(day)}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        isSelected && isGenerated
                          ? 'border-teal-400 bg-teal-600 text-white shadow-lg shadow-teal-100'
                          : isGenerated
                          ? 'border-teal-200 bg-teal-50 hover:opacity-80'
                          : isSelected
                          ? 'border-gray-300 bg-gray-100'
                          : 'border-dashed border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isLoading
                        ? <Loader2 size={18} className="animate-spin text-gray-400" />
                        : <span className="text-lg">{meta.emoji}</span>
                      }
                      <span className={`text-xs font-bold uppercase tracking-wide ${isSelected && isGenerated ? 'text-white' : isGenerated ? 'text-teal-700' : 'text-gray-400'}`}>
                        {meta.abbr}
                      </span>
                      <span className={`text-xs leading-tight text-center ${isSelected && isGenerated ? 'text-white/90' : isGenerated ? 'text-teal-600' : 'text-gray-400'}`}>
                        {isLoading ? 'Generating…' : isGenerated ? meta.pillar : '+ Optional'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Weekend generating state */}
              {(selectedDay === 'saturday' || selectedDay === 'sunday') && generatingWeekend[selectedDay] && (
                <div className="border border-gray-200 rounded-2xl p-12 flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-teal-400" />
                  <p className="text-sm text-gray-500">Generating your {selectedDay} post…</p>
                  <p className="text-xs text-gray-400">This takes about 10 seconds</p>
                </div>
              )}

              {/* Selected day post card */}
              {[...weeklyPosts, ...Object.values(weekendPosts).filter((wp): wp is WeeklyPost => !!wp)].filter(wp => wp.day === selectedDay).map(wp => {
                const imgUrl = weeklyImages[wp.day] ?? null
                const imgLoading = weeklyImgLoading[wp.day] ?? false
                const imgError = weeklyImgError[wp.day] ?? false
                const activePlatform = weeklyPlatform[wp.day] ?? 'instagram'
                const caption = weeklyCaptions[wp.day]?.[activePlatform] ?? wp.captions[activePlatform]
                const isCopied = weeklyCopied?.day === wp.day && weeklyCopied.platform === activePlatform
                const cardId = `week-${wp.day}`
                const dayAccent: Record<string, { bar: string; badge: string; accent: string }> = {
                  monday:    { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', accent: 'text-violet-700 bg-violet-50' },
                  tuesday:   { bar: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200',   accent: 'text-amber-700 bg-amber-50'   },
                  wednesday: { bar: 'bg-sky-500',    badge: 'bg-sky-50 text-sky-700 border-sky-200',         accent: 'text-sky-700 bg-sky-50'         },
                  thursday:  { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', accent: 'text-emerald-700 bg-emerald-50' },
                  friday:    { bar: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-700 border-rose-200',      accent: 'text-rose-700 bg-rose-50'      },
                  saturday:  { bar: 'bg-teal-500',   badge: 'bg-teal-50 text-teal-700 border-teal-200',      accent: 'text-teal-700 bg-teal-50'      },
                  sunday:    { bar: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', accent: 'text-indigo-700 bg-indigo-50' },
                }
                const style = dayAccent[wp.day] ?? dayAccent.monday
                const tmpl = TEMPLATES.find(t => t.type === wp.templateType)
                return (
                  <div key={wp.day} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                    <div className={`h-1 ${style.bar}`} />
                    <div className="flex">
                      {/* Image panel */}
                      <div className="w-52 flex-shrink-0 p-4 border-r border-gray-100 flex flex-col">
                        <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100 mb-3 relative">
                          {imgUrl && !imgError ? (
                            <>
                              {imgLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-100 z-10">
                                  <Loader2 size={20} className="animate-spin text-gray-400" />
                                  <span className="text-xs text-gray-400">{(weeklyImgRetries[wp.day] ?? 0) > 0 ? 'Retrying…' : 'Generating…'}</span>
                                </div>
                              )}
                              <img
                                src={imgUrl} alt="Post visual"
                                className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                                onLoad={() => setWeeklyImgLoading(prev => ({ ...prev, [wp.day]: false }))}
                                onError={() => handleWeeklyImageError(wp.day, wp)}
                              />
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                              <span className="text-2xl">🖼️</span>
                              <span className="text-xs text-gray-400">{imgError ? 'Failed to load' : 'No image yet'}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleWeeklyNewImage(wp.day, wp)}
                          disabled={imgLoading}
                          className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-600 hover:bg-gray-50 mb-2"
                        >
                          {imgLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} New image
                        </button>
                        <label className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                          <Download size={11} /> Upload your own
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) { const url = URL.createObjectURL(f); setWeeklyImages(prev => ({ ...prev, [wp.day]: url })); setWeeklyImgLoading(prev => ({ ...prev, [wp.day]: true })); setWeeklyImgError(prev => ({ ...prev, [wp.day]: false })) }
                          }} />
                        </label>
                      </div>

                      {/* Content panel */}
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${style.badge}`}>
                              {wp.pillarEmoji} {wp.dayLabel} · {wp.pillar}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900">{wp.headline}</h3>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{wp.tone}</span>
                        </div>
                        <p className={`text-xs rounded-lg px-3 py-2 mb-4 leading-relaxed ${style.accent}`}>💡 {wp.reason}</p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-400 mr-1">Platform:</span>
                          {PLATFORM_TABS.map(pt => (
                            <button key={pt.key}
                              onClick={() => setWeeklyPlatform(prev => ({ ...prev, [wp.day]: pt.key }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activePlatform === pt.key ? `${pt.color} text-white shadow-sm` : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >{pt.abbr}</button>
                          ))}
                        </div>
                        <Textarea
                          value={caption}
                          onChange={e => setWeeklyCaptions(prev => ({ ...prev, [wp.day]: { ...(prev[wp.day] ?? wp.captions), [activePlatform]: e.target.value } }))}
                          rows={activePlatform === 'google_business' ? 3 : 5}
                          className="text-sm text-gray-700 leading-relaxed resize-none bg-gray-50 border-gray-200"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-gray-400">{caption.length} chars</span>
                          <button
                            onClick={() => handleWeeklyCopy(wp.day, activePlatform)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${isCopied ? 'bg-green-100 text-green-700' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            {isCopied ? 'Copied!' : `Copy ${PLATFORM_TABS.find(p => p.key === activePlatform)?.label}`}
                          </button>
                        </div>
                        {renderCardFooter(cardId, { templateType: wp.templateType, promptData: wp.promptData, captions: weeklyCaptions[wp.day] ?? wp.captions, imageUrl: imgUrl }, { emoji: tmpl?.emoji, label: tmpl?.label })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Create a Post Tab ── */}
      {activeTab === 'create' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {TEMPLATES.map(t => (
              <button key={t.type}
                onClick={() => { setSelectedTemplate(t.type); setFormData({}) }}
                className={`text-left border rounded-xl p-4 transition-all cursor-pointer ${selectedTemplate === t.type ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="text-2xl mb-2">{t.emoji}</div>
                <div className={`font-semibold text-sm mb-1 ${selectedTemplate === t.type ? 'text-blue-700' : 'text-gray-900'}`}>{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>

          {selectedTemplate && (
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 mb-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">
                {TEMPLATES.find(t => t.type === selectedTemplate)?.emoji} {TEMPLATES.find(t => t.type === selectedTemplate)?.label} — Tell us a little more
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {FORM_FIELDS[selectedTemplate].map(field => (
                  <div key={field.key} className={field.textarea ? 'col-span-2' : ''}>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">{field.label}</Label>
                    {field.textarea ? (
                      <Textarea placeholder={field.placeholder} value={formData[field.key] ?? ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))} rows={3} className="resize-none" />
                    ) : (
                      <Input placeholder={field.placeholder} value={formData[field.key] ?? ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${tone === t ? 'border-blue-500 text-blue-600 bg-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >{t}</button>
                  ))}
                  <button onClick={() => setTone('Custom')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${tone === 'Custom' ? 'border-blue-500 text-blue-600 bg-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >+ Custom</button>
                </div>
                {tone === 'Custom' && (
                  <Input className="mt-2" placeholder="Describe your tone (e.g. conversational but authoritative...)" value={customTone} onChange={e => setCustomTone(e.target.value)} />
                )}
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2">
                {generating ? <Loader2 size={16} className="animate-spin" /> : '✨'}
                {generating ? 'Generating your post...' : 'Generate post'}
              </Button>
            </div>
          )}

          {post && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                <span className="font-semibold text-gray-900">Your post is ready ✨</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {post.status === 'published' ? '✓ Published' : 'Draft'}
                </span>
              </div>
              <div className="flex min-h-[520px]">
                <div className="w-64 flex-shrink-0 p-5 border-r border-gray-100 flex flex-col">
                  {post.image_url && !imageError ? (
                    <div className="relative aspect-square w-full rounded-xl mb-3 overflow-hidden bg-gray-100">
                      {imageLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100">
                          <Loader2 className="animate-spin text-gray-400" size={24} />
                          <span className="text-xs text-gray-400">Generating image…</span>
                        </div>
                      )}
                      <img src={post.image_url} alt="Generated post"
                        className={`aspect-square w-full object-cover rounded-xl transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setImageLoading(false)}
                        onError={() => { setImageLoading(false); setImageError(true) }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl mb-3 flex flex-col items-center justify-center gap-2 text-center px-3">
                      <span className="text-2xl">🖼️</span>
                      <span className="text-xs text-gray-500">{imageError ? 'Image failed to load' : 'No image generated'}</span>
                      <span className="text-xs text-gray-400">Click &quot;New image&quot; to retry</span>
                    </div>
                  )}
                  <div className="flex gap-2 mb-3">
                    <a href={post.image_url ?? '#'} download="post-image.png"
                      className="flex-1 border border-gray-200 rounded-lg py-1.5 text-center text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1">
                      <Download size={12} /> Download
                    </a>
                    <button onClick={handleRegenerateImage} disabled={regenImageLoading}
                      className="flex-1 border border-gray-200 rounded-lg py-1.5 text-center text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1">
                      {regenImageLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} New image
                    </button>
                  </div>
                  <div className="mt-auto pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Google Business auto-post can be enabled in <a href="/dashboard/settings" className="text-blue-500 hover:underline">Settings</a>.</p>
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                  {(Object.keys(PLATFORM_CONFIG) as SocialPlatform[]).map(platform => {
                    const cfg = PLATFORM_CONFIG[platform]
                    return (
                      <div key={platform} className={`border rounded-xl overflow-hidden ${cfg.border}`}>
                        <div className={`${cfg.bg} px-4 py-2.5 flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <span className={`${cfg.badgeBg} text-white text-xs px-2 py-0.5 rounded font-semibold`}>{cfg.abbr}</span>
                            <span className="text-sm font-semibold text-gray-900">{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleRegenerateCaption(platform)} disabled={regenLoading === platform}
                              className={`border ${cfg.regenBorder} ${cfg.regenText} text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1 hover:opacity-80`}>
                              {regenLoading === platform ? <Loader2 size={11} className="animate-spin" /> : '✨'} Regenerate
                            </button>
                            <button onClick={() => handleCopy(platform)}
                              className={`${cfg.badgeBg} text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1`}>
                              {copied === platform ? <Check size={11} /> : <Copy size={11} />}
                              {copied === platform ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <Textarea value={captions[platform]} onChange={e => setCaptions(prev => ({ ...prev, [platform]: e.target.value }))}
                            className="text-xs text-gray-700 leading-relaxed resize-none border-gray-200 bg-white" rows={platform === 'google_business' ? 3 : 5} />
                          <div className="text-right text-xs text-gray-400 mt-1">{captions[platform].length} chars</div>
                        </div>
                      </div>
                    )
                  })}
                  <Button onClick={handlePublish} disabled={publishing || post.status === 'published'} className="w-full py-3 text-sm">
                    {publishing ? <Loader2 size={16} className="animate-spin mr-2" /> : '🚀 '}
                    {post.status === 'published' ? 'Published' : publishing ? 'Publishing...' : 'Publish — Post to Google Business + Copy others'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
