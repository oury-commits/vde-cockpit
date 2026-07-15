import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Clés fournies par Oury dans .env.local (JAMAIS en dur, jamais committées).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Vrai quand les clés Supabase sont présentes → bascule sur le backend réel. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Client Supabase navigateur (singleton). `null` si non configuré. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
