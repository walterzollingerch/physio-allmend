'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Search, X } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  entwurf:    { label: 'Entwurf',    cls: 'bg-[#F4EDE2] text-[#7A6E60]' },
  gesendet:   { label: 'Gesendet',   cls: 'bg-blue-100 text-blue-700' },
  bezahlt:    { label: 'Bezahlt',    cls: 'bg-green-100 text-green-700' },
  archiviert: { label: 'Archiviert', cls: 'bg-gray-100 text-gray-500' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2 }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-CH')
}

type Invoice = {
  id: string
  number: string
  customer_name: string
  invoice_date: string
  due_date: string | null
  status: string
  reference: string | null
  total: number
}

type FilterKey = 'alle' | 'offen' | 'erledigt' | 'archiviert'

const FILTERS: { key: FilterKey; label: string; match: (s: string) => boolean }[] = [
  { key: 'alle',       label: 'Alle',       match: () => true },
  { key: 'offen',      label: 'Offen',      match: s => s === 'entwurf' || s === 'gesendet' },
  { key: 'erledigt',   label: 'Erledigt',   match: s => s === 'bezahlt' },
  { key: 'archiviert', label: 'Archiviert', match: s => s === 'archiviert' },
]

export default function RechnungenClient({
  invoices,
  totalOffen,
  totalBezahlt,
}: {
  invoices: Invoice[]
  totalOffen: number
  totalBezahlt: number
}) {
  const [filter, setFilter] = useState<FilterKey>('alle')
  const [query, setQuery]   = useState('')

  const current = FILTERS.find(f => f.key === filter)!

  const q = query.trim().toLowerCase()
  const visible = invoices.filter(inv => {
    if (!current.match(inv.status)) return false
    if (!q) return true
    return (
      inv.number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q) ||
      (inv.reference ?? '').toLowerCase().includes(q) ||
      fmtDate(inv.invoice_date).includes(q)
    )
  })

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
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
          <p className="text-xl font-semibold text-[#2A2622]">{invoices.length}</p>
        </div>
      </div>

      {/* Filter tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit">
          {FILTERS.map(f => {
            const count = invoices.filter(inv => f.match(inv.status)).length
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-[#6B8E7F] text-white'
                    : 'text-[#7A6E60] hover:text-[#2A2622]'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-[#F4EDE2] text-[#7A6E60]'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E60] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nr., Kunde, Referenz suchen…"
            className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-[#E1D6C2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A6E60] hover:text-[#2A2622]">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7A6E60]">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">
              {q
                ? `Keine Rechnungen für «${query}»`
                : invoices.length === 0
                  ? 'Noch keine Rechnungen'
                  : `Keine ${current.label.toLowerCase()} Rechnungen`}
            </p>
            {!q && invoices.length === 0 && (
              <Link href="/rechnungen/neu" className="mt-4 text-sm text-[#6B8E7F] hover:underline">
                Erste Rechnung erstellen →
              </Link>
            )}
            {q && (
              <button onClick={() => setQuery('')} className="mt-3 text-sm text-[#6B8E7F] hover:underline">
                Suche zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                <th className="text-left px-5 py-3">Nr.</th>
                <th className="text-left py-3">Kunde</th>
                <th className="text-left py-3 hidden md:table-cell">Referenz</th>
                <th className="text-left py-3 hidden sm:table-cell">Datum</th>
                <th className="text-left py-3 hidden lg:table-cell">Fällig</th>
                <th className="text-left py-3">Status</th>
                <th className="text-right py-3 pr-5">Total (CHF)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(inv => {
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
                    <td className="py-3 pr-4 text-[#7A6E60] text-xs hidden md:table-cell">
                      {inv.reference || <span className="text-[#C5B99A]">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-[#4A4138] hidden sm:table-cell">{fmtDate(inv.invoice_date)}</td>
                    <td className="py-3 pr-4 text-[#4A4138] hidden lg:table-cell">{fmtDate(inv.due_date)}</td>
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

      {/* Result count when searching */}
      {q && visible.length > 0 && (
        <p className="mt-2 text-xs text-[#7A6E60] text-right">
          {visible.length} Ergebnis{visible.length !== 1 ? 'se' : ''} für «{query}»
        </p>
      )}
    </>
  )
}
