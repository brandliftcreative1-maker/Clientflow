import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')

  if (!code) {
    console.error('Google OAuth callback: no code. error param:', errorParam)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?google=error&reason=no_code`)
  }

  // Exchange code for tokens
  const redirectUri = `${APP_URL}/api/auth/google/callback`
  console.log('Google OAuth: exchanging code, redirect_uri:', redirectUri)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    console.error('Google OAuth token exchange failed:', tokens.error, tokens.error_description)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?google=error&reason=${tokens.error ?? 'no_token'}`)
  }

  // Fetch the first Google Business location
  const accountsRes = await fetch('https://mybusiness.googleapis.com/v4/accounts', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const accountsData = await accountsRes.json() as { accounts?: { name: string }[] }
  const googleAccountName = accountsData.accounts?.[0]?.name

  let locationName: string | null = null
  if (googleAccountName) {
    const locRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${googleAccountName}/locations`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const locData = await locRes.json() as { locations?: { name: string }[] }
    locationName = locData.locations?.[0]?.name ?? null
  }

  // Get the current user's account_id
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?google=error`)
  }

  const serviceSupabase = await createServiceClient()
  await serviceSupabase
    .from('accounts')
    .update({
      google_refresh_token: tokens.refresh_token,
      google_location_name: locationName,
    })
    .eq('user_id', user.id)

  return NextResponse.redirect(`${APP_URL}/dashboard/settings?google=connected`)
}
