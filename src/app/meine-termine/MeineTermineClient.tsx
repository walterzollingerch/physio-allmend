'use client'
import { useState } from 'react'
import { CalendarDays, Clock, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

type BookingRow = {
  id: string
  patient_id: string
  requested_date: string
  requested_time: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  treatment_types: { name: string; duration_min: number }
}

const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend', color: 'bg-amber-100 text-amber-700', icon: Clock },
  confirmed: { label: 'Bestätigt',  color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Abgesagt',   color: 'bg-red-100 text-red-600',     icon: XCircle },
}

// Bestätigungsdialog
function CancelConfirmDialog({
  booking,
  onConfirm,
  onClose,
}: {
  booking: BookingRow
  onConfirm: () => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const dateStr = new Date(booking.requested_date + 'T12:00').toLocaleDateString('de-CH', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const handle = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl border border-[#E1D6C2] shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
        </div>
        <h2 className="text-base font-semibold text-[#2A2622] mb-1" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
          Termin absagen?
        </h2>
        <p className="text-sm text-[#4A4138] mb-1">
          {booking.treatment_types.name}
        </p>
        <p className="text-xs text-[#7A6E60] mb-5">
          {dateStr} · {booking.requested_time.slice(0, 5)} Uhr
        </p>
        <p className="text-xs text-[#7A6E60] mb-5">
          Die Physiotherapie wird automatisch informiert.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-[#E1D6C2] text-sm text-[#4A4138] hover:bg-[#F4EDE2] transition-colors">
            Zurück
          </button>
          <button onClick={handle} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
            {loading ? 'Wird abgesagt…' : 'Termin absagen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Buchungskarte
function BookingCard({
  booking,
  onCancelRequest,
}: {
  booking: BookingRow
  onCancelRequest: (b: BookingRow) => void
}) {
  const cfg = STATUS_CONFIG[booking.status]
  const Icon = cfg.icon
  const dateStr = new Date(booking.requested_date + 'T12:00').toLocaleDateString('de-CH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = booking.requested_time.slice(0, 5)
  const isUpcoming = new Date(booking.requested_date) >= new Date(new Date().toISOString().slice(0, 10))
  const isCancellable = isUpcoming && booking.status !== 'cancelled'

  return (
    <div className="bg-white rounded-xl border border-[#E1D6C2] p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#C7D6CD]/40 flex items-center justify-center shrink-0">
        <CalendarDays size={18} className="text-[#6B8E7F]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-medium text-sm text-[#2A2622]">{booking.treatment_types?.name}</p>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
          </span>
        </div>
        <p className="text-xs text-[#7A6E60]">{dateStr} · {timeStr} Uhr · {booking.treatment_types?.duration_min} Min.</p>
        {booking.notes && (
          <p className="text-xs text-[#7A6E60] mt-1 italic">&ldquo;{booking.notes}&rdquo;</p>
        )}
      </div>
      {isCancellable && (
        <button
          onClick={() => onCancelRequest(booking)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#7A6E60] border border-[#E1D6C2] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
        >
          <XCircle size={13} /> Absagen
        </button>
      )}
    </div>
  )
}

// Hauptkomponente
export default function MeineTermineClient({ bookings: initial }: { bookings: BookingRow[] }) {
  const [bookings, setBookings] = useState(initial)
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.requested_date >= today)
  const past     = bookings.filter(b => b.status === 'cancelled' || b.requested_date < today)

  const doCancel = async () => {
    if (!cancelTarget) return
    setError(null)
    const res = await fetch('/api/bookings/cancel-by-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: cancelTarget.id }),
    })
    if (res.ok) {
      setBookings(prev => prev.map(b =>
        b.id === cancelTarget.id ? { ...b, status: 'cancelled' } : b
      ))
      setCancelTarget(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Absagen')
      setCancelTarget(null)
    }
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E1D6C2] p-12 text-center">
          <CalendarDays size={36} className="text-[#C7D6CD] mx-auto mb-3" />
          <p className="text-[#7A6E60] text-sm">Noch keine Terminanfragen</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
            Kommende Termine ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(b => (
              <BookingCard key={b.id} booking={b} onCancelRequest={setCancelTarget} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
            Vergangene / Abgesagte Termine
          </h2>
          <div className="space-y-3 opacity-70">
            {past.map(b => (
              <BookingCard key={b.id} booking={b} onCancelRequest={setCancelTarget} />
            ))}
          </div>
        </section>
      )}

      {cancelTarget && (
        <CancelConfirmDialog
          booking={cancelTarget}
          onConfirm={doCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  )
}
