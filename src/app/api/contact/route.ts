import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// Mapping Kontaktformular-Thema → Behandlungstyp-ID
const TOPIC_TREATMENT: Record<string, string> = {
  ersttermin:  'f3dfb60e-bd41-4ea4-bfbd-136432a14d50', // Erstgespräch
  folgetermin: '8d6d8166-3c52-46bf-abf3-5a55cff6f2d7', // Physiotherapie
  information: 'f3dfb60e-bd41-4ea4-bfbd-136432a14d50', // Erstgespräch
  verordnung:  '8d6d8166-3c52-46bf-abf3-5a55cff6f2d7', // Physiotherapie
  sonstiges:   '8d6d8166-3c52-46bf-abf3-5a55cff6f2d7', // Physiotherapie
}
const DEFAULT_TREATMENT = '8d6d8166-3c52-46bf-abf3-5a55cff6f2d7'

export async function POST(req: NextRequest) {
  const fd = await req.formData()
  const name        = fd.get('name')    as string
  const email       = fd.get('email')   as string
  const phone       = fd.get('phone')   as string
  const topic       = fd.get('topic')   as string
  const message     = fd.get('message') as string
  const fileEntries = fd.getAll('files') as File[]

  // ── 1. E-Mail senden ──────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })

  const html = `
    <h2 style="color:#2A2622;font-family:Georgia,serif">Neue Anfrage – Physio Allmend</h2>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60;width:120px">Name</td><td style="padding:8px 12px">${name}</td></tr>
      <tr style="background:#f9f6f1"><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">E-Mail</td><td style="padding:8px 12px"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">Telefon</td><td style="padding:8px 12px">${phone || '—'}</td></tr>
      <tr style="background:#f9f6f1"><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">Anliegen</td><td style="padding:8px 12px">${topic}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60;vertical-align:top">Nachricht</td><td style="padding:8px 12px;white-space:pre-wrap">${message}</td></tr>
    </table>
    <p style="margin-top:16px;font-size:12px;color:#aaa">Gesendet über physio-allmend.vercel.app</p>
  `

  const attachments = await Promise.all(
    fileEntries.filter(f => f.size > 0).map(async f => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type,
    }))
  )

  try {
    await transporter.sendMail({
      from: `"Physio Allmend Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `Anfrage von ${name} – ${topic}`,
      html,
      attachments,
    })
  } catch (err) {
    console.error('E-Mail Fehler:', err)
  }

  // ── 2. Supabase: Profil + Buchung anlegen ─────────────────────────────────
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ ok: true })

  const admin = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // Benutzer suchen oder anlegen (gesperrt, kein Passwort)
  let userId: string | null = null
  try {
    const { data: userList } = await admin.auth.admin.listUsers()
    const existing = userList?.users.find(u => u.email === email)

    if (existing) {
      userId = existing.id
      // Profil-Daten aktualisieren
      await admin.from('profiles').update({ full_name: name, phone: phone || null }).eq('id', userId)
    } else {
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name, phone },
      })
      if (error) {
        console.error('User anlegen:', error)
      } else {
        userId = newUser.user.id
        // Profil als gesperrt anlegen
        await admin.from('profiles').upsert({
          id: userId,
          email,
          full_name: name,
          phone: phone || null,
          role: 'client',
          is_blocked: true,
        })
      }
    }
  } catch (err) {
    console.error('Auth-Fehler:', err)
  }

  if (!userId) return NextResponse.json({ ok: true })

  // Buchung mit Platzhalter-Datum anlegen (Termin wird vom Physio festgelegt)
  const treatmentId = TOPIC_TREATMENT[topic] ?? DEFAULT_TREATMENT
  const today = new Date().toISOString().slice(0, 10)
  const notes = `[ANFRAGE via Website]\nAnliegen: ${topic}\n\n${message}`

  try {
    await admin.from('bookings').insert({
      patient_id:        userId,
      treatment_type_id: treatmentId,
      requested_date:    today,
      requested_time:    '00:00:00',
      notes,
      status:            'pending',
    })
  } catch (err) {
    console.error('Buchung anlegen:', err)
  }

  return NextResponse.json({ ok: true })
}
