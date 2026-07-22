import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/calendar/tokens";
import { geocode, geocodeReady } from "@/lib/planning/geo";
import type { Entite } from "@/lib/types";

// Géocodage d'une adresse — SERVEUR UNIQUEMENT (clé GEOCODING_API_KEY). Dégrade
// proprement : sans clé → 200 { ok:false, reason:"non_configure" } ; l'écran
// tournées reste utilisable (ordre par heure, sans distances).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  if (!geocodeReady()) {
    return NextResponse.json({ ok: false, reason: "non_configure" });
  }
  const userId = await userFromBearer(bearer(request));
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    adresse?: string;
    entite?: Entite;
  };
  if (!body.adresse) {
    return NextResponse.json({ error: "Adresse manquante." }, { status: 400 });
  }
  const pt = await geocode(body.adresse, body.entite ?? "FR");
  if (!pt) return NextResponse.json({ ok: false, reason: "introuvable" });
  return NextResponse.json({ ok: true, lat: pt.lat, lng: pt.lng });
}
