import type { Devis, LigneDevis, RemiseInfo } from "@/lib/types";
import { entiteConfig } from "@/lib/entite/config";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import type { DevisDraft, DevisLigne } from "@/lib/devis/types";
import type { DevisTotaux } from "@/lib/devis/pricing";
import { puissanceKwc, TAUX_TVA_PV_REDUIT } from "@/lib/devis/solaire";

/** Fige le devis du wizard dans le modèle `Devis` (snapshot des prix). */
export function buildDevisSnapshot(
  draft: DevisDraft,
  lignes: DevisLigne[],
  totaux: DevisTotaux,
  ref: string,
  dateISO: string,
  statut: Devis["statut"] = "brouillon",
  articles: CatalogueArticle[] = [],
): Devis {
  const cfg = entiteConfig(draft.entite);
  const solaire = draft.domaine === "solaire";
  const lignesDevis: LigneDevis[] = lignes.map((l) => ({
    label:
      l.quantite !== 1 || l.unite !== "u"
        ? `${l.designation} (${l.quantite} ${UNITE_LABEL[l.unite]})`
        : l.designation,
    montant_ht: l.total_ht,
    taux_tva: l.taux_tva, // taux figé par ligne
    // Figé dans le snapshot : le QR du devis émis ne bouge plus.
    url_produit: l.url_produit ?? null,
    categorie: l.categorie ?? null,
  }));
  // La remise est portée STRUCTURELLEMENT (pas comme une ligne négative) :
  // c'est ce qui permet au PDF d'afficher HT brut → remise → HT net → TVA dans
  // le bon ordre, et à la facture de la reprendre telle quelle.
  const remise: RemiseInfo | null =
    totaux.remise > 0
      ? {
          type: totaux.remise_type,
          valeur: totaux.remise_valeur,
          montant: totaux.remise,
          motif: draft.remise_motif.trim() || null,
        }
      : null;
  return {
    ref,
    entite: draft.entite,
    devise: cfg.devise,
    date_creation: dateISO,
    lignes: lignesDevis,
    montant_ht_brut: totaux.montant_ht_brut,
    remise,
    montant_ht: totaux.montant_ht,
    // Solaire : le régime figé suit le taux réellement appliqué (5,5 % ou 20 %),
    // pas le défaut IRVE porté par le draft.
    mode_tva: solaire
      ? totaux.taux_tva === TAUX_TVA_PV_REDUIT
        ? "fr_5_5"
        : "fr_20"
      : draft.mode_tva,
    taux_tva: totaux.taux_tva,
    ventilation_tva: totaux.ventilation,
    montant_tva: totaux.montant_tva,
    montant_ttc: totaux.montant_ttc,
    // Alma : FR uniquement. En MA le drapeau est ignoré (jamais figé).
    alma_propose: draft.entite === "FR" ? draft.alma_propose : false,
    alma_plan: draft.alma_plan,
    domaine: draft.domaine,
    // Volet solaire figé : puissance installée + régime TVA effectif (le taux
    // unique du devis dit si le 5,5 % a réellement été appliqué).
    pv: solaire
      ? {
          puissance_kwc: puissanceKwc(draft.supplements, articles),
          autoconsommation: draft.pv.autoconsommation,
          tva_reduite: totaux.taux_tva === TAUX_TVA_PV_REDUIT,
          modules_conformes: draft.pv.modules_conformes,
        }
      : null,
    statut,
  };
}
