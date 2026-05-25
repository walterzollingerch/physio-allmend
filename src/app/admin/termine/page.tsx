import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TermineClient from './TermineClient'

export type TreatmentType = {
  id: string
  name: string
  duration_min: number
}

export type BookingWithRelations = {
  id: string
  patient_id: string
  confirmed_by: string | null
  requested_date: string
  requested_time: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  google_event_id: string | null
  treatment_types: { id: string; name: string; duration_min: number }
  profiles: { full_name: string; email: string; phone: string | null }
}

export default async function AdminTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/')

  const [bookingsRes, treatmentsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, treatment_types(id, name, duration_min), profiles!bookings_patient_id_fkey(full_name, email, phone)')
      .order('requested_date', { ascending: true })
      .order('requested_time', { ascending: true }),
    supabase.from('treatment_types').select('id, name, duration_min').order('name'),
  ])

  const bookings = (bookingsRes.data ?? []) as BookingWithRelations[]

  // Welche bestätigten Termine existieren noch im Google Kalender?
  let calendarDeletedIds: string[] = []
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    const confirmedWithEvent = bookings.filter(
      b => b.status === 'confirmed' && b.google_event_id
    )
    if (confirmedWithEvent.length > 0) {
      try {
        const { getExistingEventIds } = await import('@/lib/google-calendar')
        const dates = confirmedWithEvent.map(b => b.requested_date).sort()
        const existingIds = await getExistingEventIds(dates[0], dates[dates.length - 1])
        calendarDeletedIds = confirmedWithEvent
          .filter(b => !existingIds.has(b.google_event_id!))
          .map(b => b.id)
      } catch (err) {
        console.error('Calendar-Sync Fehler:', err)
      }
    }
  }

  return (
    <TermineClient
      bookings={bookings}
      treatmentTypes={(treatmentsRes.data ?? []) as TreatmentType[]}
      calendarDeletedIds={calendarDeletedIds}
    />
  )
}
