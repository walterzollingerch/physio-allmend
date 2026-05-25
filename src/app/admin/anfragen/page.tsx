import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnfragenClient from './AnfragenClient'

export type Inquiry = {
  id: string
  created_at: string
  name: string
  email: string
  phone: string | null
  topic: string | null
  message: string | null
  user_id: string | null
  status: 'new' | 'read' | 'done'
}

export type TreatmentType = {
  id: string
  name: string
  duration_min: number
}

export default async function AnfragenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/')

  const [inquiriesRes, treatmentsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('contact_inquiries').select('*').order('created_at', { ascending: false }),
    supabase.from('treatment_types').select('id, name, duration_min').order('name'),
  ])

  return (
    <AnfragenClient
      inquiries={(inquiriesRes.data ?? []) as Inquiry[]}
      treatmentTypes={(treatmentsRes.data ?? []) as TreatmentType[]}
    />
  )
}
