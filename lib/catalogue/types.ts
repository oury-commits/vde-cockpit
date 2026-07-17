import type { Entite } from "@/lib/types";

// Catalogue de prix — Oury gère ses articles une fois, le devis les consomme.
// Les prix sont des COÛTS DE REVIENT HT (la marge est ajoutée au devis).

export type CategorieArticle =
  | "borne"
  | "pose"
  | "tableau"
  | "terre"
  | "option"
  | "consommable"
  | "deplacement";

export type Unite = "u" | "forfait" | "m";

export interface CatalogueArticle {
  id: string;
  designation: string;
  categorie: CategorieArticle;
  unite: Unite;
  /** Coût de revient HT, dans la devise de l'entité. */
  cout_ht: number;
  entite: Entite;
  actif: boolean;
  /** Prix marqué (?) dans le catalogue reconstitué — à valider par Oury. */
  a_confirmer: boolean;
  /** Inclus par défaut dans un devis standard (visserie, disjoncteurs…). */
  inclus_defaut: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
}
