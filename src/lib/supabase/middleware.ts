import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

const PUBLIC_PATHS = ['/', '/auth']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuthPage    = url.pathname.startsWith('/auth')
  const isPublicPage  = url.pathname === '/' || isAuthPage
  const isAdminPage   = url.pathname.startsWith('/admin')

  // Nicht eingeloggt auf geschützter Seite → Login
  if (!user && !isPublicPage) {
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Eingeloggt auf Auth-Seite → Dashboard
  if (user && isAuthPage && !url.pathname.startsWith('/auth/reset-password')) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_blocked')
      .eq('id', user.id)
      .single()

    // Gesperrter User → abmelden
    if (profile?.is_blocked && !isAuthPage) {
      await supabase.auth.signOut()
      url.pathname = '/auth/login'
      url.searchParams.set('blocked', '1')
      return NextResponse.redirect(url)
    }

    // Admin-Seite: nur für Admin & Physio
    if (isAdminPage && !['admin', 'physio'].includes(profile?.role ?? '')) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
