"use client";

import { createContext, useContext } from "react";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import type { DevisTotaux } from "@/lib/devis/pricing";
import type {
  AideLigne,
  ControleLigne,
  DevisClient,
  DevisConfig,
  DevisDraft,
  DevisLigne,
  VueDevis,
} from "@/lib/devis/types";

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
  patchAide: (key: string, partial: Partial<AideLigne>) => void;
  setSupplement: (articleId: string, quantite: number) => void;
  toggleControle: (key: ControleLigne["key"]) => void;
}

export const WizardContext = createContext<WizardValue | null>(null);

export function useWizard(): WizardValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard doit être utilisé dans <DevisWizard>");
  return ctx;
}
