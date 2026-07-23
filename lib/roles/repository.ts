import type { Profile } from "@/lib/roles/types";
import { buildProfilesSeed } from "@/lib/roles/seed";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "vde.profiles.v1";

export interface ProfilesRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<Profile[]>;
  /** `error` null = OK ; sinon message à REMONTER (jamais avalé). */
  persistAll(profiles: Profile[]): Promise<{ error: string | null }>;
}

class LocalProfilesRepository implements ProfilesRepository {
  readonly kind = "local" as const;

  async loadAll(): Promise<Profile[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Profile[];
    } catch {
      /* ignore */
    }
    return buildProfilesSeed();
  }

  async persistAll(profiles: Profile[]): Promise<{ error: string | null }> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "stockage local indisponible" };
    }
  }
}

class SupabaseProfilesRepository implements ProfilesRepository {
  readonly kind = "supabase" as const;

  async loadAll(): Promise<Profile[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from("profiles").select("*");
    // Table absente (migration 0014 non appliquée) OU RLS active sans policy
    // (P3 pas encore posée) : on ne seed PAS en base, on retombe sur la liste
    // locale. Seeder des comptes en silence dans une table de DROITS serait
    // exactement le genre d'initiative à ne pas prendre.
    if (error || (data?.length ?? 0) === 0) return buildProfilesSeed();
    return data as Profile[];
  }

  async persistAll(profiles: Profile[]): Promise<{ error: string | null }> {
    const sb = getSupabase();
    if (!sb || profiles.length === 0) return { error: null };
    const { error } = await sb.from("profiles").upsert(profiles);
    return { error: error ? `équipe : ${error.message}` : null };
  }
}

let repository: ProfilesRepository | null = null;

export function getProfilesRepository(): ProfilesRepository {
  if (!repository) {
    repository = isSupabaseConfigured
      ? new SupabaseProfilesRepository()
      : new LocalProfilesRepository();
  }
  return repository;
}

export const profilesRepoKind: ProfilesRepository["kind"] = isSupabaseConfigured
  ? "supabase"
  : "local";
