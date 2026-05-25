import { createClient } from '@/lib/supabase/server'
import { getCalendarBusy } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 })
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ busy: [] })
  }

  try {
    const busy = await getCalendarBusy(date)
    return NextResponse.json({ busy })
  } catch (err) {
    console.error('Calendar busy error:', err)
    return NextResponse.json({ busy: [] })
  }
}
