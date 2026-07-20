import type { Entite } from "@/lib/types";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Dépôt des PDF émis sur Supabase Storage (bucket privé `documents`).
// Le lien transmis au client est SIGNÉ et expirant — jamais de bucket public.

export const BUCKET = "documents";

/** Durée de validité du lien signé (7 jours). */
export const SIGNED_URL_TTL = 7 * 24 * 3600;

/** Chemin par entité : FR/VDE-2026-008.pdf */
export function documentPath(entite: Entite, ref: string): string {
  return `${entite}/${ref}.pdf`;
}

export interface UploadResult {
  url: string | null;
  /** Raison si le lien n'a pas pu être produit (mode démo, bucket absent…). */
  raison?: string;
}

/**
 * Dépose le PDF et renvoie une URL signée expirante.
 * Renvoie `{ url: null }` en mode démo (Supabase non configuré) — l'appelant
 * bascule alors sur la pièce jointe manuelle.
 */
export async function uploadDocument(
  entite: Entite,
  ref: string,
  pdf: Blob,
): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    return { url: null, raison: "Stockage indisponible (mode démo local)." };
  }
  const sb = getSupabase();
  if (!sb) return { url: null, raison: "Client Supabase indisponible." };

  const path = documentPath(entite, ref);
  const up = await sb.storage
    .from(BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    return { url: null, raison: `Dépôt impossible : ${up.error.message}` };
  }

  const signed = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (signed.error || !signed.data?.signedUrl) {
    return {
      url: null,
      raison: `Lien signé impossible : ${signed.error?.message ?? "réponse vide"}`,
    };
  }
  return { url: signed.data.signedUrl };
}
