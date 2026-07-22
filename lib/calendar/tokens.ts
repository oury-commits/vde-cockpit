import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/calendar/crypto";
import {
  refreshAccessToken,
  type GoogleCalendar,
  type GoogleTokens,
} from "@/lib/calendar/google";

// Magasin des jetons Google — SERVEUR UNIQUEMENT. La table calendar_tokens est
// server-only (RLS sans policy) : on y accède par service_role, toujours scopé
// par user_id. Les jetons sont chiffrés au repos ; jamais renvoyés au client.

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

/** Utilisateur courant depuis le bearer (jamais sur la seule foi du client). */
export async function userFromBearer(token: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;
  const c = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await c.auth.getUser();
  return data.user?.id ?? null;
}

export async function saveConnection(
  userId: string,
  tokens: GoogleTokens,
  calendars: GoogleCalendar[],
  existingRefresh?: string,
): Promise<void> {
  const db = admin();
  if (!db) throw new Error("Supabase service indisponible.");
  // Google ne renvoie le refresh_token qu'au premier consentement : on garde
  // l'ancien s'il n'en fournit pas de nouveau.
  const refresh = tokens.refresh_token ?? existingRefresh;
  await db.from("calendar_tokens").upsert({
    user_id: userId,
    provider: "google",
    access_token_enc: encrypt(tokens.access_token),
    refresh_token_enc: refresh ? encrypt(refresh) : null,
    expiry: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
    scopes: tokens.scope ?? null,
    calendars,
    updated_at: new Date().toISOString(),
  });
}

interface Row {
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expiry: string | null;
  scopes: string | null;
  calendars: GoogleCalendar[];
}

async function row(db: SupabaseClient, userId: string): Promise<Row | null> {
  const { data } = await db
    .from("calendar_tokens")
    .select("access_token_enc, refresh_token_enc, expiry, scopes, calendars")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Row) ?? null;
}

/** Access token valide (rafraîchi si expiré). null si non connecté. */
export async function getAccessToken(userId: string): Promise<string | null> {
  const db = admin();
  if (!db) return null;
  const r = await row(db, userId);
  if (!r?.access_token_enc) return null;

  const pasExpire = r.expiry && new Date(r.expiry).getTime() > Date.now();
  if (pasExpire) return decrypt(r.access_token_enc);

  // Expiré → refresh si on a un refresh_token.
  if (!r.refresh_token_enc) return null;
  const refreshed = await refreshAccessToken(decrypt(r.refresh_token_enc));
  await db
    .from("calendar_tokens")
    .update({
      access_token_enc: encrypt(refreshed.access_token),
      expiry: new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return refreshed.access_token;
}

export interface ConnexionStatut {
  connected: boolean;
  calendars: GoogleCalendar[];
  scopes: string | null;
}

/** État exposable à l'UI — booléen + noms d'agendas, JAMAIS de jeton. */
export async function getStatut(userId: string): Promise<ConnexionStatut> {
  const db = admin();
  if (!db) return { connected: false, calendars: [], scopes: null };
  const r = await row(db, userId);
  return {
    connected: Boolean(r?.access_token_enc),
    calendars: r?.calendars ?? [],
    scopes: r?.scopes ?? null,
  };
}

export async function refreshTokenClair(userId: string): Promise<string | null> {
  const db = admin();
  if (!db) return null;
  const r = await row(db, userId);
  return r?.refresh_token_enc ? decrypt(r.refresh_token_enc) : null;
}

export async function disconnect(userId: string): Promise<void> {
  const db = admin();
  if (!db) return;
  await db.from("calendar_tokens").delete().eq("user_id", userId);
}
