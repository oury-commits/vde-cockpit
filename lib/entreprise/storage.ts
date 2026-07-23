// Upload d'un logo → Supabase Storage (bucket `logos`, préfixe entité). Renvoie
// une URL PUBLIQUE (le logo est un visuel client-facing, imprimé sur les devis).
// Dégrade proprement en mode démo (pas de Supabase → pas d'upload).

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type LogoKind = "complet" | "symbole";

export interface UploadLogoResult {
  url: string | null;
  raison?: string;
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function uploadLogo(
  entite: string,
  kind: LogoKind,
  file: File,
): Promise<UploadLogoResult> {
  if (!isSupabaseConfigured) {
    return { url: null, raison: "Stockage indisponible (mode démo local)." };
  }
  const sb = getSupabase();
  if (!sb) return { url: null, raison: "Client Supabase indisponible." };

  const ext = MIME_EXT[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "png";
  // Préfixe entité → RLS Storage (écriture admin, cloisonnée par pays).
  const path = `${entite}/${kind}.${ext}`;
  const up = await sb.storage
    .from("logos")
    .upload(path, file, { contentType: file.type || "image/png", upsert: true });
  if (up.error) return { url: null, raison: `Dépôt impossible : ${up.error.message}` };

  const { data } = sb.storage.from("logos").getPublicUrl(path);
  return { url: data.publicUrl ?? null };
}
