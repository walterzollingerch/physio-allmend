'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Inbox, Mail, Phone, MessageSquare, CheckCircle, Clock, Circle } from 'lucide-react'
import type { Inquiry } from './page'

const STATUS_CONFIG = {
  new:  { label: 'Neu',        color: 'bg-amber-100 text-amber-700',  icon: Circle },
  read: { label: 'Gelesen',    color: 'bg-blue-100 text-blue-700',    icon: Clock },
  done: { label: 'Erledigt',   color: 'bg-green-100 text-green-600',  icon: CheckCircle },
}

const TOPIC_LABELS: Record<string, string> = {
  ersttermin:    'Ersttermin / Erstkonsultation',
  folgetermin:   'Folgetermin',
  information:   'Allgemeine Information',
  verordnung:    'Verordnung einreichen',
  sonstiges:     'Sonstiges',
}

export default function AnfragenClient({ inquiries: initial }: { inquiries: Inquiry[] }) {
  const supabase = createClient()
  const [list, setList] = useState<Inquiry[]>(initial)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const updateStatus = async (id: string, status: Inquiry['status']) => {
    setLoading(id)
    const { error } = await supabase
      .from('contact_inquiries')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setList(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    }
    setLoading(null)
  }

  const newCount  = list.filter(i => i.status === 'new').length
  const readCount = list.filter(i => i.status === 'read').length
  const doneCount = list.filter(i => i.status === 'done').length

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      {/* Header */}
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Inbox size={20} className="text-[#6B8E7F]" />
            <h1 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Anfragen
            </h1>
            {newCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold">
                {newCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-0 flex gap-3 flex-wrap">
        {[
          { label: 'Neu',      count: newCount,  color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Gelesen',  count: readCount, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Erledigt', count: doneCount, color: 'text-green-600 bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium ${s.color}`}>
            <span>{s.count}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {list.length === 0 ? (
          <div className="text-center py-20 text-[#7A6E60]">
            <Inbox size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Noch keine Anfragen eingegangen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {list.map(inquiry => {
                const cfg = STATUS_CONFIG[inquiry.status]
                const StatusIcon = cfg.icon
                const isActive = selected?.id === inquiry.id
                return (
                  <button
                    key={inquiry.id}
                    onClick={() => {
                      setSelected(inquiry)
                      if (inquiry.status === 'new') updateStatus(inquiry.id, 'read')
                    }}
                    className={`w-full text-left bg-white rounded-xl border p-3.5 transition-all ${
                      isActive
                        ? 'border-[#6B8E7F] shadow-sm'
                        : 'border-[#E1D6C2] hover:border-[#6B8E7F]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm text-[#2A2622] truncate">{inquiry.name}</span>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#4F7163] truncate mb-1">
                      {TOPIC_LABELS[inquiry.topic ?? ''] ?? inquiry.topic ?? '—'}
                    </p>
                    <p className="text-xs text-[#7A6E60] truncate">{inquiry.message}</p>
                    <p className="text-xs text-[#aaa] mt-1.5">
                      {new Date(inquiry.created_at).toLocaleString('de-CH', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Detail */}
            <div className="lg:col-span-3">
              {selected ? (
                <div className="bg-white rounded-2xl border border-[#E1D6C2] p-5 sm:p-6 sticky top-4">
                  {/* Status-Buttons */}
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {(Object.keys(STATUS_CONFIG) as Inquiry['status'][]).map(s => {
                      const cfg = STATUS_CONFIG[s]
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(selected.id, s)}
                          disabled={loading === selected.id || selected.status === s}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all border disabled:opacity-60 ${
                            selected.status === s
                              ? cfg.color + ' border-transparent'
                              : 'bg-white text-[#4A4138] border-[#E1D6C2] hover:border-[#6B8E7F]'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>

                  <h2 className="text-xl font-semibold text-[#2A2622] mb-4" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
                    {selected.name}
                  </h2>

                  <div className="space-y-3 mb-5">
                    <DetailRow icon={<Mail size={14} />} label="E-Mail">
                      <a href={`mailto:${selected.email}`} className="text-[#4F7163] hover:underline">
                        {selected.email}
                      </a>
                    </DetailRow>
                    {selected.phone && (
                      <DetailRow icon={<Phone size={14} />} label="Telefon">
                        <a href={`tel:${selected.phone}`} className="text-[#4F7163] hover:underline">
                          {selected.phone}
                        </a>
                      </DetailRow>
                    )}
                    <DetailRow icon={<MessageSquare size={14} />} label="Anliegen">
                      {TOPIC_LABELS[selected.topic ?? ''] ?? selected.topic ?? '—'}
                    </DetailRow>
                  </div>

                  {selected.message && (
                    <div className="bg-[#FBF7F1] rounded-xl p-4 text-sm text-[#4A4138] whitespace-pre-wrap leading-relaxed">
                      {selected.message}
                    </div>
                  )}

                  <p className="text-xs text-[#aaa] mt-4">
                    Eingegangen am{' '}
                    {new Date(selected.created_at).toLocaleString('de-CH', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>

                  {selected.user_id && (
                    <p className="text-xs text-[#7A6E60] mt-1">
                      Benutzer-ID: <span className="font-mono">{selected.user_id}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-center h-64 text-[#7A6E60] text-sm">
                  ← Anfrage auswählen
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[#6B8E7F] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-[#7A6E60] block">{label}</span>
        <span className="text-sm text-[#2A2622]">{children}</span>
      </div>
    </div>
  )
}
