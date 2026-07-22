// Helpers CLIENT du RDV : construction du payload d'événement + appels
// best-effort à /api/calendar/rdv. Aucun secret ici — les jetons Google vivent
// côté serveur ; on ne fait que passer le bearer de session et lire un booléen.

import type { Lead, RdvInstall } from "@/lib/types";
import type { RdvEventInput } from "@/lib/calendar/event"; // type-only : rien n'est bundlé du code serveur

/** Libellé court de la borne pour le titre d'événement (« 7,4 kW »). */
export function borneLabel(lead: Lead): string | null {
  if (lead.puissance_souhaitee) return `${lead.puissance_souhaitee.replace(".", ",")} kW`;
  const ligne = lead.devis?.lignes.find((l) => l.url_produit || l.categorie === "borne");
  return ligne?.label ?? null;
}

/** Adresse complète (rue + CP + ville) — lieu de l'événement. */
export function adresseComplete(lead: Lead): string {
  return [lead.adresse, [lead.code_postal, lead.ville].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

/** Lien Google Maps « Y aller » vers l'adresse du chantier. */
export function mapsLink(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

/** Payload d'événement à partir du lead + du RDV posé. */
export function buildEventInput(lead: Lead, rdv: RdvInstall): RdvEventInput {
  return {
    entite: lead.entite,
    type: rdv.type,
    clientNom: lead.nom,
    borne: borneLabel(lead),
    adresse: adresseComplete(lead),
    dossier: lead.id,
    telephone: lead.telephone,
    debut: rdv.debut,
    fin: rdv.fin,
    technicienNom: rdv.technicien_nom,
    technicienEmail: rdv.technicien_email,
  };
}

function headers(token: string | null): HeadersInit {
  return token
    ? { "content-type": "application/json", authorization: `Bearer ${token}` }
    : { "content-type": "application/json" };
}

export interface SyncResult {
  synced: boolean;
  google_event_id?: string;
  reason?: string;
}

/** Crée / met à jour l'événement de l'agenda VDE. Best-effort (jamais bloquant). */
export async function syncRdv(
  token: string | null,
  event: RdvEventInput,
  googleEventId: string | null,
): Promise<SyncResult> {
  try {
    const res = await fetch("/api/calendar/rdv", {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ event, google_event_id: googleEventId }),
    });
    if (!res.ok) return { synced: false, reason: `http_${res.status}` };
    return (await res.json()) as SyncResult;
  } catch {
    return { synced: false, reason: "reseau" };
  }
}

/** Supprime l'événement de l'agenda VDE. Best-effort. */
export async function unsyncRdv(token: string | null, eventId: string): Promise<void> {
  try {
    await fetch(`/api/calendar/rdv?event_id=${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: headers(token),
    });
  } catch {
    /* best-effort — l'annulation CRM a déjà eu lieu */
  }
}
