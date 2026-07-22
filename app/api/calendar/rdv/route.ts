import { NextResponse } from "next/server";
import {
  userFromBearer,
  getAccessToken,
  getWriteCalendarId,
} from "@/lib/calendar/tokens";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  googleReady,
} from "@/lib/calendar/google";
import { chiffrementPret } from "@/lib/calendar/crypto";
import { buildRdvEvent, type RdvEventInput } from "@/lib/calendar/event";

// Sync d'un RDV vers l'agenda VDE maître — SERVEUR UNIQUEMENT (jetons Google).
// POST   : crée l'événement (ou le met à jour si google_event_id est fourni).
// DELETE : supprime l'événement (annulation du RDV).
//
// PRINCIPE : la synchro est best-effort et JAMAIS bloquante. Si l'agenda n'est
// pas connecté / pas configuré, on renvoie 200 { synced: false, reason } — le
// RDV reste valide côté CRM, il n'est simplement pas encore dans Google.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  // Non configuré côté serveur → dégrade proprement (le CRM garde le RDV).
  if (!googleReady() || !chiffrementPret()) {
    return NextResponse.json({ synced: false, reason: "non_configure" });
  }

  const userId = await userFromBearer(bearer(request));
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    event?: RdvEventInput;
    google_event_id?: string | null;
  };
  if (!body.event?.debut || !body.event?.fin || !body.event?.dossier) {
    return NextResponse.json({ error: "Données RDV incomplètes." }, { status: 400 });
  }

  // Jeton d'accès valide (rafraîchi si besoin). null = agenda non connecté.
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ synced: false, reason: "non_connecte" });
  }

  const calendarId = await getWriteCalendarId(userId);
  const event = buildRdvEvent(body.event);
  try {
    if (body.google_event_id) {
      await updateEvent(accessToken, calendarId, body.google_event_id, event);
      return NextResponse.json({ synced: true, google_event_id: body.google_event_id });
    }
    const created = await createEvent(accessToken, calendarId, event);
    return NextResponse.json({ synced: true, google_event_id: created.id });
  } catch (e) {
    // Erreur Google → on ne casse pas la confirmation CRM ; l'UI affichera
    // « non synchronisé » et pourra réessayer.
    return NextResponse.json({
      synced: false,
      reason: "google_error",
      message: e instanceof Error ? e.message : "erreur",
    });
  }
}

export async function DELETE(request: Request) {
  const userId = await userFromBearer(bearer(request));
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const eventId = new URL(request.url).searchParams.get("event_id");
  // Rien à supprimer côté Google → succès (l'annulation CRM a déjà eu lieu).
  if (!eventId) return NextResponse.json({ ok: true, reason: "aucun_event" });

  const accessToken = await getAccessToken(userId);
  if (!accessToken) return NextResponse.json({ ok: true, reason: "non_connecte" });

  const calendarId = await getWriteCalendarId(userId);
  try {
    await deleteEvent(accessToken, calendarId, eventId);
  } catch {
    // 410/404 déjà idempotents dans deleteEvent ; toute autre erreur reste
    // best-effort — l'annulation CRM ne doit jamais être bloquée par Google.
  }
  return NextResponse.json({ ok: true });
}
