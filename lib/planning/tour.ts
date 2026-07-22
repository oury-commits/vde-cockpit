// Géométrie de tournée — PUR (aucun réseau, aucun secret), donc testable hors
// ligne (scripts/planning-tour-test.mjs). L'API de routage donne le temps réel ;
// ces fonctions servent au classement, au fallback d'estimation et à l'ordre de
// tournée par proximité. PAS de moteur TSP : simple plus-proche-voisin.

import { FACTEUR_DETOUR, VITESSE_MOY_KMH } from "@/lib/planning/config";

export interface Pt {
  lat: number;
  lng: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau entre deux points, en km (Haversine). */
export function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distance ROUTE estimée (vol d'oiseau × facteur de détour), en km. */
export function estimateDistanceKm(a: Pt, b: Pt): number {
  return haversineKm(a, b) * FACTEUR_DETOUR;
}

/** Temps de trajet estimé pour une distance route (km), en minutes. */
export function estimateMinutes(km: number): number {
  return Math.round((km / VITESSE_MOY_KMH) * 60);
}

/** "1 h 30" / "45 min" — durée lisible. */
export function formatDuree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${String(r).padStart(2, "0")}`;
}

/**
 * Ordre de tournée par PROXIMITÉ (plus-proche-voisin depuis `start`). Les arrêts
 * sans coordonnées sont renvoyés à la fin, dans leur ordre d'entrée (on ne peut
 * pas les classer sans géocodage). PAS d'optimisation globale (pas de TSP).
 */
export function orderByProximity<T extends { pt: Pt | null }>(
  start: Pt | null,
  stops: T[],
): T[] {
  const avecPt = stops.filter((s) => s.pt);
  const sansPt = stops.filter((s) => !s.pt);
  if (!start || avecPt.length <= 1) return [...stops];

  const reste = [...avecPt];
  const ordre: T[] = [];
  let courant: Pt = start;
  while (reste.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < reste.length; i++) {
      const d = haversineKm(courant, reste[i].pt as Pt);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const [suivant] = reste.splice(bestI, 1);
    ordre.push(suivant);
    courant = suivant.pt as Pt;
  }
  return [...ordre, ...sansPt];
}
