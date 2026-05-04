import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NeuerKundePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  // Nächste Kundennummer ermitteln
  const { data: last } = await supabase
    .from('customers')
    .select('customer_number')
    .order('customer_number', { ascending: false })
    .limit(1)
    .single()

  const nextNum = last
    ? 'A' + String(parseInt(last.customer_number.replace('A', '')) + 1).padStart(4, '0')
    : 'A0001'

  const { data: kunde, error } = await supabase
    .from('customers')
    .insert({ customer_number: nextNum, name: 'Neuer Kunde' })
    .select('id')
    .single()

  if (error || !kunde) redirect('/kunden')
  redirect(`/kunden/${kunde.id}`)
}
