'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle, XCircle, Clock, ChevronLeft, Calendar } from 'lucide-react'

type Booking = {
  id: string
  requested_date: string
  requested_time: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  google_event_id: string | null
  treatment_types: { name: string; duration_min: number }
  profiles: { full_name: string; email: string; phone: string | null }
}

const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Bestätigt',  color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Abgesagt',   color: 'bg-red-100 text-red-600' },
}

export default function TermineClient({ bookings: initial }: { bookings: Booking[] }) {
  const router = useRouter()
  const [bookings, setBookings] = useState(initial)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const pending   = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'confirmed' && new Date(b.requested_date) >= new Date())
  const past      = bookings.filter(b => b.status !== 'pending' && new Date(b.requested_date) < new Date())

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

        {/* Ausstehende Anfragen */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
                {pending.length}
              </span>
              Ausstehende Anfragen
            </h2>
            <div className="space-y-3">
              {pending.map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  loadingId={loadingId}
                  onAction={handleAction}
                  showActions
                />
              ))}
            </div>
          </section>
        )}

        {/* Bestätigte Termine */}
        {confirmed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
              Bestätigte Termine ({confirmed.length})
            </h2>
            <div className="space-y-3">
              {confirmed.map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  loadingId={loadingId}
                  onAction={handleAction}
                  showActions
                />
              ))}
            </div>
          </section>
        )}

        {/* Vergangene */}
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
            <p className="text-[#7A6E60] text-sm">Noch keine Terminanfragen</p>
          </div>
        )}
      </main>
    </div>
  )
}

function BookingCard({
  booking,
  loadingId,
  onAction,
  showActions = false,
}: {
  booking: Booking
  loadingId: string | null
  onAction: (id: string, action: 'confirm' | 'cancel') => void
  showActions?: boolean
}) {
  const cfg = STATUS_CONFIG[booking.status]
  const isLoading = loadingId === booking.id
  const dateStr = new Date(booking.requested_date + 'T12:00').toLocaleDateString('de-CH', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            {booking.google_event_id && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                Im Kalender
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A4138] font-medium">{booking.treatment_types.name} · {booking.treatment_types.duration_min} Min.</p>
          <p className="text-xs text-[#7A6E60]">
            {dateStr} · {booking.requested_time.slice(0, 5)} Uhr
          </p>
          <p className="text-xs text-[#7A6E60]">{booking.profiles.email}{booking.profiles.phone ? ` · ${booking.profiles.phone}` : ''}</p>
          {booking.notes && (
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
