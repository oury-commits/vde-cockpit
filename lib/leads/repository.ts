import type { Activite, Lead } from "@/lib/types";
import { buildSeed } from "@/lib/leads/seed";
import { seedLocalSequencesFromLeads } from "@/lib/leads/sequences";
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
/** Résultat d'une écriture sous verrou optimiste. */
export type EcritureGardee =
  | { ok: true; lead: Lead }
  | { ok: false; auteur: string | null };

export interface LeadsRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<Persisted>;
  persistAll(state: Persisted): Promise<void>;
  /**
   * Écriture d'un lead sous verrou optimiste : n'écrit que si la version
   * persistée est bien celle qui a été lue. Sinon → conflit, on n'écrase pas.
   * Lit/écrit la SOURCE PERSISTÉE (pas l'état React) : c'est ce qui permet de
   * détecter un collègue qui a enregistré depuis un autre onglet/poste.
   */
  updateLeadGuarded(
    id: string,
    patch: Partial<Lead>,
    versionAttendue: number,
    auteur: string,
  ): Promise<EcritureGardee>;
  /** Suppression définitive (local : couvert par persistAll ; Supabase : DELETE). */
  deleteLead(id: string): Promise<void>;
  deleteLeads(ids: string[]): Promise<void>;
}

const STORAGE_KEY = "vde.crm.v1";

/** Seed de démonstration (leads fictifs + timeline). Local uniquement. */
export function seedState(): Persisted {
  const now = new Date();
  const leads = buildSeed(now);
  // Aligne le compteur local sur les numéros seedés (démo) pour éviter toute
  // collision avec les nouveaux documents.
  seedLocalSequencesFromLeads(leads);
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

  /** Read-modify-write sur le blob persisté → détecte un autre onglet. */
  async updateLeadGuarded(
    id: string,
    patch: Partial<Lead>,
    versionAttendue: number,
    auteur: string,
  ): Promise<EcritureGardee> {
    let state: Persisted;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state = raw ? (JSON.parse(raw) as Persisted) : { leads: [], activites: [] };
    } catch {
      return { ok: false, auteur: null };
    }
    const courant = state.leads.find((l) => l.id === id);
    if (!courant) return { ok: false, auteur: null };
    if ((courant.version ?? 0) !== versionAttendue) {
      return { ok: false, auteur: courant.modifie_par ?? null };
    }
    const lead: Lead = {
      ...courant,
      ...patch,
      version: versionAttendue + 1,
      modifie_par: auteur,
      updated_at: new Date().toISOString(),
    };
    state.leads = state.leads.map((l) => (l.id === id ? lead : l));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      return { ok: false, auteur: null };
    }
    return { ok: true, lead };
  }

  async deleteLead(): Promise<void> {
    // La suppression est reflétée par persistAll (réécriture complète).
  }

  async deleteLeads(): Promise<void> {
    // Idem : persistAll réécrit l'état complet.
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

  /** UPDATE … WHERE version = :lue → 0 ligne = quelqu'un est passé avant. */
  async updateLeadGuarded(
    id: string,
    patch: Partial<Lead>,
    versionAttendue: number,
    auteur: string,
  ): Promise<EcritureGardee> {
    const sb = getSupabase();
    if (!sb) return { ok: false, auteur: null };
    const { data, error } = await sb
      .from("leads")
      .update({
        ...patch,
        version: versionAttendue + 1,
        modifie_par: auteur,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", versionAttendue)
      .select()
      .maybeSingle();

    if (!error && data) return { ok: true, lead: data as Lead };
    // Aucune ligne touchée : on relit pour dire QUI a modifié entre-temps.
    const { data: actuel } = await sb
      .from("leads")
      .select("modifie_par")
      .eq("id", id)
      .maybeSingle();
    return { ok: false, auteur: (actuel as { modifie_par?: string } | null)?.modifie_par ?? null };
  }

  async deleteLead(id: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    // Les activités partent en cascade (FK on delete cascade).
    await sb.from("leads").delete().eq("id", id);
  }

  async deleteLeads(ids: string[]): Promise<void> {
    const sb = getSupabase();
    if (!sb || ids.length === 0) return;
    await sb.from("leads").delete().in("id", ids);
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
