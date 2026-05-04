import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/PhysioLogo'
import { LogOut, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import BuchhaltungClient from './BuchhaltungClient'

export default async function BuchhaltungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('number')

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[#7A6E60] hover:text-[#2A2622] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <Wordmark size={32} />
          </div>
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

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Buchhaltung
          </h1>
          <p className="text-[#7A6E60] text-sm mt-1">Bilanz & Erfolgsrechnung · Physio Allmend</p>
        </div>

        <BuchhaltungClient initialAccounts={accounts ?? []} isAdmin={profile.role === 'admin'} />
      </main>
    </div>
  )
}
