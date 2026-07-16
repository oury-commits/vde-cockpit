import type { Lead, LigneDevis } from "@/lib/types";
import { PUISSANCE_LABEL } from "@/lib/leads/meta";

// TODO: brancher données réelles — grille tarifaire de démonstration (HT).
// À remplacer par la grille VDE réelle avant livraison. Montants en unité de
// l'entité (EUR pour FR, MAD pour MA — la grille ci-dessous est calibrée FR).
const PRIX_FOURNITURE: Record<string, number> = {
  "3.7": 490,
  "7.4": 690,
  "11": 1190,
  "22": 1590,
};
const INSTALLATION_BASE = 590; // forfait pose + raccordement
const PRIX_METRE_SUP = 25; // par mètre au-delà de l'inclus
const METRES_INCLUS = 5;
const SUPPLEMENT_EXTERIEUR = 180; // pose extérieure / sur pied

/** Lignes de devis pré-remplies depuis la qualif du lead (§6.5). */
export function buildLignes(lead: Lead): LigneDevis[] {
  const lignes: LigneDevis[] = [];
  const p = lead.puissance_souhaitee ?? "7.4";
  lignes.push({
    label: `Borne de recharge ${PUISSANCE_LABEL[p]} — fourniture`,
    montant_ht: PRIX_FOURNITURE[p] ?? PRIX_FOURNITURE["7.4"],
  });
  lignes.push({
    label: "Installation et raccordement",
    montant_ht: INSTALLATION_BASE,
  });
  const dist = lead.distance_tableau ?? 0;
  if (dist > METRES_INCLUS) {
    lignes.push({
      label: `Supplément distance tableau (+${dist - METRES_INCLUS} m)`,
      montant_ht: (dist - METRES_INCLUS) * PRIX_METRE_SUP,
    });
  }
  if (lead.emplacement === "exterieur" || lead.fixation === "pied") {
    lignes.push({
      label: "Supplément pose extérieure / sur pied",
      montant_ht: SUPPLEMENT_EXTERIEUR,
    });
  }
  return lignes;
}

/** Total HT de référence (somme des lignes pré-remplies). */
export function baseHt(lead: Lead): number {
  return buildLignes(lead).reduce((s, l) => s + l.montant_ht, 0);
}
