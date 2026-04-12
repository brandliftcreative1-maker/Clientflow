'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, getDaysInMonth, startOfMonth, getDay, isToday, isPast, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Download, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import {
  getCalendarPosts,
  getCadenceSettings,
  deletePost,
  duplicatePost,
  type ContentPost,
  type CadenceSettings,
} from '@/actions/content'
import type { SocialCaptions, SocialPlatform } from '@/lib/ai-provider'

// ---- Platform config ----

const PLATFORM_CONFIG: Record<SocialPlatform, { label: string; abbr: string; dot: string; badgeBg: string; rowBg: string; rowBorder: string }> = {
  instagram: { label: 'Instagram', abbr: 'IG', dot: 'bg-[#e1306c]', badgeBg: 'bg-[#e1306c]', rowBg: 'bg-pink-50', rowBorder: 'border-pink-200' },
  facebook: { label: 'Facebook', abbr: 'FB', dot: 'bg-[#1877f2]', badgeBg: 'bg-[#1877f2]', rowBg: 'bg-blue-50', rowBorder: 'border-blue-200' },
  google_business: { label: 'Google Business', abbr: 'G', dot: 'bg-[#f97316]', badgeBg: 'bg-[#f97316]', rowBg: 'bg-orange-50', rowBorder: 'border-orange-200' },
}

const PLATFORMS = Object.keys(PLATFORM_CONFIG) as SocialPlatform[]

// ---- Calendar pill helpers ----

function getPostsForDay(posts: ContentPost[], dateStr: string): ContentPost[] {
  return posts.filter(p => p.scheduled_date === dateStr)
}

function getSuggestedPlatformsForDay(
  dateStr: string,
  posts: ContentPost[],
  cadence: CadenceSettings,
  today: Date
): SocialPlatform[] {
  const date = parseISO(dateStr)
  if (isPast(date) && !isToday(date)) return []
  const dow = getDay(date) // 0=Sun ... 6=Sat
  const dayPosts = getPostsForDay(posts, dateStr)
  return PLATFORMS.filter(platform => {
    if (!cadence.preferred_days[platform].includes(dow)) return false
    return !dayPosts.some(p => p.template_type) // simple: show suggested if no post exists
  })
}

export default function ContentCalendarPage() {
  const router = useRouter()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [cadence, setCadence] = useState<CadenceSettings | null>(null)
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [postsData, cadenceData] = await Promise.all([
      getCalendarPosts(month, year),
      getCadenceSettings(),
    ])
    setPosts(postsData)
    setCadence(cadenceData)
    setLoading(false)
  }, [month, year])

  useEffect(() => { loadData() }, [loadData])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(new Date(year, month))
  const firstDow = getDay(startOfMonth(new Date(year, month))) // 0=Sun
  const todayStr = format(today, 'yyyy-MM-dd')

  const published = posts.filter(p => p.status === 'published').length
  const drafts = posts.filter(p => p.status === 'draft').length
  const scheduled = posts.length

  const handleDelete = async (postId: string) => {
    await deletePost(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    setSelectedPost(null)
    toast.success('Post deleted')
  }

  const handleDuplicate = async (postId: string) => {
    const result = await duplicatePost(postId)
    if (result.error) { toast.error(result.error); return }
    toast.success('Post duplicated as draft')
    loadData()
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(year, month), 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
          <Link href="/dashboard/content">
            <Button className="flex items-center gap-2"><Plus size={16} /> New post</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          {/* Legend */}
          <div className="flex gap-4 mb-3 text-xs text-gray-500 flex-wrap">
            {PLATFORMS.map(p => (
              <span key={p} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${PLATFORM_CONFIG[p].dot} inline-block`} />
                {PLATFORM_CONFIG[p].label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Published</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Draft</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-400 inline-block" /> Suggested</span>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty offset cells */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 rounded-md bg-gray-50 border border-gray-100" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayPosts = getPostsForDay(posts, dateStr)
              const isCurrentDay = dateStr === todayStr
              const suggestedPlatforms = cadence ? getSuggestedPlatformsForDay(dateStr, posts, cadence, today) : []
              const isPastDay = !isCurrentDay && new Date(dateStr) < today

              return (
                <div
                  key={dateStr}
                  className={`h-24 rounded-md border overflow-hidden flex flex-col p-1.5 ${
                    isCurrentDay
                      ? 'border-amber-400 bg-amber-50'
                      : isPastDay
                      ? 'border-gray-100 bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 ${isCurrentDay ? 'text-amber-600' : isPastDay ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isCurrentDay ? `${day} · Today` : day}
                  </div>

                  {/* Existing posts */}
                  {dayPosts.slice(0, 2).map(post => (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`w-full text-left mb-0.5 rounded px-1.5 py-0.5 text-xs truncate flex items-center gap-1 ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${PLATFORM_CONFIG[PLATFORMS[0]].dot}`} />
                      {post.template_type.replace(/_/g, ' ')}
                    </button>
                  ))}
                  {dayPosts.length > 2 && (
                    <button
                      onClick={() => setSelectedPost(dayPosts[2])}
                      className="text-xs text-gray-400 pl-1"
                    >
                      +{dayPosts.length - 2} more
                    </button>
                  )}

                  {/* Suggested slots */}
                  {dayPosts.length === 0 && suggestedPlatforms.slice(0, 2).map(platform => (
                    <Link
                      key={platform}
                      href={`/dashboard/content?date=${dateStr}`}
                      className="w-full mb-0.5 rounded px-1.5 py-0.5 text-xs border border-dashed border-gray-300 text-gray-400 flex items-center gap-1 hover:border-blue-300 hover:text-blue-500"
                    >
                      <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${PLATFORM_CONFIG[platform].dot}`} />
                      {isCurrentDay ? '✨ Create' : 'Suggested'}
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Summary strip */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Scheduled', value: scheduled, color: 'text-gray-900' },
              { label: 'Published', value: published, color: 'text-green-600' },
              { label: 'Drafts', value: drafts, color: 'text-amber-600' },
              { label: 'On-track', value: scheduled > 0 ? `${Math.round((published / scheduled) * 100)}%` : '—', color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="border border-gray-200 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Post detail panel */}
        {selectedPost && (
          <div className="w-72 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {selectedPost.scheduled_date && format(parseISO(selectedPost.scheduled_date), 'MMM d')} — {selectedPost.template_type.replace(/_/g, ' ')}
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-4 flex-1">
              {/* Image */}
              {selectedPost.image_url && (
                <div className="relative">
                  <img src={selectedPost.image_url} alt="Post image" className="w-full aspect-square object-cover rounded-xl" />
                  <a
                    href={selectedPost.image_url}
                    download="post-image.png"
                    className="absolute bottom-2 right-2 bg-black/40 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Download size={11} /> Download
                  </a>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedPost.status === 'published' ? 'bg-green-500' : 'bg-amber-400'}`} />
                  <span className="text-sm font-medium text-gray-700 capitalize">{selectedPost.status}</span>
                </div>
                <Link href={`/dashboard/content`} className="text-xs text-blue-600 hover:underline">Edit</Link>
              </div>

              {/* Platform rows */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Platforms</div>
                <div className="flex flex-col gap-1.5">
                  {PLATFORMS.map(platform => {
                    const cfg = PLATFORM_CONFIG[platform]
                    const isPosted = platform === 'google_business' ? !!selectedPost.google_posted_at : selectedPost.status === 'published'
                    return (
                      <div key={platform} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cfg.rowBg} ${cfg.rowBorder}`}>
                        <div className="flex items-center gap-2">
                          <span className={`${cfg.badgeBg} text-white text-xs px-1.5 py-0.5 rounded font-semibold`}>{cfg.abbr}</span>
                          <span className="text-xs text-gray-700">{cfg.label}</span>
                        </div>
                        <span className={`text-xs font-medium ${isPosted ? 'text-green-600' : 'text-gray-400'}`}>
                          {isPosted ? (platform === 'google_business' && selectedPost.google_posted_at ? '✓ Auto-posted' : '✓ Published') : 'Pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Caption preview */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Instagram Caption</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 leading-relaxed max-h-24 overflow-hidden relative">
                  {(selectedPost.captions as SocialCaptions).instagram}
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50" />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText((selectedPost.captions as SocialCaptions).instagram)
                    toast.success('Caption copied')
                  }}
                  className="text-xs text-blue-600 mt-1 flex items-center gap-1 hover:underline"
                >
                  <Copy size={11} /> Copy caption
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleDuplicate(selectedPost.id)}
                  className="flex-1 border border-gray-200 rounded-lg py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => handleDelete(selectedPost.id)}
                  className="flex-1 border border-red-200 rounded-lg py-2 text-xs text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
