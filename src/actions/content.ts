'use server'

import { createClient } from '@/lib/supabase/server'
import {
  generateSocialCaptions,
  generateSocialImage,
  regeneratePlatformCaption,
  getPostRecommendations,
  getReadyToPostContent,
  type SocialCaptions,
  type SocialPlatform,
  type SocialTemplateType,
  type PostRecommendation,
  type ReadyPost,
} from '@/lib/ai-provider'

export type { PostRecommendation, ReadyPost }

// ---- Helpers ----

async function getAccountAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, account: null, supabase }
  const { data: account } = await supabase
    .from('accounts')
    .select('id, business_name, industry, description, brand_voice, primary_color, google_refresh_token, google_location_name')
    .eq('user_id', user.id)
    .maybeSingle()
  return { user, account, supabase }
}

// ---- Types ----

export interface ContentPost {
  id: string
  account_id: string
  template_type: string
  prompt_data: Record<string, string>
  image_url: string | null
  captions: SocialCaptions
  status: string
  scheduled_date: string | null
  google_posted_at: string | null
  created_at: string
}

export interface CadenceSettings {
  instagram_per_week: number
  facebook_per_week: number
  google_per_week: number
  reminder_type: string
  preferred_days: {
    instagram: number[]
    facebook: number[]
    google_business: number[]
  }
}

// ---- Recommendations ----

export async function fetchRecommendations(): Promise<{ recommendations: PostRecommendation[]; error?: string }> {
  const { user, account } = await getAccountAndUser()
  if (!user || !account) return { recommendations: [], error: 'Not authenticated' }

  try {
    const recommendations = await getPostRecommendations({
      businessName: account.business_name,
      industry: account.industry,
      description: (account as { description?: string | null }).description ?? null,
      brandVoice: account.brand_voice,
    })
    return { recommendations }
  } catch (err) {
    return { recommendations: [], error: err instanceof Error ? err.message : 'Failed to generate recommendations' }
  }
}

// ---- Ready-to-Post Content (3 fully-written posts) ----

export async function fetchReadyContent(): Promise<{ posts: ReadyPost[]; error?: string }> {
  const { user, account } = await getAccountAndUser()
  if (!user || !account) return { posts: [], error: 'Not authenticated' }

  try {
    const posts = await getReadyToPostContent({
      businessName: account.business_name,
      industry: account.industry,
      description: (account as { description?: string | null }).description ?? null,
      brandVoice: account.brand_voice,
    })
    return { posts }
  } catch (err) {
    return { posts: [], error: err instanceof Error ? err.message : 'Failed to generate recommendations' }
  }
}

// ---- Generate Post ----

export async function generatePost(
  templateType: SocialTemplateType,
  promptData: Record<string, string>,
  scheduledDate?: string
): Promise<{ post: ContentPost | null; error?: string; imageError?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { post: null, error: 'Not authenticated' }

  try {
    // Generate captions (required)
    const captions = await generateSocialCaptions({
      templateType,
      promptData,
      businessName: account.business_name,
      industry: account.industry,
      brandVoice: account.brand_voice,
    }).catch((err: unknown) => {
      throw new Error(`Caption generation failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Generate image (optional — if fal.ai is unavailable, continue without it)
    let falImageUrl: string | null = null
    let imageError: string | undefined
    try {
      falImageUrl = await generateSocialImage({
        templateType,
        promptData,
        businessName: account.business_name,
        primaryColor: account.primary_color,
      })
    } catch (imgErr) {
      imageError = imgErr instanceof Error ? imgErr.message : 'Image generation failed'
      console.error('Image generation failed (non-fatal):', imageError)
      // Continue without image — user can regenerate later
    }

    // Store fal.ai URL directly — no Supabase Storage required
    const today = new Date().toISOString().split('T')[0]

    // Save to DB if table exists; non-blocking (content still shows even if DB fails)
    let savedId: string | null = null
    try {
      const { data: inserted } = await supabase
        .from('content_posts')
        .insert({
          account_id: account.id,
          template_type: templateType,
          prompt_data: promptData as unknown as import('@/types/database').Json,
          image_url: falImageUrl,
          captions: captions as unknown as import('@/types/database').Json,
          status: 'draft',
          scheduled_date: scheduledDate ?? today,
        })
        .select('id')
        .single()
      savedId = inserted?.id ?? null
    } catch {
      // DB not set up yet — content still usable in-session
    }

    return {
      post: {
        id: savedId ?? crypto.randomUUID(),
        account_id: account.id,
        template_type: templateType,
        prompt_data: promptData,
        image_url: falImageUrl,
        captions,
        status: 'draft',
        scheduled_date: scheduledDate ?? today,
        google_posted_at: null,
        created_at: new Date().toISOString(),
      },
      imageError,
    }
  } catch (err) {
    return { post: null, error: err instanceof Error ? err.message : 'Generation failed' }
  }
}

// ---- Regenerate Caption (single platform) ----

export async function regenerateCaption(
  postId: string,
  platform: SocialPlatform
): Promise<{ caption: string | null; error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { caption: null, error: 'Not authenticated' }

  const { data: post } = await supabase
    .from('content_posts')
    .select('template_type, prompt_data, captions')
    .eq('id', postId)
    .eq('account_id', account.id)
    .single()

  if (!post) return { caption: null, error: 'Post not found' }

  try {
    const caption = await regeneratePlatformCaption({
      platform,
      templateType: post.template_type as SocialTemplateType,
      promptData: post.prompt_data as Record<string, string>,
      businessName: account.business_name,
      industry: account.industry,
      brandVoice: account.brand_voice,
    })

    const updatedCaptions = { ...(post.captions as unknown as SocialCaptions), [platform]: caption }
    await supabase
      .from('content_posts')
      .update({ captions: updatedCaptions as unknown as import('@/types/database').Json })
      .eq('id', postId)

    return { caption }
  } catch (err) {
    return { caption: null, error: err instanceof Error ? err.message : 'Regeneration failed' }
  }
}

// ---- Regenerate Image ----

// Direct version — works even if DB isn't set up (no DB lookup needed)
export async function regenerateImageDirect(
  postId: string,
  templateType: string,
  promptData: Record<string, string>
): Promise<{ imageUrl: string | null; error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { imageUrl: null, error: 'Not authenticated' }

  try {
    const imageUrl = await generateSocialImage({
      templateType: templateType as SocialTemplateType,
      promptData,
      businessName: account.business_name,
      primaryColor: account.primary_color,
    })

    // Update DB if post exists (non-blocking)
    try {
      await supabase.from('content_posts').update({ image_url: imageUrl }).eq('id', postId)
    } catch { /* DB not set up yet */ }

    return { imageUrl }
  } catch (err) {
    return { imageUrl: null, error: err instanceof Error ? err.message : 'Image regeneration failed' }
  }
}

export async function regenerateImage(
  postId: string
): Promise<{ imageUrl: string | null; error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { imageUrl: null, error: 'Not authenticated' }

  const { data: post } = await supabase
    .from('content_posts')
    .select('template_type, prompt_data')
    .eq('id', postId)
    .eq('account_id', account.id)
    .single()

  if (!post) return { imageUrl: null, error: 'Post not found' }

  return regenerateImageDirect(postId, post.template_type, post.prompt_data as Record<string, string>)
}

// ---- Save Captions (after user edits) ----

export async function savePost(
  postId: string,
  captions: SocialCaptions
): Promise<{ error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { error: 'Not authenticated' }

  try {
    await supabase
      .from('content_posts')
      .update({ captions: captions as unknown as import('@/types/database').Json })
      .eq('id', postId)
      .eq('account_id', account.id)
  } catch { /* DB not set up yet */ }

  return {}
}

// ---- Publish Post ----

export async function publishPost(
  postId: string,
  captions: SocialCaptions,
  autoPostGoogle: boolean
): Promise<{ error?: string; googlePosted?: boolean }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { error: 'Not authenticated' }

  // Save latest captions (non-blocking)
  try {
    await supabase
      .from('content_posts')
      .update({ captions: captions as unknown as import('@/types/database').Json, status: 'published' })
      .eq('id', postId)
      .eq('account_id', account.id)
  } catch { /* DB not set up yet */ }

  if (!autoPostGoogle || !account.google_refresh_token || !account.google_location_name) {
    return { googlePosted: false }
  }

  // Post to Google Business
  try {
    const { data: post } = await supabase
      .from('content_posts')
      .select('image_url')
      .eq('id', postId)
      .single()

    const accessToken = await getGoogleAccessToken(account.google_refresh_token)

    const body: Record<string, unknown> = {
      languageCode: 'en',
      summary: captions.google_business,
    }
    if (post?.image_url) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.image_url }]
    }

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${account.google_location_name}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      return { error: `Google post failed: ${errText}`, googlePosted: false }
    }

    await supabase
      .from('content_posts')
      .update({ google_posted_at: new Date().toISOString() })
      .eq('id', postId)

    return { googlePosted: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Google post failed', googlePosted: false }
  }
}

// ---- Delete Post ----

export async function deletePost(postId: string): Promise<{ error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { error: 'Not authenticated' }

  // Images are stored as fal.ai CDN URLs — no Supabase Storage to clean up

  const { error } = await supabase
    .from('content_posts')
    .delete()
    .eq('id', postId)
    .eq('account_id', account.id)

  return { error: error?.message }
}

// ---- Duplicate Post ----

export async function duplicatePost(postId: string): Promise<{ newPostId: string | null; error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { newPostId: null, error: 'Not authenticated' }

  const { data: post } = await supabase
    .from('content_posts')
    .select('*')
    .eq('id', postId)
    .eq('account_id', account.id)
    .single()

  if (!post) return { newPostId: null, error: 'Post not found' }

  const { data: newPost, error } = await supabase
    .from('content_posts')
    .insert({
      account_id: account.id,
      template_type: post.template_type,
      prompt_data: post.prompt_data,
      image_url: post.image_url,
      captions: post.captions,
      status: 'draft',
      scheduled_date: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single()

  return { newPostId: newPost?.id ?? null, error: error?.message }
}

// ---- Get Calendar Posts ----

export async function getCalendarPosts(
  month: number,
  year: number
): Promise<ContentPost[]> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return []

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`

  const { data } = await supabase
    .from('content_posts')
    .select('*')
    .eq('account_id', account.id)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true })

  return (data ?? []).map(p => ({
    ...p,
    prompt_data: p.prompt_data as unknown as Record<string, string>,
    captions: p.captions as unknown as SocialCaptions,
  }))
}

// ---- Cadence Settings ----

export async function getCadenceSettings(): Promise<CadenceSettings> {
  const { user, account, supabase } = await getAccountAndUser()
  const defaults: CadenceSettings = {
    instagram_per_week: 3,
    facebook_per_week: 2,
    google_per_week: 1,
    reminder_type: 'dashboard',
    preferred_days: { instagram: [1, 3, 5], facebook: [2, 4], google_business: [3] },
  }
  if (!user || !account) return defaults

  const { data } = await supabase
    .from('content_cadence_settings')
    .select('*')
    .eq('account_id', account.id)
    .single()

  if (!data) return defaults

  return {
    instagram_per_week: data.instagram_per_week,
    facebook_per_week: data.facebook_per_week,
    google_per_week: data.google_per_week,
    reminder_type: data.reminder_type,
    preferred_days: data.preferred_days as CadenceSettings['preferred_days'],
  }
}

export async function saveCadenceSettings(
  settings: CadenceSettings
): Promise<{ error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('content_cadence_settings')
    .upsert({ account_id: account.id, ...settings })

  return { error: error?.message }
}

// ---- Google OAuth helpers ----

export async function getGoogleAuthUrl(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function disconnectGoogle(): Promise<{ error?: string }> {
  const { user, account, supabase } = await getAccountAndUser()
  if (!user || !account) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('accounts')
    .update({ google_refresh_token: null, google_location_name: null })
    .eq('id', account.id)

  return { error: error?.message }
}

// ---- Internal: refresh Google access token ----

async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json() as { access_token?: string; error?: string }
  if (!json.access_token) throw new Error(`Google token refresh failed: ${json.error}`)
  return json.access_token
}
