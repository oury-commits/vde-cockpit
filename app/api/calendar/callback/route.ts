import { NextResponse } from "next/server";
import { exchangeCode, googleReady, listCalendars } from "@/lib/calendar/google";
import { chiffrementPret } from "@/lib/calendar/crypto";
import { verifyState } from "@/lib/calendar/state";
import { saveConnection } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Callback OAuth Google : sans session, l'utilisateur vient du `state` signé.
// On échange le code, liste les agendas, chiffre et stocke, puis on renvoie
// l'utilisateur vers les Paramètres.
export async function GET(request: Request) {
  const back = (statut: string) =>
    NextResponse.redirect(new URL(`/parametres?calendar=${statut}`, request.url));

  if (!googleReady() || !chiffrementPret()) return back("nonconfig");

  const { searchParams } = new URL(request.url);
  if (searchParams.get("error")) return back("refuse");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return back("invalide");

  const userId = verifyState(state, Date.now());
  if (!userId) return back("invalide"); // signature/expiration → anti-CSRF

  try {
    const tokens = await exchangeCode(code);
    const calendars = await listCalendars(tokens.access_token).catch(() => []);
    await saveConnection(userId, tokens, calendars);
    return back("connecte");
  } catch {
    return back("echec");
  }
}
