import { createClient } from '@/lib/supabase/server'
import { deleteCalendarEvent } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { booking_id } = await request.json()
  if (!booking_id) return NextResponse.json({ error: 'booking_id fehlt' }, { status: 400 })

  // Buchung laden und prüfen, ob sie dem Patienten gehört
  const { data: booking, error: loadErr } = await supabase
    .from('bookings')
    .select('id, patient_id, google_event_id, status')
    .eq('id', booking_id)
    .single()

  if (loadErr || !booking) return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 })
  if (booking.patient_id !== user.id) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Bereits abgesagt' }, { status: 409 })

  // Google Calendar Event löschen (sendet automatisch Absage-Mail an Physio)
  if (booking.google_event_id && process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      await deleteCalendarEvent(booking.google_event_id)
    } catch (err) {
      console.error('Google Calendar Löschen Fehler:', err)
    }
  }

  // Buchung absagen – confirmed_by = patient_id als Sentinel für "vom Patienten abgesagt"
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      confirmed_by: user.id,       // patient_id === user.id → erkennbar in Admin-View
      confirmed_at: new Date().toISOString(),
      google_event_id: null,
    })
    .eq('id', booking_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
