import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, Plus } from 'lucide-react'
import MeineTermineClient from './MeineTermineClient'

export default async function MeineTerminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  type BookingRow = {
    id: string
    patient_id: string
    requested_date: string
    requested_time: string
    status: 'pending' | 'confirmed' | 'cancelled'
    notes: string | null
    treatment_types: { name: string; duration_min: number }
  }

  const { data: rawBookings } = await supabase
    .from('bookings')
    .select('*, treatment_types(name, duration_min)')
    .eq('patient_id', user.id)
    .order('requested_date', { ascending: false })

  const bookings = (rawBookings ?? []) as BookingRow[]

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline">
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

        <MeineTermineClient bookings={bookings} />
      </main>
    </div>
  )
}
