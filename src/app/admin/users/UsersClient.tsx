'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database, UserRole } from '@/lib/supabase/database.types'
import { Lock, Unlock, Users, ChevronLeft, Pencil, Trash2, Plus, X, Check } from 'lucide-react'
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

// ── Create Modal ────────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (profile: Profile) => void
}) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'client' as UserRole })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler'); setLoading(false); return }
      onCreated(data.profile)
    } catch {
      setError('Netzwerkfehler')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl border border-[#E1D6C2] shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Neuer Benutzer
          </h2>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Name *">
            <input
              type="text" required value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="E-Mail *">
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Telefon">
            <input
              type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Rolle">
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className={inputCls}
            >
              <option value="client">Patient·in</option>
              <option value="physio">Physiotherapeut·in</option>
              <option value="admin">Admin</option>
            </select>
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-[#E1D6C2] text-sm text-[#4A4138] hover:bg-[#F4EDE2] transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl bg-[#4F7163] text-white text-sm font-medium hover:bg-[#3d5a4e] transition-colors disabled:opacity-50">
              {loading ? 'Erstellen…' : 'Benutzer erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────
function DeleteModal({ profile, onClose, onDeleted }: {
  profile: Profile
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler'); setLoading(false); return }
      onDeleted(profile.id)
    } catch {
      setError('Netzwerkfehler')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl border border-[#E1D6C2] shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Benutzer löschen
          </h2>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
        </div>
        <p className="text-sm text-[#4A4138] mb-1">
          Soll <span className="font-semibold">{profile.full_name}</span> wirklich gelöscht werden?
        </p>
        <p className="text-xs text-[#7A6E60] mb-5">Diese Aktion kann nicht rückgängig gemacht werden.</p>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-[#E1D6C2] text-sm text-[#4A4138] hover:bg-[#F4EDE2] transition-colors">
            Abbrechen
          </button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
            {loading ? 'Löschen…' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline Edit Row ─────────────────────────────────────────────────────────
function EditRow({ profile, onCancel, onSaved }: {
  profile: Profile
  onCancel: () => void
  onSaved: (updated: Profile) => void
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name,
    email: profile.email ?? '',
    phone: profile.phone ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler'); setLoading(false); return }
      onSaved(data.profile)
    } catch {
      setError('Netzwerkfehler')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#6B8E7F] px-4 py-3 space-y-3">
      {/* Avatar + Fields */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#C7D6CD] flex items-center justify-center text-[#4F7163] font-semibold text-sm shrink-0 mt-0.5">
          {profile.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text" placeholder="Name" value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            className={inputCls}
          />
          <input
            type="email" placeholder="E-Mail" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={inputCls}
          />
          <input
            type="tel" placeholder="Telefon" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-1.5 text-xs">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E1D6C2] text-xs text-[#4A4138] hover:bg-[#F4EDE2] transition-colors">
          <X size={13} /> Abbrechen
        </button>
        <button onClick={save} disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#4F7163] text-white text-xs font-medium hover:bg-[#3d5a4e] transition-colors disabled:opacity-50">
          {loading ? '…' : <><Check size={13} /> Speichern</>}
        </button>
      </div>
    </div>
  )
}

// ── UserRow ─────────────────────────────────────────────────────────────────
function UserRow({
  profile,
  isSelf,
  loadingId,
  editingId,
  onToggleBlocked,
  onChangeRole,
  onEdit,
  onDelete,
  onSaved,
  onCancelEdit,
}: {
  profile: Profile
  isSelf: boolean
  loadingId: string | null
  editingId: string | null
  onToggleBlocked: (p: Profile) => void
  onChangeRole: (p: Profile, role: UserRole) => void
  onEdit: (id: string) => void
  onDelete: (p: Profile) => void
  onSaved: (updated: Profile) => void
  onCancelEdit: () => void
}) {
  const isLoading = loadingId === profile.id

  if (editingId === profile.id) {
    return <EditRow profile={profile} onCancel={onCancelEdit} onSaved={onSaved} />
  }

  return (
    <div className="bg-white rounded-xl border border-[#E1D6C2] px-4 py-3 flex items-center gap-3">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[#C7D6CD] flex items-center justify-center text-[#4F7163] font-semibold text-sm shrink-0">
        {profile.full_name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-[#2A2622] truncate">{profile.full_name}</span>
          {isSelf && <span className="text-xs text-[#7A6E60] italic">(du)</span>}
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
          className="text-xs border border-[#E1D6C2] rounded-lg px-2 py-1.5 bg-white text-[#4A4138] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F] disabled:opacity-50 hidden sm:block"
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

      {/* Bearbeiten */}
      {!isSelf && (
        <button
          onClick={() => onEdit(profile.id)}
          title="Bearbeiten"
          className="p-1.5 rounded-lg text-[#7A6E60] hover:text-[#4F7163] hover:bg-[#F4EDE2] transition-colors"
        >
          <Pencil size={15} />
        </button>
      )}

      {/* Löschen */}
      {!isSelf && (
        <button
          onClick={() => onDelete(profile)}
          title="Löschen"
          className="p-1.5 rounded-lg text-[#7A6E60] hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

// ── Helper ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full text-sm border border-[#E1D6C2] rounded-lg px-3 py-1.5 bg-white text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#7A6E60] mb-1">{label}</label>
      {children}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function UsersClient({
  users,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading]       = useState<string | null>(null)
  const [list, setList]             = useState<Profile[]>(users)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const toggleBlocked = async (profile: Profile) => {
    setLoading(profile.id)
    const newBlocked = !profile.is_blocked
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: newBlocked })
      .eq('id', profile.id)
    if (!error) setList(prev => prev.map(p => p.id === profile.id ? { ...p, is_blocked: newBlocked } : p))
    setLoading(null)
  }

  const changeRole = async (profile: Profile, role: UserRole) => {
    setLoading(profile.id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profile.id)
    if (!error) setList(prev => prev.map(p => p.id === profile.id ? { ...p, role } : p))
    setLoading(null)
    router.refresh()
  }

  const handleSaved = (updated: Profile) => {
    setList(prev => prev.map(p => p.id === updated.id ? updated : p))
    setEditingId(null)
  }

  const handleDeleted = (id: string) => {
    setList(prev => prev.filter(p => p.id !== id))
    setDeleteTarget(null)
  }

  const handleCreated = (profile: Profile) => {
    setList(prev => [...prev, profile])
    setShowCreate(false)
  }

  const pending  = list.filter(u => u.is_blocked)
  const approved = list.filter(u => !u.is_blocked)

  const rowProps = (profile: Profile) => ({
    profile,
    isSelf: profile.id === currentUserId,
    loadingId: loading,
    editingId,
    onToggleBlocked: toggleBlocked,
    onChangeRole: changeRole,
    onEdit: setEditingId,
    onDelete: setDeleteTarget,
    onSaved: handleSaved,
    onCancelEdit: () => setEditingId(null),
  })

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      {/* Header */}
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-[#4F7163] hover:underline">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Users size={20} className="text-[#6B8E7F]" />
            <h1 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
              Benutzerverwaltung
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F7163] text-white text-sm font-medium hover:bg-[#3d5a4e] transition-colors"
          >
            <Plus size={15} /> Neuer Benutzer
          </button>
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
              {pending.map(profile => <UserRow key={profile.id} {...rowProps(profile)} />)}
            </div>
          </section>
        )}

        {/* Aktiv */}
        <section>
          <h2 className="text-sm font-semibold text-[#4A4138] uppercase tracking-wide mb-3">
            Aktive Benutzer ({approved.length})
          </h2>
          <div className="space-y-2">
            {approved.map(profile => <UserRow key={profile.id} {...rowProps(profile)} />)}
          </div>
        </section>
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          profile={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
