// Client Google OAuth + Calendar — SERVEUR UNIQUEMENT (jetons, secret).
// Fetch brut vers les endpoints Google : pas de dépendance à installer.
// CRM → Google : create/update/delete d'événements.
// Google → CRM : lecture des créneaux « occupé » (freeBusy), fenêtre 90 j.

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CAL = "https://www.googleapis.com/calendar/v3";

// events : écrire les RDV ; calendar.readonly : lister agendas + lire l'occupation.
export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** true si les identifiants OAuth serveur sont configurés (sans les lire). */
export function googleReady(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
}

/** URL de consentement Google (redirection). `state` = anti-CSRF signé + user. */
export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // pour obtenir un refresh_token
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${p.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function tokenCall(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  return (await res.json()) as GoogleTokens;
}

export function exchangeCode(code: string): Promise<GoogleTokens> {
  return tokenCall({
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(refresh_token: string): Promise<GoogleTokens> {
  return tokenCall({ refresh_token, grant_type: "refresh_token" });
}

async function api(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${CAL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const res = await api(accessToken, "/users/me/calendarList");
  if (!res.ok) throw new Error(`calendarList ${res.status}`);
  const data = (await res.json()) as { items?: GoogleCalendar[] };
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary, primary: c.primary }));
}

export interface BusySlot {
  start: string;
  end: string;
}

/** Créneaux « occupé » sur les agendas donnés, fenêtre [timeMin, timeMax]. */
export async function listBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<BusySlot[]> {
  const res = await api(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  if (!res.ok) throw new Error(`freeBusy ${res.status}`);
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: BusySlot[] }>;
  };
  return Object.values(data.calendars ?? {}).flatMap((c) => c.busy ?? []);
}

export interface CalendarEvent {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: { email: string }[];
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<{ id: string }> {
  const res = await api(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`createEvent ${res.status}`);
  return (await res.json()) as { id: string };
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEvent>,
): Promise<void> {
  const res = await api(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(event) },
  );
  if (!res.ok) throw new Error(`updateEvent ${res.status}`);
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await api(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  // 410 = déjà supprimé → idempotent, on n'échoue pas.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`deleteEvent ${res.status}`);
  }
}
