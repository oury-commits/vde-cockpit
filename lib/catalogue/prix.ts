import type { Entite } from "@/lib/types";
import type { CatalogueArticle } from "@/lib/catalogue/types";

// Prix d'un article selon l'entité.
// - FR : cout_ht (EUR), source du catalogue.
// - MA : cout_ma s'il est renseigné (surchargé), sinon dérivé cout_ht × taux.
// Le taux EUR→MAD est paramétrable (Paramètres).

// TODO: brancher données réelles — taux de change EUR→MAD à confirmer/tenir à
// jour par Oury dans les Paramètres.
export const DEFAULT_TAUX_MAD = 10.8;

/** Arrondi « commercial » en DH (au dirham entier). */
export function arrondiMad(n: number): number {
  return Math.round(n);
}

export interface PrixInfo {
  montant: number;
  /** true si dérivé du taux (MA sans surcharge). */
  derive: boolean;
}

export function prixInfo(
  article: CatalogueArticle,
  entite: Entite,
  tauxMad: number,
): PrixInfo {
  if (entite === "MA") {
    if (article.cout_ma != null) {
      return { montant: article.cout_ma, derive: false };
    }
    return { montant: arrondiMad(article.cout_ht * tauxMad), derive: true };
  }
  return { montant: article.cout_ht, derive: false };
}

/** Coût de revient de l'article dans la devise de l'entité. */
export function prixArticle(
  article: CatalogueArticle,
  entite: Entite,
  tauxMad: number,
): number {
  return prixInfo(article, entite, tauxMad).montant;
}
