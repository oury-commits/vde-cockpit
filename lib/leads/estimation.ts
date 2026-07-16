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
