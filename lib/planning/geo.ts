// Géocodage + matrice de trajet — SERVEUR UNIQUEMENT (clés API, jamais
// NEXT_PUBLIC). Provider par défaut : OpenRouteService (géocode Pelias + matrix
// driving-car). Les clés GEOCODING_API_KEY / ROUTING_API_KEY sont lues seulement
// ici (routes /api/planning/*), jamais exposées au navigateur.
//
// Dégradation : sans clé de routage, la matrice retombe sur une ESTIMATION (vol
// d'oiseau × détour ÷ vitesse moyenne) — l'ordre de tournée reste calculable,
// avec un drapeau `real: false`. Sans clé de géocodage, on ne peut pas inventer
// de coordonnées → l'appelant gère l'absence.

import type { Entite } from "@/lib/types";
import { estimateDistanceKm, estimateMinutes, type Pt } from "@/lib/planning/tour";

const GEOCODE = "https://api.openrouteservice.org/geocode/search";
const MATRIX = "https://api.openrouteservice.org/v2/matrix/driving-car";

const PAYS: Record<Entite, string> = { FR: "FR", MA: "MA" };

export function geocodeReady(): boolean {
  return Boolean(process.env.GEOCODING_API_KEY);
}
export function routingReady(): boolean {
  return Boolean(process.env.ROUTING_API_KEY);
}

/** Géocode une adresse → {lat,lng}. null si non configuré / introuvable. */
export async function geocode(adresse: string, entite: Entite = "FR"): Promise<Pt | null> {
  const key = process.env.GEOCODING_API_KEY;
  if (!key || !adresse.trim()) return null;
  const u = new URL(GEOCODE);
  u.searchParams.set("api_key", key);
  u.searchParams.set("text", adresse);
  u.searchParams.set("boundary.country", PAYS[entite]);
  u.searchParams.set("size", "1");
  try {
    const res = await fetch(u, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates; // [lng, lat]
    if (!c || c.length < 2) return null;
    return { lng: c[0], lat: c[1] };
  } catch {
    return null;
  }
}

export interface MatrixResult {
  /** Minutes, origine → chaque point (même ordre que `points`). */
  durations: number[];
  /** Km, origine → chaque point. */
  distances: number[];
  /** true = API de routage ; false = estimation (vol d'oiseau + détour). */
  real: boolean;
}

/** Temps + distance de l'origine vers chaque point. Toujours une réponse. */
export async function travelMatrix(origin: Pt, points: Pt[]): Promise<MatrixResult> {
  const estimate = (): MatrixResult => ({
    durations: points.map((p) => estimateMinutes(estimateDistanceKm(origin, p))),
    distances: points.map((p) => Math.round(estimateDistanceKm(origin, p) * 10) / 10),
    real: false,
  });

  const key = process.env.ROUTING_API_KEY;
  if (!key || points.length === 0) return estimate();

  try {
    const res = await fetch(MATRIX, {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({
        locations: [[origin.lng, origin.lat], ...points.map((p) => [p.lng, p.lat])],
        sources: [0],
        destinations: points.map((_, i) => i + 1),
        metrics: ["duration", "distance"],
      }),
    });
    if (!res.ok) return estimate();
    const data = (await res.json()) as {
      durations?: number[][]; // secondes
      distances?: number[][]; // mètres
    };
    const dur = data.durations?.[0];
    const dist = data.distances?.[0];
    if (!dur || !dist) return estimate();
    return {
      durations: dur.map((s) => Math.round(s / 60)),
      distances: dist.map((m) => Math.round(m / 100) / 10),
      real: true,
    };
  } catch {
    return estimate();
  }
}
