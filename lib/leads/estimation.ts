import type { Entite, Lead } from "@/lib/types";
import { baseHt } from "@/lib/leads/pricing";
import { entiteConfig, optionTva } from "@/lib/entite/config";

export interface Estimation {
  /** Fourchette TTC (devise de l'entité). */
  min: number;
  max: number;
  devise: string; // symbole (€ / DH)
}

/**
 * Estimation de prix auto (§5) — fourchette TTC calculée depuis puissance +
 * distance + type de pose, avec la TVA par défaut de l'entité. Point de départ
 * éditable du devis.
 */
export function computeEstimation(lead: Lead, entite: Entite): Estimation {
  const cfg = entiteConfig(entite);
  const ht = baseHt(lead);
  const taux = optionTva(entite, cfg.tvaDefaut).taux;
  const ttc = (h: number) => Math.round(h * (1 + taux));
  // Incertitude : -10 % / +15 % autour de la base.
  return {
    min: ttc(ht * 0.9),
    max: ttc(ht * 1.15),
    devise: cfg.symbole,
  };
}

export interface EstimationAffichee extends Estimation {
  /** true = valeur ferme (devis émis ou montant saisi) ; false = fourchette auto. */
  fixe: boolean;
  source: "devis" | "saisi" | "auto";
}

/**
 * SOURCE UNIQUE du « montant du dossier », partagée par la fiche, la liste, le
 * tri et le drawer. Précédence : devis émis (TTC figé) → montant saisi à la main
 * → estimation auto (fourchette). Évite qu'un écran affiche la fourchette
 * calculée pendant qu'un autre montre le montant saisi.
 */
export function estimationLead(lead: Lead, entite: Entite): EstimationAffichee {
  const cfg = entiteConfig(entite);
  if (lead.devis) {
    const v = lead.devis.montant_ttc;
    return { min: v, max: v, devise: cfg.symbole, fixe: true, source: "devis" };
  }
  if (lead.montant_estime != null) {
    const v = lead.montant_estime;
    return { min: v, max: v, devise: cfg.symbole, fixe: true, source: "saisi" };
  }
  return { ...computeEstimation(lead, entite), fixe: false, source: "auto" };
}

/** Valeur représentative (point) pour la liste / le tri — même source. */
export function montantLead(lead: Lead): number {
  const e = estimationLead(lead, lead.entite);
  return e.fixe ? e.min : Math.round((e.min + e.max) / 2);
}
