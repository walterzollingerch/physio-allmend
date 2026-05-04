import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/PhysioLogo'
import { ArrowLeft, LogOut, Plus, FileText } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  entwurf:   { label: 'Entwurf',   cls: 'bg-[#F4EDE2] text-[#7A6E60]' },
  gesendet:  { label: 'Gesendet',  cls: 'bg-blue-100 text-blue-700' },
  bezahlt:   { label: 'Bezahlt',   cls: 'bg-green-100 text-green-700' },
  storniert: { label: 'Storniert', cls: 'bg-red-100 text-red-600' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-CH')
}

export default async function RechnungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, invoice_items(unit_price, quantity)')
    .order('created_at', { ascending: false })

  const withTotals = (invoices ?? []).map(inv => {
    const subtotal = (inv.invoice_items ?? []).reduce(
      (s: number, i: any) => s + Number(i.unit_price) * Number(i.quantity), 0
    )
    const discount = inv.discount_type === 'percent'
      ? subtotal * Number(inv.discount_value) / 100
      : Number(inv.discount_value)
    return { ...inv, total: subtotal - discount }
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-4">
            <p className="text-xs text-[#7A6E60] uppercase tracking-wide mb-1">Offen</p>
            <p className="text-xl font-semibold text-blue-700">CHF {fmt(totalOffen)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-4">
            <p className="text-xs text-[#7A6E60] uppercase tracking-wide mb-1">Bezahlt</p>
            <p className="text-xl font-semibold text-green-700">CHF {fmt(totalBezahlt)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-[#7A6E60] uppercase tracking-wide mb-1">Total Rechnungen</p>
            <p className="text-xl font-semibold text-[#2A2622]">{withTotals.length}</p>
          </div>
        </div>

        {/* Invoice list */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
          {withTotals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#7A6E60]">
              <FileText size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Noch keine Rechnungen</p>
              <Link href="/rechnungen/neu" className="mt-4 text-sm text-[#6B8E7F] hover:underline">
                Erste Rechnung erstellen →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                  <th className="text-left px-5 py-3">Nr.</th>
                  <th className="text-left py-3">Kunde</th>
                  <th className="text-left py-3 hidden sm:table-cell">Datum</th>
                  <th className="text-left py-3 hidden md:table-cell">Fällig</th>
                  <th className="text-left py-3">Status</th>
                  <th className="text-right py-3 pr-5">Total (CHF)</th>
                </tr>
              </thead>
              <tbody>
                {withTotals.map(inv => {
                  const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS.entwurf
                  return (
                    <tr key={inv.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6]">
                      <td className="px-5 py-3">
                        <Link href={`/rechnungen/${inv.id}`} className="font-mono font-semibold text-[#6B8E7F] hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Link href={`/rechnungen/${inv.id}`} className="font-medium text-[#2A2622] hover:text-[#6B8E7F]">
                          {inv.customer_name || <span className="text-[#7A6E60] italic">Kein Name</span>}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#4A4138] hidden sm:table-cell">{fmtDate(inv.invoice_date)}</td>
                      <td className="py-3 pr-4 text-[#4A4138] hidden md:table-cell">{fmtDate(inv.due_date)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-3 pr-5 text-right font-semibold text-[#2A2622]">{fmt(inv.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
