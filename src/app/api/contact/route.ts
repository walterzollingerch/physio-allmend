import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const { name, email, phone, topic, message, attachments } = await req.json()

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

  const mailAttachments = attachments?.map((a: { name: string; data: string; type: string }) => ({
    filename: a.name,
    content: Buffer.from(a.data, 'base64'),
    contentType: a.type,
  })) ?? []

  try {
    await transporter.sendMail({
      from: `"Physio Allmend Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `Anfrage von ${name} – ${topic}`,
      html,
      attachments: mailAttachments,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('E-Mail Fehler:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
