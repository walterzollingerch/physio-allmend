'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { CalendarDays, Clock, CheckCircle, ChevronLeft } from 'lucide-react'

type Treatment = {
  id: string
  name: string
  duration_min: number
  description: string | null
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00',
]

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function minDateISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function BookingClient({
  treatments,
  profile,
}: {
  treatments: Treatment[]
  profile: { full_name: string; email: string } | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    const res = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        treatment_type_id: selectedTreatment!.id,
        requested_date: selectedDate,
        requested_time: selectedTime,
        notes,
      }),
    })

    if (res.ok) {
      setStep(3)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Fehler bei der Buchung')
    }
    setLoading(false)
  }

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
              Termin buchen
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-8">

        {/* Schritt-Indikator */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step >= s ? 'bg-[#6B8E7F] text-white' : 'bg-[#E1D6C2] text-[#7A6E60]'
                }`}>{s}</div>
                <span className={`text-sm hidden sm:inline ${step >= s ? 'text-[#4A4138]' : 'text-[#7A6E60]'}`}>
                  {s === 1 ? 'Behandlung & Zeit' : 'Zusammenfassung'}
                </span>
                {s < 2 && <div className="w-8 h-px bg-[#E1D6C2] mx-1" />}
              </div>
            ))}
          </div>
        )}

        {/* Schritt 1: Behandlung + Datum + Zeit */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">Behandlungsart</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {treatments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTreatment(t)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedTreatment?.id === t.id
                        ? 'border-[#6B8E7F] bg-[#C7D6CD]/20 ring-1 ring-[#6B8E7F]'
                        : 'border-[#E1D6C2] bg-white hover:border-[#6B8E7F]'
                    }`}
                  >
                    <p className="font-medium text-[#2A2622] text-sm">{t.name}</p>
                    <p className="text-xs text-[#7A6E60] mt-0.5">{t.duration_min} Min. · {t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">Gewünschtes Datum</h2>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                min={minDateISO()}
              />
            </div>

            {selectedDate && (
              <div>
                <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">Gewünschte Uhrzeit</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {TIME_SLOTS.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTime === t
                          ? 'bg-[#6B8E7F] text-white'
                          : 'bg-white border border-[#E1D6C2] text-[#4A4138] hover:border-[#6B8E7F]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">Bemerkungen (optional)</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="z.B. Rückenschmerzen seit 2 Wochen..."
                rows={3}
                className="w-full px-3 py-2.5 border border-[#E1D6C2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F] bg-white placeholder:text-[#7A6E60] resize-none"
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selectedTreatment || !selectedDate || !selectedTime}
              onClick={() => setStep(2)}
            >
              Weiter
            </Button>
          </div>
        )}

        {/* Schritt 2: Zusammenfassung */}
        {step === 2 && selectedTreatment && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E1D6C2] p-6 space-y-4">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
                Buchungsübersicht
              </h2>

              <div className="space-y-3 text-sm">
                <Row label="Patient" value={profile?.full_name ?? ''} />
                <Row label="Behandlung" value={`${selectedTreatment.name} (${selectedTreatment.duration_min} Min.)`} />
                <Row label="Datum" value={new Date(selectedDate + 'T12:00').toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
                <Row label="Uhrzeit" value={selectedTime + ' Uhr'} />
                {notes && <Row label="Bemerkungen" value={notes} />}
              </div>

              <div className="pt-3 border-t border-[#F4EDE2] text-xs text-[#7A6E60]">
                Die Physiotherapeutin bestätigt deinen Terminwunsch. Du erhältst eine Kalendereinladung per E-Mail.
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Zurück</Button>
              <Button onClick={handleSubmit} loading={loading} className="flex-1" size="lg">
                Terminanfrage senden
              </Button>
            </div>
          </div>
        )}

        {/* Schritt 3: Bestätigung */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#C7D6CD] flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={26} className="text-[#4F7163]" />
            </div>
            <h2 className="text-lg font-semibold text-[#2A2622] mb-2" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Anfrage gesendet!
            </h2>
            <p className="text-sm text-[#4A4138] mb-6">
              Deine Terminanfrage wurde erfolgreich übermittelt. Die Physiotherapeutin wird sie prüfen und du erhältst eine Bestätigung per E-Mail.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/meine-termine">
                <Button variant="outline"><Clock size={15} /> Meine Termine</Button>
              </Link>
              <Button onClick={() => { setStep(1); setSelectedTreatment(null); setSelectedDate(''); setSelectedTime(''); setNotes('') }}>
                Weiteren Termin buchen
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#7A6E60] shrink-0">{label}</span>
      <span className="text-[#2A2622] text-right">{value}</span>
    </div>
  )
}
