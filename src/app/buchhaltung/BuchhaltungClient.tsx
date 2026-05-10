'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Pencil, Trash2, X, Check,
  TrendingUp, TrendingDown, Scale, BookOpen,
  Layers, CalendarRange, Lock, Unlock, ReceiptText, ClipboardCheck, AlertTriangle,
  FileText, Printer, Search, Link as LinkIcon,
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
  invoice_id?: string | null
  created_at: string
  debit_account?: { number: string; name: string; type: AccountType }
  credit_account?: { number: string; name: string; type: AccountType }
  fiscal_year?: { id: string; name: string } | null
  invoice?: { number: string; customer_name: string } | null
}

export interface InvoiceForPayment {
  id: string
  number: string
  customer_name: string
  invoice_date: string
  due_date: string | null
  total: number
  discount_type: string
  discount_value: number
  reference: string | null
  status?: string
}

interface PendingTransaction {
  id?: string
  tempId: string
  date: string
  amount: number
  cdtDbtInd: 'CRDT' | 'DBIT'
  description: string
  debtorName: string
  bankAccountId: string
  rawLine: number
  suggestedInvoice?: InvoiceForPayment  // vorgematchte Rechnung
  suggestedCreditId?: string            // vorgematchtes Forderungskonto
  isMatched?: boolean                   // Betrag + Rechnung stimmen überein
}

interface ImportResult {
  totalRead: number
  matched: number      // Einträge mit vorgeschlagenem Match (bereit zur Bestätigung)
  pendingCount: number // Einträge ohne Match
  errors: { line: number; reason: string }[]
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

// ── Main Component ───────────────────────────────────────────
export default function BuchhaltungClient({
  initialAccounts, initialGroups, initialFiscalYears, initialJournalEntries, initialPendingTransactions, isAdmin,
}: {
  initialAccounts: Account[]
  initialGroups: AccountGroup[]
  initialFiscalYears: FiscalYear[]
  initialJournalEntries: JournalEntry[]
  initialPendingTransactions: PendingTransaction[]
  isAdmin: boolean
}) {
  const [accounts, setAccounts]             = useState<Account[]>(initialAccounts)
  const [groups, setGroups]                 = useState<AccountGroup[]>(initialGroups)
  const [fiscalYears, setFiscalYears]       = useState<FiscalYear[]>(initialFiscalYears)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(initialJournalEntries)
  const [tab, setTab] = useState<'bilanz' | 'erfolg' | 'buchungen' | 'kontoübersicht'>('bilanz')
  const [adminTab, setAdminTab] = useState<'konten' | 'gruppen' | 'jahre'>('konten')
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10)
    // 1. GJ, dessen Bereich das heutige Datum enthält
    const current = initialFiscalYears.find(y => today >= y.start_date && today <= y.end_date)
    if (current) return current.id
    // 2. Erstes offenes GJ
    const open = initialFiscalYears.find(y => !y.is_closed)
    if (open) return open.id
    // 3. Letztes vorhandenes GJ
    return initialFiscalYears[0]?.id ?? ''
  })

  const supabase = createClient()

  const aktiv   = accounts.filter(a => a.type === 'aktiv'   && a.is_active)
  const passiv  = accounts.filter(a => a.type === 'passiv'  && a.is_active)
  const ertrag  = accounts.filter(a => a.type === 'ertrag'  && a.is_active)
  const aufwand = accounts.filter(a => a.type === 'aufwand' && a.is_active)

  const selectedFiscalYear = fiscalYears.find(y => y.id === selectedFiscalYearId)
  const isHistoricalYear   = selectedFiscalYear?.is_closed === true

  // Alle Salden aus den gefilterten Buchungen des Geschäftsjahres berechnen
  // → reagiert auf Jahreswechsel und ist konsistent nach direkten DB-Änderungen
  const periodEntries = journalEntries.filter(e => e.fiscal_year_id === selectedFiscalYearId)
  const periodBalances = computePeriodBalances([...aktiv, ...passiv, ...ertrag, ...aufwand], periodEntries)

  const bilanzAktiv  = aktiv.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const bilanzPassiv = passiv.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const bilanzTotalAktiv  = bilanzAktiv.reduce((s, a) => s + Number(a.balance), 0)
  const bilanzTotalPassiv = bilanzPassiv.reduce((s, a) => s + Number(a.balance), 0)

  const periodErtragAccounts  = ertrag.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const periodAufwandAccounts = aufwand.map(a => ({ ...a, balance: periodBalances.get(a.id) ?? 0 }))
  const periodErgebnis = periodErtragAccounts.reduce((s, a) => s + a.balance, 0)
                       - periodAufwandAccounts.reduce((s, a) => s + a.balance, 0)

  // KontenTab: Saldo aus Buchungen des gewählten Geschäftsjahrs (inkl. inaktive Konten)
  const allAccountPeriodBalances = computePeriodBalances(accounts, periodEntries)
  const accountsWithComputedBalance = accounts.map(a => ({ ...a, balance: allAccountPeriodBalances.get(a.id) ?? 0 }))

  return (
    <div className="space-y-6">
      {/* ── Geschäftsjahr-Selector ── */}
      <div className="bg-white rounded-2xl border border-[#E1D6C2] px-5 py-4 flex items-center gap-4">
        <CalendarRange size={18} className="text-[#6B8E7F] shrink-0" />
        <div>
          <p className="text-xs text-[#7A6E60] uppercase tracking-wide mb-1">Geschäftsjahr</p>
          {fiscalYears.length === 0 ? (
            <p className="text-sm text-[#7A6E60] italic">
              {isAdmin ? 'Kein Geschäftsjahr vorhanden — bitte im Admin-Bereich erstellen.' : 'Kein Geschäftsjahr vorhanden.'}
            </p>
          ) : (
            <select
              value={selectedFiscalYearId}
              onChange={e => setSelectedFiscalYearId(e.target.value)}
              className="text-base font-semibold text-[#2A2622] border-none bg-transparent focus:outline-none focus:ring-0 cursor-pointer pr-6"
            >
              {fiscalYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_closed ? ' (Abgeschlossen)' : ' (Offen)'}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedFiscalYear && (
          <span className="ml-auto text-xs text-[#7A6E60]">
            {fmtDate(selectedFiscalYear.start_date)} – {fmtDate(selectedFiscalYear.end_date)}
          </span>
        )}
      </div>

      {/* ── Haupt-Tabs ── */}
      {fiscalYears.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit">
            <TabBtn active={tab === 'bilanz'}         onClick={() => setTab('bilanz')}         icon={<Scale size={15} />}       label="Bilanz" />
            <TabBtn active={tab === 'erfolg'}         onClick={() => setTab('erfolg')}         icon={<BookOpen size={15} />}    label="Erfolgsrechnung" />
            <TabBtn active={tab === 'buchungen'}      onClick={() => setTab('buchungen')}      icon={<ReceiptText size={15} />} label="Buchungen" />
            <TabBtn active={tab === 'kontoübersicht'} onClick={() => setTab('kontoübersicht')} icon={<FileText size={15} />}    label="Kontoübersicht" />
          </div>

          {tab === 'bilanz' && (
            <BilanzTab
              aktiv={bilanzAktiv} passiv={bilanzPassiv}
              totalAktiv={bilanzTotalAktiv} totalPassiv={bilanzTotalPassiv}
              ergebnis={periodErgebnis}
              isHistoricalYear={isHistoricalYear}
              selectedFiscalYear={selectedFiscalYear!}
              groups={groups}
            />
          )}
          {tab === 'erfolg' && (
            <ErfolgsTab
              ertrag={periodErtragAccounts} aufwand={periodAufwandAccounts}
              totalErtrag={periodErtragAccounts.reduce((s, a) => s + a.balance, 0)}
              totalAufwand={periodAufwandAccounts.reduce((s, a) => s + a.balance, 0)}
              ergebnis={periodErgebnis}
              selectedFiscalYear={selectedFiscalYear!}
              groups={groups}
            />
          )}
          {tab === 'buchungen' && (
            <BuchungenTab
              accounts={accounts.filter(a => a.is_active)}
              journalEntries={journalEntries.filter(e => e.fiscal_year_id === selectedFiscalYearId)}
              selectedFiscalYearId={selectedFiscalYearId}
              selectedFiscalYearClosed={isHistoricalYear}
              selectedFiscalYear={selectedFiscalYear ?? null}
              onJournalEntriesChange={setJournalEntries}
              onAccountsChange={setAccounts}
              initialPendingTransactions={initialPendingTransactions}
              supabase={supabase}
            />
          )}
          {tab === 'kontoübersicht' && (
            <KontoübersichtTab
              accounts={accounts.filter(a => a.is_active)}
              journalEntries={periodEntries}
              selectedFiscalYear={selectedFiscalYear ?? null}
            />
          )}
        </>
      )}

      {/* ── Admin-Bereich ── */}
      {isAdmin && (
        <div className="border-t border-[#E1D6C2] pt-6">
          <p className="text-xs font-semibold text-[#7A6E60] uppercase tracking-widest mb-4">Administration</p>
          <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-[#E1D6C2] p-1 w-fit mb-6">
            <TabBtn active={adminTab === 'konten'}  onClick={() => setAdminTab('konten')}  icon={<Layers size={15} />}        label="Konten" />
            <TabBtn active={adminTab === 'gruppen'} onClick={() => setAdminTab('gruppen')} icon={<Layers size={15} />}        label="Kontengruppen" />
            <TabBtn active={adminTab === 'jahre'}   onClick={() => setAdminTab('jahre')}   icon={<CalendarRange size={15} />} label="Geschäftsjahre" />
          </div>
          {adminTab === 'konten' && (
            <KontenTab
              accounts={accountsWithComputedBalance}
              groups={groups}
              onAccountsChange={setAccounts}
              supabase={supabase}
            />
          )}
          {adminTab === 'gruppen' && (
            <GruppenTab groups={groups} isAdmin={isAdmin} supabase={supabase} onGroupsChange={setGroups} />
          )}
          {adminTab === 'jahre' && (
            <JahreTab
              fiscalYears={fiscalYears} isAdmin={isAdmin}
              onFiscalYearsChange={setFiscalYears}
              accounts={accounts.filter(a => a.is_active)}
              aktivAccounts={aktiv}
              passivAccounts={passiv}
              journalEntries={journalEntries}
              onAccountsChange={setAccounts}
              onJournalEntriesChange={setJournalEntries}
              supabase={supabase}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Kontoübersicht Tab ──────────────────────────────────────
const TYPE_LABELS_FULL: Record<AccountType, string> = {
  aktiv: 'Aktiv', passiv: 'Passiv', ertrag: 'Ertrag', aufwand: 'Aufwand',
}

function KontoübersichtTab({ accounts, journalEntries, selectedFiscalYear }: {
  accounts: Account[]
  journalEntries: JournalEntry[]
  selectedFiscalYear: FiscalYear | null
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const filtered = accounts.filter(a =>
    a.number.includes(search) ||
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by type for display
  const grouped: Record<AccountType, Account[]> = { aktiv: [], passiv: [], ertrag: [], aufwand: [] }
  for (const a of filtered) grouped[a.type].push(a)

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleAll() {
    if (selectedIds.length === accounts.length) setSelectedIds([])
    else setSelectedIds(accounts.map(a => a.id))
  }

  // Entries per selected account
  function entriesForAccount(account: Account) {
    return journalEntries
      .filter(e => e.debit_account_id === account.id || e.credit_account_id === account.id)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  }

  function gegenkonto(e: JournalEntry, account: Account): string {
    if (e.debit_account_id === account.id) {
      const c = e.credit_account as { number: string; name: string } | null
      return c ? `${c.number} ${c.name}` : '–'
    } else {
      const d = e.debit_account as { number: string; name: string } | null
      return d ? `${d.number} ${d.name}` : '–'
    }
  }

  // Running balance per entry
  function buildRows(account: Account) {
    const entries = entriesForAccount(account)
    let saldo = 0
    return entries.map(e => {
      const amt = Number(e.amount)
      const isSoll = e.debit_account_id === account.id
      const normalSign = account.type === 'aktiv' || account.type === 'aufwand'
      const delta = isSoll ? (normalSign ? amt : -amt) : (normalSign ? -amt : amt)
      saldo += delta
      return { entry: e, soll: isSoll ? amt : null, haben: isSoll ? null : amt, saldo }
    })
  }

  function handlePrint() {
    if (selectedIds.length === 0) return
    const selectedAccounts = accounts.filter(a => selectedIds.includes(a.id))
    const fy = selectedFiscalYear

    const rows = selectedAccounts.map(account => {
      const data = buildRows(account)
      const totalSoll  = data.reduce((s, r) => s + (r.soll  ?? 0), 0)
      const totalHaben = data.reduce((s, r) => s + (r.haben ?? 0), 0)
      const finalSaldo = data.at(-1)?.saldo ?? 0

      const rowsHtml = data.length === 0
        ? `<tr><td colspan="5" style="text-align:center;color:#999;padding:12px">Keine Buchungen</td></tr>`
        : data.map(r => `
            <tr>
              <td>${fmtDate(r.entry.date)}</td>
              <td>${r.entry.description}</td>
              <td>${gegenkonto(r.entry, account)}</td>
              <td style="text-align:right">${r.soll  != null ? fmt(r.soll)  : ''}</td>
              <td style="text-align:right">${r.haben != null ? fmt(r.haben) : ''}</td>
              <td style="text-align:right;font-weight:600">${fmt(r.saldo)}</td>
            </tr>`).join('')

      return `
        <div class="account-block">
          <div class="account-header">
            <span class="account-number">${account.number}</span>
            <span class="account-name">${account.name}</span>
            <span class="account-type">${TYPE_LABELS_FULL[account.type]}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Beschreibung</th>
                <th>Gegenkonto</th>
                <th>Soll (CHF)</th>
                <th>Haben (CHF)</th>
                <th>Saldo (CHF)</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Total</strong></td>
                <td style="text-align:right"><strong>${fmt(totalSoll)}</strong></td>
                <td style="text-align:right"><strong>${fmt(totalHaben)}</strong></td>
                <td style="text-align:right"><strong>${fmt(finalSaldo)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Kontoübersicht – Physio Allmend</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px 28px; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 18px; }
  .doc-title { font-size: 18px; font-weight: 700; color: #2A2622; }
  .doc-meta { font-size: 10px; color: #666; text-align: right; }
  .account-block { margin-bottom: 24px; page-break-inside: avoid; }
  .account-header { display: flex; align-items: baseline; gap: 10px; background: #F4EDE2; padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; }
  .account-number { font-weight: 700; font-size: 13px; color: #2A2622; font-family: monospace; }
  .account-name { font-size: 13px; font-weight: 600; color: #2A2622; flex: 1; }
  .account-type { font-size: 10px; color: #7A6E60; background: #EDE7DA; padding: 1px 6px; border-radius: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F7F2EC; text-align: left; padding: 5px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #7A6E60; border-bottom: 1px solid #E1D6C2; }
  td { padding: 4px 8px; border-bottom: 1px solid #f0ebe0; }
  tfoot td { border-top: 1px solid #333; border-bottom: none; background: #F7F2EC; }
  @media print {
    body { padding: 12px 16px; }
    .account-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="doc-title">Kontoübersicht</div>
      <div style="font-size:11px;color:#666;margin-top:2px">Physio Allmend${fy ? ` · Geschäftsjahr ${fy.name} (${fmtDate(fy.start_date)} – ${fmtDate(fy.end_date)})` : ''}</div>
    </div>
    <div class="doc-meta">
      Erstellt: ${new Date().toLocaleDateString('de-CH')}<br>
      ${selectedAccounts.length} Konto${selectedAccounts.length !== 1 ? 's' : ''}
    </div>
  </div>
  ${rows}
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  const selectedAccounts = accounts.filter(a => selectedIds.includes(a.id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

      {/* ── Konten-Auswahl ── */}
      <div className="bg-white rounded-2xl border border-[#E1D6C2] flex flex-col" style={{ maxHeight: '75vh' }}>
        {/* Header – gleiche Höhe wie der rechte Panel-Header */}
        <div className="px-4 py-3 border-b border-[#E1D6C2] flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-sm text-[#2A2622]">Konten wählen</h2>
          <div className="flex items-center gap-2">
            <button onClick={toggleAll} className="text-xs text-[#6B8E7F] hover:underline">
              {selectedIds.length === accounts.length ? 'Alle abwählen' : 'Alle wählen'}
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Printer size={12} /> PDF
              </button>
            )}
          </div>
        </div>
        {/* Suche */}
        <div className="px-3 py-2 border-b border-[#E1D6C2] shrink-0">
          <div className="flex items-center gap-2 bg-[#F7F2EC] rounded-lg px-3 py-1.5">
            <Search size={13} className="text-[#7A6E60]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="bg-transparent text-sm flex-1 outline-none text-[#2A2622] placeholder:text-[#B0A898]"
            />
          </div>
        </div>
        {/* Kontenliste scrollbar */}
        <div className="overflow-y-auto flex-1">
          {(['aktiv','passiv','ertrag','aufwand'] as AccountType[]).map(type => {
            const list = grouped[type]
            if (list.length === 0) return null
            return (
              <div key={type}>
                <div className="px-4 py-1.5 bg-[#F4EDE2] text-xs font-semibold text-[#7A6E60] uppercase tracking-wide sticky top-0">
                  {TYPE_LABELS_FULL[type]}
                </div>
                {list.map(a => (
                  <label key={a.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[#FDFAF6] cursor-pointer border-b border-[#F7F2EC] last:border-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a.id)}
                      onChange={() => toggle(a.id)}
                      className="accent-[#6B8E7F] w-4 h-4 shrink-0"
                    />
                    <span className="font-mono text-xs text-[#7A6E60] w-10 shrink-0">{a.number}</span>
                    <span className="text-sm text-[#2A2622] truncate">{a.name}</span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Buchungsansicht ── */}
      <div className="lg:col-span-2 flex flex-col overflow-hidden" style={{ maxHeight: '75vh' }}>
        {selectedIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E1D6C2] p-12 text-center flex-1 flex flex-col items-center justify-center">
            <FileText size={32} className="text-[#C8BBA8] mb-3" />
            <p className="text-sm text-[#7A6E60]">Bitte links ein oder mehrere Konten wählen</p>
          </div>
        ) : (
          /* Scrollbarer Bereich für Kontoauszüge */
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {selectedAccounts.map(account => {
              const rows = buildRows(account)
              const totalSoll  = rows.reduce((s, r) => s + (r.soll  ?? 0), 0)
              const totalHaben = rows.reduce((s, r) => s + (r.haben ?? 0), 0)
              const finalSaldo = rows.at(-1)?.saldo ?? 0

              return (
                <div key={account.id} className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
                  {/* Konto-Header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#F4EDE2] border-b border-[#E1D6C2]">
                    <span className="font-mono font-bold text-[#2A2622] shrink-0">{account.number}</span>
                    <span className="font-semibold text-[#2A2622] flex-1 truncate">{account.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#EDE7DA] text-[#7A6E60] shrink-0">{TYPE_LABELS_FULL[account.type]}</span>
                    <span className={`text-sm font-bold shrink-0 ${finalSaldo >= 0 ? 'text-[#2A2622]' : 'text-red-600'}`}>
                      CHF {fmt(finalSaldo)}
                    </span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-sm text-[#7A6E60] text-center py-8">Keine Buchungen im gewählten Geschäftsjahr</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="text-sm table-fixed w-full" style={{ minWidth: '500px' }}>
                        <colgroup>
                          <col style={{ width: '82px' }} />
                          <col />
                          <col style={{ width: '82px' }} className="hidden lg:table-column" />
                          <col style={{ width: '88px' }} />
                          <col style={{ width: '88px' }} />
                          <col style={{ width: '92px' }} />
                        </colgroup>
                        <thead>
                          <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                            <th className="text-left px-4 py-2">Datum</th>
                            <th className="text-left py-2">Beschreibung</th>
                            <th className="text-left py-2 hidden lg:table-cell">Gegenkonto</th>
                            <th className="text-right py-2 px-2">Soll</th>
                            <th className="text-right py-2 px-2">Haben</th>
                            <th className="text-right py-2 pr-4">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ entry, soll, haben, saldo }, i) => (
                            <tr key={entry.id ?? i} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6]">
                              <td className="px-4 py-2 text-xs text-[#7A6E60] whitespace-nowrap">{fmtDate(entry.date)}</td>
                              <td className="py-2 pr-2 text-[#2A2622] text-xs truncate overflow-hidden">{entry.description}</td>
                              <td className="py-2 pr-1 text-xs text-[#7A6E60] hidden lg:table-cell truncate overflow-hidden">{gegenkonto(entry, account)}</td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-[#2A2622]">
                                {soll != null ? fmt(soll) : ''}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-xs text-[#2A2622]">
                                {haben != null ? fmt(haben) : ''}
                              </td>
                              <td className={`py-2 pr-4 text-right font-mono text-xs font-semibold ${saldo >= 0 ? 'text-[#2A2622]' : 'text-red-600'}`}>
                                {fmt(saldo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#F7F2EC] border-t border-[#E1D6C2] font-semibold text-xs">
                            <td colSpan={2} className="px-4 py-2">Total</td>
                            <td className="hidden lg:table-cell" />
                            <td className="py-2 px-2 text-right font-mono">{fmt(totalSoll)}</td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(totalHaben)}</td>
                            <td className={`py-2 pr-4 text-right font-mono font-bold ${finalSaldo >= 0 ? 'text-[#2A2622]' : 'text-red-600'}`}>{fmt(finalSaldo)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bilanz Tab ───────────────────────────────────────────────
function BilanzTab({ aktiv, passiv, totalAktiv, totalPassiv, ergebnis, isHistoricalYear, selectedFiscalYear, groups }: {
  aktiv: Account[]; passiv: Account[]
  totalAktiv: number; totalPassiv: number; ergebnis: number
  isHistoricalYear: boolean
  selectedFiscalYear: FiscalYear
  groups: AccountGroup[]
}) {
  const [hideZero, setHideZero] = useState(true)
  const totalPassivMitErgebnis = totalPassiv + ergebnis
  const ausgeglichen = Math.abs(totalAktiv - totalPassivMitErgebnis) < 0.01

  function handlePrint() {
    const pdfHideZero = hideZero
    const pdfAktiv  = pdfHideZero ? aktiv.filter(a => a.balance !== 0)  : aktiv
    const pdfPassiv = pdfHideZero ? passiv.filter(a => a.balance !== 0) : passiv
    const aktivTree    = buildGroupTree(groups, pdfAktiv,  'aktiv')
    const passivTree   = buildGroupTree(groups, pdfPassiv, 'passiv')
    const aktivUng     = pdfAktiv.filter(a  => !a.group_id)
    const passivUng    = pdfPassiv.filter(a => !a.group_id)

    function renderNode(node: GroupNode, depth: number): string {
      const total = subtreeTotal(node)
      if (pdfHideZero && total === 0) return ''
      const accs = pdfHideZero ? node.nodeAccounts.filter(a => a.balance !== 0) : node.nodeAccounts
      const ind = depth * 10
      const cls = depth === 0 ? 'g0' : depth === 1 ? 'g1' : 'g2'
      let h = `<div class="${cls}" style="padding-left:${ind}px">
        <span>${node.account_number ? `<span class="mono">${node.account_number}</span> ` : ''}${node.name}</span>
        ${total !== 0 ? `<span class="amt">${fmt(total)}</span>` : ''}
      </div>`
      for (const a of accs) {
        h += `<div class="arow" style="padding-left:${ind + 14}px">
          <span class="mono">${a.number}</span><span class="aname">${a.name}</span>
          <span class="amt">${fmt(a.balance)}</span></div>`
      }
      for (const c of node.children) h += renderNode(c, depth + 1)
      return h
    }
    function renderSide(tree: GroupNode[], ung: Account[]): string {
      let h = tree.map(n => renderNode(n, 0)).join('')
      for (const a of ung) {
        h += `<div class="arow"><span class="mono">${a.number}</span><span class="aname">${a.name}</span>
          <span class="amt">${fmt(a.balance)}</span></div>`
      }
      return h
    }

    const fy = selectedFiscalYear
    const ergebnisRow = ergebnis !== 0
      ? `<div class="jerg"><span class="aname">Jahresgewinn/-verlust (laufend)</span><span class="amt">${fmt(ergebnis)}</span></div>`
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Bilanz – Physio Allmend</title>
<style>
*{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:10.5px;color:#222;margin:0;padding:18px 24px}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:14px}
.doc-title{font-size:17px;font-weight:700;color:#2A2622}.doc-meta{font-size:9.5px;color:#666;text-align:right}
.bilanz{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.side-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2A2622;padding:5px 0;border-bottom:1.5px solid #333;margin-bottom:4px;display:flex;justify-content:space-between}
.g0{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;background:#EDE7DA;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-top:4px;padding-left:4px;padding-right:4px}
.g1{display:flex;justify-content:space-between;align-items:baseline;padding:3px 4px;background:#F4EDE2;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
.g2{display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px;background:#F7F2EC;font-size:10px;font-weight:500}
.arow{display:flex;align-items:baseline;padding:2px 4px;border-bottom:1px solid #f5f0e8}
.mono{font-family:monospace;color:#7A6E60;margin-right:6px;min-width:28px;display:inline-block;font-size:9.5px}
.aname{flex:1;color:#2A2622}.amt{font-family:monospace;font-weight:600;text-align:right;min-width:70px}
.jerg{display:flex;align-items:baseline;padding:3px 4px;background:#F0F7F4;border-top:1px solid #C8D8D2;font-style:italic}
.side-total{display:flex;justify-content:space-between;font-weight:700;font-size:11px;border-top:1.5px solid #333;margin-top:4px;padding-top:4px}
.summary{margin-top:16px;border-top:2px solid #333;padding-top:10px;display:flex;justify-content:space-between;align-items:center}
.sum-block{text-align:center}.sum-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#7A6E60}
.sum-val{font-size:16px;font-weight:700;color:#2A2622}.badge{font-size:9px;padding:2px 8px;border-radius:10px;font-weight:600}
.ok{background:#d1fae5;color:#065f46}.diff{background:#fef3c7;color:#92400e}
@media print{body{padding:10px 14px}.bilanz{gap:14px}}
</style></head><body>
<div class="doc-header">
  <div><div class="doc-title">Bilanz</div>
  <div style="font-size:10px;color:#666;margin-top:2px">Physio Allmend · ${fy.name} · ${fmtDate(fy.start_date)} – ${fmtDate(fy.end_date)}${pdfHideZero ? ' · Nullkonten ausgeblendet' : ''}</div></div>
  <div class="doc-meta">Erstellt: ${new Date().toLocaleDateString('de-CH')}${isHistoricalYear ? `<br>Stand per ${fmtDate(fy.end_date)}` : ''}</div>
</div>
<div class="bilanz">
  <div>
    <div class="side-title"><span>Aktivkonten</span></div>
    ${renderSide(aktivTree, aktivUng)}
    <div class="side-total"><span>Total Aktiva</span><span>${fmt(totalAktiv)}</span></div>
  </div>
  <div>
    <div class="side-title"><span>Passivkonten</span></div>
    ${renderSide(passivTree, passivUng)}
    ${ergebnisRow}
    <div class="side-total"><span>Total Passiva</span><span>${fmt(totalPassivMitErgebnis)}</span></div>
  </div>
</div>
<div class="summary">
  <div class="sum-block"><div class="sum-label">Bilanzsumme Aktiva</div><div class="sum-val">CHF ${fmt(totalAktiv)}</div></div>
  <span class="badge ${ausgeglichen ? 'ok' : 'diff'}">${ausgeglichen ? 'Ausgeglichen' : `Differenz ${fmt(Math.abs(totalAktiv - totalPassivMitErgebnis))}`}</span>
  <div class="sum-block"><div class="sum-label">Bilanzsumme Passiva</div><div class="sum-val">CHF ${fmt(totalPassivMitErgebnis)}</div></div>
</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-[#7A6E60] cursor-pointer select-none">
          <input
            type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)}
            className="accent-[#6B8E7F] w-4 h-4"
          />
          Konten mit Saldo 0 ausblenden
        </label>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Printer size={15} /> PDF / Drucken
        </button>
      </div>

      {isHistoricalYear && (
        <p className="text-xs text-[#7A6E60] text-right mb-4">Stand per {fmtDate(selectedFiscalYear.end_date)}</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountSide
          title="Aktivkonten" type="aktiv" accounts={aktiv} total={totalAktiv}
          groups={groups} allGroups={groups}
          icon={<TrendingUp size={18} className="text-blue-600" />}
          hideZero={hideZero}
          readOnly
        />
        <AccountSide
          title="Passivkonten" type="passiv" accounts={passiv} total={totalPassiv}
          groups={groups} allGroups={groups}
          icon={<TrendingDown size={18} className="text-purple-600" />}
          jahresergebnis={ergebnis}
          hideZero={hideZero}
          readOnly
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
function ErfolgsTab({ ertrag, aufwand, totalErtrag, totalAufwand, ergebnis, selectedFiscalYear, groups }: {
  ertrag: Account[]; aufwand: Account[]
  totalErtrag: number; totalAufwand: number; ergebnis: number
  selectedFiscalYear: FiscalYear
  groups: AccountGroup[]
}) {
  const [hideZero, setHideZero] = useState(true)

  // Jahresgewinn erscheint auf Aufwand-Seite (balanciert), Jahresverlust auf Ertrag-Seite
  const gewinn  = ergebnis > 0 ? ergebnis : undefined
  const verlust = ergebnis < 0 ? Math.abs(ergebnis) : undefined

  function handlePrint() {
    const pdfHideZero = hideZero
    const pdfErtrag  = pdfHideZero ? ertrag.filter(a => a.balance !== 0)  : ertrag
    const pdfAufwand = pdfHideZero ? aufwand.filter(a => a.balance !== 0) : aufwand
    const ertragTree   = buildGroupTree(groups, pdfErtrag,  'ertrag')
    const aufwandTree  = buildGroupTree(groups, pdfAufwand, 'aufwand')
    const ertragUng    = pdfErtrag.filter(a  => !a.group_id)
    const aufwandUng   = pdfAufwand.filter(a => !a.group_id)

    function renderNode(node: GroupNode, depth: number): string {
      const total = subtreeTotal(node)
      if (pdfHideZero && total === 0) return ''
      const accs = pdfHideZero ? node.nodeAccounts.filter(a => a.balance !== 0) : node.nodeAccounts
      const ind = depth * 10
      const cls = depth === 0 ? 'g0' : depth === 1 ? 'g1' : 'g2'
      let h = `<div class="${cls}" style="padding-left:${ind}px">
        <span>${node.account_number ? `<span class="mono">${node.account_number}</span> ` : ''}${node.name}</span>
        ${total !== 0 ? `<span class="amt">${fmt(total)}</span>` : ''}
      </div>`
      for (const a of accs) {
        h += `<div class="arow" style="padding-left:${ind + 14}px">
          <span class="mono">${a.number}</span><span class="aname">${a.name}</span>
          <span class="amt">${fmt(a.balance)}</span></div>`
      }
      for (const c of node.children) h += renderNode(c, depth + 1)
      return h
    }
    function renderSide(tree: GroupNode[], ung: Account[]): string {
      let h = tree.map(n => renderNode(n, 0)).join('')
      for (const a of ung) {
        h += `<div class="arow"><span class="mono">${a.number}</span><span class="aname">${a.name}</span>
          <span class="amt">${fmt(a.balance)}</span></div>`
      }
      return h
    }

    const fy = selectedFiscalYear
    const gewinnRow  = ergebnis > 0
      ? `<div class="jerg"><span class="aname">Jahresgewinn (laufend)</span><span class="amt">${fmt(ergebnis)}</span></div>`
      : ''
    const verlustRow = ergebnis < 0
      ? `<div class="jerg"><span class="aname">Jahresverlust (laufend)</span><span class="amt">${fmt(Math.abs(ergebnis))}</span></div>`
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Erfolgsrechnung – Physio Allmend</title>
<style>
*{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:10.5px;color:#222;margin:0;padding:18px 24px}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:14px}
.doc-title{font-size:17px;font-weight:700;color:#2A2622}.doc-meta{font-size:9.5px;color:#666;text-align:right}
.er{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.side-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#2A2622;padding:5px 0;border-bottom:1.5px solid #333;margin-bottom:4px;display:flex;justify-content:space-between}
.g0{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;background:#EDE7DA;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-top:4px;padding-left:4px;padding-right:4px}
.g1{display:flex;justify-content:space-between;align-items:baseline;padding:3px 4px;background:#F4EDE2;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
.g2{display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px;background:#F7F2EC;font-size:10px;font-weight:500}
.arow{display:flex;align-items:baseline;padding:2px 4px;border-bottom:1px solid #f5f0e8}
.mono{font-family:monospace;color:#7A6E60;margin-right:6px;min-width:28px;display:inline-block;font-size:9.5px}
.aname{flex:1;color:#2A2622}.amt{font-family:monospace;font-weight:600;text-align:right;min-width:70px}
.jerg{display:flex;align-items:baseline;padding:3px 4px;background:#F0F7F4;border-top:1px solid #C8D8D2;font-style:italic}
.side-total{display:flex;justify-content:space-between;font-weight:700;font-size:11px;border-top:1.5px solid #333;margin-top:4px;padding-top:4px}
.summary{margin-top:16px;border-top:2px solid #333;padding-top:10px;display:flex;justify-content:space-between;align-items:center}
.sum-block{text-align:center}.sum-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#7A6E60}
.sum-val{font-size:15px;font-weight:700}.erg-val{font-size:18px;font-weight:800}
.green{color:#065f46}.red{color:#b91c1c}
@media print{body{padding:10px 14px}.er{gap:14px}}
</style></head><body>
<div class="doc-header">
  <div><div class="doc-title">Erfolgsrechnung</div>
  <div style="font-size:10px;color:#666;margin-top:2px">Physio Allmend · ${fy.name} · ${fmtDate(fy.start_date)} – ${fmtDate(fy.end_date)}${pdfHideZero ? ' · Nullkonten ausgeblendet' : ''}</div></div>
  <div class="doc-meta">Erstellt: ${new Date().toLocaleDateString('de-CH')}</div>
</div>
<div class="er">
  <div>
    <div class="side-title"><span>Ertragskonten</span></div>
    ${renderSide(ertragTree, ertragUng)}
    ${verlustRow}
    <div class="side-total"><span>Total Ertrag</span><span>${fmt(totalErtrag + (ergebnis < 0 ? Math.abs(ergebnis) : 0))}</span></div>
  </div>
  <div>
    <div class="side-title"><span>Aufwandskonten</span></div>
    ${renderSide(aufwandTree, aufwandUng)}
    ${gewinnRow}
    <div class="side-total"><span>Total Aufwand</span><span>${fmt(totalAufwand + (ergebnis > 0 ? ergebnis : 0))}</span></div>
  </div>
</div>
<div class="summary">
  <div class="sum-block"><div class="sum-label">Total Ertrag</div><div class="sum-val green">CHF ${fmt(totalErtrag)}</div></div>
  <div class="sum-block">
    <div class="sum-label">Ergebnis</div>
    <div class="erg-val ${ergebnis >= 0 ? 'green' : 'red'}">CHF ${fmt(ergebnis)}</div>
    <div style="font-size:9px;color:#7A6E60;margin-top:2px">${ergebnis >= 0 ? 'Jahresgewinn' : 'Jahresverlust'}</div>
  </div>
  <div class="sum-block"><div class="sum-label">Total Aufwand</div><div class="sum-val red">CHF ${fmt(totalAufwand)}</div></div>
</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-[#7A6E60] cursor-pointer select-none">
          <input
            type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)}
            className="accent-[#6B8E7F] w-4 h-4"
          />
          Konten mit Saldo 0 ausblenden
        </label>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Printer size={15} /> PDF / Drucken
        </button>
      </div>

      <p className="text-xs text-[#7A6E60] text-right mb-4">
        Beträge aus Buchungen des Geschäftsjahrs {selectedFiscalYear.name}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountSide
          title="Ertragskonten" type="ertrag" accounts={ertrag} total={totalErtrag}
          groups={groups} allGroups={groups}
          icon={<TrendingUp size={18} className="text-green-600" />}
          jahresergebnis={verlust}
          jahresergebnisLabel="Jahresverlust (laufend)"
          hideZero={hideZero}
          readOnly
        />
        <AccountSide
          title="Aufwandskonten" type="aufwand" accounts={aufwand} total={totalAufwand}
          groups={groups} allGroups={groups}
          icon={<TrendingDown size={18} className="text-red-600" />}
          jahresergebnis={gewinn}
          jahresergebnisLabel="Jahresgewinn (laufend)"
          hideZero={hideZero}
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
              <p className="text-xs text-[#7A6E60] mt-0.5">{ergebnis >= 0 ? 'Jahresgewinn' : 'Jahresverlust'}</p>
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

// ── Account Side (hierarchical, always read-only) ────────────
function AccountSide({ title, type, accounts, total, groups, allGroups, icon, jahresergebnis, jahresergebnisLabel, readOnly, hideZero }: {
  title: string; type: AccountType; accounts: Account[]; total: number
  groups: AccountGroup[]; allGroups: AccountGroup[]
  icon: React.ReactNode
  jahresergebnis?: number
  jahresergebnisLabel?: string
  readOnly?: boolean
  hideZero?: boolean
}) {
  const visibleAccounts = hideZero ? accounts.filter(a => a.balance !== 0) : accounts
  const tree = buildGroupTree(groups, visibleAccounts, type)
  const ungrouped = visibleAccounts.filter(a => !a.group_id)

  const rowProps = {
    isAdmin: false, deleteConfirm: null, readOnly: true,
    onEdit: () => {}, onDelete: () => {}, onConfirmDelete: () => {}, onCancelDelete: () => {},
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E1D6C2]">
        {icon}
        <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>{title}</h2>
      </div>

      {tree.length === 0 && ungrouped.length === 0 && (
        <p className="text-center text-sm text-[#7A6E60] py-10">Keine Konten vorhanden</p>
      )}

      {tree.map(node => (
        <GroupNodeRow key={node.id} node={node} depth={0} rowProps={rowProps} hideZero={hideZero} />
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

      {/* Virtuelles Jahresergebnis (Passiv-Seite Bilanz / Aufwand-Seite Erfolgsrechnung) */}
      {jahresergebnis !== undefined && jahresergebnis !== 0 && (
        <div className="border-t border-[#E1D6C2]">
          <div className="px-5 py-1.5 bg-[#F4EDE2] border-b border-[#E1D6C2]">
            <div className="flex items-center justify-between pl-4">
              <span className="text-xs font-semibold text-[#4A4138] uppercase tracking-wide">
                {jahresergebnisLabel ?? 'Jahresergebnis (laufend)'}
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
    </div>
  )
}

// Suppress unused variable warning — allGroups accepted for API compatibility
void (AccountSide as unknown as (p: { allGroups: AccountGroup[] }) => null)

// ── Recursive group node renderer ────────────────────────────
function GroupNodeRow({ node, depth, rowProps, hideZero }: {
  node: GroupNode; depth: number
  hideZero?: boolean
  rowProps: {
    isAdmin: boolean; deleteConfirm: string | null; readOnly: boolean
    onEdit: (a: Account) => void; onDelete: (id: string) => void
    onConfirmDelete: (id: string) => void; onCancelDelete: () => void
  }
}) {
  const total = subtreeTotal(node)

  // When hideZero is active and this entire subtree is zero, skip rendering
  if (hideZero && total === 0) return null

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
        <GroupNodeRow key={child.id} node={child} depth={depth + 1} rowProps={rowProps} hideZero={hideZero} />
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

// ── Konten Tab (Admin) ───────────────────────────────────────
function KontenTab({ accounts, groups, onAccountsChange, supabase }: {
  accounts: Account[]
  groups: AccountGroup[]
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>
  supabase: ReturnType<typeof createClient>
}) {
  const [filterType, setFilterType] = useState<AccountType | 'all'>('all')
  const [modal, setModal]           = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing]       = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, start]          = useTransition()

  const types: (AccountType | 'all')[] = ['all', 'aktiv', 'passiv', 'ertrag', 'aufwand']
  const typeLabel: Record<string, string> = { all: 'Alle', aktiv: 'Aktiv', passiv: 'Passiv', ertrag: 'Ertrag', aufwand: 'Aufwand' }

  const filtered = accounts
    .filter(a => filterType === 'all' || a.type === filterType)
    .sort((a, b) => a.number.localeCompare(b.number))

  const newAccountType: AccountType = filterType === 'all' ? 'aktiv' : filterType

  async function handleSave(data: Omit<Account, 'id' | 'is_active'>) {
    setError(null)
    start(async () => {
      if (modal === 'new') {
        const { data: created, error: err } = await supabase.from('accounts').insert({ ...data, is_active: true }).select().single()
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

  async function handleToggleActive(account: Account) {
    start(async () => {
      const { data: updated } = await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id).select().single()
      if (updated) onAccountsChange(prev => prev.map(a => a.id === account.id ? updated as Account : a))
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-white rounded-xl border border-[#E1D6C2] p-1">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-[#6B8E7F] text-white' : 'text-[#7A6E60] hover:text-[#2A2622]'}`}
            >
              {typeLabel[t]}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditing(null); setModal('new'); setError(null) }}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Konto erfassen
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-[#7A6E60] text-center py-12">Keine Konten</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                <th className="text-left px-5 py-3">Nr.</th>
                <th className="text-left py-3">Name</th>
                <th className="text-left py-3 hidden sm:table-cell">Typ</th>
                <th className="text-right py-3">Saldo</th>
                <th className="py-3 pr-4 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(account => (
                <tr key={account.id} className={`border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group ${!account.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-mono text-xs text-[#7A6E60]">{account.number}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-[#2A2622]">{account.name}</div>
                    {account.description && <div className="text-xs text-[#7A6E60]">{account.description}</div>}
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4EDE2] text-[#7A6E60]">{TYPE_LABELS[account.type]}</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-sm text-[#2A2622]">{fmt(Number(account.balance))}</td>
                  <td className="py-3 pr-4">
                    {deleteConfirm === account.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleDelete(account.id)} disabled={isPending} className="text-red-600 p-1"><Check size={13} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[#7A6E60] p-1"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleToggleActive(account)} title={account.is_active ? 'Deaktivieren' : 'Aktivieren'} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1">
                          {account.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                        <button onClick={() => { setEditing(account); setModal('edit'); setError(null) }} className="text-[#7A6E60] hover:text-[#6B8E7F] p-1"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm(account.id)} className="text-[#7A6E60] hover:text-red-600 p-1"><Trash2 size={13} /></button>
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
        <AccountModal
          mode={modal} initial={editing} fixedType={editing?.type ?? newAccountType}
          groups={groups} onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null) }}
          isPending={isPending} error={error}
        />
      )}
    </div>
  )
}

// ── Buchungen Tab ────────────────────────────────────────────
// ── CAMT.053 Parser ──────────────────────────────────────────
interface RawCamtEntry {
  line: number
  date: string
  amount: number
  cdtDbtInd: 'CRDT' | 'DBIT'
  remittance: string
  debtorName: string
  error?: string
}

function parseCamt053(xmlText: string): RawCamtEntry[] {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
    if (doc.querySelector('parsererror')) return [{ line: 0, date: '', amount: 0, cdtDbtInd: 'CRDT', remittance: '', debtorName: '', error: 'XML-Parsing-Fehler' }]

    const getText = (el: Element, tag: string) =>
      el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''

    const entries = Array.from(doc.getElementsByTagName('Ntry'))
    return entries.map((ntry, idx) => {
      const line = idx + 1
      try {
        const sts = getText(ntry, 'Sts')
        if (sts && sts !== 'BOOK') return { line, date: '', amount: 0, cdtDbtInd: 'CRDT', remittance: '', debtorName: '', error: `Status ${sts} übersprungen` }

        const amtEl  = ntry.getElementsByTagName('Amt')[0]
        const amount = parseFloat(amtEl?.textContent?.trim() ?? '0')
        if (!amount || isNaN(amount)) return { line, date: '', amount: 0, cdtDbtInd: 'CRDT', remittance: '', debtorName: '', error: 'Kein gültiger Betrag' }

        const cdi = (getText(ntry, 'CdtDbtInd') || 'CRDT') as 'CRDT' | 'DBIT'

        // Date: prefer BookgDt/Dt, fallback ValDt/Dt
        const bookDt = ntry.getElementsByTagName('BookgDt')[0]
        const valDt  = ntry.getElementsByTagName('ValDt')[0]
        const date   = getText(bookDt ?? valDt ?? ntry, 'Dt')
        if (!date) return { line, date: '', amount: 0, cdtDbtInd: cdi, remittance: '', debtorName: '', error: 'Kein Datum' }

        // Remittance info: Ustrd + strukturierte Ref (CdtrRefInf/Ref) + AddtlRmtInf
        const txDtlsAll = Array.from(ntry.getElementsByTagName('TxDtls'))
        let remittance = ''
        let debtorName = ''
        for (const tx of txDtlsAll) {
          Array.from(tx.getElementsByTagName('Ustrd')).forEach(u => { remittance += ' ' + (u.textContent?.trim() ?? '') })
          // Strukturierte Referenz (z.B. RF27000000000000000011323)
          Array.from(tx.getElementsByTagName('Ref')).forEach(r => { remittance += ' ' + (r.textContent?.trim() ?? '') })
          Array.from(tx.getElementsByTagName('AddtlRmtInf')).forEach(u => { remittance += ' ' + (u.textContent?.trim() ?? '') })
          if (!debtorName) debtorName = getText(tx, 'Nm')
        }
        // Fallback: NtryDtls level Nm
        if (!debtorName) debtorName = getText(ntry, 'Nm')
        // Also check AddtlNtryInf at entry level
        if (!remittance.trim()) remittance = getText(ntry, 'AddtlNtryInf')

        return { line, date, amount, cdtDbtInd: cdi, remittance: remittance.trim(), debtorName: debtorName.trim() }
      } catch {
        return { line, date: '', amount: 0, cdtDbtInd: 'CRDT', remittance: '', debtorName: '', error: 'Verarbeitungsfehler' }
      }
    })
  } catch {
    return [{ line: 0, date: '', amount: 0, cdtDbtInd: 'CRDT', remittance: '', debtorName: '', error: 'Datei konnte nicht gelesen werden' }]
  }
}

/**
 * Extrahiert Referenznummern aus CAMT-Remittance-Text.
 * Unterstützt:
 *  - RF-Strukturreferenz: RF27000000000000000011323 → "11323"
 *  - 5-stellige Nummern direkt: "PILATESGRUPPE 11323" → "11323"
 *  - Muster "datum / 11310": "2026-03-13 / 11310" → "11310"
 * Jahreszahlen (4-stellig) werden nicht erfasst.
 */
function extractRefNumbers(text: string): string[] {
  const nums = new Set<string>()
  // RF-Format: RF + 2 Prüfziffern + führende Nullen + Referenznummer
  for (const m of text.matchAll(/RF\d{2}0+(\d{3,6})/gi)) nums.add(m[1])
  // 5-stellige Nummern (Jahreszahlen sind 4-stellig → kein Konflikt)
  for (const m of text.matchAll(/\b(\d{5})\b/g)) nums.add(m[1])
  return [...nums]
}

// ── Account Combobox ─────────────────────────────────────────
function AccountCombobox({
  label, accounts, value, onChange, amount, isSoll, periodBalMap,
}: {
  label: string
  accounts: Account[]
  value: string
  onChange: (id: string) => void
  amount: string
  isSoll: boolean
  periodBalMap: Map<string, number>
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')

  const selected = accounts.find(a => a.id === value) ?? null

  const filtered = query.trim()
    ? accounts.filter(a =>
        a.number.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase())
      )
    : accounts

  function select(acc: Account) {
    onChange(acc.id)
    setQuery('')
    setOpen(false)
  }

  const amt         = parseFloat(amount) || 0
  const currentBal  = selected != null ? (periodBalMap.get(selected.id) ?? 0) : null
  const delta       = selected && amt > 0
    ? (isSoll
        ? ((selected.type === 'aktiv' || selected.type === 'aufwand') ?  amt : -amt)
        : ((selected.type === 'passiv' || selected.type === 'ertrag') ?  amt : -amt))
    : 0
  const afterBal = currentBal !== null ? currentBal + delta : null

  const displayValue = open ? query : (selected ? `${selected.number}  ${selected.name}` : '')

  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="— Konto suchen —"
          className={inp}
          autoComplete="off"
        />
        {open && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[#E1D6C2] rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#7A6E60]">Keine Konten gefunden</p>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => select(a)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-[#F7F2EC] transition-colors ${a.id === value ? 'bg-[#F4EDE2] font-medium' : ''}`}
                >
                  <span className="font-mono text-xs text-[#7A6E60] w-10 shrink-0">{a.number}</span>
                  <span className="text-[#2A2622] truncate">{a.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selected && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#7A6E60]">
          <span>
            Saldo:{' '}
            <span className={`font-semibold ${currentBal! < 0 ? 'text-red-600' : 'text-[#2A2622]'}`}>
              CHF {fmt(currentBal!)}
            </span>
          </span>
          {amt > 0 && (
            <>
              <span className="text-[#C5B99A]">→</span>
              <span>
                Nach Buchung:{' '}
                <span className={`font-semibold ${afterBal! < 0 ? 'text-red-600' : 'text-[#6B8E7F]'}`}>
                  CHF {fmt(afterBal!)}
                </span>
                <span className={`ml-1 ${delta >= 0 ? 'text-[#6B8E7F]' : 'text-red-500'}`}>
                  ({delta >= 0 ? '+' : ''}{fmt(delta)})
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </Field>
  )
}

function BuchungenTab({ accounts, journalEntries, selectedFiscalYearId, selectedFiscalYearClosed, selectedFiscalYear, onJournalEntriesChange, onAccountsChange, initialPendingTransactions, supabase }: {
  accounts: Account[]
  journalEntries: JournalEntry[]
  selectedFiscalYearId: string
  selectedFiscalYearClosed: boolean
  selectedFiscalYear: FiscalYear | null
  onJournalEntriesChange: React.Dispatch<React.SetStateAction<JournalEntry[]>>
  onAccountsChange: React.Dispatch<React.SetStateAction<Account[]>>
  initialPendingTransactions: PendingTransaction[]
  supabase: ReturnType<typeof createClient>
}) {
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [isPending, start]              = useTransition()

  const today = new Date().toISOString().slice(0, 10)

  // Default date for new entries: today if within fiscal year, otherwise fiscal year start
  function defaultDate() {
    if (!selectedFiscalYear) return today
    if (today >= selectedFiscalYear.start_date && today <= selectedFiscalYear.end_date) return today
    return selectedFiscalYear.start_date
  }

  const [date, setDate]         = useState(defaultDate)
  const [description, setDesc]  = useState('')
  const [debitId, setDebitId]   = useState('')
  const [creditId, setCreditId] = useState('')
  const [amount, setAmount]     = useState('')

  // CAMT Import
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>(initialPendingTransactions)
  const [importModal, setImportModal]               = useState(false)
  const [importBankAccId, setImportBankAccId]       = useState('')
  const [importFordAccId, setImportFordAccId]       = useState('')
  const [importFile, setImportFile]                 = useState<File | null>(null)
  const [importResult, setImportResult]             = useState<ImportResult | null>(null)
  const [importProcessing, setImportProcessing]     = useState(false)
  // Pending transaction completion
  const [editPending, setEditPending]               = useState<PendingTransaction | null>(null)
  const [pendingCreditId, setPendingCreditId]       = useState('')
  const [pendingLinkInv, setPendingLinkInv]         = useState(false)
  const [pendingInvoice, setPendingInvoice]         = useState<InvoiceForPayment | null>(null)
  const [pendingDesc, setPendingDesc]               = useState('')
  const [pendingError, setPendingError]             = useState<string | null>(null)

  // Debitor-Verknüpfung
  const [linkDebitor, setLinkDebitor]               = useState(false)
  const [debitorModal, setDebitorModal]             = useState(false)
  const [openInvoices, setOpenInvoices]             = useState<InvoiceForPayment[]>([])
  const [invoiceSearch, setInvoiceSearch]           = useState('')
  const [loadingInvoices, setLoadingInvoices]       = useState(false)
  const [selectedInvoice, setSelectedInvoice]       = useState<InvoiceForPayment | null>(null)
  const [discountDialog, setDiscountDialog]         = useState(false)
  const [discountAccountId, setDiscountAccountId]   = useState('')
  const [pendingDiscountAmt, setPendingDiscountAmt] = useState(0)

  const isEditMode = editingEntry !== null

  // ── Sortierung ──────────────────────────────────────────────
  type SortKey = 'date' | 'description' | 'debit' | 'credit' | 'amount'
  const [sortKey, setSortKey]   = useState<SortKey>('date')
  const [sortAsc, setSortAsc]   = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sortedEntries = [...journalEntries].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'date')        cmp = a.date.localeCompare(b.date)
    else if (sortKey === 'description') cmp = a.description.localeCompare(b.description)
    else if (sortKey === 'debit')  cmp = (a.debit_account?.number ?? '').localeCompare(b.debit_account?.number ?? '')
    else if (sortKey === 'credit') cmp = (a.credit_account?.number ?? '').localeCompare(b.credit_account?.number ?? '')
    else if (sortKey === 'amount') cmp = Number(a.amount) - Number(b.amount)
    return sortAsc ? cmp : -cmp
  })

  function openNew() {
    setEditingEntry(null)
    setDate(defaultDate()); setDesc(''); setDebitId(''); setCreditId(''); setAmount('')
    setError(null); setShowForm(true)
  }

  function openEdit(entry: JournalEntry) {
    setEditingEntry(entry)
    setDate(entry.date)
    setDesc(entry.description)
    setDebitId(entry.debit_account_id)
    setCreditId(entry.credit_account_id)
    setAmount(String(entry.amount))
    setError(null)
    // Reset debitor state
    setLinkDebitor(false); setSelectedInvoice(null)
    // If this entry already has a linked invoice, load it
    if (entry.invoice_id) {
      supabase
        .from('invoices')
        .select('id, number, customer_name, invoice_date, due_date, status, discount_type, discount_value, reference, invoice_items(unit_price, quantity)')
        .eq('id', entry.invoice_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return
          const inv = data as {
            id: string; number: string; customer_name: string; invoice_date: string; due_date: string | null
            status: string; discount_type: string; discount_value: number; reference: string | null
            invoice_items: { unit_price: number; quantity: number }[]
          }
          const subtotal = (inv.invoice_items ?? []).reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
          const disc = inv.discount_type === 'percent' ? subtotal * Number(inv.discount_value) / 100 : Number(inv.discount_value)
          setSelectedInvoice({ id: inv.id, number: inv.number, customer_name: inv.customer_name, invoice_date: inv.invoice_date, due_date: inv.due_date, total: subtotal - disc, discount_type: inv.discount_type, discount_value: inv.discount_value, reference: inv.reference ?? null, status: inv.status })
          setLinkDebitor(true)
        })
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditingEntry(null); setError(null)
    setLinkDebitor(false); setSelectedInvoice(null); setDiscountDialog(false)
    setDiscountAccountId(''); setPendingDiscountAmt(0)
  }

  async function openDebitorModal() {
    setInvoiceSearch('')
    setDebitorModal(true)
    setLoadingInvoices(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, number, customer_name, invoice_date, due_date, status, discount_type, discount_value, reference, invoice_items(unit_price, quantity)')
      .in('status', ['entwurf', 'gesendet'])
      .order('status')   // gesendet vor entwurf
      .order('number', { ascending: false })
    const list: InvoiceForPayment[] = (data ?? []).map((inv: {
      id: string; number: string; customer_name: string; invoice_date: string; due_date: string | null
      status: string; discount_type: string; discount_value: number; reference: string | null
      invoice_items: { unit_price: number; quantity: number }[]
    }) => {
      const subtotal = (inv.invoice_items ?? []).reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
      const disc = inv.discount_type === 'percent' ? subtotal * Number(inv.discount_value) / 100 : Number(inv.discount_value)
      return { id: inv.id, number: inv.number, customer_name: inv.customer_name, invoice_date: inv.invoice_date, due_date: inv.due_date, total: subtotal - disc, discount_type: inv.discount_type, discount_value: inv.discount_value, reference: inv.reference ?? null, status: inv.status }
    })
    setOpenInvoices(list)
    setLoadingInvoices(false)
  }

  function selectInvoice(inv: InvoiceForPayment) {
    if (editPending) {
      // Called from pending transaction completion
      setPendingInvoice(inv)
    } else {
      // Called from booking form
      setSelectedInvoice(inv)
      if (!amount || parseFloat(amount) === 0) setAmount(String(inv.total.toFixed(2)))
    }
    setDebitorModal(false)
  }

  async function processImport() {
    if (!importFile || !importBankAccId) return
    setImportProcessing(true)
    setImportResult(null)

    const xmlText = await importFile.text()
    const entries = parseCamt053(xmlText)

    const result: ImportResult = { totalRead: entries.length, matched: 0, pendingCount: 0, errors: [] }
    const newPending: PendingTransaction[] = []

    // Offene Rechnungen für Matching laden
    const { data: invData } = await supabase
      .from('invoices')
      .select('id, number, customer_name, invoice_date, due_date, discount_type, discount_value, reference, invoice_items(unit_price, quantity)')
      .eq('status', 'gesendet')
    const openInvList: InvoiceForPayment[] = (invData ?? []).map((inv: {
      id: string; number: string; customer_name: string; invoice_date: string; due_date: string | null
      discount_type: string; discount_value: number; reference: string | null
      invoice_items: { unit_price: number; quantity: number }[]
    }) => {
      const sub = (inv.invoice_items ?? []).reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
      const disc = inv.discount_type === 'percent' ? sub * Number(inv.discount_value) / 100 : Number(inv.discount_value)
      return { ...inv, total: sub - disc, reference: inv.reference ?? null } as InvoiceForPayment
    })

    for (const entry of entries) {
      if (entry.error && entry.amount === 0) {
        result.errors.push({ line: entry.line, reason: entry.error })
        continue
      }

      // Referenznummern aus Remittance extrahieren (5-stellig oder RF-Format)
      const nums = extractRefNumbers(entry.remittance + ' ' + entry.debtorName)
      const matchedList = openInvList.filter(inv =>
        nums.some(n =>
          (inv.reference && inv.reference.includes(n)) ||
          inv.number.toUpperCase() === n
        )
      )
      const suggestedInvoice = matchedList.length === 1 ? matchedList[0] : undefined
      const amountMatch = suggestedInvoice && Math.abs(suggestedInvoice.total - entry.amount) < 0.015
      const isMatched = !!(suggestedInvoice && amountMatch && importFordAccId)

      newPending.push({
        tempId: `p-${Date.now()}-${entry.line}`,
        date: entry.date,
        amount: entry.amount,
        cdtDbtInd: entry.cdtDbtInd,
        description: entry.remittance || entry.debtorName || 'Import',
        debtorName: entry.debtorName,
        bankAccountId: importBankAccId,
        rawLine: entry.line,
        suggestedInvoice,
        suggestedCreditId: isMatched ? importFordAccId : undefined,
        isMatched,
      })

      if (isMatched) result.matched++
      else result.pendingCount++
    }

    // Pendenzen in DB persistieren
    const toInsert = newPending.map(pt => ({
      date: pt.date,
      amount: pt.amount,
      cdt_dbt_ind: pt.cdtDbtInd,
      description: pt.description,
      debtor_name: pt.debtorName,
      bank_account_id: pt.bankAccountId,
      raw_line: pt.rawLine,
      suggested_invoice_id: pt.suggestedInvoice?.id ?? null,
      suggested_credit_id: pt.suggestedCreditId ?? null,
      is_matched: pt.isMatched ?? false,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedRows } = await (supabase as any).from('pending_transactions').insert(toInsert).select('id')
    const savedRowsTyped = savedRows as { id: string }[] | null
    const newPendingWithIds = newPending.map((pt, i) => ({ ...pt, id: savedRowsTyped?.[i]?.id }))
    setPendingTransactions(prev => [...prev, ...newPendingWithIds])
    setImportResult(result)
    setImportProcessing(false)
    setImportFile(null)
  }

  function openPendingEdit(pt: PendingTransaction) {
    setEditPending(pt)
    // Bei vorgematchtem Eintrag Formular vorausfüllen
    if (pt.isMatched && pt.suggestedInvoice && pt.suggestedCreditId) {
      setPendingCreditId(pt.suggestedCreditId)
      setPendingDesc(`Zahlung ${pt.suggestedInvoice.number} – ${pt.debtorName || pt.suggestedInvoice.customer_name}`)
      setPendingLinkInv(true)
      setPendingInvoice(pt.suggestedInvoice)
    } else {
      setPendingCreditId(importFordAccId)
      setPendingDesc(pt.description)
      setPendingLinkInv(false)
      setPendingInvoice(null)
    }
    setPendingError(null)
  }

  async function removePending(pt: PendingTransaction) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (pt.id) await (supabase as any).from('pending_transactions').delete().eq('id', pt.id)
    setPendingTransactions(prev => prev.filter(p => p.tempId !== pt.tempId))
  }

  async function completePendingBooking() {
    if (!editPending || !pendingCreditId) { setPendingError('Gegenkonto wählen'); return }
    const bankAcc   = accounts.find(a => a.id === editPending.bankAccountId)
    const creditAcc = accounts.find(a => a.id === pendingCreditId)
    if (!bankAcc || !creditAcc) { setPendingError('Konto nicht gefunden'); return }

    const debitId  = editPending.cdtDbtInd === 'CRDT' ? editPending.bankAccountId : pendingCreditId
    const creditId = editPending.cdtDbtInd === 'CRDT' ? pendingCreditId : editPending.bankAccountId
    const debitAcc = accounts.find(a => a.id === debitId)!
    const creditAcc2 = accounts.find(a => a.id === creditId)!

    setPendingError(null)
    start(async () => {
      const JE_SELECT = '*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type), invoice:invoices!invoice_id(number,customer_name)'
      const entry = {
        date: editPending.date,
        description: pendingDesc || editPending.description,
        debit_account_id: debitId,
        credit_account_id: creditId,
        amount: editPending.amount,
        fiscal_year_id: selectedFiscalYearId,
        ...(pendingLinkInv && pendingInvoice ? { invoice_id: pendingInvoice.id } : {}),
      }
      const { data: rows, error: err } = await supabase.from('journal_entries').insert(entry).select(JE_SELECT)
      if (err) { setPendingError(err.message); return }
      const newEntry = Array.isArray(rows) ? rows[0] : rows
      if (newEntry) onJournalEntriesChange(prev => [newEntry as JournalEntry, ...prev])

      const debitDelta  = (debitAcc.type === 'aktiv' || debitAcc.type === 'aufwand') ? editPending.amount : -editPending.amount
      const creditDelta = (creditAcc2.type === 'passiv' || creditAcc2.type === 'ertrag') ? editPending.amount : -editPending.amount
      await Promise.all([
        supabase.from('accounts').update({ balance: Number(debitAcc.balance) + debitDelta }).eq('id', debitId),
        supabase.from('accounts').update({ balance: Number(creditAcc2.balance) + creditDelta }).eq('id', creditId),
      ])
      onAccountsChange(prev => prev.map(a => {
        if (a.id === debitId)  return { ...a, balance: Number(a.balance) + debitDelta }
        if (a.id === creditId) return { ...a, balance: Number(a.balance) + creditDelta }
        return a
      }))

      if (pendingLinkInv && pendingInvoice) {
        await supabase.from('invoices').update({ status: 'bezahlt' }).eq('id', pendingInvoice.id)
      }

      await removePending(editPending)
      setEditPending(null)
    })
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

  function validateForm(): { amt: number; debitAcc: Account; creditAcc: Account } | null {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Betrag muss grösser als 0 sein'); return null }
    if (debitId === creditId) { setError('Soll- und Habenkonto dürfen nicht identisch sein'); return null }
    if (selectedFiscalYearClosed) { setError('Auf ein abgeschlossenes Geschäftsjahr kann nicht gebucht werden.'); return null }
    if (selectedFiscalYear) {
      if (date < selectedFiscalYear.start_date || date > selectedFiscalYear.end_date) {
        setError(`Buchungsdatum muss innerhalb des Geschäftsjahres liegen (${fmtDate(selectedFiscalYear.start_date)} – ${fmtDate(selectedFiscalYear.end_date)}).`)
        return null
      }
    }
    const debitAcc  = accounts.find(a => a.id === debitId)
    const creditAcc = accounts.find(a => a.id === creditId)
    if (!debitAcc || !creditAcc) { setError('Konten nicht gefunden'); return null }
    return { amt, debitAcc, creditAcc }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validated = validateForm()
    if (!validated) return
    const { amt } = validated

    // Debitor-Verknüpfung: Differenz prüfen → Skonto-Dialog
    if (linkDebitor && selectedInvoice) {
      const diff = +(selectedInvoice.total - amt).toFixed(2)
      if (Math.abs(diff) > 0.004) {
        setPendingDiscountAmt(diff)
        setDiscountDialog(true)
        return
      }
    }

    setError(null)
    start(async () => {
      await performBooking()
    })
  }

  async function confirmDiscount() {
    if (!discountAccountId) { setError('Bitte Skonto-/Rabattkonto wählen'); return }
    setError(null)
    setDiscountDialog(false)
    start(async () => {
      await performBooking({ discountAccountId, discountAmount: pendingDiscountAmt })
    })
  }

  async function performBooking(discount?: { discountAccountId: string; discountAmount: number }) {
    const validated = validateForm()
    if (!validated) return
    const { amt, debitAcc, creditAcc } = validated

    const JE_SELECT = '*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type)'

    if (isEditMode && editingEntry) {
      // ── Edit: reverse old entry, apply new ──────────────────
      const oldDebitAcc  = accounts.find(a => a.id === editingEntry.debit_account_id)
      const oldCreditAcc = accounts.find(a => a.id === editingEntry.credit_account_id)
      const oldAmt = Number(editingEntry.amount)

      const deltas = new Map<string, number>()
      const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d)
      if (oldDebitAcc)  add(editingEntry.debit_account_id,  -balanceDelta(oldDebitAcc.type,  true,  oldAmt))
      if (oldCreditAcc) add(editingEntry.credit_account_id, -balanceDelta(oldCreditAcc.type, false, oldAmt))
      add(debitId,  balanceDelta(debitAcc.type,  true,  amt))
      add(creditId, balanceDelta(creditAcc.type, false, amt))

      const newBalances: Record<string, number> = {}
      for (const [accountId, delta] of deltas.entries()) {
        if (delta === 0) continue
        const r = await applyDelta(accountId, delta, accounts)
        newBalances[r.id] = r.newBalance
      }

      // Debitor-Verknüpfung: invoice_id bestimmen
      const newInvoiceId = linkDebitor && selectedInvoice ? selectedInvoice.id : null
      const oldInvoiceId = editingEntry.invoice_id ?? null

      // Update – getrennt von Select (RLS verhindert sonst manchmal den Select nach Update)
      const { error: err } = await supabase
        .from('journal_entries')
        .update({
          date, description,
          debit_account_id: debitId,
          credit_account_id: creditId,
          amount: amt,
          fiscal_year_id: selectedFiscalYearId,
          invoice_id: newInvoiceId,
        })
        .eq('id', editingEntry.id)
      if (err) { setError(err.message); return }

      // Zeile erneut laden; falls RLS den Select blockiert → lokalen State verwenden
      const { data: refetched } = await supabase
        .from('journal_entries')
        .select(JE_SELECT)
        .eq('id', editingEntry.id)
        .maybeSingle()

      const debitAccObj  = accounts.find(a => a.id === debitId)
      const creditAccObj = accounts.find(a => a.id === creditId)
      const updated: JournalEntry = (refetched as JournalEntry | null) ?? {
        ...editingEntry,
        date, description,
        debit_account_id:  debitId,
        credit_account_id: creditId,
        amount: amt,
        fiscal_year_id: selectedFiscalYearId,
        invoice_id: newInvoiceId,
        debit_account:  debitAccObj  ? { number: debitAccObj.number,  name: debitAccObj.name,  type: debitAccObj.type  as never } : editingEntry.debit_account,
        credit_account: creditAccObj ? { number: creditAccObj.number, name: creditAccObj.name, type: creditAccObj.type as never } : editingEntry.credit_account,
      }

      onJournalEntriesChange(prev => prev.map(e => e.id === editingEntry.id ? updated : e))
      onAccountsChange(prev => prev.map(a => a.id in newBalances ? { ...a, balance: newBalances[a.id] } : a))

      // Rechnungsstatus anpassen
      if (oldInvoiceId && oldInvoiceId !== newInvoiceId) {
        // Alte Rechnung wieder auf gesendet stellen
        await supabase.from('invoices').update({ status: 'gesendet' }).eq('id', oldInvoiceId)
      }
      if (newInvoiceId) {
        // Skonto bei Differenz (edit mode: discount wird direkt auf Rechnung gebucht, kein extra Eintrag)
        if (discount && discount.discountAmount > 0 && selectedInvoice) {
          const existingDisc = selectedInvoice.discount_type === 'amount' ? Number(selectedInvoice.discount_value) : 0
          await supabase.from('invoices')
            .update({ discount_type: 'amount', discount_value: existingDisc + discount.discountAmount })
            .eq('id', newInvoiceId)
        }
        await supabase.from('invoices').update({ status: 'bezahlt' }).eq('id', newInvoiceId)
      }

    } else {
      // ── New entry ────────────────────────────────────────────
      const mainEntry = {
        date, description,
        debit_account_id: debitId,
        credit_account_id: creditId,
        amount: amt,
        fiscal_year_id: selectedFiscalYearId,
        ...(linkDebitor && selectedInvoice ? { invoice_id: selectedInvoice.id } : {}),
      }

      const { data: insertedRows, error: err } = await supabase
        .from('journal_entries').insert(mainEntry).select(JE_SELECT)
      if (err) { setError(err.message); return }
      const entry = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows
      if (!entry) { setError('Buchung konnte nicht gespeichert werden'); return }

      const debitDelta  = balanceDelta(debitAcc.type,  true,  amt)
      const creditDelta = balanceDelta(creditAcc.type, false, amt)

      const r1 = await applyDelta(debitId,  debitDelta,  accounts)
      const r2 = await applyDelta(creditId, creditDelta, accounts)

      const newBals: Record<string, number> = { [r1.id]: r1.newBalance, [r2.id]: r2.newBalance }
      onJournalEntriesChange(prev => [entry as JournalEntry, ...prev])
      onAccountsChange(prev => prev.map(a => a.id in newBals ? { ...a, balance: newBals[a.id] } : a))

      // ── Debitor: Skonto-Buchung + Rechnung abschliessen ──────
      if (linkDebitor && selectedInvoice) {
        if (discount && discount.discountAmount > 0) {
          const discAcc = accounts.find(a => a.id === discount.discountAccountId)
          if (discAcc) {
            const discEntry = {
              date,
              description: `Skonto ${selectedInvoice.number}`,
              debit_account_id:  discount.discountAccountId,
              credit_account_id: creditId,
              amount: discount.discountAmount,
              fiscal_year_id: selectedFiscalYearId,
              invoice_id: selectedInvoice.id,
            }
            const { data: discRows } = await supabase.from('journal_entries').insert(discEntry).select(JE_SELECT)
            const discEntry0 = Array.isArray(discRows) ? discRows[0] : discRows
            if (discEntry0) onJournalEntriesChange(prev => [discEntry0 as JournalEntry, ...prev])

            const discDebitDelta  = balanceDelta(discAcc.type, true,  discount.discountAmount)
            const discCreditDelta = balanceDelta(creditAcc.type, false, discount.discountAmount)
            const d1 = await applyDelta(discount.discountAccountId, discDebitDelta,  accounts)
            const d2 = await applyDelta(creditId,                   discCreditDelta, accounts)
            onAccountsChange(prev => prev.map(a => {
              if (a.id === d1.id) return { ...a, balance: d1.newBalance }
              if (a.id === d2.id) return { ...a, balance: d2.newBalance }
              return a
            }))

            // Rabatt auf Rechnung eintragen
            const existingDisc = selectedInvoice.discount_type === 'amount' ? Number(selectedInvoice.discount_value) : 0
            await supabase.from('invoices')
              .update({ discount_type: 'amount', discount_value: existingDisc + discount.discountAmount })
              .eq('id', selectedInvoice.id)
          }
        }
        // Rechnung auf bezahlt stellen
        await supabase.from('invoices').update({ status: 'bezahlt' }).eq('id', selectedInvoice.id)
      }
    }

    closeForm()
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

  const sortedAccounts  = [...accounts].sort((a, b) => a.number.localeCompare(b.number))
  const periodBalMap    = computePeriodBalances(accounts, journalEntries)

  // Default bank/forderungen accounts for import
  const defaultBankAcc = sortedAccounts.find(a => a.number.startsWith('102') || a.number.startsWith('100'))
  const defaultFordAcc = sortedAccounts.find(a => a.number.startsWith('110'))

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-5">
        <button
          onClick={() => {
            setImportModal(true)
            setImportResult(null)
            setImportFile(null)
            if (!importBankAccId && defaultBankAcc) setImportBankAccId(defaultBankAcc.id)
            if (!importFordAccId && defaultFordAcc) setImportFordAccId(defaultFordAcc.id)
          }}
          className="flex items-center gap-2 border border-[#E1D6C2] bg-white hover:bg-[#F7F2EC] text-[#4A4138] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <FileText size={16} /> Bankabgleich importieren
        </button>
        <button
          onClick={openNew}
          disabled={selectedFiscalYearClosed}
          className="flex items-center gap-2 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> Buchung erfassen
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E1D6C2] p-5 mb-6">
          <h3 className="text-base font-semibold text-[#2A2622] mb-4" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            {isEditMode ? 'Buchung bearbeiten' : 'Neue Buchung'}
          </h3>
          {selectedFiscalYearClosed && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Dieses Geschäftsjahr ist abgeschlossen. Buchungen sind nicht mehr erlaubt.</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Buchungsdatum *">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                min={selectedFiscalYear?.start_date}
                max={selectedFiscalYear?.end_date}
                className={inp}
              />
            </Field>
            <Field label="Betrag (CHF) *">
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className={inp} />
            </Field>
            <AccountCombobox
              label="Soll-Konto (Debit) *"
              accounts={sortedAccounts}
              value={debitId}
              onChange={setDebitId}
              amount={amount}
              isSoll={true}
              periodBalMap={periodBalMap}
            />
            <AccountCombobox
              label="Haben-Konto (Kredit) *"
              accounts={sortedAccounts}
              value={creditId}
              onChange={setCreditId}
              amount={amount}
              isSoll={false}
              periodBalMap={periodBalMap}
            />
            <div className="sm:col-span-2">
              <Field label="Beschreibung *">
                <input value={description} onChange={e => setDesc(e.target.value)} required placeholder="z.B. Mieteinnahme Januar" className={inp} />
              </Field>
            </div>
            {/* Debitor-Verknüpfung */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#7A6E60] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={linkDebitor}
                  onChange={e => { setLinkDebitor(e.target.checked); if (!e.target.checked) setSelectedInvoice(null) }}
                  className="rounded border-[#E1D6C2] accent-[#6B8E7F]"
                />
                Mit Debitor verknüpfen (offene Rechnung zuweisen)
              </label>
              {linkDebitor && (
                <div className="mt-2">
                  {selectedInvoice ? (
                    <div className="flex items-center gap-3 bg-[#F4EDE2] rounded-xl px-4 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-[#2A2622]">{selectedInvoice.number}</span>
                        <span className="text-[#4A4138] ml-2">{selectedInvoice.customer_name}</span>
                        <span className="text-[#7A6E60] ml-3">CHF {fmt(selectedInvoice.total)}</span>
                        <span className="text-xs text-[#7A6E60] ml-3">{fmtDate(selectedInvoice.invoice_date)}</span>
                        {selectedInvoice.status && (
                          <span className={`text-xs ml-2 px-1.5 py-0.5 rounded-full ${selectedInvoice.status === 'bezahlt' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {selectedInvoice.status}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={openDebitorModal} className="text-xs text-[#6B8E7F] hover:underline shrink-0">Ändern</button>
                      <button type="button" onClick={() => setSelectedInvoice(null)} className="text-[#7A6E60] hover:text-red-500"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openDebitorModal}
                      className="flex items-center gap-2 text-sm text-[#6B8E7F] border border-dashed border-[#6B8E7F] rounded-xl px-4 py-2 hover:bg-[#F4EDE2] transition-colors"
                    >
                      <Plus size={14} /> Offene Rechnung auswählen
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={isPending || selectedFiscalYearClosed} className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? 'Speichern…' : isEditMode ? 'Speichern' : 'Buchen'}
            </button>
          </div>
        </form>
      )}

      {/* Pending transactions from import */}
      {pendingTransactions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <AlertTriangle size={15} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {pendingTransactions.length} importierte Buchung{pendingTransactions.length !== 1 ? 'en' : ''} zu bestätigen
              {pendingTransactions.filter(p => p.isMatched).length > 0 && (
                <span className="ml-2 text-green-700">
                  ({pendingTransactions.filter(p => p.isMatched).length} zugeordnet ✓)
                </span>
              )}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-amber-100 bg-amber-50">
                  <th className="text-left px-5 py-2">Datum</th>
                  <th className="text-left py-2">Beschreibung</th>
                  <th className="text-left py-2 hidden sm:table-cell">Auftraggeber</th>
                  <th className="text-right py-2 pr-5">Betrag (CHF)</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.map(pt => (
                  <tr key={pt.tempId}
                    className={`border-b last:border-0 cursor-pointer transition-colors ${pt.isMatched ? 'border-green-50 hover:bg-green-50' : 'border-amber-50 hover:bg-amber-50'}`}
                    onClick={() => openPendingEdit(pt)}
                  >
                    <td className="px-5 py-2.5 text-[#4A4138]">{fmtDate(pt.date)}</td>
                    <td className="py-2.5 pr-3 text-[#2A2622] max-w-[200px]">
                      <p className="truncate">{pt.description}</p>
                      {pt.isMatched && pt.suggestedInvoice && (
                        <p className="text-xs text-green-700 font-medium mt-0.5">
                          → {pt.suggestedInvoice.number} {pt.suggestedInvoice.customer_name}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[#7A6E60] hidden sm:table-cell">{pt.debtorName || '—'}</td>
                    <td className="py-2.5 pr-5 text-right font-semibold text-[#2A2622]">{fmt(pt.amount)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {pt.isMatched ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                          <Check size={10} /> zugeordnet
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                          <AlertTriangle size={10} /> bearbeiten
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E1D6C2] overflow-hidden flex flex-col" style={{ maxHeight: '60vh' }}>
        {journalEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#7A6E60]">
            <ReceiptText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Noch keine Buchungen für dieses Geschäftsjahr</p>
          </div>
        ) : (
          <>
            {/* Sticky header */}
            <div className="shrink-0 overflow-x-auto">
              <table className="w-full text-sm table-fixed" style={{ minWidth: '700px' }}>
                <colgroup>
                  <col style={{ width: '88px' }} />
                  <col />
                  <col style={{ width: '160px' }} className="hidden sm:table-column" />
                  <col style={{ width: '160px' }} className="hidden sm:table-column" />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} className="hidden md:table-column" />
                  <col style={{ width: '64px' }} />
                </colgroup>
                <thead>
                  <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2] bg-[#F7F2EC]">
                    {([
                      { key: 'date',        label: 'Datum',        cls: 'px-5 py-3 text-left' },
                      { key: 'description', label: 'Beschreibung', cls: 'py-3 text-left' },
                      { key: 'debit',       label: 'Soll',         cls: 'py-3 text-left hidden sm:table-cell' },
                      { key: 'credit',      label: 'Haben',        cls: 'py-3 text-left hidden sm:table-cell' },
                      { key: 'amount',      label: 'Betrag (CHF)', cls: 'py-3 pr-4 text-right' },
                    ] as { key: SortKey; label: string; cls: string }[]).map(col => (
                      <th key={col.key} className={col.cls}>
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="flex items-center gap-1 hover:text-[#2A2622] transition-colors w-full justify-end [&:not(.text-right)]:justify-start"
                          style={{ justifyContent: col.cls.includes('text-right') ? 'flex-end' : 'flex-start' }}
                        >
                          {col.label}
                          <span className="text-[10px] leading-none">
                            {sortKey === col.key ? (sortAsc ? '▲' : '▼') : '⇅'}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="py-3 pl-4 hidden md:table-cell text-left text-xs text-[#7A6E60] uppercase tracking-wide">Jahr</th>
                    <th className="w-16 pr-3"></th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* Scrollable body */}
            <div className="overflow-y-auto overflow-x-auto flex-1">
              <table className="w-full text-sm table-fixed" style={{ minWidth: '700px' }}>
                <colgroup>
                  <col style={{ width: '88px' }} />
                  <col />
                  <col style={{ width: '160px' }} className="hidden sm:table-column" />
                  <col style={{ width: '160px' }} className="hidden sm:table-column" />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} className="hidden md:table-column" />
                  <col style={{ width: '64px' }} />
                </colgroup>
                <tbody>
                  {sortedEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                      <td className="px-5 py-2.5 text-[#4A4138] whitespace-nowrap text-sm">{fmtDate(entry.date)}</td>
                      <td className="py-2.5 pr-3 text-[#2A2622] font-medium text-sm overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{entry.description}</span>
                          {entry.invoice_id && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap"
                              title={entry.invoice ? `Rechnung ${entry.invoice.number} – ${entry.invoice.customer_name}` : 'Mit Rechnung verknüpft'}
                            >
                              <LinkIcon size={9} />
                              {entry.invoice ? entry.invoice.number : 'Rechnung'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 hidden sm:table-cell truncate overflow-hidden">
                        <span className="font-mono text-xs text-[#7A6E60]">{entry.debit_account?.number}</span>
                        <span className="text-xs text-[#4A4138] ml-1">{entry.debit_account?.name}</span>
                      </td>
                      <td className="py-2.5 pr-3 hidden sm:table-cell truncate overflow-hidden">
                        <span className="font-mono text-xs text-[#7A6E60]">{entry.credit_account?.number}</span>
                        <span className="text-xs text-[#4A4138] ml-1">{entry.credit_account?.name}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-[#2A2622] text-sm">{fmt(Number(entry.amount))}</td>
                      <td className="py-2.5 pl-4 hidden md:table-cell">
                        {entry.fiscal_year ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4EDE2] text-[#7A6E60] whitespace-nowrap">
                            {entry.fiscal_year.name}
                          </span>
                        ) : (
                          <span className="text-xs text-[#E1D6C2]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
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
            </div>
          </>
        )}
      </div>

      {/* ── Modal: CAMT Import ────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Bankabgleich – CAMT.053 / Z53</h2>
              <button onClick={() => setImportModal(false)} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* File upload */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">CAMT.053-Datei (XML) *</label>
                <input
                  type="file" accept=".xml,.camt,.053"
                  onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-[#4A4138] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#6B8E7F] file:text-white hover:file:bg-[#5a7a6c] file:cursor-pointer cursor-pointer"
                />
                {importFile && <p className="text-xs text-[#7A6E60] mt-1">{importFile.name}</p>}
              </div>

              {/* Bank account */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Bankkonto (Debit bei Eingang) *</label>
                <select value={importBankAccId} onChange={e => setImportBankAccId(e.target.value)} className={inp}>
                  <option value="">— Konto wählen —</option>
                  {sortedAccounts.map(a => <option key={a.id} value={a.id}>{a.number} {a.name}</option>)}
                </select>
              </div>

              {/* Forderungen account */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Debitorenkonto / Forderungen (für Auto-Matching)</label>
                <select value={importFordAccId} onChange={e => setImportFordAccId(e.target.value)} className={inp}>
                  <option value="">— Konto wählen (optional) —</option>
                  {sortedAccounts.map(a => <option key={a.id} value={a.id}>{a.number} {a.name}</option>)}
                </select>
                <p className="text-xs text-[#7A6E60] mt-1">Wenn gesetzt: Zahlungen mit eindeutiger Rechnungsnummer werden automatisch gebucht und die Rechnung auf «Bezahlt» gestellt.</p>
              </div>

              {/* Import result */}
              {importResult && (
                <div className="bg-[#F7F2EC] rounded-xl px-4 py-3 space-y-2 text-sm">
                  <p className="font-semibold text-[#2A2622]">Import-Ergebnis</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-[#7A6E60]">Gelesen</p>
                      <p className="text-lg font-bold text-[#2A2622]">{importResult.totalRead}</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-[#7A6E60]">Zugeordnet ✓</p>
                      <p className="text-lg font-bold text-green-700">{importResult.matched}</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-[#7A6E60]">Manuell</p>
                      <p className="text-lg font-bold text-amber-600">{importResult.pendingCount}</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-700 mb-1">Fehlerhafte Zeilen ({importResult.errors.length}):</p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {importResult.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">Zeile {e.line}: {e.reason}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-[#E1D6C2]">
              <button onClick={() => setImportModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC]">
                {importResult ? 'Schliessen' : 'Abbrechen'}
              </button>
              {!importResult && (
                <button
                  onClick={processImport}
                  disabled={!importFile || !importBankAccId || importProcessing}
                  className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {importProcessing ? 'Verarbeite…' : 'Importieren'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Pending Transaction bearbeiten ──────────────── */}
      {editPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Buchung vervollständigen</h2>
              <button onClick={() => setEditPending(null)} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Transaction info */}
              <div className="bg-[#F7F2EC] rounded-xl px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Datum</span>
                  <span className="font-medium text-[#2A2622]">{fmtDate(editPending.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Betrag</span>
                  <span className="font-semibold text-[#2A2622]">CHF {fmt(editPending.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Auftraggeber</span>
                  <span className="text-[#2A2622]">{editPending.debtorName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Bankkonto</span>
                  <span className="font-mono text-xs text-[#2A2622]">{accounts.find(a => a.id === editPending.bankAccountId)?.number} {accounts.find(a => a.id === editPending.bankAccountId)?.name}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Beschreibung</label>
                <input value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} className={inp} />
              </div>

              {/* Gegenkonto */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">
                  {editPending.cdtDbtInd === 'CRDT' ? 'Gegenkonto (Haben / Kredit) *' : 'Gegenkonto (Soll / Debit) *'}
                </label>
                <AccountCombobox
                  label=""
                  accounts={sortedAccounts}
                  value={pendingCreditId}
                  onChange={setPendingCreditId}
                  amount={String(editPending.amount)}
                  isSoll={editPending.cdtDbtInd === 'DBIT'}
                  periodBalMap={periodBalMap}
                />
              </div>

              {/* Debitor verknüpfen */}
              <label className="flex items-center gap-2 text-sm text-[#7A6E60] cursor-pointer select-none">
                <input type="checkbox" checked={pendingLinkInv} onChange={e => { setPendingLinkInv(e.target.checked); if (!e.target.checked) setPendingInvoice(null) }} className="rounded border-[#E1D6C2] accent-[#6B8E7F]" />
                Mit Debitor verknüpfen (Rechnung als bezahlt markieren)
              </label>
              {pendingLinkInv && (
                <div>
                  {pendingInvoice ? (
                    <div className="flex items-center gap-2 bg-[#F4EDE2] rounded-xl px-3 py-2 text-sm">
                      <span className="font-semibold text-[#6B8E7F]">{pendingInvoice.number}</span>
                      <span className="flex-1 text-[#2A2622]">{pendingInvoice.customer_name}</span>
                      <span className="text-[#7A6E60]">CHF {fmt(pendingInvoice.total)}</span>
                      <button type="button" onClick={() => { setPendingInvoice(null); openDebitorModal() }} className="text-xs text-[#6B8E7F] hover:underline">Ändern</button>
                    </div>
                  ) : (
                    <button type="button" onClick={openDebitorModal} className="flex items-center gap-2 text-sm text-[#6B8E7F] border border-dashed border-[#6B8E7F] rounded-xl px-4 py-2 hover:bg-[#F4EDE2]">
                      <Plus size={14} /> Offene Rechnung auswählen
                    </button>
                  )}
                </div>
              )}

              {pendingError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pendingError}</p>}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-[#E1D6C2]">
              <button
                onClick={async () => { await removePending(editPending); setEditPending(null) }}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50"
              >
                Verwerfen
              </button>
              <div className="flex-1" />
              <button onClick={() => setEditPending(null)} className="px-4 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC]">Abbrechen</button>
              <button
                onClick={completePendingBooking}
                disabled={isPending || !pendingCreditId}
                className="px-4 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium disabled:opacity-50"
              >
                {isPending ? 'Buchen…' : 'Buchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Offene Rechnungen ──────────────────────────── */}
      {debitorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2] shrink-0">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Offene Rechnung auswählen</h2>
              <button onClick={() => setDebitorModal(false)} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
            </div>
            <div className="px-4 py-3 border-b border-[#E1D6C2] shrink-0">
              <input
                type="text"
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                placeholder="Suche nach Nummer oder Kunde…"
                className={inp}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingInvoices ? (
                <p className="text-sm text-[#7A6E60] text-center py-10">Laden…</p>
              ) : openInvoices.length === 0 ? (
                <p className="text-sm text-[#7A6E60] text-center py-10">Keine unbezahlten Rechnungen gefunden</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#F7F2EC]">
                    <tr className="text-xs text-[#7A6E60] uppercase tracking-wide border-b border-[#E1D6C2]">
                      <th className="text-left px-4 py-2">Nr.</th>
                      <th className="text-left py-2">Kunde</th>
                      <th className="text-right py-2 pr-4">Total (CHF)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices
                      .filter(inv =>
                        !invoiceSearch.trim() ||
                        inv.number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                        inv.customer_name.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                        (inv.reference ?? '').toLowerCase().includes(invoiceSearch.toLowerCase())
                      )
                      .map(inv => (
                        <tr
                          key={inv.id}
                          onClick={() => selectInvoice(inv)}
                          className="border-b border-[#F7F2EC] hover:bg-[#F4EDE2] cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono font-semibold text-[#6B8E7F]">{inv.number}</td>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-[#2A2622] flex items-center gap-2">
                              {inv.customer_name || <span className="italic text-[#7A6E60]">Kein Name</span>}
                              {inv.status === 'entwurf' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4EDE2] text-[#7A6E60] font-medium">Entwurf</span>
                              )}
                            </p>
                            <p className="text-xs text-[#7A6E60]">
                              {fmtDate(inv.invoice_date)}{inv.due_date ? ` · Fällig ${fmtDate(inv.due_date)}` : ''}
                              {inv.reference && <span className="ml-2 font-mono text-[#6B8E7F]">{inv.reference}</span>}
                            </p>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-[#2A2622]">{fmt(inv.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Skonto / Differenz ──────────────────────────── */}
      {discountDialog && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Differenz als Skonto buchen?</h2>
              <button onClick={() => setDiscountDialog(false)} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="bg-[#F7F2EC] rounded-xl px-4 py-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Rechnungsbetrag ({selectedInvoice.number})</span>
                  <span className="font-semibold text-[#2A2622]">CHF {fmt(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A6E60]">Zahlungsbetrag</span>
                  <span className="font-semibold text-[#2A2622]">CHF {fmt(parseFloat(amount) || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E1D6C2] pt-1.5">
                  <span className="text-[#7A6E60]">Differenz (Skonto)</span>
                  <span className="font-semibold text-amber-700">CHF {fmt(pendingDiscountAmt)}</span>
                </div>
              </div>

              <p className="text-sm text-[#4A4138]">
                Soll die Differenz von <strong>CHF {fmt(pendingDiscountAmt)}</strong> als Skonto/Rabatt gebucht werden?
                Die Rechnung wird danach auf <span className="font-medium text-green-700">Bezahlt</span> gestellt.
              </p>

              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Skonto-/Rabattkonto *</label>
                <AccountCombobox
                  label=""
                  accounts={sortedAccounts}
                  value={discountAccountId}
                  onChange={setDiscountAccountId}
                  amount={String(pendingDiscountAmt)}
                  isSoll={true}
                  periodBalMap={periodBalMap}
                />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-[#E1D6C2]">
              <button
                onClick={() => setDiscountDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E1D6C2] text-sm text-[#7A6E60] hover:bg-[#F7F2EC] transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={confirmDiscount}
                disabled={isPending || !discountAccountId}
                className="flex-1 py-2.5 rounded-xl bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isPending ? 'Buchen…' : 'Skonto buchen & Rechnung schliessen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Kontengruppen Tab ────────────────────────────────────────
type GruppenForm = {
  name: string
  type: AccountType
  account_number: string
  level: 'klasse' | 'gruppe' | ''
  parent_id: string
  sort_order: string
  description: string
}

const EMPTY_GRUPPEN_FORM: GruppenForm = {
  name: '', type: 'aktiv', account_number: '', level: '', parent_id: '', sort_order: '0', description: ''
}

function GruppenTab({ groups, isAdmin, supabase, onGroupsChange }: {
  groups: AccountGroup[]
  isAdmin: boolean
  supabase: ReturnType<typeof createClient>
  onGroupsChange: (groups: AccountGroup[]) => void
}) {
  const [modal, setModal]           = useState<null | 'new' | string>(null) // null | 'new' | group.id
  const [form, setForm]             = useState<GruppenForm>(EMPTY_GRUPPEN_FORM)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, start]          = useTransition()

  function openNew() {
    setForm(EMPTY_GRUPPEN_FORM)
    setError(null)
    setModal('new')
  }

  function openEdit(g: AccountGroup) {
    setForm({
      name:           g.name,
      type:           g.type,
      account_number: g.account_number ?? '',
      level:          g.level ?? '',
      parent_id:      g.parent_id ?? '',
      sort_order:     String(g.sort_order),
      description:    g.description ?? '',
    })
    setError(null)
    setModal(g.id)
  }

  function closeModal() { setModal(null); setError(null) }

  function field(key: keyof GruppenForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return }
    setError(null)
    start(async () => {
      const payload = {
        name:           form.name.trim(),
        type:           form.type,
        account_number: form.account_number.trim() || null,
        level:          (form.level || null) as 'klasse' | 'gruppe' | null,
        parent_id:      form.parent_id || null,
        sort_order:     Number(form.sort_order) || 0,
        description:    form.description.trim() || null,
      }

      if (modal === 'new') {
        const { data, error: err } = await supabase
          .from('account_groups').insert(payload).select().single()
        if (err) { setError(err.message); return }
        onGroupsChange([...groups, data as AccountGroup])
      } else {
        const { data, error: err } = await supabase
          .from('account_groups').update(payload).eq('id', modal!).select().single()
        if (err) { setError(err.message); return }
        onGroupsChange(groups.map(g => g.id === modal ? data as AccountGroup : g))
      }
      closeModal()
    })
  }

  async function handleDelete(id: string) {
    setError(null)
    start(async () => {
      const { error: err } = await supabase.from('account_groups').delete().eq('id', id)
      if (err) { setError(err.message); setDeleteId(null); return }
      onGroupsChange(groups.filter(g => g.id !== id))
      setDeleteId(null)
    })
  }

  const byType = (['aktiv', 'passiv', 'ertrag', 'aufwand'] as AccountType[]).map(type => ({
    type, items: groups.filter(g => g.type === type).sort((a, b) => a.sort_order - b.sort_order || (a.account_number ?? '').localeCompare(b.account_number ?? ''))
  }))

  return (
    <>
      {/* Toolbar */}
      {isAdmin && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#7A6E60]">{groups.length} Kontengruppen</p>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={15} /> Neue Gruppe
          </button>
        </div>
      )}

      {error && !modal && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

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
                  <li key={g.id} className="flex items-center justify-between px-5 py-2.5 border-b border-[#F7F2EC] last:border-0 hover:bg-[#FDFAF6] group">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.account_number && (
                        <span className="font-mono text-xs text-[#7A6E60] w-10 shrink-0">{g.account_number}</span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-[#2A2622] text-sm truncate">{g.name}</p>
                        <div className="flex items-center gap-2">
                          {g.level && <p className="text-xs text-[#7A6E60] capitalize">{g.level}</p>}
                          {g.parent_id && (
                            <p className="text-xs text-[#7A6E60]">↳ {groups.find(p => p.id === g.parent_id)?.name ?? '—'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-1 rounded text-[#7A6E60] hover:text-[#2A2622] hover:bg-[#F4EDE2] transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(g.id)}
                          className="p-1 rounded text-[#7A6E60] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Edit / New Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1D6C2]">
              <h2 className="font-semibold text-[#2A2622]" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
                {modal === 'new' ? 'Neue Kontengruppe' : 'Gruppe bearbeiten'}
              </h2>
              <button onClick={closeModal} className="text-[#7A6E60] hover:text-[#2A2622]"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Name *</label>
                <input
                  value={form.name} onChange={field('name')}
                  className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
                  placeholder="z. B. Umlaufvermögen"
                />
              </div>

              {/* Type + Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#7A6E60] mb-1">Typ *</label>
                  <select value={form.type} onChange={field('type')} className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]">
                    <option value="aktiv">Aktiv</option>
                    <option value="passiv">Passiv</option>
                    <option value="ertrag">Ertrag</option>
                    <option value="aufwand">Aufwand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A6E60] mb-1">Level</label>
                  <select value={form.level} onChange={field('level')} className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]">
                    <option value="">—</option>
                    <option value="klasse">Klasse</option>
                    <option value="gruppe">Gruppe</option>
                  </select>
                </div>
              </div>

              {/* Account number + Sort order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#7A6E60] mb-1">Kontonummer</label>
                  <input
                    value={form.account_number} onChange={field('account_number')}
                    className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
                    placeholder="z. B. 10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A6E60] mb-1">Reihenfolge</label>
                  <input
                    type="number" value={form.sort_order} onChange={field('sort_order')}
                    className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]"
                  />
                </div>
              </div>

              {/* Parent group */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Übergeordnete Gruppe</label>
                <select value={form.parent_id} onChange={field('parent_id')} className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]">
                  <option value="">— Keine —</option>
                  {groups
                    .filter(g => modal === 'new' || g.id !== modal)
                    .sort((a, b) => (a.account_number ?? '').localeCompare(b.account_number ?? '') || a.name.localeCompare(b.name))
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.account_number ? `${g.account_number} – ` : ''}{g.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[#7A6E60] mb-1">Beschreibung</label>
                <textarea
                  value={form.description} onChange={field('description')} rows={2}
                  className="w-full border border-[#E1D6C2] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E7F] resize-none"
                  placeholder="Optional"
                />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E1D6C2]">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-[#7A6E60] hover:text-[#2A2622] transition-colors">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#6B8E7F] hover:bg-[#5a7a6c] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Check size={14} /> {isPending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-[#2A2622] mb-2" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>Gruppe löschen?</h2>
            <p className="text-sm text-[#7A6E60] mb-5">
              <strong className="text-[#2A2622]">{groups.find(g => g.id === deleteId)?.name}</strong> wird permanent gelöscht.
              Konten dieser Gruppe werden <em>nicht</em> gelöscht.
            </p>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-[#7A6E60] hover:text-[#2A2622]">Abbrechen</button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} /> {isPending ? 'Löschen…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Jahresabschluss Modal ────────────────────────────────────
function JahresabschlussModal({ year, aktivAccounts, passivAccounts, allAccounts, journalEntries, onClose, onDone, supabase }: {
  year: FiscalYear
  aktivAccounts: Account[]
  passivAccounts: Account[]
  allAccounts: Account[]
  journalEntries: JournalEntry[]
  onClose: () => void
  onDone: (closedYear: FiscalYear, newEntries: JournalEntry[], updatedAccounts: Account[], newFiscalYear: FiscalYear | null) => void
  supabase: ReturnType<typeof createClient>
}) {
  const eroeffnungsOptions = allAccounts.filter(a => a.number.startsWith('297'))

  const [guvId, setGuvId]  = useState(eroeffnungsOptions[0]?.id ?? '')
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  // Salden des abzuschliessenden Jahres aus Buchungen berechnen (nie aus account.balance cache)
  const yearEntries = journalEntries.filter(e => e.fiscal_year_id === year.id)
  const closingBalances = computePeriodBalances([...aktivAccounts, ...passivAccounts], yearEntries)

  const totalAktiv  = aktivAccounts.reduce((s, a) => s + (closingBalances.get(a.id) ?? 0), 0)
  const totalPassiv = passivAccounts.reduce((s, a) => s + (closingBalances.get(a.id) ?? 0), 0)

  // Compute next year dates
  const nextStart    = new Date(year.end_date); nextStart.setDate(nextStart.getDate() + 1)
  const nextEnd      = new Date(nextStart);     nextEnd.setFullYear(nextEnd.getFullYear() + 1); nextEnd.setDate(nextEnd.getDate() - 1)
  const nextStartStr = nextStart.toISOString().split('T')[0]
  const nextEndStr   = nextEnd.toISOString().split('T')[0]
  const nextYearNum  = nextStart.getFullYear()

  async function handleExecute() {
    if (!guvId) { setError('Bitte Eröffnungskonto wählen.'); return }
    setError(null)
    start(async () => {
      type EntryInsert = { date: string; description: string; debit_account_id: string; credit_account_id: string; amount: number; fiscal_year_id: string }

      // ── Find or create next fiscal year ──────────────────────
      const { data: existingNext } = await supabase.from('fiscal_years').select('*').eq('start_date', nextStartStr).maybeSingle()
      let nextYear: FiscalYear
      let createdNewYear = false
      if (existingNext) {
        nextYear = existingNext as FiscalYear
      } else {
        const { data: newYear, error: nyErr } = await supabase
          .from('fiscal_years').insert({ name: String(nextYearNum), start_date: nextStartStr, end_date: nextEndStr, is_closed: false }).select().single()
        if (nyErr) { setError(nyErr.message); return }
        nextYear = newYear as FiscalYear
        createdNewYear = true
      }

      // ── Eröffnungsbuchungen: Aktiv → Soll Aktiv / Haben 2970 ──
      const openingEntries: EntryInsert[] = []
      for (const a of aktivAccounts) {
        const bal = closingBalances.get(a.id) ?? 0
        if (Math.abs(bal) < 0.005) continue
        const amt = Math.abs(bal)
        openingEntries.push({
          date: nextStartStr,
          description: `Eröffnung ${nextYear.name}: ${a.name}`,
          debit_account_id:  bal >= 0 ? a.id  : guvId,
          credit_account_id: bal >= 0 ? guvId : a.id,
          amount: amt,
          fiscal_year_id: nextYear.id,
        })
      }

      // ── Eröffnungsbuchungen: Passiv → Soll 2970 / Haben Passiv ──
      for (const a of passivAccounts) {
        if (a.id === guvId) continue
        const bal = closingBalances.get(a.id) ?? 0
        if (Math.abs(bal) < 0.005) continue
        const amt = Math.abs(bal)
        openingEntries.push({
          date: nextStartStr,
          description: `Eröffnung ${nextYear.name}: ${a.name}`,
          debit_account_id:  bal >= 0 ? guvId : a.id,
          credit_account_id: bal >= 0 ? a.id  : guvId,
          amount: amt,
          fiscal_year_id: nextYear.id,
        })
      }

      // ── Insert journal entries ────────────────────────────────
      const { data: created, error: err } = await supabase
        .from('journal_entries')
        .insert(openingEntries)
        .select('*, fiscal_year:fiscal_years!fiscal_year_id(id,name), debit_account:accounts!debit_account_id(number,name,type), credit_account:accounts!credit_account_id(number,name,type)')
      if (err) { setError(err.message); return }

      // ── Compute balance deltas from opening entries ───────────
      const balanceDeltas = new Map<string, number>()
      const guvAcc = allAccounts.find(a => a.id === guvId)
      for (const entry of openingEntries) {
        const debitType  = allAccounts.find(a => a.id === entry.debit_account_id)?.type
        const creditType = allAccounts.find(a => a.id === entry.credit_account_id)?.type
        if (debitType) {
          const d = (debitType === 'aktiv' || debitType === 'aufwand') ? entry.amount : -entry.amount
          balanceDeltas.set(entry.debit_account_id, (balanceDeltas.get(entry.debit_account_id) ?? 0) + d)
        }
        if (creditType) {
          const d = (creditType === 'passiv' || creditType === 'ertrag') ? entry.amount : -entry.amount
          balanceDeltas.set(entry.credit_account_id, (balanceDeltas.get(entry.credit_account_id) ?? 0) + d)
        }
      }

      // ── Zero all Aktiv/Passiv accounts then apply deltas ─────
      const allBilanzAccounts = [...aktivAccounts, ...passivAccounts]
      const updatedAccounts: Account[] = []
      for (const a of allBilanzAccounts) {
        const newBalance = balanceDeltas.get(a.id) ?? 0
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', a.id)
        updatedAccounts.push({ ...a, balance: newBalance })
      }
      if (guvAcc && !allBilanzAccounts.find(a => a.id === guvId)) {
        const newBalance = balanceDeltas.get(guvId) ?? 0
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', guvId)
        updatedAccounts.push({ ...guvAcc, balance: newBalance })
      }

      // ── Mark fiscal year closed ───────────────────────────────
      const { data: closedYear } = await supabase.from('fiscal_years').update({ is_closed: true }).eq('id', year.id).select().single()
      onDone(closedYear as FiscalYear, (created ?? []) as JournalEntry[], updatedAccounts, createdNewYear ? nextYear : null)
    })
  }

  return (
    <Modal title={`Jahresabschluss: ${year.name}`} onClose={onClose}>
      <div className="space-y-5">

        {/* Preview */}
        <div className="bg-[#F7F2EC] rounded-xl p-4 text-sm space-y-1.5">
          <p className="text-xs font-semibold text-[#7A6E60] uppercase tracking-wide mb-2">Eröffnungsbilanz {nextYearNum}</p>
          <div className="flex justify-between">
            <span className="text-[#7A6E60]">Total Aktiv (wird übertragen)</span>
            <span className="font-mono text-[#2A2622]">{fmt(totalAktiv)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A6E60]">Total Passiv (wird übertragen)</span>
            <span className="font-mono text-[#2A2622]">{fmt(totalPassiv)}</span>
          </div>
          <div className="border-t border-[#E1D6C2] pt-1.5 flex justify-between text-xs text-[#7A6E60]">
            <span>Ertrag/Aufwand starten per 0 im neuen Jahr</span>
          </div>
        </div>

        <Field label="Eröffnungskonto (2970)">
          <select value={guvId} onChange={e => setGuvId(e.target.value)} className={inp}>
            {eroeffnungsOptions.map(a => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
        </Field>

        <div className="bg-[#F0F9F4] border border-[#C3E6D3] rounded-xl p-3 text-xs text-[#2A6645] space-y-1">
          <p>• Für jedes Aktiv-Konto: <strong>Soll Konto / Haben {eroeffnungsOptions.find(a => a.id === guvId)?.number ?? '2970'}</strong></p>
          <p>• Für jedes Passiv-Konto: <strong>Soll {eroeffnungsOptions.find(a => a.id === guvId)?.number ?? '2970'} / Haben Konto</strong></p>
          <p>• Alle Buchungen werden dem Geschäftsjahr <strong>{nextYearNum}</strong> zugewiesen</p>
          <p>• Geschäftsjahr {nextYearNum} wird automatisch eröffnet falls noch nicht vorhanden ({nextStartStr} – {nextEndStr})</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Alle Konten werden auf 0 gesetzt. Die Eröffnungsbuchungen stellen die Bilanzwerte im neuen Jahr wieder her. Das Geschäftsjahr {year.name} wird als abgeschlossen markiert.</span>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="text-sm text-[#7A6E60] hover:text-[#2A2622] px-4 py-2">Abbrechen</button>
          <button
            onClick={handleExecute} disabled={isPending || !guvId}
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
function JahreTab({ fiscalYears, isAdmin, onFiscalYearsChange, accounts, aktivAccounts, passivAccounts, journalEntries, onAccountsChange, onJournalEntriesChange, supabase }: {
  fiscalYears: FiscalYear[]; isAdmin: boolean
  onFiscalYearsChange: React.Dispatch<React.SetStateAction<FiscalYear[]>>
  accounts: Account[]
  aktivAccounts: Account[]
  passivAccounts: Account[]
  journalEntries: JournalEntry[]
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
          aktivAccounts={aktivAccounts}
          passivAccounts={passivAccounts}
          allAccounts={accounts}
          journalEntries={journalEntries}
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
