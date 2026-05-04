'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PhysioLogo from '@/components/PhysioLogo'
import { Clock } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function RegisterClient() {
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [registered, setRegistered] = useState(false)

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (signUpError) {
      setError(
        signUpError.message === 'User already registered'
          ? 'Diese E-Mail-Adresse ist bereits registriert.'
          : 'Fehler bei der Registrierung. Bitte versuche es erneut.'
      )
      setLoading(false)
      return
    }

    setRegistered(true)
    setLoading(false)
  }

  const header = (
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
  )

  if (registered) {
    return (
      <div className="w-full max-w-md">
        {header}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#C7D6CD] flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-[#4F7163]" />
          </div>
          <h2
            className="text-lg font-semibold text-[#2A2622] mb-2"
            style={{ fontFamily: '"Fraunces", Georgia, serif' }}
          >
            Konto erstellt
          </h2>
          <p className="text-sm text-[#4A4138] mb-3">
            Dein Konto wurde erfolgreich erstellt. Du bist jedoch noch{' '}
            <strong>gesperrt</strong> — eine Physiotherapeutin muss dich zuerst
            freischalten, bevor du das Portal nutzen kannst.
          </p>
          <p className="text-xs text-[#7A6E60] mb-6">
            Bitte melde dich direkt in der Praxis oder per E-Mail.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-sm font-medium text-[#4F7163] hover:underline"
          >
            Zurück zur Anmeldung →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {header}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] p-6 sm:p-8">
        <h2
          className="text-xl font-semibold text-[#2A2622] mb-6"
          style={{ fontFamily: '"Fraunces", Georgia, serif' }}
        >
          Registrieren
        </h2>

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="Vollständiger Name"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            placeholder="Maria Muster"
          />
          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="name@beispiel.ch"
          />
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Mindestens 8 Zeichen"
            helpText="Mindestens 8 Zeichen"
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="p-3 rounded-lg bg-[#FBF7F1] border border-[#E1D6C2] text-xs text-[#7A6E60]">
            Nach der Registrierung wird dein Konto von der Praxis manuell
            freigeschaltet. Du erhältst eine Benachrichtigung per E-Mail.
          </div>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Konto erstellen
          </Button>
        </form>

        <div className="my-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E1D6C2]" />
          </div>
          <div className="relative flex justify-center text-xs text-[#7A6E60]">
            <span className="bg-white px-3">oder</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#E1D6C2] rounded-lg text-sm font-medium text-[#2A2622] bg-white hover:bg-[#FBF7F1] transition-colors"
        >
          <GoogleIcon />
          Mit Google registrieren / anmelden
        </button>

        <div className="mt-6 pt-6 border-t border-[#F4EDE2] text-center">
          <p className="text-sm text-[#7A6E60]">
            Bereits ein Konto?{' '}
            <Link href="/auth/login" className="text-[#4F7163] font-medium hover:underline">
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
