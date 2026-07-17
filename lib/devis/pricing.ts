import type { Echeance } from "@/lib/types";
import type { DevisLigne, ModePaiement } from "@/lib/devis/types";

// Moteur de prix du devis. Convention validée avec Oury : « marge 35 % » =
// TAUX DE MARGE sur le prix de vente → PU vente HT = coût ÷ (1 − marge).
// (et non un coefficient coût × 1,35). Le taux est réglable dans la Synthèse.

export const MARGE_DEFAUT = 0.35;
export const MARGE_MAX = 0.9;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Borne le taux de marge dans [0 ; MARGE_MAX] (évite la division par ~0). */
export function clampMarge(m: number): number {
  if (!Number.isFinite(m) || m < 0) return 0;
  return Math.min(m, MARGE_MAX);
}

/** PU de vente HT à partir du coût de revient HT et du taux de marge sur PV. */
export function puVenteHt(coutHt: number, marge: number): number {
  const m = clampMarge(marge);
  return round2(coutHt / (1 - m));
}

/** Total HT d'une ligne (PU vente × quantité), arrondi au centime. */
export function ligneTotalHt(ligne: DevisLigne): number {
  return round2(ligne.pu_ht * ligne.quantite);
}

export interface DevisTotaux {
  cout_total: number; // interne : somme des coûts de revient
  montant_ht_brut: number; // avant réduction
  remise: number; // réduction commerciale HT appliquée
  montant_ht: number; // après réduction
  marge_euro: number;
  marge_pct: number; // marge € / HT
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  aides_total: number;
  reste_a_charge: number; // TTC − aides (indicatif)
}

export function computeTotaux(
  lignes: DevisLigne[],
  tauxTva: number,
  aidesTotal: number,
  remise = 0,
): DevisTotaux {
  const cout_total = round2(
    lignes.reduce((s, l) => s + l.cout_ht * l.quantite, 0),
  );
  const montant_ht_brut = round2(lignes.reduce((s, l) => s + ligneTotalHt(l), 0));
  const remiseAppliquee = round2(Math.min(Math.max(0, remise), montant_ht_brut));
  const montant_ht = round2(montant_ht_brut - remiseAppliquee);
  const marge_euro = round2(montant_ht - cout_total);
  const marge_pct = montant_ht > 0 ? marge_euro / montant_ht : 0;
  const montant_tva = round2(montant_ht * tauxTva);
  const montant_ttc = round2(montant_ht + montant_tva);
  const aides = round2(Math.max(0, aidesTotal));
  return {
    cout_total,
    montant_ht_brut,
    remise: remiseAppliquee,
    montant_ht,
    marge_euro,
    marge_pct,
    taux_tva: tauxTva,
    montant_tva,
    montant_ttc,
    aides_total: aides,
    reste_a_charge: round2(montant_ttc - aides),
  };
}

interface EcheancePlan {
  label: Echeance["label"];
  pct: number;
}

const PLANS: Record<ModePaiement, EcheancePlan[]> = {
  "40_40_20": [
    { label: "acompte", pct: 40 },
    { label: "demarrage", pct: 40 },
    { label: "solde", pct: 20 },
  ],
  "50_50": [
    { label: "acompte", pct: 50 },
    { label: "solde", pct: 50 },
  ],
};

/** Échéancier selon le mode de paiement retenu (le solde absorbe l'arrondi). */
export function buildEcheancierPaiement(
  ttc: number,
  mode: ModePaiement,
): Echeance[] {
  const plan = PLANS[mode];
  const out: Echeance[] = [];
  let cumul = 0;
  plan.forEach((e, i) => {
    const montant =
      i === plan.length - 1 ? round2(ttc - cumul) : round2(ttc * (e.pct / 100));
    cumul = round2(cumul + montant);
    out.push({ label: e.label, pct: e.pct, montant, statut: "attendu" });
  });
  return out;
}
