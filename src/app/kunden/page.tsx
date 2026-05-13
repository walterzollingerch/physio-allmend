import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/PhysioLogo'
import { ArrowLeft, LogOut, Plus, Search, Users } from 'lucide-react'

export default async function KundenPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  const { q: qRaw } = await searchParams
  const q = qRaw?.trim() ?? ''

  let query = supabase.from('customers').select('*').order('customer_number')
  if (q) query = query.or(`name.ilike.%${q}%,customer_number.ilike.%${q}%,city.ilike.%${q}%`)

  const { data: customers } = await query

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
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Kunden
            </h1>
            <p className="text-[#7A6E60] text-sm mt-1">{customers?.length ?? 0} Kunden · Physio Allmend</p>
          </div>
          <Link
            href="/kunden/neu"
            className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Neuer Kunde
          </Link>
        </div>

        {/* Suche */}
        <form method="get" className="mb-6">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E60]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Name, Nummer oder Ort…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#E1D6C2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F]"
            />
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
          {!customers || customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#7A6E60]">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{q ? 'Keine Treffer' : 'Noch keine Kunden'}</p>
              {!q && (
                <Link href="/kunden/neu" className="mt-4 text-sm text-[#6B8E7F] hover:underline">
                  Ersten Kunden erfassen →
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                  <th className="text-left px-5 py-3">Nr.</th>
                  <th className="text-left py-3">Name</th>
                  <th className="text-left py-3 hidden sm:table-cell">Ort</th>
                  <th className="text-left py-3 hidden md:table-cell">Telefon</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6]">
                    <td className="px-5 py-3">
                      <Link href={`/kunden/${c.id}`} className="font-mono text-xs font-semibold text-[#6B8E7F] hover:underline">
                        {c.customer_number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/kunden/${c.id}`} className="font-medium text-[#2A2622] hover:text-[#6B8E7F]">
                        {c.name}
                      </Link>
                      {(c.street || c.city) && (
                        <div className="text-xs text-[#7A6E60] sm:hidden mt-0.5">
                          {[c.street, c.street_number].filter(Boolean).join(' ')}{c.postal_code ? `, ${c.postal_code} ${c.city}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[#4A4138] hidden sm:table-cell">
                      {c.postal_code && c.city ? `${c.postal_code} ${c.city}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-[#4A4138] hidden md:table-cell">
                      {c.phone ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
