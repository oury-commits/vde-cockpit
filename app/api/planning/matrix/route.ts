import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/calendar/tokens";
import { travelMatrix } from "@/lib/planning/geo";
import type { Pt } from "@/lib/planning/tour";

// Matrice de trajet origine → points — SERVEUR UNIQUEMENT (clé ROUTING_API_KEY).
// travelMatrix retombe toujours sur une estimation si la clé manque : la route
// renvoie donc TOUJOURS des durées/distances (avec `real` à false en estimation).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  const userId = await userFromBearer(bearer(request));
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    origin?: Pt;
    points?: Pt[];
  };
  if (
    !body.origin ||
    typeof body.origin.lat !== "number" ||
    !Array.isArray(body.points)
  ) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  const r = await travelMatrix(body.origin, body.points);
  return NextResponse.json({ ok: true, ...r });
}
