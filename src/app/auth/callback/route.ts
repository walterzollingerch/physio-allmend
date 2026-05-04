import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type')
  const next      = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // E-Mail-Bestätigung
  if (tokenHash && (type === 'signup' || type === 'email')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (!error) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/auth/login?confirmed=1`)
    }
    return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
  }

  // OAuth-Flow (Google)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
