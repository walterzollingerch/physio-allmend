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

export interface BusySlot {
  start: string  // HH:MM
  end: string    // HH:MM
  title: string
}

export async function getCalendarBusy(date: string): Promise<BusySlot[]> {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })

  const timeMin = new Date(`${date}T00:00:00+02:00`).toISOString()
  const timeMax = new Date(`${date}T23:59:59+02:00`).toISOString()

  const response = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'zollinger.baden@gmail.com',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = response.data.items ?? []
  return events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({
      start: new Date(e.start!.dateTime!).toLocaleTimeString('de-CH', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
      }),
      end: new Date(e.end!.dateTime!).toLocaleTimeString('de-CH', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
      }),
      title: e.summary ?? 'Belegt',
    }))
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

/**
 * Returns the set of Google Calendar event IDs that still exist
 * between fromDate and toDate (inclusive, YYYY-MM-DD).
 */
export async function getExistingEventIds(fromDate: string, toDate: string): Promise<Set<string>> {
  const auth = getOAuth2Client()
  const calendar = google.calendar({ version: 'v3', auth })

  const timeMin = new Date(`${fromDate}T00:00:00`).toISOString()
  const timeMax = new Date(`${toDate}T23:59:59`).toISOString()

  const response = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'zollinger.baden@gmail.com',
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 2500,
  })

  const ids = new Set<string>()
  for (const event of response.data.items ?? []) {
    if (event.id && event.status !== 'cancelled') ids.add(event.id)
  }
  return ids
}
