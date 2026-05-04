'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown, Scale, BookOpen } from 'lucide-react'

type AccountType = 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'

interface Account {
  id: string
  number: string
  name: string
  type: AccountType
  balance: number
  description: string | null
  is_active: boolean
}

const TYPE_LABELS: Record<AccountType, string> = {
  aktiv: 'Aktiv',
  passiv: 'Passiv',
  ertrag: 'Ertrag',
  aufwand: 'Aufwand',
}

const TYPE_COLORS: Record<AccountType, string> = {
  aktiv:   'bg-blue-50 text-blue-700 border-blue-200',
  passiv:  'bg-purple-50 text-purple-700 border-purple-200',
  ertrag:  'bg-green-50 text-green-700 border-green-200',
  aufwand: 'bg-red-50 text-red-700 border-red-200',
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function BuchhaltungClient({
  initialAccounts,
  isAdmin,
}: {
  initialAccounts: Account[]
  isAdmin: boolean
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [tab, setTab] = useState<'bilanz' | 'erfolg'>('bilanz')
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const aktiv   = accounts.filter(a => a.type === 'aktiv'   && a.is_active)
  const passiv  = accounts.filter(a => a.type === 'passiv'  && a.is_active)
  const ertrag  = accounts.filter(a => a.type === 'ertrag'  && a.is_active)
  const aufwand = accounts.filter(a => a.type === 'aufwand' && a.is_active)

  const totalAktiv   = aktiv.reduce((s, a) => s + Number(a.balance), 0)
  const totalPassiv  = passiv.reduce((s, a) => s + Number(a.balance), 0)
  const totalErtrag  = ertrag.reduce((s, a) => s + Number(a.balance), 0)
  const totalAufwand = aufwand.reduce((s, a) => s + Number(a.balance), 0)
  const ergebnis     = totalErtrag - totalAufwand

  function openNew() {
    setEditing(null)
    setModal('new')
    setError(null)
  }

  function openEdit(account: Account) {
    setEditing(account)
    setModal('edit')
    setError(null)
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setError(null)
  }

  async function handleSave(data: Omit<Account, 'id' | 'is_active'>) {
    setError(null)
    startTransition(async () => {
      if (modal === 'new') {
        const { data: created, error: err } = await supabase
          .from('accounts')
          .insert({ ...data, is_active: true })
          .select()
          .single()
        if (err) { setError(err.message); return }
        setAccounts(prev => [...prev, created].sort((a, b) => a.number.localeCompare(b.number)))
      } else if (modal === 'edit' && editing) {
        const { data: updated, error: err } = await supabase
          .from('accounts')
          .update(data)
          .eq('id', editing.id)
          .select()
          .single()
        if (err) { setError(err.message); return }
        setAccounts(prev => prev.map(a => a.id === editing.id ? updated : a))
      }
      closeModal()
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const { error: err } = await supabase.from('accounts').delete().eq('id', id)
      if (err) { setError(err.message); return }
      setAccounts(prev => prev.filter(a => a.id !== id))
      setDeleteConfirm(null)
    })
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit">
        <TabBtn active={tab === 'bilanz'} onClick={() => setTab('bilanz')} icon={<Scale size={16} />} label="Bilanz" />
        <TabBtn active={tab === 'erfolg'} onClick={() => setTab('erfolg')} icon={<BookOpen size={16} />} label="Erfolgsrechnung" />
      </div>

      {/* Action bar */}
      <div className="flex justify-end mb-5">
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Konto eröffnen
        </button>
      </div>

      {/* Bilanz */}
      {tab === 'bilanz' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccountSection
            title="Aktivkonten"
            type="aktiv"
            accounts={aktiv}
            total={totalAktiv}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={id => setDeleteConfirm(id)}
            deleteConfirm={deleteConfirm}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirm(null)}
            icon={<TrendingUp size={18} className="text-blue-600" />}
          />
          <AccountSection
            title="Passivkonten"
            type="passiv"
            accounts={passiv}
            total={totalPassiv}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={id => setDeleteConfirm(id)}
            deleteConfirm={deleteConfirm}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirm(null)}
            icon={<TrendingDown size={18} className="text-purple-600" />}
          />
          {/* Bilanzsumme */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1D6C2] p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Aktiva</p>
                <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalAktiv)}</p>
              </div>
              <div className={`text-sm font-medium px-3 py-1 rounded-full ${Math.abs(totalAktiv - totalPassiv) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {Math.abs(totalAktiv - totalPassiv) < 0.01 ? 'Ausgeglichen' : `Differenz: ${fmt(Math.abs(totalAktiv - totalPassiv))}`}
              </div>
              <div className="text-right">
                <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Passiva</p>
                <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalPassiv)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Erfolgsrechnung */}
      {tab === 'erfolg' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccountSection
            title="Ertragskonten"
            type="ertrag"
            accounts={ertrag}
            total={totalErtrag}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={id => setDeleteConfirm(id)}
            deleteConfirm={deleteConfirm}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirm(null)}
            icon={<TrendingUp size={18} className="text-green-600" />}
          />
          <AccountSection
            title="Aufwandskonten"
            type="aufwand"
            accounts={aufwand}
            total={totalAufwand}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={id => setDeleteConfirm(id)}
            deleteConfirm={deleteConfirm}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirm(null)}
            icon={<TrendingDown size={18} className="text-red-600" />}
          />
          {/* Ergebnis */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1D6C2] p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Total Ertrag</p>
                <p className="text-xl font-semibold text-green-700">CHF {fmt(totalErtrag)}</p>
              </div>
              <div className={`text-center px-4`}>
                <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Ergebnis</p>
                <p className={`text-2xl font-bold ${ergebnis >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  CHF {fmt(ergebnis)}
                </p>
                <p className="text-xs text-[#7A6E60] mt-0.5">{ergebnis >= 0 ? 'Gewinn' : 'Verlust'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Total Aufwand</p>
                <p className="text-xl font-semibold text-red-600">CHF {fmt(totalAufwand)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <AccountModal
          mode={modal}
          initial={editing}
          onSave={handleSave}
          onClose={closeModal}
          isPending={isPending}
          error={error}
        />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:text-[#2A2622]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function AccountSection({
  title, type, accounts, total, isAdmin,
  onEdit, onDelete, deleteConfirm, onConfirmDelete, onCancelDelete, icon,
}: {
  title: string
  type: AccountType
  accounts: Account[]
  total: number
  isAdmin: boolean
  onEdit: (a: Account) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E1D6C2]">
        {icon}
        <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
          {title}
        </h2>
        <span className="ml-auto text-sm text-[#7A6E60]">{accounts.length} Konto{accounts.length !== 1 ? 'en' : ''}</span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-center text-sm text-[#7A6E60] py-10">Keine Konten vorhanden</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#F0E8DC]">
              <th className="text-left px-5 py-2">Nr.</th>
              <th className="text-left py-2">Bezeichnung</th>
              <th className="text-right py-2 pr-5">Saldo (CHF)</th>
              <th className="py-2 pr-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => (
              <tr key={account.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                <td className="px-5 py-3 font-mono text-xs text-[#7A6E60]">{account.number}</td>
                <td className="py-3 pr-3">
                  <div className="font-medium text-[#2A2622]">{account.name}</div>
                  {account.description && <div className="text-xs text-[#7A6E60]">{account.description}</div>}
                </td>
                <td className="py-3 pr-5 text-right font-medium text-[#2A2622]">{fmt(Number(account.balance))}</td>
                <td className="py-3 pr-3">
                  {deleteConfirm === account.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => onConfirmDelete(account.id)} className="text-red-600 hover:text-red-700 p-1"><Check size={14} /></button>
                      <button onClick={onCancelDelete} className="text-[#7A6E60] hover:text-[#2A2622] p-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(account)} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={14} /></button>
                      {isAdmin && (
                        <button onClick={() => onDelete(account.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F7F2EC]">
              <td colSpan={2} className="px-5 py-3 font-semibold text-[#2A2622] text-sm">Total</td>
              <td className="py-3 pr-5 text-right font-bold text-[#2A2622]">{fmt(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function AccountModal({
  mode, initial, onSave, onClose, isPending, error,
}: {
  mode: 'new' | 'edit'
  initial: Account | null
  onSave: (data: Omit<Account, 'id' | 'is_active'>) => void
  onClose: () => void
  isPending: boolean
  error: string | null
}) {
  const [number, setNumber]       = useState(initial?.number ?? '')
  const [name, setName]           = useState(initial?.name ?? '')
  const [type, setType]           = useState<AccountType>(initial?.type ?? 'aktiv')
  const [balance, setBalance]     = useState(initial ? String(initial.balance) : '0')
  const [description, setDesc]    = useState(initial?.description ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ number, name, type, balance: parseFloat(balance) || 0, description: description || null })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
          <h2 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            {mode === 'new' ? 'Konto eröffnen' : 'Konto bearbeiten'}
          </h2>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kontonummer *" required>
              <input
                value={number} onChange={e => setNumber(e.target.value)} required
                placeholder="1000" className={input}
              />
            </Field>
            <Field label="Kontotyp *" required>
              <select value={type} onChange={e => setType(e.target.value as AccountType)} className={input}>
                <option value="aktiv">Aktiv</option>
                <option value="passiv">Passiv</option>
                <option value="ertrag">Ertrag</option>
                <option value="aufwand">Aufwand</option>
              </select>
            </Field>
          </div>

          <Field label="Bezeichnung *" required>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="z.B. Kasse, Bankkonto, Miete…" className={input}
            />
          </Field>

          <Field label="Saldo (CHF)" required={false}>
            <input
              type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
              className={input}
            />
          </Field>

          <Field label="Beschreibung" required={false}>
            <input
              value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional" className={input}
            />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors">
              Abbrechen
            </button>
            <button
              type="submit" disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? 'Speichern…' : mode === 'new' ? 'Eröffnen' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#7A6E60] mb-1">{label}</label>
      {children}
    </div>
  )
}

const input = 'w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
