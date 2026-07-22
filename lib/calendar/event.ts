// Construction de l'événement Google d'un RDV d'installation. Pur et testable
// (aucun appel réseau) : le format du titre / lieu / description est verrouillé
// par scripts/calendar-event-test.mjs. Utilisé côté serveur par la route
// /api/calendar/rdv. « Agenda partagé » : le technicien est INVITÉ (attendee).

import type { CalendarEvent } from "@/lib/calendar/google";
import type { Entite, RdvType } from "@/lib/types";

const TYPE_LABEL: Record<RdvType, string> = {
  pose: "Pose",
  visite_technique: "Visite technique",
  sav: "SAV",
};

// Fuseau par entité — l'heure affichée dans l'agenda doit être l'heure locale
// du chantier, pas celle du serveur.
const TZ: Record<Entite, string> = {
  FR: "Europe/Paris",
  MA: "Africa/Casablanca",
};

export interface RdvEventInput {
  entite: Entite;
  type: RdvType;
  clientNom: string;
  /** Libellé court de la borne (ex. « 7,4 kW »), ou null si inconnu. */
  borne?: string | null;
  /** Lieu complet : rue + code postal + ville. */
  adresse: string;
  /** N° de dossier = identifiant du lead (FB-XXX). */
  dossier: string;
  telephone: string;
  debut: string; // ISO
  fin: string; // ISO
  technicienNom: string;
  technicienEmail: string;
}

/** Lien Google Maps « Y aller » vers l'adresse du chantier. */
export function mapsLink(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

/**
 * Événement Google d'un RDV : titre = « Client — Type · Borne », lieu = adresse,
 * description = dossier + tél + lien « Y aller », attendee = technicien assigné.
 */
export function buildRdvEvent(input: RdvEventInput): CalendarEvent {
  const borne = input.borne ? ` · ${input.borne}` : "";
  const summary = `${input.clientNom} — ${TYPE_LABEL[input.type]}${borne}`;
  const maps = mapsLink(input.adresse);
  const description = [
    `Dossier : ${input.dossier}`,
    `Client : ${input.clientNom}`,
    `Tél. : ${input.telephone}`,
    `Technicien : ${input.technicienNom}`,
    "",
    `Y aller : ${maps}`,
    "",
    "Créé automatiquement par VDE Cockpit — piloté depuis le CRM.",
  ].join("\n");

  const tz = TZ[input.entite];
  return {
    summary,
    location: input.adresse,
    description,
    start: { dateTime: input.debut, timeZone: tz },
    end: { dateTime: input.fin, timeZone: tz },
    attendees: input.technicienEmail
      ? [{ email: input.technicienEmail, displayName: input.technicienNom }]
      : undefined,
    // Réconciliation future (Bloc C / audit) : on marque l'origine CRM.
    extendedProperties: { private: { vdeLeadId: input.dossier, vdeSource: "cockpit" } },
  };
}
