import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingClient from './BookingClient'

export default async function TerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: treatments } = await supabase
    .from('treatment_types')
    .select('*')
    .eq('is_active', true)
    .order('duration_min')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return <BookingClient treatments={treatments ?? []} profile={profile} />
}
