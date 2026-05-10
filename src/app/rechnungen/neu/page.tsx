import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NeueRechnungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  // Nächste Rechnungsnummer ermitteln
  const { data: lastInv } = await supabase
    .from('invoices')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNumber = 'R0001'
  if (lastInv?.number) {
    const match = lastInv.number.match(/R(\d+)/i)
    if (match) {
      const n = parseInt(match[1]) + 1
      nextNumber = 'R' + n.toString().padStart(4, '0')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  // Neue Rechnung anlegen und zur Bearbeitungsseite weiterleiten
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({
      number: nextNumber,
      customer_name: '',
      customer_address: '',
      invoice_date: today,
      status: 'entwurf',
      discount_type: 'percent',
      discount_value: 0,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !inv) redirect('/rechnungen')
  redirect(`/rechnungen/${inv.id}`)
}
