import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/PhysioLogo'
import { ArrowLeft, LogOut } from 'lucide-react'
import Link from 'next/link'
import RechnungEditor from './RechnungEditor'

export default async function RechnungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'physio'].includes(profile.role)) redirect('/dashboard')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (!invoice) redirect('/rechnungen')

  const [{ data: items }, { data: customers }, { data: accounts }, { data: fiscalYears }] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
    supabase.from('customers').select('id,customer_number,name,street,street_number,postal_code,city,country').order('name'),
    supabase.from('accounts').select('id,number,name,type,balance').eq('is_active', true).order('number'),
    supabase.from('fiscal_years').select('id,name,start_date,end_date').eq('is_closed', false).order('start_date'),
  ])

  return (
    <div className="min-h-screen bg-[#FBF7F1]">
      <header className="bg-white border-b border-[#E1D6C2] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/rechnungen" className="text-[#7A6E60] hover:text-[#2A2622] transition-colors">
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

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        <RechnungEditor
          invoice={invoice}
          initialItems={items ?? []}
          isAdmin={profile.role === 'admin'}
          customers={customers ?? []}
          accounts={accounts ?? []}
          fiscalYears={fiscalYears ?? []}
        />
      </main>
    </div>
  )
}
