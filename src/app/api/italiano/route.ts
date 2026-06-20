import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: Request) {
  try {
    const { tenseName } = await request.json()

    if (!tenseName) {
      return NextResponse.json({ error: 'tenseName fehlt' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: `Du bist ein Experte für Italienisch. Erstelle genau 10 Übungsaufgaben für die Zeitform "${tenseName}".

Für jede Aufgabe:
- Ein alltäglicher deutscher Satz (kurz, max 10 Wörter, typische Alltagssituation)
- Genau 3 Übersetzungen auf Italienisch im ${tenseName} (1 korrekte + 2 falsche aber plausible)
- Den Index der korrekten Antwort (0, 1, oder 2) — variiere die Positionen über alle 10 Fragen
- Eine kurze grammatikalische Erklärung auf Deutsch (1-2 Sätze), warum die richtige Antwort korrekt ist und was an den falschen Optionen falsch ist (z.B. falsche Konjugation, falsche Zeitform, falsches Hilfsverb)

Die falschen Optionen sollen typische Lernfehler zeigen: falsche Verbkonjugation, falsche Zeitform, oder falsche Endung.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array, OHNE Markdown, OHNE Erklärungen:
[{"german": "...", "options": ["...", "...", "..."], "correctIndex": 0, "explanation": "..."}]`,
        },
      ],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Keine gültige Antwort vom Modell' }, { status: 500 })
    }

    const questions = JSON.parse(jsonMatch[0])

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Ungültige Fragen-Struktur' }, { status: 500 })
    }

    return NextResponse.json({ questions })
  } catch (e) {
    console.error('Italiano generate error:', e)
    return NextResponse.json({ error: 'Fehler beim Generieren der Übungen' }, { status: 500 })
  }
}
