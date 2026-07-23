"use client";

import { createContext, useContext } from "react";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import type { DevisTotaux } from "@/lib/devis/pricing";
import type {
  ControleLigne,
  DevisClient,
  DevisConfig,
  DevisDraft,
  DevisLigne,
  DevisPv,
  LigneLibre,
  VueDevis,
} from "@/lib/devis/types";
import type { PackSolaire } from "@/lib/devis/solaire";

export interface WizardValue {
  draft: DevisDraft;
  /** Articles catalogue actifs (base partagée). */
  articles: CatalogueArticle[];
  /** Coût de revient d'un article dans la devise de l'entité (EUR ou MAD). */
  coutOf: (article: CatalogueArticle) => number;
  lignes: DevisLigne[];
  totaux: DevisTotaux;
  /** Contrôle technique /6 dérivé de la configuration. */
  controle: ControleLigne[];
  vue: VueDevis;
  setVue: (v: VueDevis) => void;
  patch: (partial: Partial<DevisDraft>) => void;
  patchClient: (partial: Partial<DevisClient>) => void;
  patchConfig: (partial: Partial<DevisConfig>) => void;
  /** Modifie le volet solaire (autoconsommation, modules conformes, TVA 5,5 %). */
  patchPv: (partial: Partial<DevisPv>) => void;
  /** Applique une sélection pré-cochée (point de départ modifiable). */
  applyPack: (pack: PackSolaire) => void;
  setSupplement: (articleId: string, quantite: number) => void;
  /** Coche/décoche un article du catalogue (qté 1 ↔ 0) — ajout de ligne immédiat. */
  toggleSupplement: (articleId: string) => void;
  /** Affiche/masque le QR de fiche produit d'une borne sur ce devis. */
  toggleQr: (articleId: string) => void;
  /** Surcharge le taux TVA d'une ligne (par article_id). France uniquement. */
  setTauxLigne: (articleId: string, taux: number) => void;
  toggleControle: (key: ControleLigne["key"]) => void;
  /** Renomme une ligne catalogue (chaîne vide = nom d'origine). */
  setLigneNom: (articleId: string, nom: string) => void;
  /** Impose le PU vente HT d'une ligne catalogue ; null = PU dérivé de la marge. */
  setLignePu: (articleId: string, pu: number | null) => void;
  /** Ajoute une ligne libre (hors catalogue). */
  addLigneLibre: () => void;
  /** Modifie une ligne libre. */
  updateLigneLibre: (id: string, patch: Partial<LigneLibre>) => void;
  /** Supprime une ligne libre. */
  removeLigneLibre: (id: string) => void;
}

export const WizardContext = createContext<WizardValue | null>(null);

export function useWizard(): WizardValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard doit être utilisé dans <DevisWizard>");
  return ctx;
}
