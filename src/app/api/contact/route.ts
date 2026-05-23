import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const { name, email, phone, topic, message, files } = await req.json()

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  const html = `
    <h2>Neue Kontaktanfrage – Physio Allmend</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;font-weight:bold;width:120px">Name</td><td style="padding:8px">${name}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">E-Mail</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold">Telefon</td><td style="padding:8px">${phone || '—'}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">Anliegen</td><td style="padding:8px">${topic}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">Nachricht</td><td style="padding:8px;white-space:pre-wrap">${message}</td></tr>
      ${files?.length ? `<tr><td style="padding:8px;font-weight:bold">Anhänge</td><td style="padding:8px">${files.join(', ')}</td></tr>` : ''}
    </table>
  `

  try {
    await transporter.sendMail({
      from: `"Physio Allmend Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `Anfrage von ${name} – ${topic}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('E-Mail Fehler:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
