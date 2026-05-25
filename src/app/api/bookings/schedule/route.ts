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

  const { booking_id, date, time, treatment_type_id } = await request.json()

  // Buchung mit Patient laden
  type BookingRow = {
    id: string
    notes: string | null
    profiles: { full_name: string; email: string }
    treatment_types: { name: string; duration_min: number }
  }

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, notes, profiles!bookings_patient_id_fkey(full_name, email), treatment_types(name, duration_min)')
    .eq('id', booking_id)
    .single() as { data: BookingRow | null; error: unknown }

  if (bErr || !booking) return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 })

  // Behandlungstyp laden (kann geändert worden sein)
  const { data: treatment } = await supabase
    .from('treatment_types').select('name, duration_min').eq('id', treatment_type_id).single()

  if (!treatment) return NextResponse.json({ error: 'Behandlungstyp nicht gefunden' }, { status: 404 })

  // Google Calendar Event erstellen
  let googleEventId: string | null = null
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      // Notizen ohne [ANFRAGE]-Prefix für die Kalender-Beschreibung
      const description = (booking.notes ?? '')
        .replace('[ANFRAGE via Website]', '').replace(/^Anliegen:.*\n\n?/m, '').trim()

      googleEventId = await createCalendarEvent({
        title: treatment.name,
        description,
        date,
        time: time.slice(0, 5),
        durationMin: treatment.duration_min,
        patientName: booking.profiles.full_name,
        patientEmail: booking.profiles.email,
      })
    } catch (err) {
      console.error('Google Calendar Fehler:', err)
    }
  }

  // Buchung aktualisieren: Datum, Zeit, Behandlung, Status → confirmed
  const { error: uErr } = await supabase
    .from('bookings')
    .update({
      requested_date:    date,
      requested_time:    time,
      treatment_type_id,
      status:            'confirmed',
      google_event_id:   googleEventId,
      confirmed_by:      user.id,
      confirmed_at:      new Date().toISOString(),
    })
    .eq('id', booking_id)

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ success: true, google_event_id: googleEventId })
}
