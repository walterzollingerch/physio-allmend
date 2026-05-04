import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'physio'].includes(profile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { booking_id, action } = body // action: 'confirm' | 'cancel'

  // Buchung mit Patient & Behandlungstyp laden
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      treatment_types ( name, duration_min ),
      profiles!bookings_patient_id_fkey ( full_name, email )
    `)
    .eq('id', booking_id)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 })
  }

  if (action === 'confirm') {
    let googleEventId: string | null = null

    // Google Calendar Event erstellen
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      try {
        const patient = booking.profiles as { full_name: string; email: string }
        const treatment = booking.treatment_types as { name: string; duration_min: number }

        googleEventId = await createCalendarEvent({
          title: treatment.name,
          description: booking.notes ?? '',
          date: booking.requested_date,
          time: booking.requested_time.slice(0, 5),
          durationMin: treatment.duration_min,
          patientName: patient.full_name,
          patientEmail: patient.email,
        })
      } catch (err) {
        console.error('Google Calendar Fehler:', err)
        // Weiter auch ohne Kalender-Event
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        google_event_id: googleEventId,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', booking_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, google_event_id: googleEventId })
  }

  if (action === 'cancel') {
    // Google Calendar Event löschen falls vorhanden
    if (booking.google_event_id && process.env.GOOGLE_REFRESH_TOKEN) {
      try {
        await deleteCalendarEvent(booking.google_event_id)
      } catch (err) {
        console.error('Google Calendar Löschen Fehler:', err)
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
