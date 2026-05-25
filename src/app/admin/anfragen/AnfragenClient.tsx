'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Inbox, Mail, Phone, MessageSquare,
  CheckCircle, Clock, Circle, CalendarDays, Loader2, X
} from 'lucide-react'
import type { Inquiry, TreatmentType } from './page'

const STATUS_CONFIG = {
  new:  { label: 'Neu',      color: 'bg-amber-100 text-amber-700',  icon: Circle },
  read: { label: 'Gelesen',  color: 'bg-blue-100 text-blue-700',    icon: Clock },
  done: { label: 'Erledigt', color: 'bg-green-100 text-green-600',  icon: CheckCircle },
}

const TOPIC_LABELS: Record<string, string> = {
  ersttermin:  'Ersttermin / Erstkonsultation',
  folgetermin: 'Folgetermin',
  information: 'Allgemeine Information',
  verordnung:  'Verordnung einreichen',
  sonstiges:   'Sonstiges',
}

type BusySlot = { start: string; end: string; title: string }

// Zeitslots 08:00–18:30 in 30-Min-Schritten
const TIME_SLOTS: string[] = []
for (let h = 8; h <= 18; h++) {
  for (const m of [0, 30]) {
    if (h === 18 && m === 30) break
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function isSlotBusy(slot: string, durationMin: number, busy: BusySlot[]): boolean {
  const [sh, sm] = slot.split(':').map(Number)
  const slotStart = sh * 60 + sm
  const slotEnd = slotStart + durationMin

  return busy.some(b => {
    const [bsh, bsm] = b.start.split(':').map(Number)
    const [beh, bem] = b.end.split(':').map(Number)
    const busyStart = bsh * 60 + bsm
    const busyEnd = beh * 60 + bem
    return slotStart < busyEnd && slotEnd > busyStart
  })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function AnfragenClient({
  inquiries: initial,
  treatmentTypes,
}: {
  inquiries: Inquiry[]
  treatmentTypes: TreatmentType[]
}) {
  const supabase = createClient()
  const [list, setList] = useState<Inquiry[]>(initial)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Termin-Planung
  const [scheduling, setScheduling] = useState(false)
  const [schedDate, setSchedDate] = useState(todayStr())
  const [schedTime, setSchedTime] = useState('')
  const [schedTreatment, setSchedTreatment] = useState(treatmentTypes[0]?.id ?? '')
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [busyLoading, setBusyLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmSuccess, setConfirmSuccess] = useState(false)

  const selectedDuration = treatmentTypes.find(t => t.id === schedTreatment)?.duration_min ?? 60

  const fetchBusy = useCallback(async (date: string) => {
    setBusyLoading(true)
    try {
      const res = await fetch(`/api/calendar/busy?date=${date}`)
      const json = await res.json()
      setBusy(json.busy ?? [])
    } catch {
      setBusy([])
    }
    setBusyLoading(false)
  }, [])

  useEffect(() => {
    if (scheduling && schedDate) fetchBusy(schedDate)
  }, [scheduling, schedDate, fetchBusy])

  const updateStatus = async (id: string, status: Inquiry['status']) => {
    setLoading(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('contact_inquiries')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setList(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    }
    setLoading(null)
  }

  const openScheduling = () => {
    setSchedDate(todayStr())
    setSchedTime('')
    setSchedTreatment(treatmentTypes[0]?.id ?? '')
    setConfirmSuccess(false)
    setScheduling(true)
  }

  const confirmAppointment = async () => {
    if (!selected || !schedDate || !schedTime || !schedTreatment) return
    setConfirming(true)

    const res = await fetch('/api/anfragen/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inquiry_id: selected.id,
        date: schedDate,
        time: schedTime,
        treatment_type_id: schedTreatment,
      }),
    })

    if (res.ok) {
      setConfirmSuccess(true)
      setList(prev => prev.map(i => i.id === selected.id ? { ...i, status: 'done' } : i))
      setSelected(prev => prev ? { ...prev, status: 'done' } : null)
      setTimeout(() => { setScheduling(false); setConfirmSuccess(false) }, 2000)
    }
    setConfirming(false)
  }

  const newCount  = list.filter(i => i.status === 'new').length

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
                      setScheduling(false)
                      if (inquiry.status === 'new') updateStatus(inquiry.id, 'read')
                    }}
                    className={`w-full text-left bg-white rounded-xl border p-3.5 transition-all ${
                      isActive ? 'border-[#6B8E7F] shadow-sm' : 'border-[#E1D6C2] hover:border-[#6B8E7F]'
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
                      <a href={`mailto:${selected.email}`} className="text-[#4F7163] hover:underline">{selected.email}</a>
                    </DetailRow>
                    {selected.phone && (
                      <DetailRow icon={<Phone size={14} />} label="Telefon">
                        <a href={`tel:${selected.phone}`} className="text-[#4F7163] hover:underline">{selected.phone}</a>
                      </DetailRow>
                    )}
                    <DetailRow icon={<MessageSquare size={14} />} label="Anliegen">
                      {TOPIC_LABELS[selected.topic ?? ''] ?? selected.topic ?? '—'}
                    </DetailRow>
                  </div>

                  {selected.message && (
                    <div className="bg-[#FBF7F1] rounded-xl p-4 text-sm text-[#4A4138] whitespace-pre-wrap leading-relaxed mb-4">
                      {selected.message}
                    </div>
                  )}

                  {/* Termin festlegen Button */}
                  {!scheduling && selected.status !== 'done' && (
                    <button
                      onClick={openScheduling}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4F7163] text-white text-sm font-medium hover:bg-[#3d5a4e] transition-colors"
                    >
                      <CalendarDays size={16} />
                      Termin festlegen
                    </button>
                  )}

                  {/* Termin-Planer */}
                  {scheduling && (
                    <div className="mt-4 border border-[#E1D6C2] rounded-xl overflow-hidden">
                      <div className="bg-[#F4EDE2] px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
                          Termin festlegen
                        </span>
                        <button onClick={() => setScheduling(false)} className="text-[#7A6E60] hover:text-[#2A2622]">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Behandlungstyp */}
                        <div>
                          <label className="text-xs text-[#7A6E60] block mb-1.5">Behandlung</label>
                          <select
                            value={schedTreatment}
                            onChange={e => setSchedTreatment(e.target.value)}
                            className="w-full text-sm border border-[#E1D6C2] rounded-lg px-3 py-2 bg-white text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
                          >
                            {treatmentTypes.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.duration_min} Min.)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Datum */}
                        <div>
                          <label className="text-xs text-[#7A6E60] block mb-1.5">Datum</label>
                          <input
                            type="date"
                            value={schedDate}
                            min={todayStr()}
                            onChange={e => { setSchedDate(e.target.value); setSchedTime('') }}
                            className="w-full text-sm border border-[#E1D6C2] rounded-lg px-3 py-2 bg-white text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
                          />
                        </div>

                        {/* Zeitslots */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#7A6E60]">Uhrzeit</label>
                            {busyLoading && (
                              <span className="flex items-center gap-1 text-xs text-[#7A6E60]">
                                <Loader2 size={11} className="animate-spin" /> Kalender wird geladen…
                              </span>
                            )}
                            {!busyLoading && busy.length > 0 && (
                              <span className="text-xs text-[#7A6E60]">{busy.length} Termin{busy.length !== 1 ? 'e' : ''} belegt</span>
                            )}
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-52 overflow-y-auto">
                            {TIME_SLOTS.map(slot => {
                              const isBusy = isSlotBusy(slot, selectedDuration, busy)
                              const isSelected = schedTime === slot
                              const busyInfo = busy.find(b => {
                                const [bsh, bsm] = b.start.split(':').map(Number)
                                const [beh, bem] = b.end.split(':').map(Number)
                                const [sh, sm] = slot.split(':').map(Number)
                                const slotMin = sh * 60 + sm
                                return slotMin >= bsh * 60 + bsm && slotMin < beh * 60 + bem
                              })

                              return (
                                <button
                                  key={slot}
                                  disabled={isBusy}
                                  onClick={() => setSchedTime(slot)}
                                  title={isBusy ? (busyInfo?.title ?? 'Belegt') : slot}
                                  className={`text-xs py-2 rounded-lg font-medium transition-all border ${
                                    isSelected
                                      ? 'bg-[#4F7163] text-white border-transparent'
                                      : isBusy
                                        ? 'bg-[#F4EDE2] text-[#C4B9AA] border-[#E1D6C2] cursor-not-allowed line-through'
                                        : 'bg-white text-[#2A2622] border-[#E1D6C2] hover:border-[#6B8E7F] hover:bg-[#F4EDE2]'
                                  }`}
                                >
                                  {slot}
                                </button>
                              )
                            })}
                          </div>

                          {/* Legende */}
                          <div className="flex gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-xs text-[#7A6E60]">
                              <span className="w-3 h-3 rounded bg-[#4F7163] inline-block" /> Ausgewählt
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-[#7A6E60]">
                              <span className="w-3 h-3 rounded bg-[#F4EDE2] border border-[#E1D6C2] inline-block" /> Belegt
                            </span>
                          </div>
                        </div>

                        {/* Belegte Termine anzeigen */}
                        {busy.length > 0 && (
                          <div className="bg-[#FBF7F1] rounded-lg p-3">
                            <p className="text-xs font-medium text-[#4A4138] mb-1.5">Bereits eingetragen:</p>
                            <div className="space-y-1">
                              {busy.map((b, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-[#7A6E60]">
                                  <span className="font-medium text-[#2A2622]">{b.start}–{b.end}</span>
                                  <span className="truncate">{b.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bestätigen */}
                        {confirmSuccess ? (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                            <CheckCircle size={16} />
                            Termin erstellt & im Kalender eingetragen!
                          </div>
                        ) : (
                          <button
                            onClick={confirmAppointment}
                            disabled={!schedDate || !schedTime || !schedTreatment || confirming}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#4F7163] text-white text-sm font-medium hover:bg-[#3d5a4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {confirming ? (
                              <><Loader2 size={15} className="animate-spin" /> Wird eingetragen…</>
                            ) : (
                              <><CalendarDays size={15} /> Termin bestätigen & in Kalender eintragen</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[#aaa] mt-4">
                    Eingegangen am{' '}
                    {new Date(selected.created_at).toLocaleString('de-CH', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
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
