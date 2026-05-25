import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { inquiry_id, date, time, treatment_type_id } = await request.json()

  // Anfrage + Behandlungstyp laden
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (supabase as any)
    .from('contact_inquiries')
    .select('*')
    .eq('id', inquiry_id)
    .single()

  if (!inquiry) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })

  const { data: treatment } = await supabase
    .from('treatment_types')
    .select('name, duration_min')
    .eq('id', treatment_type_id)
    .single()

  if (!treatment) return NextResponse.json({ error: 'Behandlungstyp nicht gefunden' }, { status: 404 })

  // Google Calendar Event erstellen
  let googleEventId: string | null = null
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      googleEventId = await createCalendarEvent({
        title: treatment.name,
        description: inquiry.message ?? '',
        date,
        time: time.slice(0, 5),
        durationMin: treatment.duration_min,
        patientName: inquiry.name,
        patientEmail: inquiry.email,
      })
    } catch (err) {
      console.error('Google Calendar Fehler:', err)
    }
  }

  // Buchung als bestätigt anlegen (patient_id = user_id aus Anfrage, kann null sein)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      patient_id: inquiry.user_id,
      treatment_type_id,
      requested_date: date,
      requested_time: time,
      notes: inquiry.message ?? null,
      status: 'confirmed',
      google_event_id: googleEventId,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  // Anfrage als erledigt markieren
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('contact_inquiries')
    .update({ status: 'done' })
    .eq('id', inquiry_id)

  return NextResponse.json({ success: true, booking_id: booking.id, google_event_id: googleEventId })
}
