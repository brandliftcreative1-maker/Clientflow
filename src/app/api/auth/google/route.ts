import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/actions/content'

export async function GET() {
  const url = await getGoogleAuthUrl()
  return NextResponse.redirect(url)
}
