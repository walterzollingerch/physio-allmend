import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NeueRechnungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  // Neue Rechnung anlegen und zur Bearbeitungsseite weiterleiten
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({ created_by: user.id })
    .select('id')
    .single()

  if (error || !inv) redirect('/rechnungen')
  redirect(`/rechnungen/${inv.id}`)
}
