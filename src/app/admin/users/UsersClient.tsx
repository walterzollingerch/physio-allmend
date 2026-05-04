'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database, UserRole } from '@/lib/supabase/database.types'
import { Lock, Unlock, Users, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

type Profile = Database['public']['Tables']['profiles']['Row']

const ROLE_LABELS: Record<UserRole, string> = {
  admin:  'Admin',
  physio: 'Physiotherapeut·in',
  client: 'Patient·in',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin:  'bg-purple-100 text-purple-700',
  physio: 'bg-[#C7D6CD] text-[#4F7163]',
  client: 'bg-[#F4EDE2] text-[#4A4138]',
}

export default function UsersClient({
  users,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [list, setList] = useState<Profile[]>(users)

  const toggleBlocked = async (profile: Profile) => {
    setLoading(profile.id)
    const newBlocked = !profile.is_blocked

    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: newBlocked })
      .eq('id', profile.id)

    if (!error) {
      setList(prev =>
        prev.map(p => p.id === profile.id ? { ...p, is_blocked: newBlocked } : p)
      )
    }
    setLoading(null)
  }

  const changeRole = async (profile: Profile, role: UserRole) => {
    setLoading(profile.id)
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profile.id)

    if (!error) {
      setList(prev =>
        prev.map(p => p.id === profile.id ? { ...p, role } : p)
      )
    }
    setLoading(null)
    router.refresh()
  }

  const pending  = list.filter(u => u.is_blocked)
  const approved = list.filter(u => !u.is_blocked)

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      {/* Header */}
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline"
          >
            <ChevronLeft size={16} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Users size={20} className="text-[#6B8E7F]" />
            <h1
              className="text-lg font-semibold text-[#2A2622]"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              Benutzerverwaltung
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
        {/* Ausstehend */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold">
                {pending.length}
              </span>
              Ausstehend – Freischaltung erforderlich
            </h2>
            <div className="space-y-2">
              {pending.map(profile => (
                <UserRow
                  key={profile.id}
                  profile={profile}
                  isSelf={profile.id === currentUserId}
                  loadingId={loading}
                  onToggleBlocked={toggleBlocked}
                  onChangeRole={changeRole}
                />
              ))}
            </div>
          </section>
        )}

        {/* Aktiv */}
        <section>
          <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
            Aktive Benutzer ({approved.length})
          </h2>
          <div className="space-y-2">
            {approved.map(profile => (
              <UserRow
                key={profile.id}
                profile={profile}
                isSelf={profile.id === currentUserId}
                loadingId={loading}
                onToggleBlocked={toggleBlocked}
                onChangeRole={changeRole}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function UserRow({
  profile,
  isSelf,
  loadingId,
  onToggleBlocked,
  onChangeRole,
}: {
  profile: Profile
  isSelf: boolean
  loadingId: string | null
  onToggleBlocked: (p: Profile) => void
  onChangeRole: (p: Profile, role: UserRole) => void
}) {
  const isLoading = loadingId === profile.id

  return (
    <div className="bg-white rounded-xl border border-[#E1D6C2] px-4 py-3 flex items-center gap-3">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[#C7D6CD] flex items-center justify-center text-[#4F7163] font-semibold text-sm shrink-0">
        {profile.full_name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-[#2A2622] truncate">
            {profile.full_name}
          </span>
          {isSelf && (
            <span className="text-xs text-[#7A6E60] italic">(du)</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[profile.role]}`}>
            {ROLE_LABELS[profile.role]}
          </span>
          {profile.is_blocked && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              Gesperrt
            </span>
          )}
        </div>
        <p className="text-xs text-[#7A6E60] truncate">{profile.email}</p>
      </div>

      {/* Rolle ändern */}
      {!isSelf && (
        <select
          value={profile.role}
          onChange={e => onChangeRole(profile, e.target.value as UserRole)}
          disabled={isLoading}
          className="text-xs border border-[#E1D6C2] rounded-lg px-2 py-1.5 bg-white text-[#4A4138] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F] disabled:opacity-50"
        >
          <option value="client">Patient·in</option>
          <option value="physio">Physiotherapeut·in</option>
          <option value="admin">Admin</option>
        </select>
      )}

      {/* Sperren / Freischalten */}
      {!isSelf && (
        <button
          onClick={() => onToggleBlocked(profile)}
          disabled={isLoading}
          title={profile.is_blocked ? 'Freischalten' : 'Sperren'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
            profile.is_blocked
              ? 'bg-[#6B8E7F] text-white hover:bg-[#4F7163]'
              : 'bg-[#F4EDE2] text-[#4A4138] hover:bg-[#EDE3D2]'
          }`}
        >
          {isLoading ? (
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : profile.is_blocked ? (
            <><Unlock size={13} /> Freischalten</>
          ) : (
            <><Lock size={13} /> Sperren</>
          )}
        </button>
      )}
    </div>
  )
}
