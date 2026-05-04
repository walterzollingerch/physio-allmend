import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TermineClient from './TermineClient'

export default async function AdminTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/')

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      treatment_types ( name, duration_min ),
      profiles!bookings_patient_id_fkey ( full_name, email, phone )
    `)
    .order('requested_date', { ascending: true })
    .order('requested_time', { ascending: true })

  return <TermineClient bookings={bookings ?? []} />
}
