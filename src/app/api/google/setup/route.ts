import { google } from 'googleapis'
import { NextResponse } from 'next/server'

// Einmalige Setup-Route um den Google Refresh Token zu erhalten.
// Aufruf: GET /api/google/setup
// Nach dem Login zeigt die Route den Refresh Token an → in .env.local / Vercel eintragen.

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  })

  return NextResponse.redirect(url)
}
