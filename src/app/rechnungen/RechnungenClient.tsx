'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Search, X, Upload, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

// ── Referenz-Import ──────────────────────────────────────────

type ImportRow = { number: string; reference: string }
type ImportResultRow = { number: string; reference: string; status: 'ok' | 'not_found' | 'error'; reason?: string }
type ImportResult = { rows: ImportResultRow[]; updated: number; notFound: number; errors: number }

function detectDelimiter(text: string): string {
  const counts = { '\t': 0, ';': 0, ',': 0 }
  for (const ch of text.slice(0, 2000)) {
    if (ch in counts) counts[ch as keyof typeof counts]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function parseImportText(text: string): ImportRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const delim = detectDelimiter(text)
  return lines.map(line => {
    const parts = line.split(delim).map(p => p.trim().replace(/^["']|["']$/g, ''))
    return { number: parts[0] ?? '', reference: parts[1] ?? '' }
  }).filter(r => r.number && r.reference)
}

function ReferenzImportModal({ invoices, onClose, onDone }: {
  invoices: Invoice[]
  onClose: () => void
  onDone: (updated: Map<string, string>) => void
}) {
  const [rawText, setRawText]         = useState('')
  const [preview, setPreview]         = useState<ImportRow[]>([])
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [isPending, start]            = useTransition()
  const supabase = createClient()

  function handleTextChange(text: string) {
    setRawText(text)
    setPreview(parseImportText(text))
    setResult(null)
  }

  async function handleFile(file: File) {
    const text = await file.text()
    handleTextChange(text)
  }

  async function runImport() {
    if (preview.length === 0) return
    const invoiceMap = new Map(invoices.map(inv => [inv.number.toUpperCase(), inv]))
    const resultRows: ImportResultRow[] = []

    start(async () => {
      for (const row of preview) {
        const inv = invoiceMap.get(row.number.toUpperCase())
        if (!inv) {
          resultRows.push({ number: row.number, reference: row.reference, status: 'not_found', reason: 'Rechnung nicht gefunden' })
          continue
        }
        const { error } = await supabase.from('invoices').update({ reference: row.reference }).eq('id', inv.id)
        if (error) {
          resultRows.push({ number: row.number, reference: row.reference, status: 'error', reason: error.message })
        } else {
          resultRows.push({ number: row.number, reference: row.reference, status: 'ok' })
        }
      }

      const updated = resultRows.filter(r => r.status === 'ok').length
      const notFound = resultRows.filter(r => r.status === 'not_found').length
      const errors   = resultRows.filter(r => r.status === 'error').length
      setResult({ rows: resultRows, updated, notFound, errors })

      // Pass updated map back so the list refreshes without a full reload
      const updatedMap = new Map<string, string>()
      for (const r of resultRows) {
        if (r.status === 'ok') updatedMap.set(r.number.toUpperCase(), r.reference)
      }
      onDone(updatedMap)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2] shrink-0">
          <div>
            <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Referenzen importieren</h2>
            <p className="text-xs text-[#7A6E60] mt-0.5">Spalte 1: Rechnungsnummer · Spalte 2: Referenz (Tab, Semikolon oder Komma getrennt)</p>
          </div>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {!result ? (
            <>
              {/* File upload */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Datei hochladen (CSV / TSV / TXT)</label>
                <input
                  type="file" accept=".csv,.tsv,.txt,.xls,.xlsx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  className="w-full text-sm text-[#4A4138] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#6B8E7F] file:text-white hover:file:bg-[#5a7a6c] file:cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-[#7A6E60]">
                <div className="flex-1 border-t border-[#E1D6C2]" />
                oder direkt einfügen
                <div className="flex-1 border-t border-[#E1D6C2]" />
              </div>

              {/* Paste area */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Daten einfügen</label>
                <textarea
                  value={rawText}
                  onChange={e => handleTextChange(e.target.value)}
                  rows={8}
                  placeholder={'R0068\tRg11316 Ruf Martina\nR0067\tRg11316 Ruf Martina\nR0066\tRg11330 Benkö Jasmin'}
                  className="w-full font-mono text-xs border border-[#E1D6C2] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] resize-none"
                />
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#7A6E60] mb-2">{preview.length} Zeilen erkannt – Vorschau:</p>
                  <div className="border border-[#E1D6C2] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F7F2EC] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-[#7A6E60] font-medium w-28">Rechnungsnr.</th>
                          <th className="text-left px-3 py-2 text-[#7A6E60] font-medium">Referenz</th>
                          <th className="text-left px-3 py-2 text-[#7A6E60] font-medium hidden sm:table-cell">Besteht?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => {
                          const exists = invoices.some(inv => inv.number.toUpperCase() === row.number.toUpperCase())
                          return (
                            <tr key={i} className={`border-t border-[#F7F2EC] ${!exists ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-1.5 font-mono font-semibold text-[#6B8E7F]">{row.number}</td>
                              <td className="px-3 py-1.5 text-[#2A2622]">{row.reference}</td>
                              <td className="px-3 py-1.5 hidden sm:table-cell">
                                {exists
                                  ? <span className="text-green-600 flex items-center gap-1"><Check size={11} /> Ja</span>
                                  : <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> Nicht gefunden</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[#7A6E60] mt-1">
                    {preview.filter(r => invoices.some(inv => inv.number.toUpperCase() === r.number.toUpperCase())).length} gefunden ·{' '}
                    {preview.filter(r => !invoices.some(inv => inv.number.toUpperCase() === r.number.toUpperCase())).length} nicht gefunden
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Result */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-green-700 mb-1">Aktualisiert</p>
                  <p className="text-2xl font-bold text-green-700">{result.updated}</p>
                </div>
                <div className={`rounded-xl px-4 py-3 text-center border ${result.notFound > 0 ? 'bg-amber-50 border-amber-200' : 'bg-[#F7F2EC] border-[#E1D6C2]'}`}>
                  <p className="text-xs text-[#7A6E60] mb-1">Nicht gefunden</p>
                  <p className={`text-2xl font-bold ${result.notFound > 0 ? 'text-amber-700' : 'text-[#7A6E60]'}`}>{result.notFound}</p>
                </div>
                <div className={`rounded-xl px-4 py-3 text-center border ${result.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-[#F7F2EC] border-[#E1D6C2]'}`}>
                  <p className="text-xs text-[#7A6E60] mb-1">Fehler</p>
                  <p className={`text-2xl font-bold ${result.errors > 0 ? 'text-red-600' : 'text-[#7A6E60]'}`}>{result.errors}</p>
                </div>
              </div>

              {/* Detail table */}
              <div className="border border-[#E1D6C2] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F7F2EC] sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#7A6E60] font-medium">Nr.</th>
                      <th className="text-left px-3 py-2 text-[#7A6E60] font-medium">Referenz</th>
                      <th className="text-left px-3 py-2 text-[#7A6E60] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => (
                      <tr key={i} className="border-t border-[#F7F2EC]">
                        <td className="px-3 py-1.5 font-mono font-semibold text-[#6B8E7F]">{r.number}</td>
                        <td className="px-3 py-1.5 text-[#2A2622]">{r.reference}</td>
                        <td className="px-3 py-1.5">
                          {r.status === 'ok'        && <span className="text-green-600 flex items-center gap-1"><Check size={11} /> OK</span>}
                          {r.status === 'not_found' && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> Nicht gefunden</span>}
                          {r.status === 'error'     && <span className="text-red-600 flex items-center gap-1"><X size={11} /> {r.reason}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#E1D6C2] shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC]">
            {result ? 'Schliessen' : 'Abbrechen'}
          </button>
          {!result && (
            <button
              onClick={runImport}
              disabled={preview.length === 0 || isPending}
              className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Importiere…' : `${preview.length} Referenz${preview.length !== 1 ? 'en' : ''} importieren`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export default function RechnungenClient({
  invoices: initialInvoices,
  totalOffen,
  totalBezahlt,
}: {
  invoices: Invoice[]
  totalOffen: number
  totalBezahlt: number
}) {
  const router = useRouter()
  const [filter, setFilter]         = useState<FilterKey>('alle')
  const [query, setQuery]           = useState('')
  const [showImport, setShowImport] = useState(false)
  const [invoices, setInvoices]     = useState<Invoice[]>(initialInvoices)

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

  function handleImportDone(updatedMap: Map<string, string>) {
    setInvoices(prev => prev.map(inv => {
      const ref = updatedMap.get(inv.number.toUpperCase())
      return ref !== undefined ? { ...inv, reference: ref } : inv
    }))
  }

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

      {/* Toolbar: filters + search + import */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-[#E1D6C2] p-1 shrink-0">
          {FILTERS.map(f => {
            const count = invoices.filter(inv => f.match(inv.status)).length
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:text-[#2A2622]'
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
        <div className="relative flex-1 min-w-0">
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

        {/* Import button */}
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 shrink-0 border border-[#E1D6C2] bg-white hover:bg-[#F7F2EC] text-[#4A4138] text-sm font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <Upload size={14} /> Referenzen importieren
        </button>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden flex flex-col" style={{ maxHeight: '65vh' }}>
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
          <>
            {/* Sticky Header */}
            <div className="shrink-0">
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
              </table>
            </div>
            {/* Scrollbarer Body */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <tbody>
                  {visible.map(inv => {
                    const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS.entwurf
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(`/rechnungen/${inv.id}`)}
                        className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] cursor-pointer"
                      >
                        <td className="px-5 py-3 font-mono font-semibold text-[#6B8E7F]">{inv.number}</td>
                        <td className="py-3 pr-4 font-medium text-[#2A2622]">
                          {inv.customer_name || <span className="text-[#7A6E60] italic">Kein Name</span>}
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
            </div>
          </>
        )}
      </div>

      {/* Result count when searching */}
      {q && visible.length > 0 && (
        <p className="mt-2 text-xs text-[#7A6E60] text-right">
          {visible.length} Ergebnis{visible.length !== 1 ? 'se' : ''} für «{query}»
        </p>
      )}

      {/* Import modal */}
      {showImport && (
        <ReferenzImportModal
          invoices={invoices}
          onClose={() => setShowImport(false)}
          onDone={updatedMap => { handleImportDone(updatedMap); }}
        />
      )}
    </>
  )
}
