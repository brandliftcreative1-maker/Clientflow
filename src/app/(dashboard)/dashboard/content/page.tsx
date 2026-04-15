'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Loader2, RefreshCw, Download, Copy, Check, Sparkles, PenLine } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  generatePost,
  regenerateCaption,
  regenerateImageDirect,
  savePost,
  publishPost,
  fetchReadyContent,
  generatePostImage,
  type ContentPost,
  type ReadyPost,
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
    { key: 'quote', label: "Customer quote or review", placeholder: '"Best service ever!" — Sarah M.' },
    { key: 'result', label: 'What result did they get? (optional)', placeholder: 'Saved 3 hours a week, saw 30% more leads...' },
    { key: 'cta', label: 'Call to action (optional)', placeholder: 'Try it yourself, book a free consult...' },
  ],
  behind_scenes: [
    { key: 'description', label: "What are you showing?", placeholder: 'Our team preparing for a big job' },
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

// ---- Main Page ----

export default function ContentStudioPage() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [activeTab, setActiveTab] = useState<'recommended' | 'create'>('recommended')
  const [readyPosts, setReadyPosts] = useState<ReadyPost[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)
  const [cardPlatform, setCardPlatform] = useState<Record<number, SocialPlatform>>({ 0: 'instagram', 1: 'instagram', 2: 'instagram' })
  const [cardCopied, setCardCopied] = useState<{ index: number; platform: SocialPlatform } | null>(null)
  const [editedCaptions, setEditedCaptions] = useState<Record<number, Record<SocialPlatform, string>>>({})
  const [cardImages, setCardImages] = useState<Record<number, string | null>>({})
  const [cardImageLoading, setCardImageLoading] = useState<Record<number, boolean>>({})
  const [cardImageError, setCardImageError] = useState<Record<number, boolean>>({})
  const uploadRefs = useRef<(HTMLInputElement | null)[]>([])
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

  useEffect(() => {
    fetchReadyContent().then(result => {
      if (result.posts.length > 0) {
        setReadyPosts(result.posts)
        const initialCaptions: Record<number, Record<SocialPlatform, string>> = {}
        const initialImages: Record<number, string | null> = {}
        const initialImgLoading: Record<number, boolean> = {}
        result.posts.forEach((p, i) => {
          initialCaptions[i] = { ...p.captions }
          initialImages[i] = p.imageUrl ?? null
          initialImgLoading[i] = !!p.imageUrl
        })
        setEditedCaptions(initialCaptions)
        setCardImages(initialImages)
        setCardImageLoading(initialImgLoading)
        setCardImageError({})
      }
      setLoadingRecs(false)
    })
  }, [])

  const handleUseReadyPost = (post: ReadyPost) => {
    setSelectedTemplate(post.templateType as TemplateType)
    setFormData(post.promptData)
    setTone(post.tone)
    setActiveTab('create')
  }

  const handleRefreshRecommendations = async () => {
    setLoadingRecs(true)
    setReadyPosts([])
    setEditedCaptions({})
    setCardImages({})
    setCardImageLoading({})
    setCardImageError({})
    const result = await fetchReadyContent()
    if (result.error) toast.error(result.error)
    else {
      setReadyPosts(result.posts)
      const initialCaptions: Record<number, Record<SocialPlatform, string>> = {}
      const initialImages: Record<number, string | null> = {}
      const initialImgLoading: Record<number, boolean> = {}
      result.posts.forEach((p, i) => {
        initialCaptions[i] = { ...p.captions }
        initialImages[i] = p.imageUrl ?? null
        initialImgLoading[i] = !!p.imageUrl
      })
      setEditedCaptions(initialCaptions)
      setCardImages(initialImages)
      setCardImageLoading(initialImgLoading)
      setCardImageError({})
    }
    setLoadingRecs(false)
  }

  const handleCardNewImage = async (i: number, rp: ReadyPost) => {
    setCardImageLoading(prev => ({ ...prev, [i]: true }))
    setCardImageError(prev => ({ ...prev, [i]: false }))
    const result = await generatePostImage(rp.templateType, rp.promptData)
    if (result.error) {
      toast.error(result.error)
      setCardImageLoading(prev => ({ ...prev, [i]: false }))
    } else {
      setCardImages(prev => ({ ...prev, [i]: result.imageUrl }))
      setCardImageLoading(prev => ({ ...prev, [i]: !!result.imageUrl }))
    }
  }

  const handleCardUpload = (i: number, file: File) => {
    const url = URL.createObjectURL(file)
    setCardImages(prev => ({ ...prev, [i]: url }))
    setCardImageLoading(prev => ({ ...prev, [i]: true }))
    setCardImageError(prev => ({ ...prev, [i]: false }))
  }

  const handleCardCopy = async (index: number, platform: SocialPlatform) => {
    const text = editedCaptions[index]?.[platform] ?? ''
    await navigator.clipboard.writeText(text)
    setCardCopied({ index, platform })
    setTimeout(() => setCardCopied(null), 2000)
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) return
    setGenerating(true)
    setPost(null)
    try {
      const effectiveTone = tone === 'Custom' ? (customTone.trim() || 'Friendly') : tone
      const promptData = { ...formData, tone: effectiveTone }
      const result = await generatePost(selectedTemplate, promptData, dateParam ?? undefined)
      if (result.error) { toast.error(result.error); return }
      if (result.post) {
        setPost(result.post)
        setCaptions(result.post.captions)
        setImageLoading(!!result.post.image_url)
        setImageError(false)
        if (result.imageError) {
          toast.error(`Image failed: ${result.imageError}`, { duration: 6000 })
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerateCaption = async (platform: SocialPlatform) => {
    if (!post) return
    setRegenLoading(platform)
    try {
      const result = await regenerateCaption(post.id, platform)
      if (result.error) { toast.error(result.error); return }
      if (result.caption) {
        setCaptions(prev => ({ ...prev, [platform]: result.caption! }))
        toast.success(`${PLATFORM_CONFIG[platform].label} caption regenerated`)
      }
    } finally {
      setRegenLoading(null)
    }
  }

  const handleRegenerateImage = async () => {
    if (!post) return
    setRegenImageLoading(true)
    try {
      const result = await regenerateImageDirect(post.id, post.template_type, post.prompt_data)
      if (result.error) { toast.error(result.error); return }
      if (result.imageUrl) {
        setPost(prev => prev ? { ...prev, image_url: result.imageUrl! } : prev)
        setImageLoading(true)
        setImageError(false)
        toast.success('New image generated')
      }
    } finally {
      setRegenImageLoading(false)
    }
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
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Post saved! Copy each caption to post on your platforms.')
        setPost(prev => prev ? { ...prev, status: 'published' } : prev)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setPublishing(false)
    }
  }

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
            <CalendarDays size={16} />
            View Calendar
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('recommended')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'recommended' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles size={15} />
          Recommended for You
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <PenLine size={15} />
          Create a Post
        </button>
      </div>

      {/* Recommended Tab */}
      {activeTab === 'recommended' && (
        <div>
          {/* Section header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Your top 3 posts this week</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Fully written and ready to copy — our AI picks what will perform best for your business.
              </p>
            </div>
            <button
              onClick={handleRefreshRecommendations}
              disabled={loadingRecs}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 whitespace-nowrap mt-1"
            >
              {loadingRecs ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              New picks
            </button>
          </div>

          {loadingRecs ? (
            <div className="flex flex-col gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-2xl p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-24 h-6 bg-gray-200 rounded-full" />
                    <div className="h-5 bg-gray-200 rounded w-48" />
                  </div>
                  <div className="h-10 bg-gray-100 rounded-lg mb-4 w-full" />
                  <div className="flex gap-2 mb-3">
                    <div className="h-8 w-16 bg-gray-200 rounded-lg" />
                    <div className="h-8 w-16 bg-gray-200 rounded-lg" />
                    <div className="h-8 w-24 bg-gray-200 rounded-lg" />
                  </div>
                  <div className="h-24 bg-gray-100 rounded-lg" />
                </div>
              ))}
              <p className="text-xs text-center text-gray-400 -mt-2">Writing your posts… this takes about 10 seconds</p>
            </div>
          ) : readyPosts.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <p className="text-gray-500 text-sm mb-3">Couldn&apos;t load recommendations right now.</p>
              <button onClick={handleRefreshRecommendations} className="text-sm text-blue-600 hover:underline">Try again</button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {readyPosts.map((rp, i) => {
                const categoryStyles = {
                  timely: { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', border: 'border-amber-200', accent: 'text-amber-600 bg-amber-50' },
                  trust:  { bar: 'bg-blue-500',  badge: 'bg-blue-50 text-blue-700 border-blue-200',   border: 'border-blue-200',  accent: 'text-blue-600 bg-blue-50'  },
                  action: { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-200', accent: 'text-emerald-700 bg-emerald-50' },
                }
                const style = categoryStyles[rp.category] ?? categoryStyles.timely
                const activePlatform = cardPlatform[i] ?? 'instagram'
                const caption = editedCaptions[i]?.[activePlatform] ?? rp.captions[activePlatform]
                const isCopied = cardCopied?.index === i && cardCopied.platform === activePlatform

                const platformTabs: { key: SocialPlatform; label: string; abbr: string; color: string }[] = [
                  { key: 'instagram', label: 'Instagram', abbr: 'IG', color: 'bg-[#e1306c]' },
                  { key: 'facebook', label: 'Facebook', abbr: 'FB', color: 'bg-[#1877f2]' },
                  { key: 'google_business', label: 'Google Business', abbr: 'G', color: 'bg-[#f97316]' },
                ]

                const imgUrl = cardImages[i] ?? null
                const imgLoading = cardImageLoading[i] ?? false
                const imgError = cardImageError[i] ?? false

                return (
                  <div key={i} className={`border rounded-2xl overflow-hidden bg-white ${style.border}`}>
                    {/* Colored top bar */}
                    <div className={`h-1 ${style.bar}`} />

                    <div className="flex">
                      {/* Left: image panel */}
                      <div className="w-52 flex-shrink-0 p-4 border-r border-gray-100 flex flex-col">
                        {/* Image */}
                        <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100 mb-3 relative">
                          {imgUrl && !imgError ? (
                            <>
                              {imgLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-100 z-10">
                                  <Loader2 size={20} className="animate-spin text-gray-400" />
                                  <span className="text-xs text-gray-400">Generating…</span>
                                </div>
                              )}
                              <img
                                src={imgUrl}
                                alt="Post visual"
                                className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                                onLoad={() => setCardImageLoading(prev => ({ ...prev, [i]: false }))}
                                onError={() => { setCardImageLoading(prev => ({ ...prev, [i]: false })); setCardImageError(prev => ({ ...prev, [i]: true })) }}
                              />
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                              <span className="text-2xl">🖼️</span>
                              <span className="text-xs text-gray-400">{imgError ? 'Failed to load' : 'No image yet'}</span>
                            </div>
                          )}
                        </div>
                        {/* Image actions */}
                        <button
                          onClick={() => handleCardNewImage(i, rp)}
                          disabled={imgLoading}
                          className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-600 hover:bg-gray-50 mb-2"
                        >
                          {imgLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                          New image
                        </button>
                        <label className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                          <Download size={11} />
                          Upload your own
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={el => { uploadRefs.current[i] = el }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleCardUpload(i, f) }}
                          />
                        </label>
                      </div>

                      {/* Right: content */}
                      <div className="flex-1 p-5">
                        {/* Card header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${style.badge}`}>
                              {rp.categoryEmoji} {rp.categoryLabel}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900">{rp.headline}</h3>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2 mt-0.5">{rp.tone}</span>
                        </div>

                        {/* Why it works */}
                        <p className={`text-xs rounded-lg px-3 py-2 mb-4 leading-relaxed ${style.accent}`}>
                          💡 {rp.reason}
                        </p>

                        {/* Platform tabs */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-400 mr-1">Platform:</span>
                          {platformTabs.map(pt => (
                            <button
                              key={pt.key}
                              onClick={() => setCardPlatform(prev => ({ ...prev, [i]: pt.key }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activePlatform === pt.key
                                  ? `${pt.color} text-white shadow-sm`
                                  : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pt.abbr}
                            </button>
                          ))}
                        </div>

                        {/* Caption text (editable) */}
                        <Textarea
                          value={caption}
                          onChange={e => setEditedCaptions(prev => ({
                            ...prev,
                            [i]: { ...(prev[i] ?? rp.captions), [activePlatform]: e.target.value }
                          }))}
                          rows={activePlatform === 'google_business' ? 3 : 5}
                          className="text-sm text-gray-700 leading-relaxed resize-none bg-gray-50 border-gray-200"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-gray-400">{caption.length} chars</span>
                          <button
                            onClick={() => handleCardCopy(i, activePlatform)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                              isCopied ? 'bg-green-100 text-green-700' : 'bg-gray-900 text-white hover:bg-gray-700'
                            }`}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            {isCopied ? 'Copied!' : `Copy ${platformTabs.find(p => p.key === activePlatform)?.label}`}
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">
                            {TEMPLATES.find(t => t.type === rp.templateType)?.emoji}{' '}
                            {TEMPLATES.find(t => t.type === rp.templateType)?.label}
                          </span>
                          <button
                            onClick={() => handleUseReadyPost(rp)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <PenLine size={11} />
                            Customize &amp; edit →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Tab */}
      {activeTab === 'create' && (
      <div>
      {/* Template Picker */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {TEMPLATES.map(t => (
          <button
            key={t.type}
            onClick={() => { setSelectedTemplate(t.type); setFormData({}) }}
            className={`text-left border rounded-xl p-4 transition-all cursor-pointer ${
              selectedTemplate === t.type
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-2xl mb-2">{t.emoji}</div>
            <div className={`font-semibold text-sm mb-1 ${selectedTemplate === t.type ? 'text-blue-700' : 'text-gray-900'}`}>{t.label}</div>
            <div className="text-xs text-gray-500">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Form */}
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
                  <Textarea
                    placeholder={field.placeholder}
                    value={formData[field.key] ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <Input
                    placeholder={field.placeholder}
                    value={formData[field.key] ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mb-4">
            <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
              Tone
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    tone === t ? 'border-blue-500 text-blue-600 bg-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setTone('Custom')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  tone === 'Custom' ? 'border-blue-500 text-blue-600 bg-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                + Custom
              </button>
            </div>
            {tone === 'Custom' && (
              <Input
                className="mt-2"
                placeholder="Describe your tone (e.g. conversational but authoritative, warm and empathetic...)"
                value={customTone}
                onChange={e => setCustomTone(e.target.value)}
              />
            )}
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2">
            {generating ? <Loader2 size={16} className="animate-spin" /> : '✨'}
            {generating ? 'Generating your post...' : 'Generate post'}
          </Button>
        </div>
      )}

      {/* Generated Result */}
      {post && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
            <span className="font-semibold text-gray-900">Your post is ready ✨</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {post.status === 'published' ? '✓ Published' : 'Draft'}
            </span>
          </div>
          <div className="flex min-h-[520px]">
            {/* Left: image */}
            <div className="w-64 flex-shrink-0 p-5 border-r border-gray-100 flex flex-col">
              {post.image_url && !imageError ? (
                <div className="relative aspect-square w-full rounded-xl mb-3 overflow-hidden bg-gray-100">
                  {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100">
                      <Loader2 className="animate-spin text-gray-400" size={24} />
                      <span className="text-xs text-gray-400">Generating image…</span>
                    </div>
                  )}
                  <img
                    src={post.image_url}
                    alt="Generated post"
                    className={`aspect-square w-full object-cover rounded-xl transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => { setImageLoading(false); setImageError(true) }}
                  />
                </div>
              ) : (
                <div className="aspect-square w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl mb-3 flex flex-col items-center justify-center gap-2 text-center px-3">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-xs text-gray-500">{imageError ? 'Image failed to load' : 'No image generated'}</span>
                  <span className="text-xs text-gray-400">Click "New image" to retry</span>
                </div>
              )}
              <div className="flex gap-2 mb-3">
                <a
                  href={post.image_url ?? '#'}
                  download="post-image.png"
                  className="flex-1 border border-gray-200 rounded-lg py-1.5 text-center text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  <Download size={12} /> Download
                </a>
                <button
                  onClick={handleRegenerateImage}
                  disabled={regenImageLoading}
                  className="flex-1 border border-gray-200 rounded-lg py-1.5 text-center text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  {regenImageLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  New image
                </button>
              </div>
              {/* Google auto-post — configured in Settings */}
              <div className="mt-auto pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Google Business auto-post can be enabled in <a href="/dashboard/settings" className="text-blue-500 hover:underline">Settings</a>.</p>
              </div>
            </div>

            {/* Right: captions */}
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
                        <button
                          onClick={() => handleRegenerateCaption(platform)}
                          disabled={regenLoading === platform}
                          className={`border ${cfg.regenBorder} ${cfg.regenText} text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1 hover:opacity-80`}
                        >
                          {regenLoading === platform ? <Loader2 size={11} className="animate-spin" /> : '✨'}
                          Regenerate
                        </button>
                        <button
                          onClick={() => handleCopy(platform)}
                          className={`${cfg.badgeBg} text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1`}
                        >
                          {copied === platform ? <Check size={11} /> : <Copy size={11} />}
                          {copied === platform ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <Textarea
                        value={captions[platform]}
                        onChange={e => setCaptions(prev => ({ ...prev, [platform]: e.target.value }))}
                        className="text-xs text-gray-700 leading-relaxed resize-none border-gray-200 bg-white"
                        rows={platform === 'google_business' ? 3 : 5}
                      />
                      <div className="text-right text-xs text-gray-400 mt-1">
                        {captions[platform].length} chars
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Publish button */}
              <Button
                onClick={handlePublish}
                disabled={publishing || post.status === 'published'}
                className="w-full py-3 text-sm"
              >
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
