import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/PhysioLogo'
import { Users, LogOut, CalendarDays, ClipboardList, Clock, Calendar, BookOpen } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  const isAdmin  = profile.role === 'admin'
  const isPhysio = profile.role === 'physio'
  const isClient = profile.role === 'client'

  // Anzahl ausstehender Buchungen für Physio/Admin
  let pendingCount = 0
  if (isAdmin || isPhysio) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    pendingCount = count ?? 0
  }

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Wordmark size={36} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#4A4138] hidden sm:block">{profile.full_name}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex items-center gap-1.5 text-sm text-[#7A6E60] hover:text-[#2A2622] transition-colors">
                <LogOut size={16} />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Willkommen, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-[#7A6E60] text-sm mt-1">
            {isAdmin  && 'Administrator · Physio Allmend'}
            {isPhysio && 'Physiotherapeut·in · Physio Allmend'}
            {isClient && 'Patient·in · Physio Allmend'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Termin buchen (Patienten) */}
          {isClient && (
            <DashboardCard
              icon={<CalendarDays size={22} className="text-[#6B8E7F]" />}
              title="Termin buchen"
              description="Neue Terminanfrage stellen"
              href="/termine"
            />
          )}

          {/* Meine Termine (Patienten) */}
          {isClient && (
            <DashboardCard
              icon={<Clock size={22} className="text-[#6B8E7F]" />}
              title="Meine Termine"
              description="Deine Terminanfragen & Bestätigungen"
              href="/meine-termine"
            />
          )}

          {/* Terminverwaltung (Physio & Admin) */}
          {(isPhysio || isAdmin) && (
            <DashboardCard
              icon={<Calendar size={22} className="text-[#6B8E7F]" />}
              title="Terminverwaltung"
              description="Anfragen bestätigen, Kalender verwalten"
              href="/admin/termine"
              badge={pendingCount > 0 ? `${pendingCount} neu` : undefined}
              badgeColor="amber"
            />
          )}

          {/* Patienten (Physio & Admin) */}
          {(isPhysio || isAdmin) && (
            <DashboardCard
              icon={<ClipboardList size={22} className="text-[#6B8E7F]" />}
              title="Patienten"
              description="Patientenliste & Behandlungspläne"
              href="#"
              badge="In Kürze"
            />
          )}

          {/* Buchhaltung (Physio & Admin) */}
          {(isPhysio || isAdmin) && (
            <DashboardCard
              icon={<BookOpen size={22} className="text-[#6B8E7F]" />}
              title="Buchhaltung"
              description="Bilanz, Erfolgsrechnung & Kontenplan"
              href="/buchhaltung"
            />
          )}

          {/* Benutzerverwaltung (nur Admin) */}
          {isAdmin && (
            <DashboardCard
              icon={<Users size={22} className="text-[#6B8E7F]" />}
              title="Benutzerverwaltung"
              description="Konten freischalten, Rollen vergeben"
              href="/admin/users"
            />
          )}
        </div>
      </main>
    </div>
  )
}

function DashboardCard({
  icon, title, description, href, badge, badgeColor = 'gray',
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  badge?: string
  badgeColor?: 'gray' | 'amber'
}) {
  const badgeClass = badgeColor === 'amber'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-[#F4EDE2] text-[#7A6E60]'

  return (
    <Link href={href} className="group bg-white rounded-2xl border border-[#E1D6C2] p-5 hover:border-[#6B8E7F] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#C7D6CD]/40 flex items-center justify-center">
          {icon}
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-[#2A2622] mb-1 group-hover:text-[#4F7163] transition-colors" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
        {title}
      </h3>
      <p className="text-sm text-[#7A6E60]">{description}</p>
    </Link>
  )
}
