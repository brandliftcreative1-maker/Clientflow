'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Loader2, RefreshCw, Download, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  generatePost,
  regenerateCaption,
  regenerateImageDirect,
  savePost,
  publishPost,
  type ContentPost,
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
] as const

type TemplateType = typeof TEMPLATES[number]['type']

const TONES = ['Friendly', 'Professional', 'Exciting'] as const

const PLATFORM_CONFIG = {
  instagram: { label: 'Instagram', abbr: 'IG', bg: 'bg-pink-50', border: 'border-pink-200', badgeBg: 'bg-[#e1306c]', regenBorder: 'border-[#e1306c]', regenText: 'text-[#e1306c]' },
  facebook: { label: 'Facebook', abbr: 'FB', bg: 'bg-blue-50', border: 'border-blue-200', badgeBg: 'bg-[#1877f2]', regenBorder: 'border-[#1877f2]', regenText: 'text-[#1877f2]' },
  google_business: { label: 'Google Business', abbr: 'G', bg: 'bg-orange-50', border: 'border-orange-200', badgeBg: 'bg-[#f97316]', regenBorder: 'border-[#f97316]', regenText: 'text-[#f97316]' },
} as const

const FORM_FIELDS: Record<TemplateType, { key: string; label: string; placeholder: string }[]> = {
  promotion: [
    { key: 'offer', label: "What's the offer?", placeholder: '20% off spring cleaning' },
    { key: 'expiry', label: 'Valid until', placeholder: 'April 30th' },
  ],
  tip: [
    { key: 'tip', label: 'What tip or advice?', placeholder: 'How to keep your home clean between visits' },
  ],
  customer_spotlight: [
    { key: 'quote', label: "Customer quote or review", placeholder: '"Best service ever!" — Sarah M.' },
  ],
  behind_scenes: [
    { key: 'description', label: "What are you showing?", placeholder: 'Our team preparing for a big job' },
  ],
  seasonal: [
    { key: 'season', label: 'Season or holiday', placeholder: 'Spring, Easter, Back to School...' },
    { key: 'message', label: 'Message', placeholder: 'Wishing all our customers a happy spring!' },
  ],
  about_business: [
    { key: 'highlight', label: 'What to highlight?', placeholder: 'Family-owned for 10 years, serving the local community' },
  ],
}

// ---- Main Page ----

export default function ContentStudioPage() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  const [tone, setTone] = useState<string>('Friendly')
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

  const handleGenerate = async () => {
    if (!selectedTemplate) return
    setGenerating(true)
    setPost(null)
    try {
      const promptData = { ...formData, tone }
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
              <div key={field.key}>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">{field.label}</Label>
                <Input
                  placeholder={field.placeholder}
                  value={formData[field.key] ?? ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
              Tone <span className="font-normal normal-case">(auto-set from your brand voice)</span>
            </Label>
            <div className="flex gap-2">
              {TONES.map(t => (
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
            </div>
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
  )
}
