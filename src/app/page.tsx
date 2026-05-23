'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhysioLogo, { Wordmark } from '@/components/PhysioLogo'
import { createClient } from '@/lib/supabase/client'

// ─── Data ──────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    tag: '01',
    name: 'Allgemeine Physiotherapie',
    body: 'Nach einer genauen Befundaufnahme mit anschließender Problemanalyse legen wir gemeinsam die Ziele für Ihre Behandlung fest. Mit einem individuell zusammengestellten Trainingsplan, Massagen und manueller Therapie versuchen wir gemeinsam an Ihrem Anliegen zu arbeiten. Bei Rückenschmerzen, nach Operationen, bei Sportverletzungen oder chronischen Beschwerden versuche ich, Sie bestmöglich zu unterstützen.',
    bullets: ['Befund & Diagnostik', 'Manuelle Therapie', 'Trainingstherapie', 'Nachsorge & Prävention'],
  },
  {
    tag: '02',
    name: 'Pilates Einzeltraining',
    body: 'Ich biete Pilates eins zu eins auf der Matte an für alle, die mit ihrem Körper gerne achtsam und genau arbeiten. Jede Stunde wird auf den Tag und die Tagesform abgestimmt. Individuelle Einschränkungen und Trainingsziele werden berücksichtigt.',
    bullets: ['Reformer & Matte', 'Individueller Plan', '60 Minuten', 'Auf Wunsch mit Therapie kombiniert'],
  },
]

const PRICING = [
  { name: 'Physiotherapie', duration: '25 Min', price: 'CHF 50.—' },
  { name: 'Massage', duration: '45 Min', price: 'CHF 90.—' },
  { name: 'Pilates Einzeltraining', duration: '45 Min', price: 'CHF 90.—' },
  { name: 'Pilates 2er-Gruppe', duration: '45 Min', price: 'CHF 45.—' },
  { name: 'Pilates 6er–9er-Gruppe', duration: '60 Min', price: 'CHF 28.—' },
]

const REVIEWS = [
  { name: 'Wolfgang Hoffelner', when: 'vor 8 Monaten', stars: 5, text: 'Ich bin 78 Jahre alt und hatte bei sportlichen Bewegungen wie Walken, Velofahren, Fitness und Golf immer wieder starke Schmerzen in meinem Bewegungsapparat (Piriformis, Rücken und Knie). Meine Hausärztin hat mir deshalb eine Physiotherapie empfohlen.' },
  { name: 'Myrtha Weber', when: 'vor 5 Jahren', stars: 5, text: 'Super Physiotherapie und Pilates. Karin erklärt immer alles sehr genau. Ich weiss nun über meinen Körper und wie unser System funktioniert. Seid ich Karin\'s Pilates besuche geht es meinem Rücken viel besser.' },
  { name: 'Daniela Bronner', when: 'vor 5 Jahren', stars: 5, text: 'Super zufrieden. Jahrelange, hartnäckige Schulterschmerzen sind bereits nach wenigen Sitzungen massiv zurückgegangen. Sehr freundliche und kompetente Therapeutin.' },
  { name: 'Martin Müller', when: 'vor 5 Jahren', stars: 5, text: 'Hier fühlt man sich ernst genommen! Sehr empfehlenswert...' },
  { name: 'Reto Bronner', when: 'vor 5 Jahren', stars: 5, text: 'Hart aber herzlich, Profi durch und durch!' },
]

const MAPS_URL = 'https://www.google.com/maps/place/Physio+Allmend+%2FPilates/@47.4738674,8.2950277,627m/data=!3m2!1e3!4b1!4m6!3m5!1s0x47906d5649bd7e93:0x144d3715b94d6c5b!8m2!3d47.4738674!4d8.2976026!16s%2Fg%2F11px8x9dwz?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D'

// ─── Components ─────────────────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-wide">
      <span style={{ color: '#6B8E7F' }}>{'★'.repeat(n)}</span>
      <span className="text-[#C7D6CD]">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase text-[#6B8E7F] mb-3">{children}</p>
  )
}

function Heading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-3xl sm:text-4xl font-light text-[#2A2622] leading-tight ${className}`}
      style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
      {children}
    </h2>
  )
}

// ─── Nav ────────────────────────────────────────────────────────────────────

type AuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'patient'; name: string }
  | { status: 'staff' }   // admin or physio → Dashboard

function Nav() {
  const [open, setOpen]       = useState(false)
  const [auth, setAuth]       = useState<AuthState>({ status: 'loading' })
  const router                = useRouter()
  const supabase              = createClient()

  useEffect(() => {
    async function loadAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuth({ status: 'guest' }); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!profile) { setAuth({ status: 'guest' }); return }

      if (profile.role === 'admin' || profile.role === 'physio') {
        setAuth({ status: 'staff' })
      } else {
        setAuth({ status: 'patient', name: profile.full_name ?? user.email ?? 'Patient' })
      }
    }
    loadAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const links = [
    ['#ueber', 'Über mich'],
    ['#leistungen', 'Leistungen'],
    ['#preise', 'Preise'],
    ['#stimmen', 'Stimmen'],
    ['#anfahrt', 'Anfahrt'],
    ['#kontakt', 'Kontakt'],
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#E1D6C2]">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        <a href="#top" aria-label="Zur Startseite"><Wordmark size={36} /></a>
        <nav className="hidden md:flex items-center gap-5 ml-4 flex-1">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-sm text-[#4A4138] hover:text-[#6B8E7F] transition-colors">{label}</a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* ── Rechts-Bereich je nach Auth-Status ── */}
          {auth.status === 'loading' && (
            <div className="w-24 h-8 bg-[#F4EDE2] rounded-lg animate-pulse" />
          )}

          {auth.status === 'guest' && (
            <Link
              href="/auth/login"
              className="text-sm font-medium border border-[#6B8E7F] text-[#6B8E7F] hover:bg-[#6B8E7F] hover:text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Anmelden
            </Link>
          )}

          {auth.status === 'staff' && (
            <Link
              href="/dashboard"
              className="text-sm font-medium border border-[#6B8E7F] text-[#6B8E7F] hover:bg-[#6B8E7F] hover:text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          )}

          {auth.status === 'patient' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#4A4138] hidden sm:block">
                {auth.name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-[#7A6E60] border border-[#E1D6C2] px-3 py-1.5 rounded-lg hover:bg-[#F7F2EC] transition-colors"
              >
                Abmelden
              </button>
            </div>
          )}

          <a
            href="#kontakt"
            className="text-sm bg-[#6B8E7F] text-white px-4 py-1.5 rounded-lg hover:bg-[#4F7163] transition-colors font-medium"
          >
            Termin anfragen
          </a>

          <button className="md:hidden p-1.5 text-[#4A4138]" onClick={() => setOpen(o => !o)} aria-label="Menü">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <path d="M6 6l12 12M6 18L18 6" />
                : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile-Menü */}
      {open && (
        <div className="md:hidden border-t border-[#E1D6C2] bg-white px-4 pb-4">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-[#4A4138] border-b border-[#F4EDE2] last:border-0">
              {label}
            </a>
          ))}
          {auth.status === 'guest' && (
            <Link href="/auth/login" className="block mt-3 text-sm font-medium text-[#4F7163]">
              → Anmelden
            </Link>
          )}
          {auth.status === 'staff' && (
            <Link href="/dashboard" className="block mt-3 text-sm font-medium text-[#4F7163]">
              → Dashboard
            </Link>
          )}
          {auth.status === 'patient' && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[#4A4138]">{auth.name}</span>
              <button onClick={handleSignOut} className="text-sm text-[#7A6E60] hover:text-red-600">
                Abmelden
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section id="top" className="bg-[#FBF7F1] py-16 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <SectionLabel>Physiotherapie · Pilates · Baden AG</SectionLabel>
          <h1 className="text-4xl sm:text-5xl font-light text-[#2A2622] leading-tight mb-5"
            style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
            Bewegung,<br />klar und persönlich.
          </h1>
          <p className="text-[#4A4138] leading-relaxed mb-8">
            Eine kleine Praxis in der ruhigen Allmend in Baden. Klassische Physiotherapie und Pilates im Einzeltraining — mit Zeit, Aufmerksamkeit und einem klaren Plan.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <a href="#kontakt"
              className="inline-flex items-center gap-2 bg-[#6B8E7F] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#4F7163] transition-colors">
              Termin anfragen →
            </a>
            <a href="#ueber"
              className="inline-flex items-center gap-2 border border-[#C7D6CD] text-[#4A4138] px-6 py-3 rounded-xl font-medium hover:border-[#6B8E7F] hover:text-[#2A2622] transition-colors">
              Mehr erfahren
            </a>
          </div>
          <ul className="space-y-1.5">
            {['Direktzugang ohne Verordnung', 'Anerkannt von allen Krankenkassen', 'Sitzungen 30–45 Minuten'].map(m => (
              <li key={m} className="flex items-center gap-2 text-sm text-[#7A6E60]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6B8E7F] shrink-0" />
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="rounded-2xl overflow-hidden aspect-[4/5] flex items-end p-5">
            <img src="/praxis.jpg" alt="Behandlungsraum Physio Allmend" className="absolute inset-0 w-full h-full object-cover" />
            <div className="relative z-10 bg-white/90 backdrop-blur rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#6B8E7F] animate-pulse" />
              <span className="text-sm font-medium text-[#2A2622]">Baden AG</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── About ──────────────────────────────────────────────────────────────────

function About() {
  return (
    <section id="ueber" className="py-16 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div className="rounded-2xl overflow-hidden aspect-[3/4] order-last md:order-first">
          <img src="/portrait.jpg" alt="Karin Zollinger, Physiotherapeutin" className="w-full h-full object-cover object-top" />
        </div>
        <div>
          <SectionLabel>Über mich</SectionLabel>
          <p className="text-[#4A4138] leading-relaxed mb-4">
            Mein Name ist Karin Zollinger. Ich begleite Menschen zurück in ihre Bewegung — nach Verletzungen, Operationen, oder einfach nach zu vielen Stunden am Schreibtisch. Ich arbeite in einem ruhigen Raum in persönlicher Atmosphäre.
          </p>
          <p className="text-[#4A4138] leading-relaxed mb-8">
            Pilates kam später dazu, als logische Fortsetzung der Therapie. Was in der Praxis beginnt, soll im Alltag tragen. Viele Menschen tun sich schwer dabei, selbständig in Eigendisziplin weiter zu trainieren. Pilates Einzel- oder Gruppenstunden können eine Unterstützung dabei sein, die Kraft und Beweglichkeit, welche man in der Therapie erworben hat, zu erhalten oder weiter auszubauen.
          </p>
          <div className="border-t border-[#E1D6C2] pt-6 mb-6">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#7A6E60] mb-3">Ausbildungen</p>
            <ul className="space-y-1.5">
              {[
                'Manuelle Therapie nach Samt',
                'Analytische Biomechanik und Behandlungskonzept nach Raymond Sohier',
                'Mobilisation des Nervensystems NOI',
                'Kinetic Control – Muscle Balance (LWS, Nacken, Schulter und Untere Extremität)',
                'Manuelle Triggerpunkt Therapie IMTT®',
                'Lymphologische Entstauungstherapie',
                'Therapeutisches Yoga',
                'Kinesiotap Kurs',
                'Krafttraining Ü65',
                'Polestar® Pilates',
                'Spiraldynamik Basic Med',
              ].map(c => (
                <li key={c} className="text-sm text-[#4A4138] flex items-start gap-2">
                  <span className="text-[#6B8E7F] mt-0.5 shrink-0">—</span> {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-[#E1D6C2] pt-6">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#7A6E60] mb-3">Werdegang</p>
            <ul className="space-y-2">
              {[
                ['1999–2003', 'Physiotherapie Ausbildung im Unispital Basel'],
                ['2004–2007', 'Physiotherapeutin im Kantonsspital Aarau'],
                ['2007–2009', 'Leitung des physiotherapeutischen Teams der Intensivstationen'],
                ['2009–2010', 'Geburt meiner Zwillinge'],
                ['2010–2014', 'Selbständige Physiotherapeutin in der Praxis Egli.Hug'],
                ['2014', 'Eröffnung Praxis Physio Allmend'],
              ].map(([year, desc]) => (
                <li key={year} className="text-sm text-[#4A4138] flex items-start gap-3">
                  <span className="text-[#6B8E7F] font-mono shrink-0 w-20">{year}</span>
                  <span>{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Services ───────────────────────────────────────────────────────────────

function Services() {
  return (
    <section id="leistungen" className="py-16 sm:py-24 bg-[#FBF7F1]">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-12">
          <SectionLabel>Leistungen</SectionLabel>
          <Heading>Zwei Angebote.<br />Verbunden, nicht vermischt.</Heading>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {SERVICES.map(s => (
            <div key={s.tag} className="bg-white rounded-2xl border border-[#E1D6C2] p-7">
              <span className="text-xs font-semibold text-[#6B8E7F] tracking-widest">{s.tag}</span>
              <h3 className="text-xl font-semibold text-[#2A2622] mt-2 mb-3"
                style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
                {s.name}
              </h3>
              <p className="text-sm text-[#4A4138] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="preise" className="py-16 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-10">
          <SectionLabel>Preise</SectionLabel>
        </div>
        <div className="space-y-0 border border-[#E1D6C2] rounded-2xl overflow-hidden mb-8">
          {PRICING.map((it, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[#F4EDE2] last:border-0 bg-white hover:bg-[#FBF7F1] transition-colors">
              <div className="flex-1">
                <span className="font-medium text-[#2A2622] text-sm">{it.name}</span>
                <span className="ml-3 text-xs text-[#7A6E60]">{it.duration}</span>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-[#2A2622]">{it.price}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm text-[#4A4138]">
          <p>Die Physiotherapie wird nach ärztlicher Verordnung über die Grundversicherung bezahlt.</p>
          <p>Für die Massage habe ich eine Anerkennung beim EMR. Bitte fragen Sie bei Ihrer Krankenkasse nach, wie sich Ihre Kasse anteilsmäßig beteiligt.</p>
          <p>Auch an den Pilatesstunden beteiligen sich einige Krankenkassen mit der Zusatzversicherung.</p>
          <p className="text-[#7A6E60]">Absagen bitte mindestens 24 Stunden im Voraus, ansonsten kann der volle Betrag verrechnet werden.</p>
        </div>
      </div>
    </section>
  )
}

// ─── Reviews ────────────────────────────────────────────────────────────────

function Reviews() {
  return (
    <section id="stimmen" className="py-16 sm:py-24 bg-[#FBF7F1]">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end gap-6 justify-between">
          <div>
            <SectionLabel>Stimmen</SectionLabel>
            <Heading>Was Patientinnen sagen.</Heading>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl mb-0.5"><Stars n={5} /></div>
            <div className="font-semibold text-[#2A2622]">5,0 von 5</div>
            <div className="text-xs text-[#7A6E60]">basierend auf 5 Google-Rezensionen</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEWS.map((r, i) => (
            <article key={i} className="bg-white rounded-2xl border border-[#E1D6C2] p-5">
              <div className="mb-3"><Stars n={r.stars} /></div>
              <p className="text-sm text-[#4A4138] leading-relaxed mb-4 italic">&ldquo;{r.text}&rdquo;</p>
              <footer className="flex items-center gap-2 pt-3 border-t border-[#F4EDE2]">
                <span className="w-7 h-7 rounded-full bg-[#C7D6CD]/60 flex items-center justify-center text-xs font-semibold text-[#4F7163]">
                  {r.name.split(' ').map(p => p[0]).join('')}
                </span>
                <span className="text-sm font-medium text-[#2A2622]">{r.name}</span>
                <span className="text-xs text-[#7A6E60] ml-auto">{r.when}</span>
              </footer>
            </article>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <a
            href="https://www.google.ch/maps/place/Physio+Allmend+%2FPilates/@47.4738674,8.2950277,627m/data=!3m1!1e3!4m8!3m7!1s0x47906d5649bd7e93:0x144d3715b94d6c5b!8m2!3d47.4738674!4d8.2976026!9m1!1b1!16s%2Fg%2F11px8x9dwz?entry=ttu&g_ep=EgoyMDI2MDUyMC4wIKXMDSoASAFQAw%3D%3D#:~:text=%EE%95%A0-,Rezension,-schreiben"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-[#6B8E7F] text-[#6B8E7F] hover:bg-[#6B8E7F] hover:text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Bewertung schreiben
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Location ───────────────────────────────────────────────────────────────

function Location() {
  return (
    <section id="anfahrt" className="py-16 sm:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <SectionLabel>Anfahrt</SectionLabel>
          <Heading className="mb-6">Physio Allmend –<br />mitten in Baden.</Heading>
          <address className="not-italic mb-6">
            <div className="text-[#2A2622] font-medium">Allmendstrasse 10</div>
            <div className="text-[#7A6E60]">5400 Baden</div>
          </address>
          <div className="space-y-2 mb-6">
            {[
              ['Mo – Do', '08:15 – 14:30'],
              ['Freitag', 'Geschlossen'],
              ['Samstag', 'Geschlossen'],
              ['Sonntag', 'Geschlossen'],
            ].map(([d, h]) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-[#7A6E60]">{d}</span>
                <span className="flex-1 border-t border-dashed border-[#E1D6C2]" />
                <span className="text-[#2A2622]">{h}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#7A6E60]">
            Gut erreichbar mit öffentlichem Verkehr ab Bahnhof Baden mit der Buslinie 5 in Richtung Baldegg bis Bushaltestelle Birkenweg. Gratis Parkplätze direkt vor der Praxis.
          </p>
        </div>
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden border border-[#E1D6C2] hover:border-[#6B8E7F] transition-colors group">
          <svg viewBox="0 0 600 400" className="w-full" style={{ background: '#EEE8DC' }}>
            <g stroke="#D4C9B5" strokeWidth="1" fill="none" opacity="0.8">
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50 + 80} y2="400" />
              ))}
              {Array.from({ length: 9 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 50} x2="600" y2={i * 50 + 20} />
              ))}
            </g>
            <path d="M-20 300 C 120 260, 220 320, 340 280 S 540 300, 640 260" fill="none" stroke="#C7D6CD" strokeWidth="22" strokeLinecap="round" />
            <path d="M40 60 L 330 170 L 530 380" fill="none" stroke="white" strokeWidth="12" />
            <path d="M40 60 L 330 170 L 530 380" fill="none" stroke="#B5A99A" strokeWidth="1" strokeDasharray="6 6" />
            <g transform="translate(320 165)">
              <circle r="30" fill="#6B8E7F" opacity="0.18" />
              <circle r="17" fill="#6B8E7F" opacity="0.32" />
              <circle r="7" fill="#6B8E7F" stroke="white" strokeWidth="3" />
            </g>
            <g transform="translate(350 155)">
              <rect x="0" y="-13" width="150" height="26" rx="13" fill="white" stroke="#E1D6C2" />
              <text x="75" y="5" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="#2A2622" fontWeight="500">Allmendstrasse 10</text>
            </g>
          </svg>
          <div className="px-4 py-3 bg-white border-t border-[#E1D6C2] text-sm text-[#6B8E7F] group-hover:text-[#4F7163] transition-colors">
            In Google Maps öffnen →
          </div>
        </a>
      </div>
    </section>
  )
}

// ─── Contact ────────────────────────────────────────────────────────────────

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: 'Physiotherapie', message: '', consent: false })
  const [files, setFiles] = useState<FileList | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setForm(f => ({ ...f, [k]: v }))
  }
  const blur = (k: string) => () => setTouched(s => ({ ...s, [k]: true }))
  const validate = () => {
    const e: Record<string, boolean> = {}
    if (!form.name.trim()) e.name = true
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = true
    if (!form.message.trim() || form.message.trim().length < 10) e.message = true
    if (!form.consent) e.consent = true
    return e
  }
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    setTouched({ name: true, email: true, message: true, consent: true })
    if (Object.keys(errs).length > 0) return
    setSending(true)
    setSendError(false)
    try {
      // Dateien als Base64 einlesen
      const attachments = files
        ? await Promise.all(Array.from(files).map(f => new Promise<{ name: string; data: string; type: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ name: f.name, data: (reader.result as string).split(',')[1], type: f.type })
            reader.onerror = reject
            reader.readAsDataURL(f)
          })))
        : []

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          topic: form.topic,
          message: form.message,
          attachments,
        }),
      })
      if (res.ok) setSubmitted(true)
      else setSendError(true)
    } catch {
      setSendError(true)
    } finally {
      setSending(false)
    }
  }
  const err = (k: string) => touched[k] && errors[k]

  if (submitted) {
    return (
      <section id="kontakt" className="py-16 sm:py-24 bg-[#FBF7F1]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#6B8E7F] mb-6">
            <svg viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="#6B8E7F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 25l7 7 13-15" />
            </svg>
          </div>
          <Heading className="mb-3">Danke — Ihre Nachricht ist angekommen.</Heading>
          <p className="text-[#7A6E60] mb-6">Ich melde mich innerhalb eines Werktags. Bei dringenden Anliegen erreichen Sie mich telefonisch.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <a href="tel:+41763689144" className="text-[#4F7163] hover:underline">076 368 91 44</a>
            <span className="text-[#C7D6CD]">·</span>
            <a href="mailto:zollinger.baden@gmail.com" className="text-[#4F7163] hover:underline">zollinger.baden@gmail.com</a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="kontakt" className="py-16 sm:py-24 bg-[#FBF7F1]">
      <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <SectionLabel>Kontakt</SectionLabel>
          <Heading className="mb-4">Schreiben Sie mir.</Heading>
          <p className="text-[#4A4138] leading-relaxed mb-8">
            Termine vergebe ich persönlich. Schicken Sie mir ein paar Worte zu Ihrem Anliegen — ich melde mich innerhalb eines Werktags zurück.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-16 text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">Mobile</span>
              <a href="tel:+41763689144" className="text-[#2A2622] hover:text-[#6B8E7F] transition-colors">076 368 91 44</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-16 text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">Festnetz</span>
              <a href="tel:+41565552314" className="text-[#2A2622] hover:text-[#6B8E7F] transition-colors">056 555 23 14</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-16 text-xs font-semibold text-[#7A6E60] uppercase tracking-wide">Mail</span>
              <a href="mailto:zollinger.baden@gmail.com" className="text-[#2A2622] hover:text-[#6B8E7F] transition-colors">zollinger.baden@gmail.com</a>
            </div>
          </div>
          <div className="mt-8">
            <img src="/wartestuhl.jpg" alt="Wartebereich Physio Allmend" className="rounded-2xl w-full object-contain" />
          </div>
          <div className="mt-8 pt-8 border-t border-[#E1D6C2]">
            <p className="text-sm text-[#7A6E60] mb-3">Bereits Patient? Termin direkt im Portal buchen:</p>
            <Link href="/auth/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4F7163] hover:text-[#2A2622] transition-colors">
              → Zum Patientenportal
            </Link>
          </div>
        </div>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <FieldWrap label="Name" error={err('name')}>
              <input type="text" value={form.name} onChange={set('name')} onBlur={blur('name')}
                placeholder="Vor- und Nachname" required
                className={fieldCls(err('name'))} />
            </FieldWrap>
            <FieldWrap label="E-Mail" error={err('email')}>
              <input type="email" value={form.email} onChange={set('email')} onBlur={blur('email')}
                placeholder="name@beispiel.ch" required
                className={fieldCls(err('email'))} />
            </FieldWrap>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FieldWrap label="Telefon (optional)">
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+41 …"
                className={fieldCls(false)} />
            </FieldWrap>
            <FieldWrap label="Anliegen">
              <select value={form.topic} onChange={set('topic')} className={fieldCls(false)}>
                {['Physiotherapie', 'Pilates Einzeltraining', 'Frage zu Preisen / Versicherung', 'Anderes'].map(o => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </FieldWrap>
          </div>
          <FieldWrap label="Nachricht" error={err('message')}>
            <textarea rows={5} value={form.message} onChange={set('message')} onBlur={blur('message')}
              placeholder="Worum geht es? Seit wann? Was haben Sie schon probiert?" required
              className={fieldCls(err('message'))} />
          </FieldWrap>
          <div>
            <span className="block text-xs font-medium text-[#7A6E60] mb-1">Anhänge (optional)</span>
            <label className="flex flex-col items-center justify-center w-full border border-dashed border-[#C7D6CD] rounded-lg px-4 py-5 cursor-pointer bg-white hover:bg-[#FBF7F1] transition-colors text-center">
              <svg className="w-6 h-6 text-[#6B8E7F] mb-2" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8.5 7.5M12 4l3.5 3.5" />
              </svg>
              <span className="text-sm text-[#4A4138]">
                {files && files.length > 0
                  ? Array.from(files).map(f => f.name).join(', ')
                  : 'Verordnung, Berichte oder Bilder hochladen'}
              </span>
              <span className="text-xs text-[#7A6E60] mt-1">PDF, JPG, PNG – max. 10 MB pro Datei</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => setFiles(e.target.files)} />
            </label>
          </div>
          <label className={`flex items-start gap-2.5 cursor-pointer ${err('consent') ? 'text-red-600' : 'text-[#7A6E60]'}`}>
            <input type="checkbox" checked={form.consent} onChange={set('consent')}
              className="mt-0.5 accent-[#6B8E7F]" />
            <span className="text-xs leading-relaxed">
              Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden.
            </span>
          </label>
          {sendError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              Fehler beim Senden. Bitte versuchen Sie es erneut oder schreiben Sie direkt an zollinger.baden@gmail.com.
            </p>
          )}
          <button type="submit" disabled={sending}
            className="w-full bg-[#6B8E7F] text-white py-3 rounded-xl font-medium hover:bg-[#4F7163] transition-colors disabled:opacity-60">
            {sending ? 'Wird gesendet…' : 'Anfrage senden →'}
          </button>
        </form>
      </div>
    </section>
  )
}

function fieldCls(hasError: boolean | undefined) {
  return `w-full px-3 py-2.5 rounded-lg border text-sm text-[#2A2622] bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8E7F]/30 transition-colors ${hasError ? 'border-red-400' : 'border-[#E1D6C2] hover:border-[#C7D6CD]'}`
}
function FieldWrap({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`block text-xs font-medium mb-1 ${error ? 'text-red-600' : 'text-[#7A6E60]'}`}>{label}</span>
      {children}
    </label>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#2A2622] text-[#C7B99A] py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid sm:grid-cols-3 gap-8 pb-8 border-b border-white/10">
          <div>
            <div className="mb-3">
              <Wordmark size={32} inverted />
            </div>
            <p className="text-xs leading-relaxed">Eine kleine Praxis. Mit Zeit für eine Person.</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-white mb-3">Seite</p>
            <ul className="space-y-2 text-xs">
              {[['#ueber', 'Über mich'], ['#leistungen', 'Leistungen'], ['#preise', 'Preise'], ['#stimmen', 'Stimmen']].map(([h, l]) => (
                <li key={h}><a href={h} className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-white mb-3">Kontakt</p>
            <ul className="space-y-2 text-xs">
              <li>Allmendstrasse 10, 5400 Baden</li>
              <li><a href="tel:+41565552314" className="hover:text-white transition-colors">056 555 23 14</a></li>
              <li><a href="mailto:zollinger.baden@gmail.com" className="hover:text-white transition-colors">zollinger.baden@gmail.com</a></li>
              <li className="pt-1">
                <Link href="/auth/login" className="hover:text-white transition-colors">→ Patientenportal</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-6 text-xs">
          <span>© 2026 Physio Allmend · Karin Zollinger</span>
          <span>Made with care.</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <Services />
        <Pricing />
        <Reviews />
        <Location />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
