import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Redirect relativ zur aktuellen Host-URL (funktioniert lokal + Produktion)
  const origin = request.nextUrl.origin
  // 303 See Other → Browser macht GET auf /auth/login (nicht erneut POST)
  return NextResponse.redirect(new URL('/auth/login', origin), { status: 303 })
}
