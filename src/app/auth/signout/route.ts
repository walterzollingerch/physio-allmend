import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Redirect relativ zur aktuellen Host-URL (funktioniert lokal + Produktion)
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL('/auth/login', origin))
}
