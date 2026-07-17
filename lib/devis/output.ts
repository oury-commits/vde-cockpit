import type { Devis } from "@/lib/types";
import { entiteConfig } from "@/lib/entite/config";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import type { DevisDraft, DevisLigne } from "@/lib/devis/types";
import type { DevisTotaux } from "@/lib/devis/pricing";

export { nextDevisRef } from "@/lib/leads/devis";

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
  const lignesDevis = lignes.map((l) => ({
    label:
      l.quantite !== 1 || l.unite !== "u"
        ? `${l.designation} (${l.quantite} ${UNITE_LABEL[l.unite]})`
        : l.designation,
    montant_ht: l.total_ht,
  }));
  // La réduction commerciale apparaît comme une ligne négative dans le devis.
  if (totaux.remise > 0) {
    lignesDevis.push({ label: "Réduction commerciale", montant_ht: -totaux.remise });
  }
  return {
    ref,
    entite: draft.entite,
    devise: cfg.devise,
    date_creation: dateISO,
    lignes: lignesDevis,
    montant_ht: totaux.montant_ht,
    mode_tva: draft.mode_tva,
    taux_tva: totaux.taux_tva,
    montant_tva: totaux.montant_tva,
    montant_ttc: totaux.montant_ttc,
    statut,
  };
}
