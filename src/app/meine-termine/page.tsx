import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Clock, CheckCircle, XCircle, ChevronLeft, Plus } from 'lucide-react'

const STATUS_CONFIG = {
  pending: { label: 'Ausstehend', color: 'bg-amber-100 text-amber-700', icon: Clock },
  confirmed: { label: 'Bestätigt', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Abgesagt', color: 'bg-red-100 text-red-600', icon: XCircle },
}

export default async function MeineTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`*, treatment_types ( name, duration_min )`)
    .eq('patient_id', user.id)
    .order('requested_date', { ascending: false })

  const upcoming = bookings?.filter(b => b.status !== 'cancelled' && new Date(b.requested_date) >= new Date()) ?? []
  const past = bookings?.filter(b => b.status === 'cancelled' || new Date(b.requested_date) < new Date()) ?? []

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <CalendarDays size={20} className="text-[#6B8E7F]" />
            <h1 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Meine Termine
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="flex justify-end">
          <Link href="/termine">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#6B8E7F] text-white rounded-lg text-sm font-medium hover:bg-[#4F7163] transition-colors">
              <Plus size={15} /> Neuen Termin buchen
            </button>
          </Link>
        </div>

        {upcoming.length === 0 && past.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-12 text-center">
            <CalendarDays size={36} className="text-[#C7D6CD] mx-auto mb-3" />
            <p className="text-[#7A6E60] text-sm">Noch keine Terminanfragen</p>
            <Link href="/termine" className="mt-4 inline-block text-sm font-medium text-[#4F7163] hover:underline">
              Ersten Termin buchen →
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
              Kommende Termine ({upcoming.length})
            </h2>
            <div className="space-y-3">
              {upcoming.map(b => <BookingCard key={b.id} booking={b} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
              Vergangene / Abgesagte Termine
            </h2>
            <div className="space-y-3 opacity-70">
              {past.map(b => <BookingCard key={b.id} booking={b} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function BookingCard({ booking }: { booking: Record<string, unknown> }) {
  const status = booking.status as keyof typeof STATUS_CONFIG
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  const treatment = booking.treatment_types as { name: string; duration_min: number }

  const dateStr = new Date((booking.requested_date as string) + 'T12:00').toLocaleDateString('de-CH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const timeStr = (booking.requested_time as string).slice(0, 5)

  return (
    <div className="bg-white rounded-xl border border-[#E1D6C2] p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#C7D6CD]/40 flex items-center justify-center shrink-0">
        <CalendarDays size={18} className="text-[#6B8E7F]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-medium text-sm text-[#2A2622]">{treatment?.name}</p>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
          </span>
        </div>
        <p className="text-xs text-[#7A6E60]">{dateStr} · {timeStr} Uhr · {treatment?.duration_min} Min.</p>
        {booking.notes && (
          <p className="text-xs text-[#7A6E60] mt-1 italic">&ldquo;{booking.notes as string}&rdquo;</p>
        )}
      </div>
    </div>
  )
}
