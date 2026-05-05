'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PhysioLogo from '@/components/PhysioLogo'
import { CheckCircle, AlertCircle, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isBlocked  = searchParams.get('blocked')  === '1'
  const confirmed  = searchParams.get('confirmed') === '1'
  const confirmErr = searchParams.get('error')     === 'confirmation_failed'

  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-Mail oder Passwort ist falsch.')
      setLoading(false)
      return
    }

    // Rolle prüfen: Patienten bleiben auf der Website
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'physio') {
      router.push('/dashboard')
      router.refresh()
    } else {
      // Patient → zurück zur Startseite
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] p-6 sm:p-8">
      <h2
        className="text-xl font-semibold text-[#2A2622] mb-6"
        style={{ fontFamily: '"Fraunces", Georgia, serif' }}
      >
        Anmelden
      </h2>

      {/* Status-Meldungen */}
      {isBlocked && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
          <Lock size={15} className="shrink-0 mt-0.5" />
          <span>
            Dein Konto ist noch gesperrt. Bitte warte, bis ein Administrator dich
            freischaltet.
          </span>
        </div>
      )}
      {confirmed && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={15} className="shrink-0" />
          E-Mail erfolgreich bestätigt. Du kannst dich jetzt anmelden.
        </div>
      )}
      {confirmErr && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          Bestätigungslink ungültig oder abgelaufen.
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="E-Mail"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="name@beispiel.ch"
        />
        <div>
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <div className="text-right mt-1">
            <Link
              href="/auth/forgot-password"
              className="text-xs text-[#4F7163] hover:underline"
            >
              Passwort vergessen?
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Anmelden
        </Button>
      </form>

      {/* Trennlinie */}
      <div className="my-6 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E1D6C2]" />
        </div>
        <div className="relative flex justify-center text-xs text-[#7A6E60]">
          <span className="bg-white px-3">oder</span>
        </div>
      </div>

      {/* Google Login */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#E1D6C2] rounded-lg text-sm font-medium text-[#2A2622] bg-white hover:bg-[#FBF7F1] transition-colors"
      >
        <GoogleIcon />
        Mit Google anmelden
      </button>

      <div className="mt-6 pt-6 border-t border-[#F4EDE2] text-center">
        <p className="text-sm text-[#7A6E60]">
          Noch kein Konto?{' '}
          <Link href="/auth/register" className="text-[#4F7163] font-medium hover:underline">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}

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

export default function LoginPage() {
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
      <Suspense
        fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] p-6 sm:p-8 h-64" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
