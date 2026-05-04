import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PhysioLogo from '@/components/PhysioLogo'
import { Users, LogOut, CalendarDays, ClipboardList } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const isAdmin  = profile.role === 'admin'
  const isPhysio = profile.role === 'physio'

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      {/* Navbar */}
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PhysioLogo size={36} />
            <div>
              <p
                className="font-medium text-[#2A2622] leading-tight"
                style={{ fontFamily: '"Fraunces", Georgia, serif' }}
              >
                Physio Allmend
              </p>
              <p className="text-xs text-[#7A6E60]">Patientenportal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#4A4138] hidden sm:block">
              {profile.full_name}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-[#7A6E60] hover:text-[#2A2622] transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        {/* Willkommen */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-light text-[#2A2622]"
            style={{ fontFamily: '"Fraunces", Georgia, serif' }}
          >
            Willkommen, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-[#7A6E60] text-sm mt-1">
            {profile.role === 'admin'  && 'Administrator · Physio Allmend'}
            {profile.role === 'physio' && 'Physiotherapeut·in · Physio Allmend'}
            {profile.role === 'client' && 'Patient·in · Physio Allmend'}
          </p>
        </div>

        {/* Kacheln */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Termine (für alle) */}
          <DashboardCard
            icon={<CalendarDays size={22} className="text-[#6B8E7F]" />}
            title="Termine"
            description="Deine geplanten Behandlungstermine"
            href="#"
            badge="In Kürze"
          />

          {/* Behandlungsplan (für Clients) */}
          {!isAdmin && !isPhysio && (
            <DashboardCard
              icon={<ClipboardList size={22} className="text-[#6B8E7F]" />}
              title="Behandlungsplan"
              description="Dein persönlicher Therapieplan"
              href="#"
              badge="In Kürze"
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
  icon,
  title,
  description,
  href,
  badge,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-[#E1D6C2] p-5 hover:border-[#6B8E7F] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#C7D6CD]/40 flex items-center justify-center">
          {icon}
        </div>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4EDE2] text-[#7A6E60] font-medium">
            {badge}
          </span>
        )}
      </div>
      <h3
        className="font-semibold text-[#2A2622] mb-1 group-hover:text-[#4F7163] transition-colors"
        style={{ fontFamily: '"Fraunces", Georgia, serif' }}
      >
        {title}
      </h3>
      <p className="text-sm text-[#7A6E60]">{description}</p>
    </Link>
  )
}
