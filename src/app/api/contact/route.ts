import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const fd = await req.formData()

  const name    = fd.get('name') as string
  const email   = fd.get('email') as string
  const phone   = fd.get('phone') as string
  const topic   = fd.get('topic') as string
  const message = fd.get('message') as string
  const fileEntries = fd.getAll('files') as File[]

  // ── 1. E-Mail senden ─────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  const html = `
    <h2 style="color:#2A2622;font-family:Georgia,serif">Neue Anfrage – Physio Allmend</h2>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60;width:120px">Name</td><td style="padding:8px 12px">${name}</td></tr>
      <tr style="background:#f9f6f1"><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">E-Mail</td><td style="padding:8px 12px"><a href="mailto:${email}" style="color:#6B8E7F">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">Telefon</td><td style="padding:8px 12px">${phone || '—'}</td></tr>
      <tr style="background:#f9f6f1"><td style="padding:8px 12px;font-weight:bold;color:#7A6E60">Anliegen</td><td style="padding:8px 12px">${topic}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold;color:#7A6E60;vertical-align:top">Nachricht</td><td style="padding:8px 12px;white-space:pre-wrap">${message}</td></tr>
    </table>
    <p style="margin-top:16px;font-size:12px;color:#aaa">Gesendet über physio-allmend.vercel.app</p>
  `

  const attachments = await Promise.all(
    fileEntries
      .filter(f => f.size > 0)
      .map(async f => ({
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
    // Weiter – Supabase-Einträge trotzdem erstellen
  }

  // ── 2. Supabase: Benutzer anlegen (gesperrt) + Anfrage speichern ──────────
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY fehlt – Benutzer/Anfrage nicht angelegt')
    return NextResponse.json({ ok: true })
  }

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  // Prüfen ob Benutzer mit dieser E-Mail schon existiert
  let userId: string | null = null
  try {
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existing = existingUsers?.users.find(u => u.email === email)

    if (existing) {
      userId = existing.id
    } else {
      // Neuen gesperrten Benutzer anlegen (kein Passwort, kein Login möglich)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name, phone },
      })
      if (createError) {
        console.error('Benutzer anlegen Fehler:', createError)
      } else {
        userId = newUser.user.id
        // Profil als gesperrt markieren
        await adminClient
          .from('profiles')
          .update({ is_blocked: true, phone: phone || null })
          .eq('id', userId)
      }
    }
  } catch (err) {
    console.error('Benutzer-Fehler:', err)
  }

  // Anfrage in contact_inquiries speichern
  try {
    await adminClient.from('contact_inquiries').insert({
      name,
      email,
      phone: phone || null,
      topic,
      message,
      user_id: userId,
      status: 'new',
    })
  } catch (err) {
    console.error('Anfrage speichern Fehler:', err)
  }

  return NextResponse.json({ ok: true })
}
