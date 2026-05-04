import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TermineClient from './TermineClient'

export default async function AdminTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/')

  type BookingWithRelations = {
    id: string
    requested_date: string
    requested_time: string
    status: 'pending' | 'confirmed' | 'cancelled'
    notes: string | null
    google_event_id: string | null
    treatment_types: { name: string; duration_min: number }
    profiles: { full_name: string; email: string; phone: string | null }
  }

  const { data: rawBookings } = await supabase
    .from('bookings')
    .select(`
      *,
      treatment_types ( name, duration_min ),
      profiles!bookings_patient_id_fkey ( full_name, email, phone )
    `)
    .order('requested_date', { ascending: true })
    .order('requested_time', { ascending: true })

  const bookings = (rawBookings ?? []) as BookingWithRelations[]

  return <TermineClient bookings={bookings} />
}
