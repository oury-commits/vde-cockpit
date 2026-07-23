import type { ModeleEmail } from "@/lib/emails/types";
import { buildModelesSeed } from "@/lib/emails/seed";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "vde.modeles.v1";

export type SaveResult =
  | { ok: true; modele: ModeleEmail }
  | { ok: false; conflit?: boolean; error: string };

export interface ModelesRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<ModeleEmail[]>;
  /** Écrit un modèle. En MÀJ (`!estNouveau`) : verrou optimiste sur `version`. */
  save(modele: ModeleEmail, estNouveau: boolean): Promise<SaveResult>;
  remove(id: string): Promise<{ error: string | null }>;
}

class LocalModelesRepository implements ModelesRepository {
  readonly kind = "local" as const;

  private read(): ModeleEmail[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ModeleEmail[];
    } catch {
      /* ignore */
    }
    return buildModelesSeed();
  }
  private write(all: ModeleEmail[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }

  async loadAll(): Promise<ModeleEmail[]> {
    return this.read();
  }

  async save(modele: ModeleEmail, estNouveau: boolean): Promise<SaveResult> {
    const all = this.read();
    if (estNouveau) {
      const suivant = { ...modele, version: 0 };
      this.write([...all, suivant]);
      return { ok: true, modele: suivant };
    }
    const courant = all.find((x) => x.id === modele.id);
    if (courant && courant.version !== modele.version) {
      return { ok: false, conflit: true, error: "Modèle modifié entre-temps." };
    }
    const suivant = { ...modele, version: modele.version + 1 };
    this.write(all.map((x) => (x.id === modele.id ? suivant : x)));
    return { ok: true, modele: suivant };
  }

  async remove(id: string): Promise<{ error: string | null }> {
    this.write(this.read().filter((x) => x.id !== id));
    return { error: null };
  }
}

class SupabaseModelesRepository implements ModelesRepository {
  readonly kind = "supabase" as const;

  async loadAll(): Promise<ModeleEmail[]> {
    const sb = getSupabase();
    if (!sb) return buildModelesSeed();
    const { data, error } = await sb.from("modeles_email").select("*").order("ordre");
    if (error || (data?.length ?? 0) === 0) return buildModelesSeed();
    return data as ModeleEmail[];
  }

  async save(modele: ModeleEmail, estNouveau: boolean): Promise<SaveResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: "Client Supabase indisponible." };

    if (estNouveau) {
      const { data, error } = await sb
        .from("modeles_email")
        .insert({ ...modele, version: 0 })
        .select()
        .maybeSingle();
      if (error || !data) return { ok: false, error: error?.message ?? "Création impossible." };
      return { ok: true, modele: data as ModeleEmail };
    }

    // MÀJ gardée : n'écrit que si la version persistée est celle qu'on a lue.
    const { data, error } = await sb
      .from("modeles_email")
      .update({ ...modele, version: modele.version + 1 })
      .eq("id", modele.id)
      .eq("version", modele.version)
      .select()
      .maybeSingle();
    if (!error && data) return { ok: true, modele: data as ModeleEmail };
    // 0 ligne alors que le modèle existe → conflit de version.
    const { data: existe } = await sb
      .from("modeles_email")
      .select("id")
      .eq("id", modele.id)
      .maybeSingle();
    if (existe) return { ok: false, conflit: true, error: "Modèle modifié entre-temps." };
    return { ok: false, error: error?.message ?? "Enregistrement impossible." };
  }

  async remove(id: string): Promise<{ error: string | null }> {
    const sb = getSupabase();
    if (!sb) return { error: "Client Supabase indisponible." };
    const { error } = await sb.from("modeles_email").delete().eq("id", id);
    return { error: error ? error.message : null };
  }
}

let repository: ModelesRepository | null = null;

export function getModelesRepository(): ModelesRepository {
  if (!repository) {
    repository = isSupabaseConfigured
      ? new SupabaseModelesRepository()
      : new LocalModelesRepository();
  }
  return repository;
}

export const modelesRepoKind: ModelesRepository["kind"] = isSupabaseConfigured
  ? "supabase"
  : "local";
