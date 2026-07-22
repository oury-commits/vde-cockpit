import { NextResponse } from "next/server";
import { googleReady } from "@/lib/calendar/google";
import { getStatut, userFromBearer } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// État de connexion pour l'UI : booléen + noms d'agendas. JAMAIS de jeton.
export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userId = await userFromBearer(token);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const statut = await getStatut(userId);
  return NextResponse.json({ ...statut, configured: googleReady() });
}
