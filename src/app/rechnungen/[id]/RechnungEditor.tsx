'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, Send, CheckCircle, XCircle, Search, UserRound, X, Archive, AlertTriangle } from 'lucide-react'

type Status = 'entwurf' | 'gesendet' | 'bezahlt' | 'archiviert'

interface InvoiceItem {
  id: string
  invoice_id: string
  position: number
  service_name: string
  description: string | null
  unit_price: number
  quantity: number
  unit: string
  account_id: string | null
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

interface Customer {
  id: string
  customer_number: string
  name: string
  street: string | null
  street_number: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

interface Account {
  id: string
  number: string
  name: string
  type: string
  balance: number
}

const STATUS_CONFIG: Record<Status, { label: string; cls: string }> = {
  entwurf:   { label: 'Entwurf',   cls: 'bg-[#F4EDE2] text-[#7A6E60]' },
  gesendet:  { label: 'Gesendet',  cls: 'bg-blue-100 text-blue-700' },
  bezahlt:   { label: 'Bezahlt',   cls: 'bg-green-100 text-green-700' },
  archiviert: { label: 'Archiviert', cls: 'bg-gray-100 text-gray-500' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatAddress(c: Customer): string {
  const lines: string[] = []
  const street = [c.street, c.street_number].filter(Boolean).join(' ')
  if (street) lines.push(street)
  const city = [c.postal_code, c.city].filter(Boolean).join(' ')
  if (city) lines.push(city)
  if (c.country && c.country !== 'Schweiz') lines.push(c.country)
  return lines.join('\n')
}

function newItem(invoiceId: string, position: number): Omit<InvoiceItem, 'id'> {
  return { invoice_id: invoiceId, position, service_name: '', description: null, unit_price: 0, quantity: 1, unit: 'Sitzung', account_id: null }
}

export default function RechnungEditor({ invoice: initial, initialItems, isAdmin, customers, accounts }: {
  invoice: Invoice
  initialItems: InvoiceItem[]
  isAdmin: boolean
  customers: Customer[]
  accounts: Account[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, start] = useTransition()

  const [inv, setInv]     = useState<Invoice>(initial)
  const [items, setItems] = useState<InvoiceItem[]>(initialItems)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Customer picker
  const [showPicker, setShowPicker]       = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')

  // Send modal
  const [showSendModal, setShowSendModal]         = useState(false)
  const [forderungsKontoId, setForderungsKontoId] = useState('')

  // Derived
  const subtotal    = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
  const discountAmt = inv.discount_type === 'percent'
    ? subtotal * Number(inv.discount_value) / 100
    : Number(inv.discount_value)
  const total = subtotal - discountAmt

  const ertragskonten   = accounts.filter(a => a.type === 'ertrag')
  const forderungskonten = accounts.filter(a => a.number.startsWith('110'))

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customer_number.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // ── Helpers ───────────────────────────────────────────────
  const setField = (key: keyof Invoice, value: unknown) => setInv(prev => ({ ...prev, [key]: value }))

  function updateItem(id: string, key: keyof InvoiceItem, value: unknown) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  function selectCustomer(c: Customer) {
    setInv(prev => ({ ...prev, customer_name: c.name, customer_address: formatAddress(c) }))
    setShowPicker(false)
    setCustomerSearch('')
  }

  // ── Add / remove items ────────────────────────────────────
  async function addItem() {
    const { data, error: err } = await supabase
      .from('invoice_items')
      .insert(newItem(inv.id, items.length))
      .select()
      .single()
    if (err) { setError(err.message); return }
    setItems(prev => [...prev, data as InvoiceItem])
  }

  async function removeItem(id: string) {
    await supabase.from('invoice_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // ── Save ──────────────────────────────────────────────────
  const save = useCallback(async (statusOverride?: Status) => {
    setError(null)
    return new Promise<boolean>(resolve => {
      start(async () => {
        const { id: _id, ...invData } = inv
        if (statusOverride) invData.status = statusOverride

        const { error: invErr } = await supabase.from('invoices').update(invData).eq('id', inv.id)
        if (invErr) { setError(invErr.message); resolve(false); return }

        for (const item of items) {
          await supabase.from('invoice_items').upsert(item)
        }

        if (statusOverride) setInv(prev => ({ ...prev, status: statusOverride }))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        resolve(true)
      })
    })
  }, [inv, items, supabase])

  // ── Send with journal entries ─────────────────────────────
  async function handleSend() {
    if (!forderungsKontoId) return
    setError(null)
    start(async () => {
      // Save invoice as 'gesendet'
      const { id: _id, ...invData } = inv
      invData.status = 'gesendet'
      const { error: invErr } = await supabase.from('invoices').update(invData).eq('id', inv.id)
      if (invErr) { setError(invErr.message); return }
      for (const item of items) { await supabase.from('invoice_items').upsert(item) }

      // Create journal entries per position with account_id
      const itemsWithAccount = items.filter(i => i.account_id)
      const forderungsAcc = accounts.find(a => a.id === forderungsKontoId)

      // Accumulate balance deltas
      const balanceDeltas = new Map<string, number>()

      for (const item of itemsWithAccount) {
        const amount = Number(item.unit_price) * Number(item.quantity)
        if (amount <= 0) continue

        await supabase.from('journal_entries').insert({
          date: inv.invoice_date,
          description: `${inv.number} – ${item.service_name}`,
          debit_account_id: forderungsKontoId,
          credit_account_id: item.account_id as string,
          amount,
          invoice_id: inv.id,
        })

        // Forderungskonto (aktiv) im Soll → balance +
        balanceDeltas.set(forderungsKontoId, (balanceDeltas.get(forderungsKontoId) ?? 0) + amount)
        // Ertragskonto (ertrag) im Haben → balance +
        balanceDeltas.set(item.account_id!, (balanceDeltas.get(item.account_id!) ?? 0) + amount)
      }

      // Update account balances
      for (const [accountId, delta] of balanceDeltas.entries()) {
        const acc = accounts.find(a => a.id === accountId)
        if (acc) {
          await supabase.from('accounts').update({ balance: Number(acc.balance) + delta }).eq('id', accountId)
        }
      }

      setInv(prev => ({ ...prev, status: 'gesendet' }))
      setShowSendModal(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function handleArchive() {
    setError(null)
    start(async () => {
      // Fetch related journal entries with fresh account balances
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id, amount, debit_account_id, credit_account_id')
        .eq('invoice_id', inv.id)

      if (entries && entries.length > 0) {
        // Accumulate balance reversals
        const deltas = new Map<string, number>()
        for (const entry of entries) {
          const amt = Number(entry.amount)
          deltas.set(entry.debit_account_id,  (deltas.get(entry.debit_account_id)  ?? 0) - amt)
          deltas.set(entry.credit_account_id, (deltas.get(entry.credit_account_id) ?? 0) - amt)
        }

        // Fetch current balances and reverse them
        for (const [accountId, delta] of deltas.entries()) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
          if (acc) {
            await supabase.from('accounts').update({ balance: Number(acc.balance) + delta }).eq('id', accountId)
          }
        }

        // Delete the journal entries
        await supabase.from('journal_entries').delete().eq('invoice_id', inv.id)
      }

      // Set invoice to archiviert
      const { error: invErr } = await supabase.from('invoices').update({ status: 'archiviert' }).eq('id', inv.id)
      if (invErr) { setError(invErr.message); return }

      setInv(prev => ({ ...prev, status: 'archiviert' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

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
  const itemsMissingAccount = items.filter(i => !i.account_id && (Number(i.unit_price) * Number(i.quantity)) > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              {inv.number}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-sm text-[#7A6E60] mt-0.5">Rechnung bearbeiten</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            {saved ? 'Gespeichert ✓' : 'Speichern'}
          </button>
          {inv.status === 'entwurf' && (
            <button
              onClick={() => setShowSendModal(true)}
              disabled={isPending}
              className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Send size={15} /> Versenden
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
          {(inv.status === 'gesendet' || inv.status === 'bezahlt') && (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="flex items-center gap-2 border border-[#E1D6C2] text-[#7A6E60] hover:bg-[#F7F2EC] text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Archive size={14} /> Archivieren
            </button>
          )}
          {isAdmin && inv.status === 'archiviert' && (
            <button onClick={() => save('entwurf')} className="text-sm text-[#7A6E60] border border-[#E1D6C2] px-4 py-2 rounded-lg hover:bg-[#F7F2EC]">
              Reaktivieren
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {/* Address + Meta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rechnungsadresse */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#2A2622] text-sm" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Rechnungsadresse</h2>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-xs text-[#6B8E7F] hover:text-[#5a7a6c] font-medium border border-[#E1D6C2] px-2.5 py-1 rounded-lg"
            >
              <UserRound size={13} /> Aus Kundenstamm
            </button>
          </div>
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
          <table className="w-full text-sm" style={{ minWidth: '780px' }}>
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide bg-[#F7F2EC] border-b border-[#E1D6C2]">
                <th className="text-left px-5 py-2.5 w-[22%]">Leistung</th>
                <th className="text-left py-2.5 w-[20%]">Beschreibung</th>
                <th className="text-left py-2.5 w-[22%]">Ertragskonto</th>
                <th className="text-right py-2.5 w-[12%]">Einzelpreis</th>
                <th className="text-right py-2.5 w-[8%]">Menge</th>
                <th className="text-left py-2.5 px-2 w-[8%]">Einheit</th>
                <th className="text-right py-2.5 pr-5 w-[10%]">Summe</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-[#F7F2EC] last:border-0">
                  <td className="px-5 py-2">
                    <input
                      value={item.service_name}
                      onChange={e => updateItem(item.id, 'service_name', e.target.value)}
                      placeholder="Physiotherapie"
                      className={inpSm}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={item.description ?? ''}
                      onChange={e => updateItem(item.id, 'description', e.target.value || null)}
                      placeholder="Optional"
                      className={inpSm}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={item.account_id ?? ''}
                      onChange={e => updateItem(item.id, 'account_id', e.target.value || null)}
                      className={inpSm + ' text-xs'}
                    >
                      <option value="">— Konto —</option>
                      {ertragskonten.map(a => (
                        <option key={a.id} value={a.id}>{a.number} {a.name}</option>
                      ))}
                    </select>
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
                      {['Sitzung', 'Stk.', 'h', 'min', 'Pauschal'].map(u => <option key={u}>{u}</option>)}
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
            <textarea value={inv.notes ?? ''} onChange={e => setField('notes', e.target.value || null)} rows={4} placeholder="Für den Kunden sichtbar" className={inp + ' resize-none'} />
          </Field>
        </div>
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <Field label="Bedingungen">
            <textarea value={inv.conditions ?? ''} onChange={e => setField('conditions', e.target.value || null)} rows={4} placeholder="Zahlung innerhalb 30 Tagen" className={inp + ' resize-none'} />
          </Field>
        </div>
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <Field label="Fusszeile">
            <textarea value={inv.footer ?? ''} onChange={e => setField('footer', e.target.value || null)} rows={4} placeholder="z.B. IBAN, Danksagung…" className={inp + ' resize-none'} />
          </Field>
        </div>
      </div>

      {/* ── Customer Picker Modal ───────────────────────────── */}
      {showPicker && (
        <Modal title="Kunde auswählen" onClose={() => { setShowPicker(false); setCustomerSearch('') }}>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E60]" />
            <input
              autoFocus
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Name oder Nummer…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#E1D6C2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F]"
            />
          </div>
          <div className="max-h-80 overflow-y-auto -mx-6 px-6">
            {filteredCustomers.length === 0 ? (
              <p className="text-sm text-[#7A6E60] text-center py-6">Keine Treffer</p>
            ) : (
              <ul>
                {filteredCustomers.map(c => (
                  <li key={c.id}>
                    <button
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F7F2EC] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#7A6E60] w-14">{c.customer_number}</span>
                        <div>
                          <p className="font-medium text-[#2A2622] text-sm">{c.name}</p>
                          {(c.postal_code || c.city) && (
                            <p className="text-xs text-[#7A6E60]">{[c.postal_code, c.city].filter(Boolean).join(' ')}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {/* ── Send Modal ──────────────────────────────────────── */}
      {showSendModal && (
        <Modal title="Rechnung versenden & buchen" onClose={() => setShowSendModal(false)}>
          <div className="space-y-4">
            {itemsMissingAccount.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  {itemsMissingAccount.length} Position{itemsMissingAccount.length > 1 ? 'en haben' : ' hat'} kein Ertragskonto — für diese wird keine Buchung erstellt.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#7A6E60] mb-1">Forderungskonto (Gruppe 110) *</label>
              {forderungskonten.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Keine Konten in Gruppe 110 gefunden. Bitte zuerst Forderungskonten (11xx) anlegen.
                </p>
              ) : (
                <select
                  value={forderungsKontoId}
                  onChange={e => setForderungsKontoId(e.target.value)}
                  className={inp}
                  autoFocus
                >
                  <option value="">— Konto wählen —</option>
                  {forderungskonten.map(a => (
                    <option key={a.id} value={a.id}>{a.number} {a.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Preview of journal entries */}
            {forderungsKontoId && items.filter(i => i.account_id).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#7A6E60] mb-2 uppercase tracking-wide">Buchungsvorschau</p>
                <div className="rounded-lg border border-[#E1D6C2] overflow-hidden text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F7F2EC] text-[#7A6E60]">
                        <th className="text-left px-3 py-2">Position</th>
                        <th className="text-left py-2">Soll</th>
                        <th className="text-left py-2">Haben</th>
                        <th className="text-right py-2 pr-3">CHF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter(i => i.account_id).map(item => {
                        const ertragAcc = accounts.find(a => a.id === item.account_id)
                        const fordAcc   = accounts.find(a => a.id === forderungsKontoId)
                        return (
                          <tr key={item.id} className="border-t border-[#F7F2EC]">
                            <td className="px-3 py-1.5 text-[#2A2622] font-medium">{item.service_name || '—'}</td>
                            <td className="py-1.5 text-[#4A4138]">{fordAcc?.number} {fordAcc?.name}</td>
                            <td className="py-1.5 text-[#4A4138]">{ertragAcc?.number} {ertragAcc?.name}</td>
                            <td className="py-1.5 pr-3 text-right font-medium text-[#2A2622]">
                              {fmt(Number(item.unit_price) * Number(item.quantity))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSend}
                disabled={isPending || !forderungsKontoId}
                className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isPending ? 'Wird gesendet…' : 'Versenden & Buchen'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Shared ───────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
          <h2 className="text-base font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{title}</h2>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={20} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
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

const inp   = 'w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
const inpSm = 'w-full border border-[#E1D6C2] rounded-md px-2 py-1.5 text-sm text-[#2A2622] focus:outline-none focus:ring-1 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
