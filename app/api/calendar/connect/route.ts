import { NextResponse } from "next/server";
import { buildAuthUrl, googleReady } from "@/lib/calendar/google";
import { chiffrementPret } from "@/lib/calendar/crypto";
import { signState } from "@/lib/calendar/state";
import { userFromBearer } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Démarre la connexion Google Calendar : renvoie l'URL de consentement.
// L'utilisateur est identifié par son bearer et scellé dans un `state` signé,
// que le callback (sans session) pourra vérifier.
export async function POST(request: Request) {
  if (!googleReady() || !chiffrementPret()) {
    return NextResponse.json(
      { error: "Google Calendar non configuré (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI, CALENDAR_TOKEN_KEY)." },
      { status: 501 },
    );
  }
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userId = await userFromBearer(token);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const url = buildAuthUrl(signState(userId, Date.now()));
  return NextResponse.json({ url });
}
