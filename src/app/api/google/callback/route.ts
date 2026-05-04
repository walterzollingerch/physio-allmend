import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.json({ error: 'Kein Code' }, { status: 400 })

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  )

  const { tokens } = await oauth2Client.getToken(code)

  return NextResponse.json({
    message: '✅ Refresh Token erhalten. Trage diesen Wert als GOOGLE_REFRESH_TOKEN in Vercel & .env.local ein:',
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
  })
}
