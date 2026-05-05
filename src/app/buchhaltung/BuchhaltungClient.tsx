'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Pencil, Trash2, X, Check,
  TrendingUp, TrendingDown, Scale, BookOpen,
  Layers, CalendarRange, Lock, Unlock, ReceiptText, ClipboardCheck, AlertTriangle,
} from 'lucide-react'

type AccountType = 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'

interface AccountGroup {
  id: string
  name: string
  type: AccountType
  description: string | null
  sort_order: number
  account_number: string | null
  level: 'klasse' | 'gruppe' | null
  parent_id: string | null
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

interface JournalEntry {
  id: string
  date: string
  description: string
  debit_account_id: string
  credit_account_id: string
  amount: number
  fiscal_year_id: string | null
  created_at: string
  debit_account?: { number: string; name: string; type: AccountType }
  credit_account?: { number: string; name: string; type: AccountType }
  fiscal_year?: { id: string; name: string } | null
}

interface GroupNode extends AccountGroup {
  children: GroupNode[]
  nodeAccounts: Account[]
}

// ── Helpers ──────────────────────────────────────────────────
const TYPE_LABELS: Record<AccountType, string> = {
  aktiv: 'Aktiv', passiv: 'Passiv', ertrag: 'Ertrag', aufwand: 'Aufwand',
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('de-CH')
}

function buildGroupTree(allGroups: AccountGroup[], accounts: Account[], type: AccountType): GroupNode[] {
  const typeGroups = allGroups.filter(g => g.type === type)
  const roots = typeGroups.filter(g => !g.parent_id)

  function buildNode(g: AccountGroup): GroupNode {
    return {
      ...g,
      children: typeGroups
        .filter(c => c.parent_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order || (a.account_number ?? '').localeCompare(b.account_number ?? ''))
        .map(buildNode),
      nodeAccounts: accounts.filter(a => a.group_id === g.id && a.is_active),
    }
  }

  return roots
    .sort((a, b) => a.sort_order - b.sort_order || (a.account_number ?? '').localeCompare(b.account_number ?? ''))
    .map(buildNode)
}

function subtreeTotal(node: GroupNode): number {
  const own = node.nodeAccounts.reduce((s, a) => s + Number(a.balance), 0)
  return own + node.children.reduce((s, c) => s + subtreeTotal(c), 0)
}

// Historical balance: start from current account.balance and reverse all entries after cutoff
function getBalanceAt(account: Account, allEntries: JournalEntry[], cutoffDate: string): number {
  let bal = Number(account.balance)
  for (const e of allEntries) {
    if (e.date <= cutoffDate) continue
    const amt = Number(e.amount)
    if (e.debit_account_id === account.id)
      bal -= (account.type === 'aktiv' || account.type === 'aufwand') ? amt : -amt
    if (e.credit_account_id === account.id)
      bal -= (account.type === 'passiv' || account.type === 'ertrag') ? amt : -amt
  }
  return bal
}

function computePeriodBalances(accounts: Account[], entries: JournalEntry[]): Map<string, number> {
  const map = new Map<string, number>(accounts.map(a => [a.id, 0]))
  for (const e of entries) {
    const amt = Number(e.amount)
    const debitType  = accounts.find(a => a.id === e.debit_account_id)?.type
    const creditType = accounts.find(a => a.id === e.credit_account_id)?.type
    if (debitType) {
      const delta = (debitType === 'aktiv' || debitType === 'aufwand') ? amt : -amt
      map.set(e.debit_account_id, (map.get(e.debit_account_id) ?? 0) + delta)
    }
    if (creditType) {
      const delta = (creditType === 'passiv' || creditType === 'ertrag') ? amt : -amt
      map.set(e.credit_account_id, (map.get(e.credit_account_id) ?? 0) + delta)
    }
  }
  return map
}

// ── Geschäftsjahr-Auswahl ────────────────────────────────────
function FiscalYearPicker({ fiscalYears, value, onChange }: {
  fiscalYears: FiscalYear[]; value: string; onChange: (id: string) => void
}) {
  if (fiscalYears.length === 0) return <span className="text-xs text-[#7A6E60] italic">Kein Geschäftsjahr</span>
  return (
    <div className="flex items-center gap-2">
      <CalendarRange size={14} className="text-[#7A6E60] shrink-0" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-[#E1D6C2] rounded-lg px-2.5 py-1.5 bg-white text-[#2A2622] focus:outline-none focus:ring-1 focus:ring-[#6B8E7F]"
      >
        {fiscalYears.map(y => (
          <option key={y.id} value={y.id}>
            {y.name}{y.is_closed ? ' (Abgeschlossen)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function BuchhaltungClient({
  initialAccounts, initialGroups, initialFiscalYears, initialJournalEntries, isAdmin,
}: {
  initialAccounts: Account[]
  initialGroups: AccountGroup[]
  initialFiscalYears: FiscalYear[]
  initialJournalEntries: JournalEntry[]
  isAdmin: boolean
}) {
  const [accounts, setAccounts]             = useState<Account[]>(initialAccounts)
  const [groups]                            = useState<AccountGroup[]>(initialGroups)
  const [fiscalYears, setFiscalYears]       = useState<FiscalYear[]>(initialFiscalYears)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(initialJournalEntries)
  const [tab, setTab] = useState<'bilanz' | 'erfolg' | 'buchungen' | 'gruppen' | 'jahre'>('bilanz')
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<string>(
    () => initialFiscalYears.find(y => !y.is_closed)?.id ?? initialFiscalYears[0]?.id ?? ''
  )

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

  const periodEntries = journalEntries.filter(e => e.fiscal_year_id === selectedFiscalYearId)
  const periodBalances = computePeriodBalances([...ertrag, ...aufwand], periodEntries)
  const periodErtragAccounts  = ertrag.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const periodAufwandAccounts = aufwand.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const periodErgebnis = periodErtragAccounts.reduce((s, a) => s + a.balance, 0)
                       - periodAufwandAccounts.reduce((s, a) => s + a.balance, 0)

  // Bilanz: historische Salden für abgeschlossene Jahre rekonstruieren
  const selectedFiscalYear = fiscalYears.find(y => y.id === selectedFiscalYearId)
  const isHistoricalYear   = selectedFiscalYear?.is_closed === true
  const bilanzAktiv  = isHistoricalYear && selectedFiscalYear
    ? aktiv.map(a => ({ ...a, balance: getBalanceAt(a, journalEntries, selectedFiscalYear.end_date) }))
    : aktiv
  const bilanzPassiv = isHistoricalYear && selectedFiscalYear
    ? passiv.map(a => ({ ...a, balance: getBalanceAt(a, journalEntries, selectedFiscalYear.end_date) }))
    : passiv
  const bilanzTotalAktiv  = bilanzAktiv.reduce((s, a) => s + Number(a.balance), 0)
  const bilanzTotalPassiv = bilanzPassiv.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit">
        <TabBtn active={tab === 'bilanz'}    onClick={() => setTab('bilanz')}    icon={<Scale size={15} />}         label="Bilanz" />
        <TabBtn active={tab === 'erfolg'}    onClick={() => setTab('erfolg')}    icon={<BookOpen size={15} />}      label="Erfolgsrechnung" />
        <TabBtn active={tab === 'buchungen'} onClick={() => setTab('buchungen')} icon={<ReceiptText size={15} />}   label="Buchungen" />
        <TabBtn active={tab === 'gruppen'}   onClick={() => setTab('gruppen')}   icon={<Layers size={15} />}        label="Kontengruppen" />
        <TabBtn active={tab === 'jahre'}     onClick={() => setTab('jahre')}     icon={<CalendarRange size={15} />} label="Geschäftsjahre" />
      </div>

      {tab === 'bilanz' && (
        <BilanzTab
          aktiv={bilanzAktiv} passiv={bilanzPassiv}
          totalAktiv={bilanzTotalAktiv} totalPassiv={bilanzTotalPassiv}
          ergebnis={isHistoricalYear ? 0 : periodErgebnis}
          isHistoricalYear={isHistoricalYear}
          fiscalYears={fiscalYears}
          selectedFiscalYearId={selectedFiscalYearId}
          onFiscalYearChange={setSelectedFiscalYearId}
          groups={groups} isAdmin={isAdmin}
          onAccountsChange={setAccounts} supabase={supabase}
        />
      )}

      {tab === 'erfolg' && (
        <ErfolgsTab
          ertrag={periodErtragAccounts} aufwand={periodAufwandAccounts}
          totalErtrag={periodErtragAccounts.reduce((s, a) => s + a.balance, 0)}
          totalAufwand={periodAufwandAccounts.reduce((s, a) => s + a.balance, 0)}
          ergebnis={periodErgebnis}
          fiscalYears={fiscalYears}
          selectedFiscalYearId={selectedFiscalYearId}
          onFiscalYearChange={setSelectedFiscalYearId}
          groups={groups} isAdmin={isAdmin}
          onAccountsChange={setAccounts} supabase={supabase}
        />
      )}

      {tab === 'buchungen' && (
        <BuchungenTab
          accounts={accounts.filter(a => a.is_active)}
          journalEntries={journalEntries}
          fiscalYears={fiscalYears}
          onJournalEntriesChange={setJournalEntries}
          onAccountsChange={setAccounts}
          supabase={supabase}
        />
      )}

      {tab === 'gruppen' && (
        <GruppenTab
          groups={groups} isAdmin={isAdmin}
          supabase={supabase}
        />
      )}

      {tab === 'jahre' && (
        <JahreTab
          fiscalYears={fiscalYears} isAdmin={isAdmin}
          onFiscalYearsChange={setFiscalYears}
          accounts={accounts.filter(a => a.is_active)}
          ertragAccounts={ertrag} aufwandAccounts={aufwand}
          ergebnis={ergebnis}
          onAccountsChange={setAccounts}
          onJournalEntriesChange={setJournalEntries}
          supabase={supabase}
        />
      )}
    </div>
  )
}

// ── Bilanz Tab ───────────────────────────────────────────────
function BilanzTab({ aktiv, passiv, totalAktiv, totalPassiv, ergebnis, isHistoricalYear, fiscalYears, selectedFiscalYearId, onFiscalYearChange, groups, isAdmin, onAccountsChange, supabase }: {
  aktiv: Account[]; passiv: Account[]
  totalAktiv: number; totalPassiv: number; ergebnis: number
  isHistoricalYear: boolean
  fiscalYears: FiscalYear[]; selectedFiscalYearId: string
  onFiscalYearChange: (id: string) => void
  groups: AccountGroup[]; isAdmin: boolean
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>; supabase: ReturnType<typeof createClient>
}) {
  const totalPassivMitErgebnis = totalPassiv + ergebnis
  const ausgeglichen = Math.abs(totalAktiv - totalPassivMitErgebnis) < 0.01
  const selectedYear = fiscalYears.find(y => y.id === selectedFiscalYearId)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <FiscalYearPicker fiscalYears={fiscalYears} value={selectedFiscalYearId} onChange={onFiscalYearChange} />
        {isHistoricalYear && selectedYear && (
          <p className="text-xs text-[#7A6E60]">Stand per {new Date(selectedYear.end_date).toLocaleDateString('de-CH')}</p>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountSide
          title="Aktivkonten" type="aktiv" accounts={aktiv} total={totalAktiv}
          groups={groups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingUp size={18} className="text-blue-600" />}
          readOnly={isHistoricalYear}
        />
        <AccountSide
          title="Passivkonten" type="passiv" accounts={passiv} total={totalPassiv}
          groups={groups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingDown size={18} className="text-purple-600" />}
          jahresergebnis={ergebnis}
          readOnly={isHistoricalYear}
        />
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1D6C2] p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Aktiva</p>
              <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalAktiv)}</p>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${ausgeglichen ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {ausgeglichen ? 'Ausgeglichen' : `Differenz: ${fmt(Math.abs(totalAktiv - totalPassivMitErgebnis))}`}
            </span>
            <div className="text-right">
              <p className="text-xs text-[#7A6E60] uppercase tracking-wide">Bilanzsumme Passiva</p>
              <p className="text-xl font-semibold text-[#2A2622]">CHF {fmt(totalPassivMitErgebnis)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Erfolgsrechnung Tab ──────────────────────────────────────
function ErfolgsTab({ ertrag, aufwand, totalErtrag, totalAufwand, ergebnis, fiscalYears, selectedFiscalYearId, onFiscalYearChange, groups, isAdmin, onAccountsChange, supabase }: {
  ertrag: Account[]; aufwand: Account[]
  totalErtrag: number; totalAufwand: number; ergebnis: number
  fiscalYears: FiscalYear[]; selectedFiscalYearId: string
  onFiscalYearChange: (id: string) => void
  groups: AccountGroup[]; isAdmin: boolean
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>; supabase: ReturnType<typeof createClient>
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <FiscalYearPicker fiscalYears={fiscalYears} value={selectedFiscalYearId} onChange={onFiscalYearChange} />
        <p className="text-xs text-[#7A6E60]">Beträge aus Buchungen des gewählten Geschäftsjahrs</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountSide
          title="Ertragskonten" type="ertrag" accounts={ertrag} total={totalErtrag}
          groups={groups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingUp size={18} className="text-green-600" />}
          readOnly
        />
        <AccountSide
          title="Aufwandskonten" type="aufwand" accounts={aufwand} total={totalAufwand}
          groups={groups} isAdmin={isAdmin} allGroups={groups}
          onAccountsChange={onAccountsChange} supabase={supabase}
          icon={<TrendingDown size={18} className="text-red-600" />}
          readOnly
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

// ── Account Side (hierarchical) ──────────────────────────────
function AccountSide({ title, type, accounts, total, groups, isAdmin, allGroups, onAccountsChange, supabase, icon, jahresergebnis, readOnly }: {
  title: string; type: AccountType; accounts: Account[]; total: number
  groups: AccountGroup[]; isAdmin: boolean; allGroups: AccountGroup[]
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>
  supabase: ReturnType<typeof createClient>; icon: React.ReactNode
  jahresergebnis?: number
  readOnly?: boolean
}) {
  const [modal, setModal]         = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing]     = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  const tree = buildGroupTree(groups, accounts, type)
  const ungrouped = accounts.filter(a => !a.group_id)

  async function handleSave(data: Omit<Account, 'id' | 'is_active'>) {
    setError(null)
    start(async () => {
      if (modal === 'new') {
        const { data: created, error: err } = await supabase.from('accounts').insert({ ...data, is_active: true, type }).select().single()
        if (err) { setError(err.message); return }
        onAccountsChange(prev => [...prev, created as Account].sort((a, b) => a.number.localeCompare(b.number)))
      } else if (modal === 'edit' && editing) {
        const { data: updated, error: err } = await supabase.from('accounts').update(data).eq('id', editing.id).select().single()
        if (err) { setError(err.message); return }
        onAccountsChange(prev => prev.map(a => a.id === editing.id ? updated as Account : a))
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

  const rowProps = {
    isAdmin, deleteConfirm, readOnly: readOnly ?? false,
    onEdit: (a: Account) => { setEditing(a); setModal('edit'); setError(null) },
    onDelete: (id: string) => setDeleteConfirm(id),
    onConfirmDelete: handleDelete,
    onCancelDelete: () => setDeleteConfirm(null),
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E1D6C2]">
        {icon}
        <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{title}</h2>
        {!readOnly && (
          <button
            onClick={() => { setEditing(null); setModal('new'); setError(null) }}
            className="ml-auto flex items-center gap-1 text-xs text-[#6B8E7F] hover:text-[#5a7a6c] font-medium"
          >
            <Plus size={13} /> Konto
          </button>
        )}
      </div>

      {tree.length === 0 && ungrouped.length === 0 && (
        <p className="text-center text-sm text-[#7A6E60] py-10">Keine Konten vorhanden</p>
      )}

      {tree.map(node => (
        <GroupNodeRow key={node.id} node={node} depth={0} rowProps={rowProps} />
      ))}

      {ungrouped.length > 0 && (
        <div>
          {tree.length > 0 && (
            <div className="px-5 py-2 bg-[#F7F2EC] border-b border-[#E1D6C2]">
              <span className="text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">Ohne Gruppe</span>
            </div>
          )}
          <AccountRows accounts={ungrouped} {...rowProps} indent={0} />
        </div>
      )}

      {/* Virtuelles Jahresergebnis (nur auf Passiv-Seite) */}
      {jahresergebnis !== undefined && jahresergebnis !== 0 && (
        <div className="border-t border-[#E1D6C2]">
          <div className="px-5 py-1.5 bg-[#F4EDE2] border-b border-[#E1D6C2]">
            <div className="flex items-center justify-between pl-4">
              <span className="text-xs font-semibold text-[#4A4138] uppercase tracking-wide">
                Jahresergebnis (laufend)
              </span>
              <span className={`font-mono text-xs font-semibold ${jahresergebnis >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(jahresergebnis)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between px-5 py-3 bg-[#F7F2EC] border-t border-[#E1D6C2]">
        <span className="font-semibold text-sm text-[#2A2622]">Total</span>
        <span className="font-bold text-[#2A2622]">{fmt(total + (jahresergebnis ?? 0))}</span>
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

// ── Recursive group node renderer ────────────────────────────
function GroupNodeRow({ node, depth, rowProps }: {
  node: GroupNode; depth: number
  rowProps: {
    isAdmin: boolean; deleteConfirm: string | null; readOnly: boolean
    onEdit: (a: Account) => void; onDelete: (id: string) => void
    onConfirmDelete: (id: string) => void; onCancelDelete: () => void
  }
}) {
  const total = subtreeTotal(node)

  const isKlasse = node.level === 'klasse'
  const headerCls = isKlasse
    ? 'px-5 py-2 bg-[#EDE7DA] border-b border-[#E1D6C2]'
    : depth === 1
      ? 'px-5 py-1.5 bg-[#F4EDE2] border-b border-[#E1D6C2]'
      : 'px-5 py-1.5 bg-[#F7F2EC] border-b border-[#E1D6C2]'

  const labelCls = isKlasse
    ? 'text-xs font-bold text-[#2A2622] uppercase tracking-wide'
    : depth === 1
      ? 'text-xs font-semibold text-[#4A4138] uppercase tracking-wide'
      : 'text-xs font-medium text-[#7A6E60]'

  const indentPx = depth === 0 ? '' : depth === 1 ? 'pl-4' : 'pl-8'

  return (
    <>
      <div className={headerCls}>
        <div className={`flex items-center justify-between ${indentPx}`}>
          <span className={labelCls}>
            {node.account_number && <span className="font-mono mr-2 opacity-60">{node.account_number}</span>}
            {node.name}
          </span>
          {total !== 0 && (
            <span className={`font-mono text-xs ${isKlasse ? 'font-bold text-[#2A2622]' : 'text-[#7A6E60]'}`}>
              {fmt(total)}
            </span>
          )}
        </div>
      </div>

      {node.nodeAccounts.length > 0 && (
        <AccountRows accounts={node.nodeAccounts} {...rowProps} indent={depth + 1} />
      )}

      {node.children.map(child => (
        <GroupNodeRow key={child.id} node={child} depth={depth + 1} rowProps={rowProps} />
      ))}
    </>
  )
}

function AccountRows({ accounts, isAdmin, deleteConfirm, onEdit, onDelete, onConfirmDelete, onCancelDelete, indent, readOnly }: {
  accounts: Account[]; isAdmin: boolean; deleteConfirm: string | null; indent: number; readOnly: boolean
  onEdit: (a: Account) => void; onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void; onCancelDelete: () => void
}) {
  const pl = indent === 0 ? 'pl-5' : indent === 1 ? 'pl-7' : indent === 2 ? 'pl-9' : 'pl-11'
  return (
    <table className="w-full text-sm">
      <tbody>
        {accounts.map(account => (
          <tr key={account.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
            <td className={`${pl} pr-2 py-2 font-mono text-xs text-[#7A6E60] w-16`}>{account.number}</td>
            <td className="py-2 pr-3">
              <div className="font-medium text-[#2A2622] text-sm">{account.name}</div>
              {account.description && <div className="text-xs text-[#7A6E60]">{account.description}</div>}
            </td>
            <td className="py-2 pr-4 text-right font-medium text-[#2A2622] whitespace-nowrap text-sm">{fmt(Number(account.balance))}</td>
            <td className="py-2 pr-3 w-16">
              {!readOnly && (
                deleteConfirm === account.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => onConfirmDelete(account.id)} className="text-red-600 hover:text-red-700 p-1"><Check size={13} /></button>
                    <button onClick={onCancelDelete} className="text-[#7A6E60] p-1"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(account)} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                    {isAdmin && <button onClick={() => onDelete(account.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>}
                  </div>
                )
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Buchungen Tab ────────────────────────────────────────────
function BuchungenTab({ accounts, journalEntries, fiscalYears, onJournalEntriesChange, onAccountsChange, supabase }: {
  accounts: Account[]
  journalEntries: JournalEntry[]
  fiscalYears: FiscalYear[]
  onJournalEntriesChange: React.Dispatch<React.SetStateAction<JournalEntry[]>>
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>
  supabase: ReturnType<typeof createClient>
}) {
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [isPending, start]              = useTransition()

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]         = useState(today)
  const [description, setDesc]  = useState('')
  const [debitId, setDebitId]   = useState('')
  const [creditId, setCreditId] = useState('')
  const [amount, setAmount]     = useState('')

  const defaultFiscalYearId = fiscalYears.find(y => !y.is_closed)?.id ?? fiscalYears[0]?.id ?? ''
  const [filterYearId, setFilterYearId]       = useState<string>('all')
  const [formFiscalYearId, setFormFiscalYearId] = useState<string>(defaultFiscalYearId)

  const isEditMode = editingEntry !== null

  function openNew() {
    setEditingEntry(null)
    setDate(today); setDesc(''); setDebitId(''); setCreditId(''); setAmount('')
    setFormFiscalYearId(fiscalYears.find(y => !y.is_closed)?.id ?? fiscalYears[0]?.id ?? '')
    setError(null); setShowForm(true)
  }

  function openEdit(entry: JournalEntry) {
    setEditingEntry(entry)
    setDate(entry.date)
    setDesc(entry.description)
    setDebitId(entry.debit_account_id)
    setCreditId(entry.credit_account_id)
    setAmount(String(entry.amount))
    setFormFiscalYearId(entry.fiscal_year_id ?? defaultFiscalYearId)
    setError(null); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditingEntry(null); setError(null)
  }

  // Helper: apply balance delta to an account in DB and local state
  async function applyDelta(accountId: string, delta: number, accList: Account[]) {
    const { data: fresh } = await supabase.from('accounts').select('balance').eq('id', accountId).single()
    const base = fresh ? Number(fresh.balance) : (accList.find(a => a.id === accountId)?.balance ?? 0)
    await supabase.from('accounts').update({ balance: base + delta }).eq('id', accountId)
    return { id: accountId, newBalance: base + delta }
  }

  function balanceDelta(type: string, isSoll: boolean, amount: number): number {
    if (isSoll) return (type === 'aktiv' || type === 'aufwand') ? amount : -amount
    return (type === 'passiv' || type === 'ertrag') ? amount : -amount
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Betrag muss grösser als 0 sein'); return }
    if (debitId === creditId) { setError('Soll- und Habenkonto dürfen nicht identisch sein'); return }
    const selectedFY = fiscalYears.find(y => y.id === formFiscalYearId)
    if (selectedFY?.is_closed) { setError('Auf ein abgeschlossenes Geschäftsjahr kann nicht gebucht werden.'); return }

    const debitAcc  = accounts.find(a => a.id === debitId)
    const creditAcc = accounts.find(a => a.id === creditId)
    if (!debitAcc || !creditAcc) { setError('Konten nicht gefunden'); return }

    setError(null)
    start(async () => {
      if (isEditMode && editingEntry) {
        // ── Edit: reverse old entry, apply new ──────────────────
        const oldDebitAcc  = accounts.find(a => a.id === editingEntry.debit_account_id)
        const oldCreditAcc = accounts.find(a => a.id === editingEntry.credit_account_id)
        const oldAmt = Number(editingEntry.amount)

        // Accumulate net deltas per account (handle same account appearing in old & new)
        const deltas = new Map<string, number>()
        const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d)

        // Reverse old
        if (oldDebitAcc)  add(editingEntry.debit_account_id,  -balanceDelta(oldDebitAcc.type,  true,  oldAmt))
        if (oldCreditAcc) add(editingEntry.credit_account_id, -balanceDelta(oldCreditAcc.type, false, oldAmt))
        // Apply new
        add(debitId,  balanceDelta(debitAcc.type,  true,  amt))
        add(creditId, balanceDelta(creditAcc.type, false, amt))

        // Update DB balances and collect new values
        const newBalances: Record<string, number> = {}
        for (const [accountId, delta] of deltas.entries()) {
          if (delta === 0) continue
          const r = await applyDelta(accountId, delta, accounts)
          newBalances[r.id] = r.newBalance
        }

        // Update journal entry
        const { data: updated, error: err } = await supabase
          .from('journal_entries')
          .update({ date, description, debit_account_id: debitId, credit_account_id: creditId, amount: amt, fiscal_year_id: formFiscalYearId || null })
          .eq('id', editingEntry.id)
          .select('*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type)')
          .single()
        if (err) { setError(err.message); return }

        onJournalEntriesChange(prev => prev.map(e => e.id === editingEntry.id ? updated as JournalEntry : e))
        onAccountsChange(prev => prev.map(a => a.id in newBalances ? { ...a, balance: newBalances[a.id] } : a))
      } else {
        // ── New entry ────────────────────────────────────────────
        const { data: entry, error: err } = await supabase
          .from('journal_entries')
          .insert({ date, description, debit_account_id: debitId, credit_account_id: creditId, amount: amt, fiscal_year_id: formFiscalYearId || null })
          .select('*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type)')
          .single()
        if (err) { setError(err.message); return }

        const debitDelta  = balanceDelta(debitAcc.type,  true,  amt)
        const creditDelta = balanceDelta(creditAcc.type, false, amt)

        await Promise.all([
          supabase.from('accounts').update({ balance: Number(debitAcc.balance)  + debitDelta  }).eq('id', debitId),
          supabase.from('accounts').update({ balance: Number(creditAcc.balance) + creditDelta }).eq('id', creditId),
        ])

        onJournalEntriesChange(prev => [entry as JournalEntry, ...prev])
        onAccountsChange(prev => prev.map(a => {
          if (a.id === debitId)  return { ...a, balance: Number(a.balance) + debitDelta }
          if (a.id === creditId) return { ...a, balance: Number(a.balance) + creditDelta }
          return a
        }))
      }

      closeForm()
    })
  }

  async function handleDelete(entry: JournalEntry) {
    setError(null)
    start(async () => {
      const amt         = Number(entry.amount)
      const oldDebitAcc  = accounts.find(a => a.id === entry.debit_account_id)
      const oldCreditAcc = accounts.find(a => a.id === entry.credit_account_id)

      const newBalances: Record<string, number> = {}
      if (oldDebitAcc) {
        const r = await applyDelta(entry.debit_account_id,  -balanceDelta(oldDebitAcc.type,  true,  amt), accounts)
        newBalances[r.id] = r.newBalance
      }
      if (oldCreditAcc) {
        const r = await applyDelta(entry.credit_account_id, -balanceDelta(oldCreditAcc.type, false, amt), accounts)
        newBalances[r.id] = r.newBalance
      }

      await supabase.from('journal_entries').delete().eq('id', entry.id)

      onJournalEntriesChange(prev => prev.filter(e => e.id !== entry.id))
      onAccountsChange(prev => prev.map(a => a.id in newBalances ? { ...a, balance: newBalances[a.id] } : a))
      setDeleteConfirm(null)
    })
  }

  const sortedAccounts = [...accounts].sort((a, b) => a.number.localeCompare(b.number))
  const filteredEntries = filterYearId === 'all' ? journalEntries : journalEntries.filter(e => e.fiscal_year_id === filterYearId)

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Buchung erfassen
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E1D6C2] p-5 mb-6">
          <h3 className="text-base font-semibold text-[#2A2622] mb-4" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            {isEditMode ? 'Buchung bearbeiten' : 'Neue Buchung'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Datum *">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inp} />
            </Field>
            <Field label="Betrag (CHF) *">
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className={inp} />
            </Field>
            <Field label="Soll-Konto (Debit) *">
              <select value={debitId} onChange={e => setDebitId(e.target.value)} required className={inp}>
                <option value="">— Konto wählen —</option>
                {sortedAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.number} {a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Haben-Konto (Kredit) *">
              <select value={creditId} onChange={e => setCreditId(e.target.value)} required className={inp}>
                <option value="">— Konto wählen —</option>
                {sortedAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.number} {a.name}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Beschreibung *">
                <input value={description} onChange={e => setDesc(e.target.value)} required placeholder="z.B. Mieteinnahme Januar" className={inp} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Geschäftsjahr *">
                <select value={formFiscalYearId} onChange={e => setFormFiscalYearId(e.target.value)} required className={inp}>
                  <option value="">— Geschäftsjahr wählen —</option>
                  {fiscalYears.map(y => (
                    <option key={y.id} value={y.id} disabled={y.is_closed}>
                      {y.name}{y.is_closed ? ' (Gesperrt)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {debitId && creditId && (
            <div className="mt-3 text-xs text-[#7A6E60] bg-[#F7F2EC] rounded-lg px-3 py-2">
              Soll: <span className="font-medium text-[#2A2622]">{accounts.find(a => a.id === debitId)?.number} {accounts.find(a => a.id === debitId)?.name}</span>
              {' / '}
              Haben: <span className="font-medium text-[#2A2622]">{accounts.find(a => a.id === creditId)?.number} {accounts.find(a => a.id === creditId)?.name}</span>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50">
              {isPending ? 'Speichern…' : isEditMode ? 'Speichern' : 'Buchen'}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-3 mb-4">
        <CalendarRange size={14} className="text-[#7A6E60]" />
        <span className="text-sm text-[#7A6E60]">Geschäftsjahr:</span>
        <select
          value={filterYearId}
          onChange={e => setFilterYearId(e.target.value)}
          className="text-sm border border-[#E1D6C2] rounded-lg px-2.5 py-1.5 bg-white text-[#2A2622] focus:outline-none focus:ring-1 focus:ring-[#6B8E7F]"
        >
          <option value="all">Alle Jahre</option>
          {fiscalYears.map(y => (
            <option key={y.id} value={y.id}>{y.name}{y.is_closed ? ' (Abgeschlossen)' : ''}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7A6E60]">
            <ReceiptText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Noch keine Buchungen vorhanden</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                <th className="text-left px-5 py-3">Datum</th>
                <th className="text-left py-3">Beschreibung</th>
                <th className="text-left py-3 hidden sm:table-cell">Soll</th>
                <th className="text-left py-3 hidden sm:table-cell">Haben</th>
                <th className="text-right py-3">Betrag (CHF)</th>
                <th className="py-3 hidden md:table-cell text-left">Jahr</th>
                <th className="w-16 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                  <td className="px-5 py-3 text-[#4A4138] whitespace-nowrap">{fmtDate(entry.date)}</td>
                  <td className="py-3 pr-4 text-[#2A2622] font-medium">{entry.description}</td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    <span className="font-mono text-xs text-[#7A6E60]">{entry.debit_account?.number}</span>
                    <span className="text-xs text-[#4A4138] ml-1">{entry.debit_account?.name}</span>
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    <span className="font-mono text-xs text-[#7A6E60]">{entry.credit_account?.number}</span>
                    <span className="text-xs text-[#4A4138] ml-1">{entry.credit_account?.name}</span>
                  </td>
                  <td className="py-3 text-right font-semibold text-[#2A2622]">{fmt(Number(entry.amount))}</td>
                  <td className="py-3 pr-3 hidden md:table-cell">
                    {entry.fiscal_year ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4EDE2] text-[#7A6E60] whitespace-nowrap">
                        {entry.fiscal_year.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#E1D6C2]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {deleteConfirm === entry.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleDelete(entry)} disabled={isPending} className="text-red-600 hover:text-red-700 p-1"><Check size={13} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#7A6E60] p-1"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(entry)} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm(entry.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Kontengruppen Tab ────────────────────────────────────────
function GruppenTab({ groups, isAdmin, supabase }: {
  groups: AccountGroup[]; isAdmin: boolean; supabase: ReturnType<typeof createClient>
}) {
  const byType = (['aktiv', 'passiv', 'ertrag', 'aufwand'] as AccountType[]).map(type => ({
    type, items: groups.filter(g => g.type === type).sort((a, b) => a.sort_order - b.sort_order || (a.account_number ?? '').localeCompare(b.account_number ?? ''))
  }))

  return (
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
                <li key={g.id} className="flex items-center justify-between px-5 py-2.5 border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6]">
                  <div className="flex items-center gap-2">
                    {g.account_number && (
                      <span className="font-mono text-xs text-[#7A6E60] w-8">{g.account_number}</span>
                    )}
                    <div>
                      <p className="font-medium text-[#2A2622] text-sm">{g.name}</p>
                      {g.level && (
                        <p className="text-xs text-[#7A6E60] capitalize">{g.level}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Jahresabschluss Modal ────────────────────────────────────
function JahresabschlussModal({ year, ertragAccounts, aufwandAccounts, aktivAccounts, passivAccounts, ergebnis, allAccounts, onClose, onDone, supabase }: {
  year: FiscalYear
  ertragAccounts: Account[]
  aufwandAccounts: Account[]
  aktivAccounts: Account[]
  passivAccounts: Account[]
  ergebnis: number
  allAccounts: Account[]
  onClose: () => void
  onDone: (closedYear: FiscalYear, newEntries: JournalEntry[], updatedAccounts: Account[], newFiscalYear: FiscalYear | null) => void
  supabase: ReturnType<typeof createClient>
}) {
  const [ergebnisKontoId, setErgebnisKontoId] = useState(
    allAccounts.find(a => a.number === '9200')?.id ?? allAccounts.find(a => a.number.startsWith('92'))?.id ?? ''
  )
  const [eroeffnungsKontoId, setEroeffnungsKontoId] = useState(
    allAccounts.find(a => a.number === '2970')?.id ?? allAccounts.find(a => a.number.startsWith('2970') && !a.number.startsWith('2979'))?.id ?? ''
  )
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const totalErtrag  = ertragAccounts.reduce((s, a) => s + Number(a.balance), 0)
  const totalAufwand = aufwandAccounts.reduce((s, a) => s + Number(a.balance), 0)
  const isGewinn     = ergebnis >= 0

  const nextStart = new Date(year.end_date); nextStart.setDate(nextStart.getDate() + 1)
  const nextEnd   = new Date(nextStart); nextEnd.setFullYear(nextEnd.getFullYear() + 1); nextEnd.setDate(nextEnd.getDate() - 1)
  const nextStartStr = nextStart.toISOString().split('T')[0]
  const nextEndStr   = nextEnd.toISOString().split('T')[0]
  const nextYearNum  = nextStart.getFullYear()

  const ergebnisKontoNum    = allAccounts.find(a => a.id === ergebnisKontoId)?.number    ?? '9200'
  const eroeffnungsKontoNum = allAccounts.find(a => a.id === eroeffnungsKontoId)?.number ?? '2970'

  async function handleExecute() {
    if (!ergebnisKontoId || !eroeffnungsKontoId) { setError('Bitte alle Konten auswählen.'); return }
    setError(null)
    start(async () => {
      type EntryInsert = { date: string; description: string; debit_account_id: string; credit_account_id: string; amount: number; fiscal_year_id: string }

      // ── 1. Abschlussbuchungen (Ertrag/Aufwand → 9200) im aktuellen Jahr ──
      const closingEntries: EntryInsert[] = []
      for (const a of aufwandAccounts) {
        if (Number(a.balance) === 0) continue
        // Soll 9200 / Haben Aufwand
        closingEntries.push({ date: year.end_date, description: `Abschluss ${year.name}: ${a.name}`, debit_account_id: ergebnisKontoId, credit_account_id: a.id, amount: Number(a.balance), fiscal_year_id: year.id })
      }
      for (const a of ertragAccounts) {
        if (Number(a.balance) === 0) continue
        // Soll Ertrag / Haben 9200
        closingEntries.push({ date: year.end_date, description: `Abschluss ${year.name}: ${a.name}`, debit_account_id: a.id, credit_account_id: ergebnisKontoId, amount: Number(a.balance), fiscal_year_id: year.id })
      }

      // ── 2. Neues Geschäftsjahr finden oder erstellen ──
      const { data: existingNext } = await supabase.from('fiscal_years').select('*').eq('start_date', nextStartStr).maybeSingle()
      let nextYear: FiscalYear; let createdNewYear = false
      if (existingNext) {
        nextYear = existingNext as FiscalYear
      } else {
        const { data: newYear, error: nyErr } = await supabase.from('fiscal_years')
          .insert({ name: String(nextYearNum), start_date: nextStartStr, end_date: nextEndStr, is_closed: false }).select().single()
        if (nyErr) { setError(nyErr.message); return }
        nextYear = newYear as FiscalYear; createdNewYear = true
      }

      // ── 3. Saldo-Aktualisierung für Abschlussbuchungen ──
      const ergebnisAcc  = allAccounts.find(a => a.id === ergebnisKontoId)
      const ergebnisType = ergebnisAcc?.type ?? 'passiv'
      // Für 9200: Soll per Aufwand → debit; Haben per Ertrag → credit
      let ergebnisKontoDelta = 0
      for (const a of aufwandAccounts) {
        if (Number(a.balance) === 0) continue
        ergebnisKontoDelta += (ergebnisType === 'aktiv' || ergebnisType === 'aufwand') ? Number(a.balance) : -Number(a.balance)
      }
      for (const a of ertragAccounts) {
        if (Number(a.balance) === 0) continue
        ergebnisKontoDelta += (ergebnisType === 'passiv' || ergebnisType === 'ertrag') ? Number(a.balance) : -Number(a.balance)
      }

      const updatedAccounts: Account[] = []
      // Zero out Aufwand
      for (const a of aufwandAccounts) {
        if (Number(a.balance) === 0) continue
        const { data: fresh } = await supabase.from('accounts').select('balance').eq('id', a.id).single()
        const newBal = Number(fresh?.balance ?? a.balance) - Number(a.balance)
        await supabase.from('accounts').update({ balance: newBal }).eq('id', a.id)
        updatedAccounts.push({ ...a, balance: newBal })
      }
      // Zero out Ertrag
      for (const a of ertragAccounts) {
        if (Number(a.balance) === 0) continue
        const { data: fresh } = await supabase.from('accounts').select('balance').eq('id', a.id).single()
        const newBal = Number(fresh?.balance ?? a.balance) - Number(a.balance)
        await supabase.from('accounts').update({ balance: newBal }).eq('id', a.id)
        updatedAccounts.push({ ...a, balance: newBal })
      }
      // Update 9200
      if (ergebnisKontoDelta !== 0 && ergebnisAcc) {
        const { data: fresh } = await supabase.from('accounts').select('balance').eq('id', ergebnisKontoId).single()
        const newBal = Number(fresh?.balance ?? ergebnisAcc.balance) + ergebnisKontoDelta
        await supabase.from('accounts').update({ balance: newBal }).eq('id', ergebnisKontoId)
        updatedAccounts.push({ ...ergebnisAcc, balance: newBal })
      }

      // ── 4. Eröffnungsbuchungen im neuen Jahr (nur Journaleintrag, keine Saldoänderung) ──
      const postBal = (a: Account) => {
        const updated = updatedAccounts.find(u => u.id === a.id)
        return updated !== undefined ? Number(updated.balance) : Number(a.balance)
      }
      const openingEntries: EntryInsert[] = []
      for (const a of aktivAccounts) {
        const bal = postBal(a); if (bal <= 0) continue
        // Soll Aktiv / Haben 2970
        openingEntries.push({ date: nextStartStr, description: `Eröffnung ${nextYear.name}: ${a.name}`, debit_account_id: a.id, credit_account_id: eroeffnungsKontoId, amount: bal, fiscal_year_id: nextYear.id })
      }
      for (const a of passivAccounts) {
        const bal = postBal(a); if (bal <= 0) continue
        // Soll 2970 / Haben Passiv
        openingEntries.push({ date: nextStartStr, description: `Eröffnung ${nextYear.name}: ${a.name}`, debit_account_id: eroeffnungsKontoId, credit_account_id: a.id, amount: bal, fiscal_year_id: nextYear.id })
      }

      // ── 5. Alle Buchungen einfügen ──
      const { data: created, error: err } = await supabase
        .from('journal_entries')
        .insert([...closingEntries, ...openingEntries])
        .select('*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type)')
      if (err) { setError(err.message); return }

      // ── 6. Geschäftsjahr sperren ──
      const { data: closedYear } = await supabase.from('fiscal_years').update({ is_closed: true }).eq('id', year.id).select().single()
      onDone(closedYear as FiscalYear, (created ?? []) as JournalEntry[], updatedAccounts, createdNewYear ? nextYear : null)
    })
  }

  return (
    <Modal title={`Jahresabschluss: ${year.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="bg-[#F7F2EC] rounded-xl p-4 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-[#7A6E60]">Total Ertrag</span><span className="font-mono text-green-700">+ {fmt(totalErtrag)}</span></div>
          <div className="flex justify-between"><span className="text-[#7A6E60]">Total Aufwand</span><span className="font-mono text-red-600">− {fmt(totalAufwand)}</span></div>
          <div className="flex justify-between border-t border-[#E1D6C2] pt-2 font-semibold">
            <span className="text-[#2A2622]">{isGewinn ? 'Jahresgewinn' : 'Jahresverlust'}</span>
            <span className={`font-mono ${isGewinn ? 'text-green-700' : 'text-red-600'}`}>{fmt(Math.abs(ergebnis))}</span>
          </div>
        </div>

        <Field label={`Jahresergebniskonto (z.B. 9200)`}>
          <select value={ergebnisKontoId} onChange={e => setErgebnisKontoId(e.target.value)} className={inp}>
            <option value="">— Konto wählen —</option>
            {allAccounts.map(a => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
        </Field>
        <Field label={`Eröffnungsbilanzkonto (z.B. 2970)`}>
          <select value={eroeffnungsKontoId} onChange={e => setEroeffnungsKontoId(e.target.value)} className={inp}>
            <option value="">— Konto wählen —</option>
            {allAccounts.map(a => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
        </Field>

        <div className="bg-[#F7F2EC] border border-[#E1D6C2] rounded-xl p-3 text-xs text-[#4A4138] space-y-1">
          <p className="font-medium mb-1">Buchungsvorschau:</p>
          <p>• <strong>GJ {year.name}</strong>: Ertrag/Aufwand → {ergebnisKontoNum} (Ertrag- und Aufwandkonten werden auf 0 gesetzt)</p>
          <p>• <strong>GJ {nextYearNum}</strong>: Eröffnungsbuchungen aller Bilanzkonten mit Gegenkonto {eroeffnungsKontoNum}</p>
          <p>• GJ {nextYearNum} wird automatisch eröffnet falls noch nicht vorhanden ({nextStartStr} – {nextEndStr})</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>GJ {year.name} wird gesperrt — keine weiteren Buchungen möglich.</span>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="text-sm text-[#7A6E60] hover:text-[#2A2622] px-4 py-2">Abbrechen</button>
          <button
            onClick={handleExecute} disabled={isPending || !ergebnisKontoId || !eroeffnungsKontoId}
            className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            <ClipboardCheck size={15} /> {isPending ? 'Wird ausgeführt…' : 'Abschluss durchführen'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Geschäftsjahre Tab ───────────────────────────────────────
function JahreTab({ fiscalYears, isAdmin, onFiscalYearsChange, accounts, ertragAccounts, aufwandAccounts, ergebnis, onAccountsChange, onJournalEntriesChange, supabase }: {
  fiscalYears: FiscalYear[]; isAdmin: boolean
  onFiscalYearsChange: React.Dispatch<React.SetStateAction<FiscalYear[]>>
  accounts: Account[]
  ertragAccounts: Account[]
  aufwandAccounts: Account[]
  ergebnis: number
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>
  onJournalEntriesChange: React.Dispatch<React.SetStateAction<JournalEntry[]>>
  supabase: ReturnType<typeof createClient>
}) {
  const [modal, setModal]           = useState(false)
  const [editing, setEditing]       = useState<FiscalYear | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [abschlussYear, setAbschlussYear] = useState<FiscalYear | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, start]          = useTransition()

  async function handleSave(data: Omit<FiscalYear, 'id'>) {
    setError(null)
    start(async () => {
      if (!editing) {
        const { data: created, error: err } = await supabase.from('fiscal_years').insert(data).select().single()
        if (err) { setError(err.message); return }
        onFiscalYearsChange(prev => [created as FiscalYear, ...prev])
      } else {
        const { data: updated, error: err } = await supabase.from('fiscal_years').update(data).eq('id', editing.id).select().single()
        if (err) { setError(err.message); return }
        onFiscalYearsChange(prev => prev.map(y => y.id === editing.id ? updated as FiscalYear : y))
      }
      setModal(false); setEditing(null)
    })
  }

  async function handleDelete(id: string) {
    start(async () => {
      await supabase.from('fiscal_years').delete().eq('id', id)
      onFiscalYearsChange(prev => prev.filter(y => y.id !== id))
      setDeleteConfirm(null)
    })
  }

  async function handleReopen(year: FiscalYear) {
    start(async () => {
      const { data: updated } = await supabase
        .from('fiscal_years').update({ is_closed: false }).eq('id', year.id).select().single()
      if (updated) onFiscalYearsChange(prev => prev.map(y => y.id === year.id ? updated as FiscalYear : y))
    })
  }

  function handleAbschlussDone(closedYear: FiscalYear, newEntries: JournalEntry[], updatedAccounts: Account[], newFiscalYear: FiscalYear | null) {
    onFiscalYearsChange(prev => {
      const updated = prev.map(y => y.id === closedYear.id ? closedYear : y)
      return newFiscalYear ? [newFiscalYear, ...updated] : updated
    })
    onJournalEntriesChange(prev => [...newEntries, ...prev])
    onAccountsChange(prev => prev.map(a => {
      const updated = updatedAccounts.find(u => u.id === a.id)
      return updated ? { ...a, balance: updated.balance } : a
    }))
    setAbschlussYear(null)
  }

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => { setEditing(null); setModal(true); setError(null) }}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Geschäftsjahr eröffnen
        </button>
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
                <th className="py-3 pr-4 w-36"></th>
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
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!year.is_closed && isAdmin && (
                          <button
                            onClick={() => setAbschlussYear(year)}
                            title="Jahresabschluss durchführen"
                            className="flex items-center gap-1 text-xs text-[#6B8E7F] hover:text-[#5a7a6c] border border-[#6B8E7F] hover:border-[#5a7a6c] px-2 py-0.5 rounded"
                          >
                            <ClipboardCheck size={12} /> Abschluss
                          </button>
                        )}
                        {year.is_closed && isAdmin && (
                          <button onClick={() => handleReopen(year)} title="Wiedereröffnen" className="text-[#7A6E60] hover:text-[#6B8E7F] p-1">
                            <Unlock size={13} />
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

      {abschlussYear && (
        <JahresabschlussModal
          year={abschlussYear}
          ertragAccounts={ertragAccounts}
          aufwandAccounts={aufwandAccounts}
          aktivAccounts={accounts.filter(a => a.type === 'aktiv' && a.is_active)}
          passivAccounts={accounts.filter(a => a.type === 'passiv' && a.is_active)}
          ergebnis={ergebnis}
          allAccounts={accounts}
          onClose={() => setAbschlussYear(null)}
          onDone={handleAbschlussDone}
          supabase={supabase}
        />
      )}
    </div>
  )
}

// ── Modals ───────────────────────────────────────────────────
function AccountModal({ mode, initial, fixedType, groups, onSave, onClose, isPending, error }: {
  mode: 'new' | 'edit'; initial: Account | null; fixedType: AccountType
  groups: AccountGroup[]; onSave: (d: Omit<Account, 'id' | 'is_active'>) => void; onClose: () => void
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

  const leafGroups = groups.filter(g => g.type === fixedType)

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
              {leafGroups
                .sort((a, b) => (a.account_number ?? '').localeCompare(b.account_number ?? ''))
                .map(g => <option key={g.id} value={g.id}>{g.account_number ? `${g.account_number} ` : ''}{g.name}</option>)
              }
            </select>
          </Field>
        </div>
        <Field label="Bezeichnung *">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="z.B. Kasse, Miete…" className={inp} />
        </Field>
        <Field label="Anfangssaldo (CHF)">
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

function FiscalYearModal({ initial, onSave, onClose, isPending, error }: {
  initial: FiscalYear | null; onSave: (d: Omit<FiscalYear, 'id'>) => void; onClose: () => void
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

const inp = 'w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm text-[#2A2622] focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/40 focus:border-[#6B8E7F] bg-white'
