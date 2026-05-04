'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PhysioLogo from '@/components/PhysioLogo'
import { CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError('Fehler beim Senden. Bitte versuche es erneut.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <PhysioLogo size={64} />
        <h1
          className="mt-4 text-2xl font-light text-[#2A2622]"
          style={{ fontFamily: '"Fraunces", Georgia, serif' }}
        >
          Physio Allmend
        </h1>
        <p className="text-[#7A6E60] text-sm mt-1">Patientenportal · Birmensdorf ZH</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] p-6 sm:p-8">
        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <h2
              className="text-lg font-semibold text-[#2A2622] mb-2"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              E-Mail gesendet
            </h2>
            <p className="text-sm text-[#4A4138] mb-6">
              Falls diese E-Mail registriert ist, erhältst du in Kürze einen
              Link zum Zurücksetzen deines Passworts.
            </p>
            <Link href="/auth/login" className="text-sm font-medium text-[#4F7163] hover:underline">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
            <h2
              className="text-xl font-semibold text-[#2A2622] mb-2"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              Passwort zurücksetzen
            </h2>
            <p className="text-sm text-[#7A6E60] mb-6">
              Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum
              Zurücksetzen.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="E-Mail"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="name@beispiel.ch"
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Link senden
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/auth/login" className="text-sm text-[#4F7163] hover:underline">
                ← Zurück zur Anmeldung
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
