import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/PhysioLogo'
import { ArrowLeft, LogOut, Plus } from 'lucide-react'
import RechnungenClient from './RechnungenClient'

export default async function RechnungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  type InvoiceWithItems = {
    id: string; number: string; customer_name: string; invoice_date: string
    due_date: string | null; status: string; discount_type: string; discount_value: number
    rounding_diff: number
    reference: string | null
    invoice_items: { unit_price: number; quantity: number }[]
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, number, customer_name, invoice_date, due_date, status, discount_type, discount_value, rounding_diff, reference, invoice_items(unit_price, quantity)')
    .order('number', { ascending: false }) as { data: InvoiceWithItems[] | null; error: unknown }

  const withTotals = (invoices ?? []).map(inv => {
    const subtotal = (inv.invoice_items ?? []).reduce(
      (s: number, i: { unit_price: number; quantity: number }) => s + Number(i.unit_price) * Number(i.quantity), 0
    )
    const discount = inv.discount_type === 'percent'
      ? subtotal * Number(inv.discount_value) / 100
      : Number(inv.discount_value)
    const rounding = Number(inv.rounding_diff ?? 0)
    return { id: inv.id, number: inv.number, customer_name: inv.customer_name, invoice_date: inv.invoice_date, due_date: inv.due_date, status: inv.status, reference: inv.reference, total: subtotal - discount - rounding }
  })

  const totalOffen   = withTotals.filter(i => i.status === 'gesendet').reduce((s, i) => s + i.total, 0)
  const totalBezahlt = withTotals.filter(i => i.status === 'bezahlt').reduce((s, i) => s + i.total, 0)

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#7A6E60] hover:text-[#2A2622] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <Wordmark size={32} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#4A4138] hidden sm:block">{profile.full_name}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex items-center gap-1.5 text-sm text-[#7A6E60] hover:text-[#2A2622] transition-colors">
                <LogOut size={16} />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Rechnungen
            </h1>
            <p className="text-[#7A6E60] text-sm mt-1">Physio Allmend</p>
          </div>
          <Link
            href="/rechnungen/neu"
            className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Neue Rechnung
          </Link>
        </div>

        <RechnungenClient
          invoices={withTotals}
          totalOffen={totalOffen}
          totalBezahlt={totalBezahlt}
        />
      </main>
    </div>
  )
}
