// Helpers CLIENT du planning : appels best-effort à /api/planning/*. Aucun
// secret — on passe le bearer de session, le serveur détient les clés API.
"use client";

import type { Entite } from "@/lib/types";
import type { Pt } from "@/lib/planning/tour";

function headers(token: string | null): HeadersInit {
  return token
    ? { "content-type": "application/json", authorization: `Bearer ${token}` }
    : { "content-type": "application/json" };
}

/** Géocode une adresse via le serveur. null si non configuré / introuvable / erreur. */
export async function geocodeAdresse(
  token: string | null,
  adresse: string,
  entite: Entite,
): Promise<Pt | null> {
  try {
    const res = await fetch("/api/planning/geocode", {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ adresse, entite }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; lat?: number; lng?: number };
    return j.ok && typeof j.lat === "number" && typeof j.lng === "number"
      ? { lat: j.lat, lng: j.lng }
      : null;
  } catch {
    return null;
  }
}

export interface MatrixResp {
  durations: number[];
  distances: number[];
  real: boolean;
}

/** Temps/distance de l'origine vers chaque point. null si erreur réseau. */
export async function fetchMatrix(
  token: string | null,
  origin: Pt,
  points: Pt[],
): Promise<MatrixResp | null> {
  if (points.length === 0) return { durations: [], distances: [], real: true };
  try {
    const res = await fetch("/api/planning/matrix", {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ origin, points }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean } & MatrixResp;
    return j.ok ? { durations: j.durations, distances: j.distances, real: j.real } : null;
  } catch {
    return null;
  }
}
