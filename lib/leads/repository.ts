import type { Activite, Lead } from "@/lib/types";
import { buildSeed } from "@/lib/leads/seed";
import { uid } from "@/lib/uid";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface Persisted {
  leads: Lead[];
  activites: Activite[];
}

/**
 * Couche de persistance abstraite. Deux implémentations interchangeables :
 * `local` (localStorage, Phase 2A) et `supabase` (Phase 2B). La bascule est
 * automatique dès que les clés Supabase sont présentes (.env.local).
 */
export interface LeadsRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<Persisted>;
  persistAll(state: Persisted): Promise<void>;
}

const STORAGE_KEY = "vde.crm.v1";

/** Seed de démonstration (leads fictifs + timeline). Local uniquement. */
export function seedState(): Persisted {
  const now = new Date();
  const leads = buildSeed(now);
  const activites: Activite[] = leads.map((l) => ({
    id: uid(),
    lead_id: l.id,
    type: "import",
    contenu: "Lead importé (démonstration)",
    auteur: "Système",
    created_at: l.date_reception,
  }));
  return { leads, activites };
}

class LocalRepository implements LeadsRepository {
  readonly kind = "local" as const;

  async loadAll(): Promise<Persisted> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Persisted;
    } catch {
      /* mode privé / quota */
    }
    return seedState();
  }

  async persistAll(state: Persisted): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
}

class SupabaseRepository implements LeadsRepository {
  readonly kind = "supabase" as const;

  async loadAll(): Promise<Persisted> {
    const sb = getSupabase();
    if (!sb) return { leads: [], activites: [] };
    const [leadsRes, actesRes] = await Promise.all([
      sb.from("leads").select("*").order("date_reception", { ascending: false }),
      sb.from("activites").select("*").order("created_at", { ascending: false }),
    ]);
    return {
      leads: (leadsRes.data ?? []) as Lead[],
      activites: (actesRes.data ?? []) as Activite[],
    };
  }

  async persistAll(state: Persisted): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    // TODO 2B: passer en upsert par enregistrement (diff) — le bulk complet à
    // chaque changement suffit au volume actuel mais n'est pas optimal.
    if (state.leads.length) await sb.from("leads").upsert(state.leads);
    if (state.activites.length) await sb.from("activites").upsert(state.activites);
  }
}

let repository: LeadsRepository | null = null;

/** Repository actif (Supabase si configuré, sinon local). Singleton. */
export function getRepository(): LeadsRepository {
  if (!repository) {
    repository = isSupabaseConfigured
      ? new SupabaseRepository()
      : new LocalRepository();
  }
  return repository;
}

/** `local` en démo (Phase 2A) · `supabase` une fois branché (2B). */
export const repositoryKind: LeadsRepository["kind"] = isSupabaseConfigured
  ? "supabase"
  : "local";
