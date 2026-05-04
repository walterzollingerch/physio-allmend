import { google } from 'googleapis'

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_SITE_URL + '/api/google/callback'
  )
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  return client
}

export interface CalendarEventInput {
  title: string
  description?: string
  date: string       // YYYY-MM-DD
  time: string       // HH:MM
  durationMin: number
  patientName: string
  patientEmail: string
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string> {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })

  const startDateTime = new Date(`${input.date}T${input.time}:00`)
  const endDateTime = new Date(startDateTime.getTime() + input.durationMin * 60 * 1000)

  const event = {
    summary: `${input.title} – ${input.patientName}`,
    description: input.description ?? '',
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Europe/Zurich',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Europe/Zurich',
    },
    attendees: [
      { email: input.patientEmail, displayName: input.patientName },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 * 24 },  // 1 Tag vorher
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'zollinger.baden@gmail.com',
    requestBody: event,
    sendUpdates: 'all', // Einladung an Patient senden
  })

  return response.data.id ?? ''
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })

  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'zollinger.baden@gmail.com',
    eventId,
    sendUpdates: 'all',
  })
}
