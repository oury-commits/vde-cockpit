import { NextResponse } from "next/server";
import { disconnect, refreshTokenClair, userFromBearer } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Déconnexion : révoque le jeton Google (best-effort) puis supprime la ligne.
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userId = await userFromBearer(token);
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const refresh = await refreshTokenClair(userId).catch(() => null);
  if (refresh) {
    // Révocation côté Google (échec non bloquant : on supprime quand même).
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }).catch(() => {});
  }
  await disconnect(userId);
  return NextResponse.json({ ok: true });
}
