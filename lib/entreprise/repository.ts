import type { ParametresEntreprise } from "@/lib/entreprise/types";
import { buildEntrepriseSeed } from "@/lib/entreprise/seed";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "vde.entreprise.v1";

export interface EntrepriseRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<ParametresEntreprise[]>;
  /** Écrit UNE fiche (une entité). Jamais de mise à jour croisée entre entités. */
  upsertOne(fiche: ParametresEntreprise): Promise<{ error: string | null }>;
}

class LocalEntrepriseRepository implements EntrepriseRepository {
  readonly kind = "local" as const;

  async loadAll(): Promise<ParametresEntreprise[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ParametresEntreprise[];
    } catch {
      /* ignore */
    }
    return buildEntrepriseSeed();
  }

  async upsertOne(fiche: ParametresEntreprise): Promise<{ error: string | null }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? (JSON.parse(raw) as ParametresEntreprise[]) : buildEntrepriseSeed();
      const next = all.some((f) => f.entite === fiche.entite)
        ? all.map((f) => (f.entite === fiche.entite ? fiche : f))
        : [...all, fiche];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { error: null };
    } catch {
      return { error: "Sauvegarde locale impossible." };
    }
  }
}

class SupabaseEntrepriseRepository implements EntrepriseRepository {
  readonly kind = "supabase" as const;

  async loadAll(): Promise<ParametresEntreprise[]> {
    const sb = getSupabase();
    if (!sb) return buildEntrepriseSeed();
    const { data, error } = await sb.from("parametres_entreprise").select("*");
    // Table absente / RLS / vide → on retombe sur le seed (mêmes valeurs que 0020).
    if (error || (data?.length ?? 0) === 0) return buildEntrepriseSeed();
    return data as ParametresEntreprise[];
  }

  async upsertOne(fiche: ParametresEntreprise): Promise<{ error: string | null }> {
    const sb = getSupabase();
    if (!sb) return { error: "Client Supabase indisponible." };
    const { error } = await sb.from("parametres_entreprise").upsert(fiche);
    return { error: error ? error.message : null };
  }
}

let repository: EntrepriseRepository | null = null;

export function getEntrepriseRepository(): EntrepriseRepository {
  if (!repository) {
    repository = isSupabaseConfigured
      ? new SupabaseEntrepriseRepository()
      : new LocalEntrepriseRepository();
  }
  return repository;
}

export const entrepriseRepoKind: EntrepriseRepository["kind"] = isSupabaseConfigured
  ? "supabase"
  : "local";
