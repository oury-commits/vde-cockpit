"use client";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// RDV du technicien lus via la vue `chantiers` — le canal terrain SANS montants
// (le technicien ne peut pas lire la table `leads`). La vue projette lead.rdv :
// même source unique, juste exposée sans un seul champ financier.

export interface ChantierRdv {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  rdv_debut: string | null;
  rdv_fin: string | null;
  rdv_type: string | null;
  rdv_technicien_id: string | null;
}

/** Mes RDV via `chantiers`. `[]` hors Supabase (le mode démo lit le store). */
export async function fetchMesRdv(userId: string): Promise<ChantierRdv[]> {
  if (!isSupabaseConfigured) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("chantiers")
    .select(
      "id,nom,telephone,adresse,code_postal,ville,rdv_debut,rdv_fin,rdv_type,rdv_technicien_id",
    )
    .not("rdv_debut", "is", null);
  if (error) return [];
  // La RLS scope déjà au technicien ; on refiltre par sécurité.
  return (data as ChantierRdv[]).filter((c) => c.rdv_technicien_id === userId);
}
