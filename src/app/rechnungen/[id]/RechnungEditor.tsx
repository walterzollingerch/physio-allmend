'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, Send, CheckCircle, XCircle, ChevronDown } from 'lucide-react'

type Status = 'entwurf' | 'gesendet' | 'bezahlt' | 'storniert'

interface InvoiceItem {
  id: string
  invoice_id: string
  position: number
  service_name: string
  description: string | null
  unit_price: number
  quantity: number
  unit: string
}

interface Invoice {
  id: string
  number: string
  customer_name: string
  customer_address: string
  invoice_date: string
  due_date: string | null
  delivery_date: string | null
  reference: string | null
  bank_info: string | null
  conditions: string | null
  notes: string | null
  footer: string | null
  discount_type: 'percent' | 'amount'
  discount_value: number
  status: Status
}

const STATUS_CONFIG: Record<Status, { label: string; cls: string }> = {
  entwurf:   { label: 'Entwurf',   cls: 'bg-[#F4EDE2] text-[#7A6E60]' },
  gesendet:  { label: 'Gesendet',  cls: 'bg-blue-100 text-blue-700' },
  bezahlt:   { label: 'Bezahlt',   cls: 'bg-green-100 text-green-700' },
  storniert: { label: 'Storniert', cls: 'bg-red-100 text-red-600' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function newItem(invoiceId: string, position: number): Omit<InvoiceItem, 'id'> {
  return { invoice_id: invoiceId, position, service_name: '', description: null, unit_price: 0, quantity: 1, unit: 'Stk.' }
}

export default function RechnungEditor({ invoice: initial, initialItems, isAdmin }: {
  invoice: Invoice
  initialItems: InvoiceItem[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, start] = useTransition()

  const [inv, setInv] = useState<Invoice>(initial)
  const [items, setItems] = useState<InvoiceItem[]>(
    initialItems.length > 0 ? initialItems : []
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ── Calculations ──────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
  const discountAmt = inv.discount_type === 'percent'
    ? subtotal * Number(inv.discount_value) / 100
    : Number(inv.discount_value)
  const total = subtotal - discountAmt

  // ── Field update helpers ──────────────────────────────────
  const setField = (key: keyof Invoice, value: any) => setInv(prev => ({ ...prev, [key]: value }))

  function updateItem(id: string, key: keyof InvoiceItem, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  // ── Add / remove items ────────────────────────────────────
  async function addItem() {
    const { data, error: err } = await supabase
      .from('invoice_items')
      .insert(newItem(inv.id, items.length))
      .select()
      .single()
    if (err) { setError(err.message); return }
    setItems(prev => [...prev, data])
  }

  async function removeItem(id: string) {
    await supabase.from('invoice_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // ── Save ──────────────────────────────────────────────────
  const save = useCallback(async (statusOverride?: Status) => {
    setError(null)
    start(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, created_at: _ca, ...invData } = inv
      if (statusOverride) invData.status = statusOverride

      const { error: invErr } = await supabase
        .from('invoices')
        .update(invData)
        .eq('id', inv.id)

      if (invErr) { setError(invErr.message); return }

      // Upsert all items
      for (const item of items) {
        await supabase.from('invoice_items').upsert(item)
      }

      if (statusOverride) {
        setInv(prev => ({ ...prev, status: statusOverride }))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }, [inv, items, supabase])

  async function handleDelete() {
    if (!confirm('Rechnung wirklich löschen?')) return
    await supabase.from('invoices').delete().eq('id', inv.id)
    router.push('/rechnungen')
  }

  const addDays = (days: number) => {
    const d = new Date(inv.invoice_date || new Date())
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  const st = STATUS_CONFIG[inv.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              {inv.number}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-sm text-[#7A6E60] mt-0.5">Rechnung bearbeiten</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && inv.status === 'entwurf' && (
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700 px-3 py-2">
              Löschen
            </button>
          )}
          <button
            onClick={() => save()}
            disabled={isPending}
            className="flex items-center gap-2 border border-[#E1D6C2] bg-white hover:bg-[#F7F2EC] text-[#4A4138] text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Save size={15} />
            {saved ? 'Gespeichert' : 'Speichern'}
          </button>
          {inv.status === 'entwurf' && (
            <button
              onClick={() => save('gesendet')}
              disabled={isPending}
              className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Send size={15} /> Senden
            </button>
          )}
          {inv.status === 'gesendet' && (
            <button
              onClick={() => save('bezahlt')}
              disabled={isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <CheckCircle size={15} /> Als bezahlt markieren
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {/* Top form: address + meta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rechnungsadresse */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 space-y-4">
          <h2 className="font-semibold text-[#2A2622] text-sm" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Rechnungsadresse</h2>
          <Field label="Name / Firma">
            <input
              value={inv.customer_name}
              onChange={e => setField('customer_name', e.target.value)}
              placeholder="Patientin Muster"
              className={inp}
            />
          </Field>
          <Field label="Adresse">
            <textarea
              value={inv.customer_address}
              onChange={e => setField('customer_address', e.target.value)}
              placeholder={'Musterstrasse 1\n5400 Baden'}
              rows={3}
              className={inp + ' resize-none'}
            />
          </Field>
        </div>

        {/* Metadaten */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 space-y-4">
          <h2 className="font-semibold text-[#2A2622] text-sm" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Rechnungsdetails</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rechnungsdatum">
              <input type="date" value={inv.invoice_date} onChange={e => setField('invoice_date', e.target.value)} className={inp} />
            </Field>
            <Field label="Rechnungsnummer">
              <input value={inv.number} readOnly className={inp + ' bg-[#F7F2EC] text-[#7A6E60]'} />
            </Field>
          </div>
          <Field label="Fällig am">
            <div className="flex items-center gap-2">
              <input type="date" value={inv.due_date ?? ''} onChange={e => setField('due_date', e.target.value || null)} className={inp + ' flex-1'} />
              <button onClick={() => setField('due_date', addDays(10))} className="text-xs border border-[#E1D6C2] px-2 py-1.5 rounded-lg text-[#7A6E60] hover:bg-[#F7F2EC] whitespace-nowrap">+10</button>
              <button onClick={() => setField('due_date', addDays(30))} className="text-xs border border-[#E1D6C2] px-2 py-1.5 rounded-lg text-[#7A6E60] hover:bg-[#F7F2EC] whitespace-nowrap">+30</button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lieferdatum">
              <input type="date" value={inv.delivery_date ?? ''} onChange={e => setField('delivery_date', e.target.value || null)} className={inp} />
            </Field>
            <Field label="Referenz">
              <input value={inv.reference ?? ''} onChange={e => setField('reference', e.target.value)} placeholder="Optional" className={inp} />
            </Field>
          </div>
          <Field label="Bankverbindung">
            <input value={inv.bank_info ?? ''} onChange={e => setField('bank_info', e.target.value)} placeholder="Migros Bank AG" className={inp} />
          </Field>
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E1D6C2]">
          <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Positionen</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide bg-[#F7F2EC] border-b border-[#E1D6C2]">
                <th className="text-left px-5 py-2.5 w-[30%]">Leistung</th>
                <th className="text-left py-2.5 w-[30%]">Beschreibung</th>
                <th className="text-right py-2.5 w-[14%]">Einzelpreis</th>
                <th className="text-right py-2.5 w-[10%]">Menge</th>
                <th className="text-left py-2.5 px-2 w-[10%]">Einheit</th>
                <th className="text-right py-2.5 pr-5 w-[12%]">Summe</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-[#F7F2EC] last:border-0">
                  <td className="px-5 py-2">
                    <input
                      value={item.service_name}
                      onChange={e => updateItem(item.id, 'service_name', e.target.value)}
                      placeholder="Physiotherapie"
                      className={inpSm}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      value={item.description ?? ''}
                      onChange={e => updateItem(item.id, 'description', e.target.value || null)}
                      placeholder="Optional"
                      className={inpSm}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" step="0.05" min="0"
                      value={item.unit_price}
                      onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className={inpSm + ' text-right'}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" step="0.5" min="0"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className={inpSm + ' text-right'}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} className={inpSm}>
                      {['Stk.', 'h', 'min', 'Sitzung', 'Pauschal'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-5 text-right font-medium text-[#2A2622]">
                    {fmt(Number(item.unit_price) * Number(item.quantity))}
                  </td>
                  <td className="py-2 pr-2">
                    <button onClick={() => removeItem(item.id)} className="text-[#7A6E60] hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[#E1D6C2]">
          <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-[#6B8E7F] hover:text-[#5a7a6c] font-medium">
            <Plus size={15} /> Position hinzufügen
          </button>
        </div>

        {/* Totals */}
        <div className="border-t border-[#E1D6C2] bg-[#F7F2EC]">
          <div className="flex justify-end px-5 py-3 gap-6 text-sm">
            <span className="text-[#7A6E60]">Zwischensumme</span>
            <span className="font-medium text-[#2A2622] w-28 text-right">CHF {fmt(subtotal)}</span>
          </div>
          <div className="flex justify-end items-center px-5 pb-3 gap-3 text-sm">
            <span className="text-[#7A6E60]">Rabatt</span>
            <input
              type="number" min="0" step="0.01"
              value={inv.discount_value}
              onChange={e => setField('discount_value', parseFloat(e.target.value) || 0)}
              className="border border-[#E1D6C2] rounded-lg px-3 py-1.5 text-sm text-right w-24 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40"
            />
            <div className="flex rounded-lg border border-[#E1D6C2] overflow-hidden bg-white text-xs">
              <button
                onClick={() => setField('discount_type', 'percent')}
                className={`px-3 py-1.5 font-medium transition-colors ${inv.discount_type === 'percent' ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:bg-[#F7F2EC]'}`}
              >%</button>
              <button
                onClick={() => setField('discount_type', 'amount')}
                className={`px-3 py-1.5 font-medium transition-colors ${inv.discount_type === 'amount' ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:bg-[#F7F2EC]'}`}
              >CHF</button>
            </div>
            <span className="text-[#7A6E60] w-28 text-right">- CHF {fmt(discountAmt)}</span>
          </div>
          <div className="flex justify-end px-5 pb-4 gap-6 border-t border-[#E1D6C2] pt-3">
            <span className="font-semibold text-[#2A2622]">Total</span>
            <span className="font-bold text-xl text-[#2A2622] w-28 text-right">CHF {fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Notizen & Bedingungen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <Field label="Öffentliche Notizen">
            <textarea
              value={inv.notes ?? ''}
              onChange={e => setField('notes', e.target.value || null)}
              rows={4}
              placeholder="Für den Kunden sichtbar"
              className={inp + ' resize-none'}
            />
          </Field>
        </div>
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <Field label="Bedingungen">
            <textarea
              value={inv.conditions ?? ''}
              onChange={e => setField('conditions', e.target.value || null)}
              rows={4}
              placeholder="Zahlung innerhalb 30 Tagen"
              className={inp + ' resize-none'}
            />
          </Field>
        </div>
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <Field label="Fusszeile">
            <textarea
              value={inv.footer ?? ''}
              onChange={e => setField('footer', e.target.value || null)}
              rows={4}
              placeholder="z.B. IBAN, Danksagung…"
              className={inp + ' resize-none'}
            />
          </Field>
        </div>
      </div>

      {/* Status change (admin) */}
      {isAdmin && (
        <div className="flex gap-3 justify-end">
          {inv.status !== 'storniert' && (
            <button onClick={() => save('storniert')} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 border border-red-200 px-4 py-2 rounded-lg transition-colors">
              <XCircle size={15} /> Stornieren
            </button>
          )}
          {inv.status === 'storniert' && (
            <button onClick={() => save('entwurf')} className="text-sm text-[#7A6E60] border border-[#E1D6C2] px-4 py-2 rounded-lg hover:bg-[#F7F2EC]">
              Reaktivieren
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#7A6E60] mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
const inpSm = 'w-full border border-[#E1D6C2] rounded-md px-2 py-1.5 text-sm text-[#2A2622] focus:outline-none focus:ring-1 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
