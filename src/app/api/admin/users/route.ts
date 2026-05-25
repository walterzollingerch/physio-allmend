import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Nur Admins dürfen diese Route nutzen
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return supabase
}

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── POST /api/admin/users – Neuen Benutzer anlegen ────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await requireAdmin()
  if (!supabase) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { full_name, email, phone, role } = await req.json()
  if (!full_name || !email) return NextResponse.json({ error: 'Name und E-Mail erforderlich' }, { status: 400 })

  const admin = getAdminClient()

  // E-Mail-Duplikat prüfen
  const { data: userList } = await admin.auth.admin.listUsers()
  const exists = userList?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
  if (exists) return NextResponse.json({ error: 'E-Mail-Adresse ist bereits registriert' }, { status: 409 })

  // Auth-User anlegen (gesperrt bis Freischaltung)
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name, phone },
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

  // Profil anpassen (Trigger hat es angelegt, wir überschreiben)
  await admin.from('profiles').update({
    full_name,
    phone: phone || null,
    role: role ?? 'client',
    is_blocked: true,
  }).eq('id', newUser.user.id)

  const { data: profile } = await admin.from('profiles').select('*').eq('id', newUser.user.id).single()
  return NextResponse.json({ profile }, { status: 201 })
}

// ── PATCH /api/admin/users – Benutzer bearbeiten ─────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await requireAdmin()
  if (!supabase) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id, full_name, email, phone } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const admin = getAdminClient()

  // E-Mail-Duplikat prüfen (exklusive eigene)
  if (email) {
    const { data: userList } = await admin.auth.admin.listUsers()
    const duplicate = userList?.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase() && u.id !== id
    )
    if (duplicate) return NextResponse.json({ error: 'E-Mail-Adresse ist bereits registriert' }, { status: 409 })

    // Auth-Email aktualisieren
    await admin.auth.admin.updateUserById(id, { email })
  }

  // Profil aktualisieren
  const updates: Record<string, string | null> = {}
  if (full_name) updates.full_name = full_name
  if (email)     updates.email     = email
  if (phone !== undefined) updates.phone = phone || null

  const { data: profile, error } = await admin.from('profiles').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile })
}

// ── DELETE /api/admin/users – Benutzer löschen ───────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await requireAdmin()
  if (!supabase) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
