import type { Devis, LigneDevis, RemiseInfo } from "@/lib/types";
import { entiteConfig } from "@/lib/entite/config";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import type { DevisDraft, DevisLigne } from "@/lib/devis/types";
import type { DevisTotaux } from "@/lib/devis/pricing";

/** Fige le devis du wizard dans le modèle `Devis` (snapshot des prix). */
export function buildDevisSnapshot(
  draft: DevisDraft,
  lignes: DevisLigne[],
  totaux: DevisTotaux,
  ref: string,
  dateISO: string,
  statut: Devis["statut"] = "brouillon",
): Devis {
  const cfg = entiteConfig(draft.entite);
  const lignesDevis: LigneDevis[] = lignes.map((l) => ({
    label:
      l.quantite !== 1 || l.unite !== "u"
        ? `${l.designation} (${l.quantite} ${UNITE_LABEL[l.unite]})`
        : l.designation,
    montant_ht: l.total_ht,
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
    mode_tva: draft.mode_tva,
    taux_tva: totaux.taux_tva,
    montant_tva: totaux.montant_tva,
    montant_ttc: totaux.montant_ttc,
    statut,
  };
}
