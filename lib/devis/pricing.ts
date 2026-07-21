import type { Echeance, Entite, VentilationTva } from "@/lib/types";
import type { CategorieArticle } from "@/lib/catalogue/types";
import type { DevisLigne, ModePaiement } from "@/lib/devis/types";

// Moteur de prix du devis. Convention validée avec Oury : « marge 35 % » =
// TAUX DE MARGE sur le prix de vente → PU vente HT = coût ÷ (1 − marge).
// (et non un coefficient coût × 1,35). Le taux est réglable dans la Synthèse.

export const MARGE_DEFAUT = 0.35;
export const MARGE_MAX = 0.9;

/** Sous ce seuil de marge (sur PV), on alerte l'utilisateur (interne only). */
export const SEUIL_MARGE_ALERTE = 0.2;

export type MargeNiveau = "ok" | "faible" | "perte";

/**
 * Niveau d'alerte marge, calculé sur la marge APRÈS remise. `perte` (< 0 %)
 * signifie vendre en dessous du coût de revient — bloquant mais forçable ;
 * `faible` (< 20 %) est un simple avertissement. À n'afficher que sur l'écran
 * interne, jamais côté client.
 */
export function margeNiveau(margePct: number): MargeNiveau {
  if (margePct < 0) return "perte";
  if (margePct < SEUIL_MARGE_ALERTE) return "faible";
  return "ok";
}

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

// ── TVA par ligne (France) ──────────────────────────────────────────────────

/** Taux TVA sélectionnables par ligne en France, avec aide au choix. */
export interface OptionTauxLigne {
  taux: number;
  court: string; // « 5,5 % »
  aide: string; // libellé long (option de choix)
}

export const TAUX_TVA_FR: OptionTauxLigne[] = [
  { taux: 0.055, court: "5,5 %", aide: "5,5 % — borne IRVE résidentiel" },
  { taux: 0.1, court: "10 %", aide: "10 % — prise renforcée Green'Up" },
  { taux: 0.2, court: "20 %", aide: "20 % — matériel seul / pose séparée / pro" },
];

/** Aide au choix affichée en tooltip sous le sélecteur de TVA par ligne. */
export const AIDE_TVA_FR =
  "5,5 % = borne + pose par un pro IRVE, résidentiel, facture unique. Sinon 10 % (prise renforcée) ou 20 %.";

/**
 * Taux de TVA par défaut d'une ligne. MA est figé à 20 %. En France, une
 * installation IRVE résidentielle standard (borne + pose par un pro, facture
 * unique) relève de 5,5 % : c'est le défaut, l'utilisateur bascule une ligne en
 * 10 % ou 20 % au cas par cas.
 */
export function tauxTvaDefaut(
  _categorie: CategorieArticle | "libre",
  entite: Entite,
): number {
  return entite === "MA" ? 0.2 : 0.055;
}

/** Taux effectif d'une ligne (le champ, sinon un repli sûr). */
function tauxDe(ligne: DevisLigne): number {
  return typeof ligne.taux_tva === "number" ? ligne.taux_tva : 0.055;
}

/**
 * Ventilation de la TVA par taux, remise ALLOUÉE AU PRORATA de chaque taux.
 * Répartir la remise ainsi garde une TVA juste par taux (Art. 242 nonies A) :
 * une remise globale ne doit pas fausser la base d'un taux au profit d'un autre.
 * Le dernier groupe absorbe l'arrondi de la remise.
 */
export function ventiler(
  lignes: DevisLigne[],
  remiseEuroTotal: number,
): VentilationTva[] {
  const htBrutTotal = round2(lignes.reduce((s, l) => s + ligneTotalHt(l), 0));
  if (htBrutTotal <= 0) return [];

  // Regroupe les bases brutes par taux (ordre croissant de taux).
  const parTaux = new Map<number, number>();
  for (const l of lignes) {
    const t = tauxDe(l);
    parTaux.set(t, round2((parTaux.get(t) ?? 0) + ligneTotalHt(l)));
  }
  const taux = [...parTaux.keys()].sort((a, b) => a - b);

  let remiseAllouee = 0;
  return taux.map((t, i) => {
    const brut = parTaux.get(t)!;
    const remisePart =
      i === taux.length - 1
        ? round2(remiseEuroTotal - remiseAllouee) // le dernier absorbe l'arrondi
        : round2(remiseEuroTotal * (brut / htBrutTotal));
    remiseAllouee = round2(remiseAllouee + remisePart);
    const base = round2(brut - remisePart);
    return { taux: t, base_ht: base, montant_tva: round2(base * t) };
  });
}

/** Mode de saisie d'une remise : pourcentage du HT, ou montant fixe. */
export type RemiseType = "percent" | "montant";

export interface RemiseSpec {
  type: RemiseType;
  valeur: number; // 10 (= 10 %) ou 500 (= 500 €)
}

/**
 * Montant € de la remise, borné à [0 ; HT brut] — une remise ne peut ni être
 * négative ni dépasser le total. C'est le SEUL endroit qui convertit un % en
 * euros, pour qu'aperçu, PDF et snapshot partagent exactement la même valeur.
 */
export function remiseEuro(htBrut: number, spec?: RemiseSpec | null): number {
  if (!spec || !Number.isFinite(spec.valeur) || spec.valeur <= 0) return 0;
  const brut = spec.type === "percent" ? htBrut * (spec.valeur / 100) : spec.valeur;
  return round2(Math.min(Math.max(0, brut), htBrut));
}

export interface DevisTotaux {
  cout_total: number; // interne : somme des coûts de revient
  montant_ht_brut: number; // avant réduction
  remise: number; // réduction commerciale HT appliquée (€)
  remise_type: RemiseType; // saisie d'origine (pour l'affichage / la ré-édition)
  remise_valeur: number;
  montant_ht: number; // après réduction — base de la TVA
  marge_euro: number;
  marge_pct: number; // marge € / HT net
  /** Ventilation par taux (Art. 242 nonies A). Une entrée = un taux mono-devis. */
  ventilation: VentilationTva[];
  /** Taux unique si le devis n'en porte qu'un, sinon 0 (« mixte »). */
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
}

/**
 * Totaux du devis. Ordre conforme (I-14° CGI) : HT brut → − remise → HT net →
 * TVA (sur le HT NET) → TTC. La remise n'est JAMAIS appliquée après la TVA.
 * La TVA est ventilée PAR TAUX (chaque ligne porte son taux) : la marge, elle,
 * est calculée sur le HT et reste indépendante de la TVA.
 * Aucune aide ni subvention n'est déduite — le TTC est le montant dû.
 */
export function computeTotaux(
  lignes: DevisLigne[],
  remise: RemiseSpec | null = null,
): DevisTotaux {
  const cout_total = round2(
    lignes.reduce((s, l) => s + l.cout_ht * l.quantite, 0),
  );
  const montant_ht_brut = round2(lignes.reduce((s, l) => s + ligneTotalHt(l), 0));
  const remiseAppliquee = remiseEuro(montant_ht_brut, remise);
  const montant_ht = round2(montant_ht_brut - remiseAppliquee);
  const marge_euro = round2(montant_ht - cout_total);
  const marge_pct = montant_ht > 0 ? marge_euro / montant_ht : 0;

  const ventilation = ventiler(lignes, remiseAppliquee);
  const montant_tva = round2(
    ventilation.reduce((s, v) => s + v.montant_tva, 0),
  );
  const montant_ttc = round2(montant_ht + montant_tva);
  return {
    cout_total,
    montant_ht_brut,
    remise: remiseAppliquee,
    remise_type: remise?.type ?? "percent",
    remise_valeur: remise?.valeur ?? 0,
    montant_ht,
    marge_euro,
    marge_pct,
    ventilation,
    taux_tva: ventilation.length === 1 ? ventilation[0].taux : 0,
    montant_tva,
    montant_ttc,
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
