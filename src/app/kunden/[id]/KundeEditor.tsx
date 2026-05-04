'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Trash2 } from 'lucide-react'

interface Customer {
  id: string
  customer_number: string
  name: string
  street: string | null
  street_number: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  phone: string | null
  website: string | null
}

export default function KundeEditor({ customer: initial, isAdmin }: {
  customer: Customer
  isAdmin: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, start] = useTransition()
  const [c, setC] = useState<Customer>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = (key: keyof Customer, value: string) =>
    setC(prev => ({ ...prev, [key]: value || null }))

  async function handleSave() {
    setError(null)
    start(async () => {
      const { error: err } = await supabase
        .from('customers')
        .update({
          customer_number: c.customer_number,
          name: c.name,
          street: c.street,
          street_number: c.street_number,
          postal_code: c.postal_code,
          city: c.city,
          country: c.country,
          phone: c.phone,
          website: c.website,
        })
        .eq('id', c.id)
      if (err) { setError(err.message); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function handleDelete() {
    if (!confirm(`Kunde "${c.name}" wirklich löschen?`)) return
    start(async () => {
      await supabase.from('customers').delete().eq('id', c.id)
      router.push('/kunden')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-[#6B8E7F]">{initial.customer_number}</span>
          </div>
          <h1 className="text-2xl font-light text-[#2A2622] mt-0.5" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            {initial.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-sm text-red-500 hover:text-red-700 border border-red-200 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Löschen
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Save size={15} />
            {saved ? 'Gespeichert ✓' : isPending ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Stammdaten */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 space-y-4">
          <h2 className="font-semibold text-[#2A2622] text-sm" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Stammdaten
          </h2>
          <Field label="Kundennummer">
            <input value={c.customer_number} onChange={e => set('customer_number', e.target.value)} className={inp} />
          </Field>
          <Field label="Name / Firma *">
            <input value={c.name} onChange={e => set('name', e.target.value)} required className={inp} />
          </Field>
          <Field label="Telefon">
            <input value={c.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+41 56 …" className={inp} />
          </Field>
          <Field label="Webseite">
            <input value={c.website ?? ''} onChange={e => set('website', e.target.value)} placeholder="www.beispiel.ch" className={inp} />
          </Field>
        </div>

        {/* Adresse */}
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 space-y-4">
          <h2 className="font-semibold text-[#2A2622] text-sm" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Adresse
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Strasse">
                <input value={c.street ?? ''} onChange={e => set('street', e.target.value)} placeholder="Musterstrasse" className={inp} />
              </Field>
            </div>
            <Field label="Nr.">
              <input value={c.street_number ?? ''} onChange={e => set('street_number', e.target.value)} placeholder="1a" className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="PLZ">
              <input value={c.postal_code ?? ''} onChange={e => set('postal_code', e.target.value)} placeholder="5400" className={inp} />
            </Field>
            <div className="col-span-2">
              <Field label="Ort">
                <input value={c.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Baden" className={inp} />
              </Field>
            </div>
          </div>
          <Field label="Land">
            <input value={c.country ?? ''} onChange={e => set('country', e.target.value)} placeholder="Schweiz" className={inp} />
          </Field>
        </div>
      </div>

      {/* Adressvorschau */}
      {(c.name || c.street || c.city) && (
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
          <p className="text-xs font-medium text-[#7A6E60] mb-3 uppercase tracking-wide">Adressvorschau</p>
          <pre className="text-sm text-[#2A2622] font-sans leading-relaxed">
            {[
              c.name,
              [c.street, c.street_number].filter(Boolean).join(' '),
              [c.postal_code, c.city].filter(Boolean).join(' '),
              c.country !== 'Schweiz' ? c.country : null,
            ].filter(Boolean).join('\n')}
          </pre>
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
