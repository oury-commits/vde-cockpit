import type { Entite, Lead } from "@/lib/types";
import { entiteConfig } from "@/lib/entite/config";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Numérotation des documents (devis / factures) par entité.
// Compteur PERSISTANT et MONOTONE — jamais recalculé depuis les enregistrements :
// supprimer un document ne libère jamais son numéro.
// - Supabase : RPC atomique `next_sequence` (verrou de ligne → pas de collision
//   entre deux émissions simultanées).
// - Local (démo) : compteur localStorage (mono-utilisateur, sans concurrence).
// Un brouillon ne consomme PAS de numéro : réservation à l'émission uniquement.

export type SeqType = "devis" | "facture";

const KEY = "vde.seq.v1";
const keyOf = (entite: Entite, type: SeqType) => `${type}:${entite}`;

function loadLocal(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveLocal(m: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Réservation locale : incrément monotone, jamais recalculé. */
function reserveLocal(entite: Entite, type: SeqType): number {
  const m = loadLocal();
  const k = keyOf(entite, type);
  const next = (m[k] ?? 0) + 1;
  m[k] = next;
  saveLocal(m);
  return next;
}

/** Réservation Supabase : atomique côté serveur (UPDATE … RETURNING). */
async function reserveSupabase(entite: Entite, type: SeqType): Promise<number> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponible pour la numérotation.");
  const { data, error } = await sb.rpc("next_sequence", {
    p_entite: entite,
    p_type: type,
  });
  const n = typeof data === "number" ? data : Number(data);
  if (error || !Number.isFinite(n)) {
    throw new Error(
      "Réservation du numéro impossible : " +
        (error?.message ?? "réponse invalide"),
    );
  }
  return n;
}

function formatRef(entite: Entite, type: SeqType, n: number): string {
  const cfg = entiteConfig(entite);
  const prefix = type === "devis" ? cfg.prefixeDevis : cfg.prefixeFacture;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/**
 * Réserve et formate le prochain numéro. À n'appeler qu'à l'émission d'un
 * document (jamais pour un brouillon). Lève si la réservation échoue — l'appelant
 * doit alors NE PAS produire de document (pas de doublon silencieux).
 */
export async function reserveRef(
  entite: Entite,
  type: SeqType,
): Promise<string> {
  const n = isSupabaseConfigured
    ? await reserveSupabase(entite, type)
    : reserveLocal(entite, type);
  return formatRef(entite, type, n);
}

/**
 * Aligne le compteur LOCAL sur les documents de démonstration (seed) afin que
 * les nouveaux numéros ne collisionnent pas avec les refs seedées. Ne touche
 * pas au mode Supabase (le compteur y vit en base).
 */
export function seedLocalSequencesFromLeads(leads: Lead[]): void {
  if (isSupabaseConfigured) return;
  const maxes: Record<string, number> = {};
  const bump = (k: string, ref?: string | null) => {
    if (!ref) return;
    const n = Number(ref.split("-").pop());
    if (Number.isFinite(n)) maxes[k] = Math.max(maxes[k] ?? 0, n);
  };
  for (const l of leads) {
    bump(keyOf(l.entite, "devis"), l.devis?.ref);
    bump(keyOf(l.entite, "facture"), l.facture?.ref);
  }
  saveLocal({ ...loadLocal(), ...maxes });
}
