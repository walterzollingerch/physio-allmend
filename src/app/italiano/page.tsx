'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'

type Question = {
  german: string
  options: string[]
  correctIndex: number
}

type Phase = 'start' | 'loading' | 'quiz' | 'result'

const TENSES = [
  { id: 'Presente', label: 'Presente', sub: 'Gegenwart', example: 'io mangio' },
  { id: 'Passato Prossimo', label: 'Passato Prossimo', sub: 'Perfekt', example: 'ho mangiato' },
  { id: 'Imperfetto', label: 'Imperfetto', sub: 'Imperfekt', example: 'mangiavo' },
  { id: 'Futuro Semplice', label: 'Futuro Semplice', sub: 'Zukunft', example: 'mangerò' },
  { id: 'Condizionale Presente', label: 'Condizionale', sub: 'Konditional', example: 'mangerei' },
  { id: 'Congiuntivo Presente', label: 'Congiuntivo', sub: 'Konjunktiv', example: 'che mangi' },
  { id: 'Passato Remoto', label: 'Passato Remoto', sub: 'Hist. Präteritum', example: 'mangiai' },
]

const GREEN = '#009246'
const RED = '#CE2B37'

export default function ItalianoPage() {
  const [phase, setPhase] = useState<Phase>('start')
  const [selectedTense, setSelectedTense] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [chosen, setChosen] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tenseLabel = TENSES.find((t) => t.id === selectedTense)?.label ?? selectedTense

  const startQuiz = async () => {
    if (!selectedTense) return
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch('/api/italiano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenseName: selectedTense }),
      })
      if (!res.ok) throw new Error('Serverfehler')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQuestions(data.questions)
      setAnswers(new Array(data.questions.length).fill(null))
      setCurrent(0)
      setChosen(null)
      setPhase('quiz')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      setPhase('start')
    }
  }

  const handleChoice = (idx: number) => {
    if (chosen !== null) return
    setChosen(idx)
    const updated = [...answers]
    updated[current] = idx
    setAnswers(updated)
  }

  const nextQuestion = () => {
    if (current + 1 >= questions.length) {
      setPhase('result')
    } else {
      setCurrent((c) => c + 1)
      setChosen(null)
    }
  }

  const score = answers.filter((a, i) => a === questions[i]?.correctIndex).length

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#FBF7F1] flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🇮🇹</div>
        <p className="text-[#7A6E60] text-lg">Generiere Übungen…</p>
      </div>
    )
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-[#FBF7F1] py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-[#7A6E60] hover:text-[#2A2622] transition-colors"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>
          </div>

          <header className="text-center mb-10">
            <div className="text-5xl mb-3">🇮🇹</div>
            <h1
              className="text-3xl font-light text-[#2A2622]"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              Italiano Trainer
            </h1>
            <p className="text-[#7A6E60] mt-2">Wähle eine Zeitform und übe dein Italienisch</p>
          </header>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {TENSES.map((tense) => (
              <button
                key={tense.id}
                onClick={() => setSelectedTense(tense.id)}
                className={clsx(
                  'text-left p-4 rounded-xl border-2 transition-all duration-150 bg-white',
                  selectedTense === tense.id
                    ? 'shadow-sm'
                    : 'border-[#E1D6C2] hover:border-[#6B8E7F]'
                )}
                style={
                  selectedTense === tense.id
                    ? { borderColor: GREEN, background: '#f0faf4' }
                    : undefined
                }
              >
                <div className="font-semibold text-[#2A2622]">{tense.label}</div>
                <div className="text-sm text-[#7A6E60]">{tense.sub}</div>
                <div className="text-xs text-[#9ca3af] mt-1 italic">{tense.example}</div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={startQuiz}
              disabled={!selectedTense}
              className={clsx(
                'px-10 py-3 rounded-xl font-semibold text-white text-lg transition-all duration-150',
                selectedTense ? 'shadow-md hover:opacity-90' : 'opacity-40 cursor-not-allowed'
              )}
              style={{ background: selectedTense ? GREEN : '#9ca3af' }}
            >
              Quiz starten →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (phase === 'quiz') {
    const q = questions[current]
    const isAnswered = chosen !== null
    const progress = ((current + (isAnswered ? 1 : 0)) / questions.length) * 100

    return (
      <div className="min-h-screen bg-[#FBF7F1] py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#7A6E60]">{tenseLabel}</span>
            <span className="text-sm font-semibold text-[#4A4138]">
              {current + 1} / {questions.length}
            </span>
          </div>

          <div className="w-full bg-[#E1D6C2] rounded-full h-1.5 mb-8">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: GREEN }}
            />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E1D6C2] mb-5">
            <p className="text-xs text-[#7A6E60] uppercase tracking-widest mb-2">
              Übersetze auf Italienisch
            </p>
            <p className="text-xl font-semibold text-[#2A2622] leading-snug">{q.german}</p>
          </div>

          <div className="space-y-3 mb-6">
            {q.options.map((opt, idx) => {
              const isCorrect = idx === q.correctIndex
              const isChosen = idx === chosen

              let borderColor = '#E1D6C2'
              let bgColor = 'white'
              let textColor = '#2A2622'
              let opacity = '1'

              if (isAnswered) {
                if (isCorrect) {
                  borderColor = GREEN
                  bgColor = '#f0faf4'
                  textColor = '#166534'
                } else if (isChosen) {
                  borderColor = RED
                  bgColor = '#fff5f5'
                  textColor = '#991b1b'
                } else {
                  textColor = '#9ca3af'
                  opacity = '0.6'
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleChoice(idx)}
                  disabled={isAnswered}
                  className="w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-150 font-medium flex items-center justify-between"
                  style={{
                    borderColor,
                    background: bgColor,
                    color: textColor,
                    opacity,
                    cursor: isAnswered ? 'default' : 'pointer',
                  }}
                >
                  <span>
                    <span className="mr-3 text-sm font-bold opacity-50">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </span>
                  {isAnswered && isCorrect && <span>✓</span>}
                  {isAnswered && isChosen && !isCorrect && <span>✗</span>}
                </button>
              )
            })}
          </div>

          {isAnswered && (
            <div className="flex flex-col items-center gap-3">
              <p
                className="text-sm font-semibold"
                style={{ color: chosen === q.correctIndex ? GREEN : RED }}
              >
                {chosen === q.correctIndex
                  ? 'Richtig! 🎉'
                  : `Falsch — richtig wäre: ${q.options[q.correctIndex]}`}
              </p>
              <button
                onClick={nextQuestion}
                className="px-8 py-3 rounded-xl font-semibold text-white shadow-md hover:opacity-90 transition-all"
                style={{ background: GREEN }}
              >
                {current + 1 >= questions.length ? 'Ergebnisse anzeigen' : 'Weiter →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const pct = Math.round((score / questions.length) * 100)
  const barColor = pct >= 80 ? GREEN : pct >= 50 ? '#f59e0b' : RED
  const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'

  return (
    <div className="min-h-screen bg-[#FBF7F1] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E1D6C2] text-center mb-5">
          <div className="text-5xl mb-3">{emoji}</div>
          <h2 className="text-2xl font-bold text-[#2A2622] mb-1">
            {score} von {questions.length} richtig
          </h2>
          <p className="text-[#7A6E60] text-sm">{tenseLabel}</p>

          <div className="w-full bg-[#F4EDE2] rounded-full h-2.5 mt-5">
            <div
              className="h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <p className="text-xs text-[#7A6E60] mt-2">{pct} % korrekt</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E1D6C2] overflow-hidden mb-5">
          {questions.map((q, i) => {
            const userAnswer = answers[i]
            const correct = userAnswer === q.correctIndex
            return (
              <div
                key={i}
                className={clsx(
                  'p-4 border-b border-[#F4EDE2] last:border-b-0',
                  correct ? 'bg-green-50/40' : 'bg-red-50/40'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0">{correct ? '✅' : '❌'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#2A2622] mb-1">{q.german}</p>
                    <p className="text-xs" style={{ color: GREEN }}>
                      ✓ {q.options[q.correctIndex]}
                    </p>
                    {!correct && userAnswer !== null && (
                      <p className="text-xs mt-0.5" style={{ color: RED }}>
                        ✗ {q.options[userAnswer]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={startQuiz}
            className="flex-1 py-3 rounded-xl font-semibold text-white shadow-md hover:opacity-90 transition-all"
            style={{ background: GREEN }}
          >
            Nochmal üben
          </button>
          <button
            onClick={() => {
              setPhase('start')
              setSelectedTense('')
              setQuestions([])
              setAnswers([])
              setCurrent(0)
              setChosen(null)
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-[#4A4138] bg-white border-2 border-[#E1D6C2] hover:border-[#6B8E7F] transition-all"
          >
            Andere Zeitform
          </button>
        </div>
      </div>
    </div>
  )
}
