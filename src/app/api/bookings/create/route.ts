import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await request.json()
  const { treatment_type_id, requested_date, requested_time, notes } = body

  if (!treatment_type_id || !requested_date || !requested_time) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      patient_id: user.id,
      treatment_type_id,
      requested_date,
      requested_time,
      notes: notes ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ booking: data })
}
