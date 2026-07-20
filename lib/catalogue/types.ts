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
  /** Coût de revient HT de base, en EUR (catalogue France = source). */
  cout_ht: number;
  /**
   * Prix Maroc (MAD) surchargé. `null` → dérivé de `cout_ht × taux EUR→MAD`
   * (taux paramétrable). Renseigné → prix figé pour l'entité MA.
   */
  cout_ma?: number | null;
  /** Fiche produit sur le site VDE (ex. .../produits/v2c-trydan). */
  url_produit?: string | null;
  /**
   * Afficher le QR de la fiche produit sur le devis.
   * Effectif uniquement sur la catégorie `borne` (réassurance client) —
   * jamais de QR sur la pose ou les consommables.
   */
  afficher_qr?: boolean;
  entite: Entite;
  actif: boolean;
  /** Prix marqué (?) dans le catalogue reconstitué — à valider par Oury. */
  a_confirmer: boolean;
  /** Inclus par défaut dans un devis standard (visserie, disjoncteurs…). */
  inclus_defaut: boolean;
  note?: string | null;
  /** Verrou optimiste multi-utilisateur (même principe que leads.version). */
  version?: number;
  modifie_par?: string | null;
  created_at: string;
  updated_at: string;
}
