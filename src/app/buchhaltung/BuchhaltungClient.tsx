'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown, Scale, BookOpen, Layers, CalendarRange, Lock, Unlock } from 'lucide-react'

type AccountType = 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'

interface AccountGroup {
  id: string
  name: string
  type: AccountType
  description: string | null
  sort_order: number
}

interface Account {
  id: string
  number: string
  name: string
  type: AccountType
  group_id: string | null
  balance: number
  description: string | null
  is_active: boolean
}

interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

const TYPE_LABELS: Record<AccountType, string> = {
  aktiv: 'Aktiv', passiv: 'Passiv', ertrag: 'Ertrag', aufwand: 'Aufwand',
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('de-CH')
}

export default function BuchhaltungClient({
  initialAccounts, initialGroups, initialFiscalYears, isAdmin,
}: {
  initialAccounts: Account[]
  initialGroups: AccountGroup[]
  initialFiscalYears: FiscalYear[]
  isAdmin: boolean
}) {
  const [accounts, setAccounts]       = useState<Account[]>(initialAccounts)
  const [groups, setGroups]           = useState<AccountGroup[]>(initialGroups)
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(initialFiscalYears)
  const [tab, setTab] = useState<'bilanz' | 'erfolg' | 'gruppen' | 'jahre'>('bilanz')

  const supabase = createClient()

  // ── Derived data ──────────────────────────────────────────
  const aktiv   = accounts.filter(a => a.type === 'aktiv'   && a.is_active)
  const passiv  = accounts.filter(a => a.type === 'passiv'  && a.is_active)
  const ertrag  = accounts.filter(a => a.type === 'ertrag'  && a.is_active)
  const aufwand = accounts.filter(a => a.type === 'aufwand' && a.is_active)

  const totalAktiv   = aktiv.reduce((s, a) => s + Number(a.balance), 0)
  const totalPassiv  = passiv.reduce((s, a) => s + Number(a.balance), 0)
  const totalErtrag  = ertrag.reduce((s, a) => s + Number(a.balance), 0)
  const totalAufwand = aufwand.reduce((s, a) => s + Number(a.balance), 0)
  const ergebnis     = totalErtrag - totalAufwand

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit">
        <TabBtn active={tab === 'bilanz'}  onClick={() => setTab('bilanz')}  icon={<Scale size={15} />}        label="Bilanz" />
        <TabBtn active={tab === 'erfolg'}  onClick={() => setTab('erfolg')}  icon={<BookOpen size={15} />}     label="Erfolgsrechnung" />
        <TabBtn active={tab === 'gruppen'} onClick={() => setTab('gruppen')} icon={<Layers size={15} />}       label="Kontengruppen" />
        <TabBtn active={tab === 'jahre'}   onClick={() => setTab('jahre')}   icon={<CalendarRange size={15} />} label="Geschäftsjahre" />
      </div>

      {/* Bilanz */}
      {tab === 'bilanz' && (
        <BilanztTab
          aktiv={aktiv} passiv={passiv}
          totalAktiv={totalAktiv} totalPassiv={totalPassiv}
          groups={groups} isAdmin={isAdmin}
          onAccountsChange={setAccounts}
          supabase={supabase}
        />
      )}

      {/* Erfolgsrechnung */}
      {tab === 'erfolg' && (
        <ErfolgsTab
          ertrag={ertrag} aufwand={aufwand}
          totalErtrag={totalErtrag} totalAufwand={totalAufwand} ergebnis={ergebnis}
          groups={groups} isAdmin={isAdmin}
          onAccountsChange={setAccounts}
          supabase={supabase}
        />
      )}

      {/* Kontengruppen */}
      {tab === 'gruppen' && (
        <GruppenTab
          groups={groups} isAdmin={isAdmin}
          onGroupsChange={setGroups}
          supabase={supabase}
        />
      )}

      {/* Geschäftsjahre */}
      {tab === 'jahre' && (
        <JahreTab
          fiscalYears={fiscalYears} isAdmin={isAdmin}
          onFiscalYearsChange={setFiscalYears}
          supabase={supabase}
        />
      )}
    </div>
  )
}

// ── Bilanz Tab ───────────────────────────────────────────────
function BilanztTab({ aktiv, passiv, totalAktiv, totalPassiv, groups, isAdmin, onAccountsChange, supabase }: any) {
  const aktivGroups  = groups.filter((g: AccountGroup) => g.type === 'aktiv')
  const passivGroups = groups.filter((g: AccountGroup) => g.type === 'passiv')
  return (
    <div>
      <ActionBar label="Konto eröffnen" onNew={() => {}} groups={groups} type="aktiv" isAdmin={isAdmin} onAccountsChange={onAccountsChange} supabase={supabase} showTypeFilter />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
        <AccountSide
          title="Aktivkonten" type="aktiv" accounts={aktiv} total={totalAktiv}
          groups={aktivGroups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingUp size={18} className="text-blue-600" />}
        />
        <AccountSide
          title="Passivkonten" type="passiv" accounts={passiv} total={totalPassiv}
          groups={passivGroups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingDown size={18} className="text-purple-600" />}
        />
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1D6C2] p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Aktiva</p>
              <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalAktiv)}</p>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${Math.abs(totalAktiv - totalPassiv) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {Math.abs(totalAktiv - totalPassiv) < 0.01 ? 'Ausgeglichen' : `Differenz: ${fmt(Math.abs(totalAktiv - totalPassiv))}`}
            </span>
            <div className="text-right">
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Passiva</p>
              <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalPassiv)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Erfolgsrechnung Tab ──────────────────────────────────────
function ErfolgsTab({ ertrag, aufwand, totalErtrag, totalAufwand, ergebnis, groups, isAdmin, onAccountsChange, supabase }: any) {
  const ertragGroups  = groups.filter((g: AccountGroup) => g.type === 'ertrag')
  const aufwandGroups = groups.filter((g: AccountGroup) => g.type === 'aufwand')
  return (
    <div>
      <ActionBar label="Konto eröffnen" onNew={() => {}} groups={groups} type="ertrag" isAdmin={isAdmin} onAccountsChange={onAccountsChange} supabase={supabase} showTypeFilter />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
        <AccountSide
          title="Ertragskonten" type="ertrag" accounts={ertrag} total={totalErtrag}
          groups={ertragGroups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingUp size={18} className="text-green-600" />}
        />
        <AccountSide
          title="Aufwandskonten" type="aufwand" accounts={aufwand} total={totalAufwand}
          groups={aufwandGroups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingDown size={18} className="text-red-600" />}
        />
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1D6C2] p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Total Ertrag</p>
              <p className="text-xl font-semibold text-green-700">CHF {fmt(totalErtrag)}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Ergebnis</p>
              <p className={`text-2xl font-bold ${ergebnis >= 0 ? 'text-green-700' : 'text-red-600'}`}>CHF {fmt(ergebnis)}</p>
              <p className="text-xs text-[#7A6E60] mt-0.5">{ergebnis >= 0 ? 'Gewinn' : 'Verlust'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Total Aufwand</p>
              <p className="text-xl font-semibold text-red-600">CHF {fmt(totalAufwand)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Account Side (grouped) ───────────────────────────────────
function AccountSide({ title, type, accounts, total, groups, isAdmin, allGroups, onAccountsChange, supabase, icon }: {
  title: string; type: AccountType; accounts: Account[]; total: number
  groups: AccountGroup[]; isAdmin: boolean; allGroups: AccountGroup[]
  onAccountsChange: (fn: (prev: Account[]) => Account[]) => void
  supabase: any; icon: React.ReactNode
}) {
  const [modal, setModal]   = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  const ungrouped = accounts.filter(a => !a.group_id)

  async function handleSave(data: Omit<Account, 'id' | 'is_active'>) {
    setError(null)
    start(async () => {
      if (modal === 'new') {
        const { data: created, error: err } = await supabase.from('accounts').insert({ ...data, is_active: true, type }).select().single()
        if (err) { setError(err.message); return }
        onAccountsChange(prev => [...prev, created].sort((a, b) => a.number.localeCompare(b.number)))
      } else if (modal === 'edit' && editing) {
        const { data: updated, error: err } = await supabase.from('accounts').update(data).eq('id', editing.id).select().single()
        if (err) { setError(err.message); return }
        onAccountsChange(prev => prev.map(a => a.id === editing.id ? updated : a))
      }
      setModal(null); setEditing(null)
    })
  }

  async function handleDelete(id: string) {
    start(async () => {
      await supabase.from('accounts').delete().eq('id', id)
      onAccountsChange(prev => prev.filter(a => a.id !== id))
      setDeleteConfirm(null)
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E1D6C2]">
        {icon}
        <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{title}</h2>
        <button onClick={() => { setEditing(null); setModal('new'); setError(null) }} className="ml-auto flex items-center gap-1 text-xs text-[#6B8E7F] hover:text-[#5a7a6c] font-medium">
          <Plus size={13} /> Konto
        </button>
      </div>

      {/* Grouped sections */}
      {groups.map(group => {
        const groupAccounts = accounts.filter(a => a.group_id === group.id)
        if (groupAccounts.length === 0) return null
        const groupTotal = groupAccounts.reduce((s, a) => s + Number(a.balance), 0)
        return (
          <div key={group.id}>
            <div className="px-5 py-2 bg-[#F7F2EC] border-b border-[#E1D6C2]">
              <span className="text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">{group.name}</span>
              <span className="float-right text-xs text-[#7A6E60] font-medium">{fmt(groupTotal)}</span>
            </div>
            <AccountRows
              accounts={groupAccounts} isAdmin={isAdmin}
              deleteConfirm={deleteConfirm}
              onEdit={a => { setEditing(a); setModal('edit'); setError(null) }}
              onDelete={id => setDeleteConfirm(id)}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          </div>
        )
      })}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div>
          {groups.length > 0 && (
            <div className="px-5 py-2 bg-[#F7F2EC] border-b border-[#E1D6C2]">
              <span className="text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">Ohne Gruppe</span>
            </div>
          )}
          <AccountRows
            accounts={ungrouped} isAdmin={isAdmin}
            deleteConfirm={deleteConfirm}
            onEdit={a => { setEditing(a); setModal('edit'); setError(null) }}
            onDelete={id => setDeleteConfirm(id)}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setDeleteConfirm(null)}
          />
        </div>
      )}

      {accounts.length === 0 && (
        <p className="text-center text-sm text-[#7A6E60] py-10">Keine Konten vorhanden</p>
      )}

      {/* Total */}
      <div className="flex justify-between px-5 py-3 bg-[#F7F2EC] border-t border-[#E1D6C2]">
        <span className="font-semibold text-sm text-[#2A2622]">Total</span>
        <span className="font-bold text-[#2A2622]">{fmt(total)}</span>
      </div>

      {modal && (
        <AccountModal
          mode={modal} initial={editing} fixedType={type}
          groups={allGroups.filter(g => g.type === type)}
          onSave={handleSave} onClose={() => { setModal(null); setEditing(null) }}
          isPending={isPending} error={error}
        />
      )}
    </div>
  )
}

function AccountRows({ accounts, isAdmin, deleteConfirm, onEdit, onDelete, onConfirmDelete, onCancelDelete }: {
  accounts: Account[]; isAdmin: boolean; deleteConfirm: string | null
  onEdit: (a: Account) => void; onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void; onCancelDelete: () => void
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {accounts.map(account => (
          <tr key={account.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
            <td className="pl-5 pr-2 py-2.5 font-mono text-xs text-[#7A6E60] w-16">{account.number}</td>
            <td className="py-2.5 pr-3">
              <div className="font-medium text-[#2A2622]">{account.name}</div>
              {account.description && <div className="text-xs text-[#7A6E60]">{account.description}</div>}
            </td>
            <td className="py-2.5 pr-4 text-right font-medium text-[#2A2622] whitespace-nowrap">{fmt(Number(account.balance))}</td>
            <td className="py-2.5 pr-3 w-16">
              {deleteConfirm === account.id ? (
                <div className="flex gap-1">
                  <button onClick={() => onConfirmDelete(account.id)} className="text-red-600 hover:text-red-700 p-1"><Check size={13} /></button>
                  <button onClick={onCancelDelete} className="text-[#7A6E60] p-1"><X size={13} /></button>
                </div>
              ) : (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(account)} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                  {isAdmin && <button onClick={() => onDelete(account.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Kontengruppen Tab ────────────────────────────────────────
function GruppenTab({ groups, isAdmin, onGroupsChange, supabase }: {
  groups: AccountGroup[]; isAdmin: boolean
  onGroupsChange: (g: AccountGroup[]) => void; supabase: any
}) {
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<AccountGroup | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  async function handleSave(data: Omit<AccountGroup, 'id'>) {
    setError(null)
    start(async () => {
      if (!editing) {
        const { data: created, error: err } = await supabase.from('account_groups').insert(data).select().single()
        if (err) { setError(err.message); return }
        onGroupsChange([...groups, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
      } else {
        const { data: updated, error: err } = await supabase.from('account_groups').update(data).eq('id', editing.id).select().single()
        if (err) { setError(err.message); return }
        onGroupsChange(groups.map(g => g.id === editing.id ? updated : g))
      }
      setModal(false); setEditing(null)
    })
  }

  async function handleDelete(id: string) {
    start(async () => {
      await supabase.from('account_groups').delete().eq('id', id)
      onGroupsChange(groups.filter(g => g.id !== id))
      setDeleteConfirm(null)
    })
  }

  const byType = (['aktiv', 'passiv', 'ertrag', 'aufwand'] as AccountType[]).map(type => ({
    type, items: groups.filter(g => g.type === type)
  }))

  return (
    <div>
      <div className="flex justify-end mb-5">
        <NewBtn onClick={() => { setEditing(null); setModal(true); setError(null) }} label="Gruppe erstellen" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {byType.map(({ type, items }) => (
          <div key={type} className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E1D6C2] flex items-center justify-between">
              <span className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{TYPE_LABELS[type]}</span>
              <span className="text-xs text-[#7A6E60]">{items.length} Gruppe{items.length !== 1 ? 'n' : ''}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-[#7A6E60] text-center py-6">Keine Gruppen</p>
            ) : (
              <ul>
                {items.map(g => (
                  <li key={g.id} className="flex items-center justify-between px-5 py-3 border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                    <div>
                      <p className="font-medium text-[#2A2622] text-sm">{g.name}</p>
                      {g.description && <p className="text-xs text-[#7A6E60]">{g.description}</p>}
                    </div>
                    {deleteConfirm === g.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(g.id)} className="text-red-600 p-1"><Check size={13} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#7A6E60] p-1"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(g); setModal(true); setError(null) }} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                        {isAdmin && <button onClick={() => setDeleteConfirm(g.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <GroupModal
          initial={editing} onSave={handleSave}
          onClose={() => { setModal(false); setEditing(null) }}
          isPending={isPending} error={error}
        />
      )}
    </div>
  )
}

// ── Geschäftsjahre Tab ───────────────────────────────────────
function JahreTab({ fiscalYears, isAdmin, onFiscalYearsChange, supabase }: {
  fiscalYears: FiscalYear[]; isAdmin: boolean
  onFiscalYearsChange: (y: FiscalYear[]) => void; supabase: any
}) {
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<FiscalYear | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  async function handleSave(data: Omit<FiscalYear, 'id'>) {
    setError(null)
    start(async () => {
      if (!editing) {
        const { data: created, error: err } = await supabase.from('fiscal_years').insert(data).select().single()
        if (err) { setError(err.message); return }
        onFiscalYearsChange([created, ...fiscalYears])
      } else {
        const { data: updated, error: err } = await supabase.from('fiscal_years').update(data).eq('id', editing.id).select().single()
        if (err) { setError(err.message); return }
        onFiscalYearsChange(fiscalYears.map(y => y.id === editing.id ? updated : y))
      }
      setModal(false); setEditing(null)
    })
  }

  async function handleDelete(id: string) {
    start(async () => {
      await supabase.from('fiscal_years').delete().eq('id', id)
      onFiscalYearsChange(fiscalYears.filter(y => y.id !== id))
      setDeleteConfirm(null)
    })
  }

  async function toggleClose(year: FiscalYear) {
    start(async () => {
      const { data: updated } = await supabase
        .from('fiscal_years').update({ is_closed: !year.is_closed }).eq('id', year.id).select().single()
      if (updated) onFiscalYearsChange(fiscalYears.map(y => y.id === year.id ? updated : y))
    })
  }

  return (
    <div>
      <div className="flex justify-end mb-5">
        <NewBtn onClick={() => { setEditing(null); setModal(true); setError(null) }} label="Geschäftsjahr eröffnen" />
      </div>

      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
        {fiscalYears.length === 0 ? (
          <p className="text-sm text-[#7A6E60] text-center py-12">Keine Geschäftsjahre vorhanden</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                <th className="text-left px-5 py-3">Bezeichnung</th>
                <th className="text-left py-3">Von</th>
                <th className="text-left py-3">Bis</th>
                <th className="text-left py-3">Status</th>
                <th className="py-3 pr-4 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {fiscalYears.map(year => (
                <tr key={year.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                  <td className="px-5 py-3 font-semibold text-[#2A2622]">{year.name}</td>
                  <td className="py-3 text-[#4A4138]">{fmtDate(year.start_date)}</td>
                  <td className="py-3 text-[#4A4138]">{fmtDate(year.end_date)}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${year.is_closed ? 'bg-[#F4EDE2] text-[#7A6E60]' : 'bg-green-100 text-green-700'}`}>
                      {year.is_closed ? 'Abgeschlossen' : 'Offen'}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {deleteConfirm === year.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(year.id)} className="text-red-600 p-1"><Check size={13} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#7A6E60] p-1"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <button onClick={() => toggleClose(year)} title={year.is_closed ? 'Wiedereröffnen' : 'Abschliessen'} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1">
                            {year.is_closed ? <Unlock size={13} /> : <Lock size={13} />}
                          </button>
                        )}
                        <button onClick={() => { setEditing(year); setModal(true); setError(null) }} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                        {isAdmin && <button onClick={() => setDeleteConfirm(year.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <FiscalYearModal
          initial={editing} onSave={handleSave}
          onClose={() => { setModal(false); setEditing(null) }}
          isPending={isPending} error={error}
        />
      )}
    </div>
  )
}

// ── Modals ───────────────────────────────────────────────────
function AccountModal({ mode, initial, fixedType, groups, onSave, onClose, isPending, error }: {
  mode: 'new' | 'edit'; initial: Account | null; fixedType: AccountType
  groups: AccountGroup[]; onSave: (d: any) => void; onClose: () => void
  isPending: boolean; error: string | null
}) {
  const [number, setNumber]   = useState(initial?.number ?? '')
  const [name, setName]       = useState(initial?.name ?? '')
  const [groupId, setGroupId] = useState(initial?.group_id ?? '')
  const [balance, setBalance] = useState(initial ? String(initial.balance) : '0')
  const [desc, setDesc]       = useState(initial?.description ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ number, name, type: fixedType, group_id: groupId || null, balance: parseFloat(balance) || 0, description: desc || null })
  }

  return (
    <Modal title={mode === 'new' ? 'Konto eröffnen' : 'Konto bearbeiten'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kontonummer *">
            <input value={number} onChange={e => setNumber(e.target.value)} required placeholder="1000" className={inp} />
          </Field>
          <Field label="Gruppe">
            <select value={groupId} onChange={e => setGroupId(e.target.value)} className={inp}>
              <option value="">— keine —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Bezeichnung *">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="z.B. Kasse, Miete…" className={inp} />
        </Field>
        <Field label="Saldo (CHF)">
          <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} className={inp} />
        </Field>
        <Field label="Beschreibung">
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" className={inp} />
        </Field>
        <ModalActions onClose={onClose} isPending={isPending} error={error} label={mode === 'new' ? 'Eröffnen' : 'Speichern'} />
      </form>
    </Modal>
  )
}

function GroupModal({ initial, onSave, onClose, isPending, error }: {
  initial: AccountGroup | null; onSave: (d: any) => void; onClose: () => void
  isPending: boolean; error: string | null
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [type, setType]     = useState<AccountType>(initial?.type ?? 'aktiv')
  const [desc, setDesc]     = useState(initial?.description ?? '')
  const [order, setOrder]   = useState(String(initial?.sort_order ?? 0))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ name, type, description: desc || null, sort_order: parseInt(order) || 0 })
  }

  return (
    <Modal title={initial ? 'Gruppe bearbeiten' : 'Gruppe erstellen'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bezeichnung *">
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="z.B. Umlaufvermögen" className={inp} />
          </Field>
          <Field label="Typ *">
            <select value={type} onChange={e => setType(e.target.value as AccountType)} className={inp}>
              <option value="aktiv">Aktiv</option>
              <option value="passiv">Passiv</option>
              <option value="ertrag">Ertrag</option>
              <option value="aufwand">Aufwand</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Beschreibung">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" className={inp} />
          </Field>
          <Field label="Reihenfolge">
            <input type="number" value={order} onChange={e => setOrder(e.target.value)} className={inp} />
          </Field>
        </div>
        <ModalActions onClose={onClose} isPending={isPending} error={error} label={initial ? 'Speichern' : 'Erstellen'} />
      </form>
    </Modal>
  )
}

function FiscalYearModal({ initial, onSave, onClose, isPending, error }: {
  initial: FiscalYear | null; onSave: (d: any) => void; onClose: () => void
  isPending: boolean; error: string | null
}) {
  const [name, setName]   = useState(initial?.name ?? '')
  const [start, setStart] = useState(initial?.start_date ?? '')
  const [end, setEnd]     = useState(initial?.end_date ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ name, start_date: start, end_date: end, is_closed: initial?.is_closed ?? false })
  }

  return (
    <Modal title={initial ? 'Geschäftsjahr bearbeiten' : 'Geschäftsjahr eröffnen'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Bezeichnung *">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="z.B. 2025" className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von *">
            <input type="date" value={start} onChange={e => setStart(e.target.value)} required className={inp} />
          </Field>
          <Field label="Bis *">
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} required className={inp} />
          </Field>
        </div>
        <ModalActions onClose={onClose} isPending={isPending} error={error} label={initial ? 'Speichern' : 'Eröffnen'} />
      </form>
    </Modal>
  )
}

// ── Shared UI ────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
          <h2 className="text-lg font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{title}</h2>
          <button onClick={onClose} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={20} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onClose, isPending, error, label }: { onClose: () => void; isPending: boolean; error: string | null; label: string }) {
  return (
    <>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors">Abbrechen</button>
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50">
          {isPending ? 'Speichern…' : label}
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#7A6E60] mb-1">{label}</label>
      {children}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:text-[#2A2622]'}`}>
      {icon}{label}
    </button>
  )
}

function NewBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
      <Plus size={16} />{label}
    </button>
  )
}

function ActionBar({ label, groups, type, isAdmin, onAccountsChange, supabase, showTypeFilter }: any) {
  return <div /> // placeholder – add button is inline in AccountSide header
}

const inp = 'w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
