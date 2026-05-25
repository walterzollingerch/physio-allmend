'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, CheckCircle, XCircle, Clock, ChevronLeft,
  Calendar, Loader2, X, Inbox, Phone, Mail,
} from 'lucide-react'
import type { BookingWithRelations, TreatmentType } from './page'

const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Bestätigt',  color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Abgesagt',   color: 'bg-red-100 text-red-600' },
}

// ── Hilfsfunktionen für Anfragen-Erkennung ────────────────────────────────
const isInquiry = (b: BookingWithRelations) =>
  b.requested_time.startsWith('00:00') && (b.notes?.startsWith('[ANFRAGE via Website]') ?? false)

const parseInquiryNotes = (notes: string | null) => {
  if (!notes) return { topic: '', message: '' }
  const lines = notes.replace('[ANFRAGE via Website]\n', '').split('\n\n')
  const topicLine = lines[0] ?? ''
  const message = lines.slice(1).join('\n\n').trim()
  const topic = topicLine.replace('Anliegen: ', '').trim()
  return { topic, message }
}

// ── Zeitslots ─────────────────────────────────────────────────────────────
type BusySlot = { start: string; end: string; title: string }

const TIME_SLOTS: string[] = []
for (let h = 8; h <= 18; h++) {
  for (const m of [0, 30]) {
    if (h === 18 && m === 30) break
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function isSlotBusy(slot: string, durationMin: number, busy: BusySlot[]) {
  const [sh, sm] = slot.split(':').map(Number)
  const start = sh * 60 + sm
  const end = start + durationMin
  return busy.some(b => {
    const [bsh, bsm] = b.start.split(':').map(Number)
    const [beh, bem] = b.end.split(':').map(Number)
    return start < beh * 60 + bem && end > bsh * 60 + bsm
  })
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

// ═══════════════════════════════════════════════════════════════════════════
export default function TermineClient({
  bookings: initial,
  treatmentTypes,
}: {
  bookings: BookingWithRelations[]
  treatmentTypes: TreatmentType[]
}) {
  const router = useRouter()
  const [bookings, setBookings] = useState(initial)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Anfragen (ohne Termin) vs normale Buchungen
  const inquiries  = bookings.filter(b => b.status === 'pending' && isInquiry(b))
  const pending    = bookings.filter(b => b.status === 'pending' && !isInquiry(b))
  const confirmed  = bookings.filter(b => b.status === 'confirmed' && new Date(b.requested_date) >= new Date())
  const past       = bookings.filter(b => b.status !== 'pending' && new Date(b.requested_date) < new Date() && !isInquiry(b))

  const handleAction = async (booking_id: string, action: 'confirm' | 'cancel') => {
    setLoadingId(booking_id)
    const res = await fetch('/api/bookings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id, action }),
    })
    if (res.ok) {
      setBookings(prev => prev.map(b =>
        b.id === booking_id
          ? { ...b, status: action === 'confirm' ? 'confirmed' : 'cancelled' }
          : b
      ))
      router.refresh()
    }
    setLoadingId(null)
  }

  const handleScheduled = (booking_id: string, date: string, time: string, treatment_type_id: string) => {
    const treatment = treatmentTypes.find(t => t.id === treatment_type_id)
    setBookings(prev => prev.map(b =>
      b.id === booking_id
        ? {
            ...b,
            status: 'confirmed',
            requested_date: date,
            requested_time: time,
            treatment_types: treatment ? { id: treatment.id, name: treatment.name, duration_min: treatment.duration_min } : b.treatment_types,
          }
        : b
    ))
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={20} className="text-[#6B8E7F]" />
            <h1 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Terminverwaltung
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">

        {/* ── Website-Anfragen (ohne Termin) ── */}
        {inquiries.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
                {inquiries.length}
              </span>
              <Inbox size={14} />
              Website-Anfragen – Termin ausstehend
            </h2>
            <div className="space-y-3">
              {inquiries.map(b => (
                <InquiryCard
                  key={b.id}
                  booking={b}
                  treatmentTypes={treatmentTypes}
                  loadingId={loadingId}
                  onCancel={() => handleAction(b.id, 'cancel')}
                  onScheduled={(date, time, ttId) => handleScheduled(b.id, date, time, ttId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Ausstehende Terminanfragen (von Patienten im Portal) ── */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
                {pending.length}
              </span>
              Ausstehende Terminanfragen
            </h2>
            <div className="space-y-3">
              {pending.map(b => (
                <BookingCard key={b.id} booking={b} loadingId={loadingId} onAction={handleAction} showActions />
              ))}
            </div>
          </section>
        )}

        {/* ── Bestätigte Termine ── */}
        {confirmed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
              Bestätigte Termine ({confirmed.length})
            </h2>
            <div className="space-y-3">
              {confirmed.map(b => (
                <BookingCard key={b.id} booking={b} loadingId={loadingId} onAction={handleAction} showActions />
              ))}
            </div>
          </section>
        )}

        {/* ── Vergangene / Abgesagte ── */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
              Vergangen / Abgesagt
            </h2>
            <div className="space-y-3 opacity-60">
              {past.map(b => (
                <BookingCard key={b.id} booking={b} loadingId={loadingId} onAction={handleAction} />
              ))}
            </div>
          </section>
        )}

        {bookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-12 text-center">
            <CalendarDays size={36} className="text-[#C7D6CD] mx-auto mb-3" />
            <p className="text-[#7A6E60] text-sm">Noch keine Termine oder Anfragen</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Anfragen-Karte mit eingebettetem Termin-Planer
// ═══════════════════════════════════════════════════════════════════════════
function InquiryCard({
  booking,
  treatmentTypes,
  loadingId,
  onCancel,
  onScheduled,
}: {
  booking: BookingWithRelations
  treatmentTypes: TreatmentType[]
  loadingId: string | null
  onCancel: () => void
  onScheduled: (date: string, time: string, treatmentTypeId: string) => void
}) {
  const { topic, message } = parseInquiryNotes(booking.notes)
  const [open, setOpen] = useState(false)

  // Termin-Planer State
  const [schedDate, setSchedDate] = useState(todayStr())
  const [schedTime, setSchedTime] = useState('')
  const [schedTreatment, setSchedTreatment] = useState(booking.treatment_types.id)
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [busyLoading, setBusyLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState(false)

  const selectedDuration = treatmentTypes.find(t => t.id === schedTreatment)?.duration_min ?? 60

  const fetchBusy = useCallback(async (date: string) => {
    setBusyLoading(true)
    try {
      const res = await fetch(`/api/calendar/busy?date=${date}`)
      const json = await res.json()
      setBusy(json.busy ?? [])
    } catch { setBusy([]) }
    setBusyLoading(false)
  }, [])

  useEffect(() => { if (open) fetchBusy(schedDate) }, [open, schedDate, fetchBusy])

  const confirm = async () => {
    if (!schedDate || !schedTime || !schedTreatment) return
    setConfirming(true)
    const res = await fetch('/api/bookings/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        date: schedDate,
        time: schedTime,
        treatment_type_id: schedTreatment,
      }),
    })
    if (res.ok) {
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        onScheduled(schedDate, schedTime, schedTreatment)
      }, 1800)
    }
    setConfirming(false)
  }

  const isLoading = loadingId === booking.id

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      {/* Kopfzeile */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Inbox size={18} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-sm text-[#2A2622]">{booking.profiles.full_name}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                Kein Termin
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[#7A6E60]">
              <a href={`mailto:${booking.profiles.email}`} className="flex items-center gap-1 hover:text-[#4F7163]">
                <Mail size={11} /> {booking.profiles.email}
              </a>
              {booking.profiles.phone && (
                <a href={`tel:${booking.profiles.phone}`} className="flex items-center gap-1 hover:text-[#4F7163]">
                  <Phone size={11} /> {booking.profiles.phone}
                </a>
              )}
            </div>
            {topic && <p className="text-xs text-[#4F7163] font-medium mt-1">Anliegen: {topic}</p>}
            {message && (
              <p className="text-xs text-[#7A6E60] mt-1 line-clamp-2 italic">&ldquo;{message}&rdquo;</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0 ml-2">
            {!open && (
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F7163] text-white rounded-lg text-xs font-medium hover:bg-[#3d5a4e] transition-colors"
              >
                <CalendarDays size={13} /> Termin festlegen
              </button>
            )}
            <button
              onClick={onCancel}
              disabled={isLoading}
              title="Absagen"
              className="flex items-center gap-1 px-3 py-1.5 bg-[#F4EDE2] text-[#4A4138] rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <XCircle size={13} /> Absagen
            </button>
          </div>
        </div>
      </div>

      {/* Termin-Planer (ausgeklappt) */}
      {open && (
        <div className="border-t border-amber-100 bg-[#FFFDF9]">
          <div className="flex items-center justify-between px-4 py-3 bg-[#F4EDE2]">
            <span className="text-sm font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Termin festlegen
            </span>
            <button onClick={() => setOpen(false)} className="text-[#7A6E60] hover:text-[#2A2622]">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Behandlung */}
            <div>
              <label className="text-xs text-[#7A6E60] block mb-1.5">Behandlung</label>
              <select
                value={schedTreatment}
                onChange={e => setSchedTreatment(e.target.value)}
                className="w-full text-sm border border-[#E1D6C2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
              >
                {treatmentTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.duration_min} Min.)</option>
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
                className="w-full text-sm border border-[#E1D6C2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
              />
            </div>
          </div>

          {/* Zeitslots */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#7A6E60]">Uhrzeit wählen</label>
              {busyLoading && (
                <span className="flex items-center gap-1 text-xs text-[#7A6E60]">
                  <Loader2 size={11} className="animate-spin" /> Kalender…
                </span>
              )}
              {!busyLoading && busy.length > 0 && (
                <span className="text-xs text-[#7A6E60]">{busy.length} Termine belegt</span>
              )}
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 mb-3">
              {TIME_SLOTS.map(slot => {
                const isBusy = isSlotBusy(slot, selectedDuration, busy)
                const isSelected = schedTime === slot
                const busyInfo = busy.find(b => {
                  const [bsh, bsm] = b.start.split(':').map(Number)
                  const [beh, bem] = b.end.split(':').map(Number)
                  const [sh, sm] = slot.split(':').map(Number)
                  const m = sh * 60 + sm
                  return m >= bsh * 60 + bsm && m < beh * 60 + bem
                })
                return (
                  <button
                    key={slot}
                    disabled={isBusy}
                    onClick={() => setSchedTime(slot)}
                    title={isBusy ? (busyInfo?.title ?? 'Belegt') : ''}
                    className={`text-xs py-1.5 rounded-lg font-medium transition-all border ${
                      isSelected
                        ? 'bg-[#4F7163] text-white border-transparent'
                        : isBusy
                          ? 'bg-[#F4EDE2] text-[#C4B9AA] border-[#E1D6C2] cursor-not-allowed line-through'
                          : 'bg-white text-[#2A2622] border-[#E1D6C2] hover:border-[#6B8E7F]'
                    }`}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>

            {/* Belegte Termine */}
            {busy.length > 0 && (
              <div className="bg-[#FBF7F1] rounded-lg p-3 mb-3 text-xs">
                <p className="font-medium text-[#4A4138] mb-1">Heute bereits eingetragen:</p>
                {busy.map((b, i) => (
                  <div key={i} className="flex gap-2 text-[#7A6E60]">
                    <span className="font-medium text-[#2A2622] w-24">{b.start}–{b.end}</span>
                    <span className="truncate">{b.title}</span>
                  </div>
                ))}
              </div>
            )}

            {success ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                <CheckCircle size={16} /> Termin erstellt & im Google Kalender eingetragen!
              </div>
            ) : (
              <button
                onClick={confirm}
                disabled={!schedDate || !schedTime || confirming}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4F7163] text-white text-sm font-medium hover:bg-[#3d5a4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming
                  ? <><Loader2 size={14} className="animate-spin" /> Wird eingetragen…</>
                  : <><CalendarDays size={14} /> Termin bestätigen & in Kalender eintragen</>
                }
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Standard-Buchungskarte
// ═══════════════════════════════════════════════════════════════════════════
function BookingCard({
  booking, loadingId, onAction, showActions = false,
}: {
  booking: BookingWithRelations
  loadingId: string | null
  onAction: (id: string, action: 'confirm' | 'cancel') => void
  showActions?: boolean
}) {
  const cfg = STATUS_CONFIG[booking.status]
  const isLoading = loadingId === booking.id
  const dateStr = new Date(booking.requested_date + 'T12:00').toLocaleDateString('de-CH', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl border border-[#E1D6C2] p-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#C7D6CD]/40 flex items-center justify-center shrink-0">
          <CalendarDays size={18} className="text-[#6B8E7F]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-medium text-sm text-[#2A2622]">{booking.profiles.full_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            {booking.google_event_id && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Im Kalender</span>
            )}
          </div>
          <p className="text-xs text-[#4A4138] font-medium">
            {booking.treatment_types.name} · {booking.treatment_types.duration_min} Min.
          </p>
          <p className="text-xs text-[#7A6E60]">
            {dateStr} · {booking.requested_time.slice(0, 5)} Uhr
          </p>
          <p className="text-xs text-[#7A6E60]">
            {booking.profiles.email}{booking.profiles.phone ? ` · ${booking.profiles.phone}` : ''}
          </p>
          {booking.notes && !isInquiry(booking) && (
            <p className="text-xs text-[#7A6E60] mt-1 italic">&ldquo;{booking.notes}&rdquo;</p>
          )}
        </div>

        {showActions && booking.status === 'pending' && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onAction(booking.id, 'confirm')}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#6B8E7F] text-white rounded-lg text-xs font-medium hover:bg-[#4F7163] transition-colors disabled:opacity-50"
            >
              <CheckCircle size={13} /> Bestätigen
            </button>
            <button
              onClick={() => onAction(booking.id, 'cancel')}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#F4EDE2] text-[#4A4138] rounded-lg text-xs font-medium hover:bg-[#EDE3D2] transition-colors disabled:opacity-50"
            >
              <XCircle size={13} /> Absagen
            </button>
          </div>
        )}
        {showActions && booking.status === 'confirmed' && (
          <button
            onClick={() => onAction(booking.id, 'cancel')}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#F4EDE2] text-[#4A4138] rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 shrink-0"
          >
            <XCircle size={13} /> Absagen
          </button>
        )}
      </div>
    </div>
  )
}
