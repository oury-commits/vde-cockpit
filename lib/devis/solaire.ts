import type { CatalogueArticle } from "@/lib/catalogue/types";
import type { DevisDraft, DevisPv, DevisSupplement } from "@/lib/devis/types";

// Logique métier du devis SOLAIRE (photovoltaïque résidentiel, FR).
//
// Réalité marché 2026 : aucune aide (prime autoconso supprimée le 5 juin 2026),
// rachat du surplus effondré (≈ 0,011 €/kWh) → l'offre = AUTOCONSOMMATION, pas
// la revente. Le seul levier prix est la TVA 5,5 %, soumise à critères stricts.
//
// TVA 5,5 % (PV résidentiel) — critères CUMULATIFS, sinon 20 % :
//   · puissance ≤ 9 kWc ;
//   · gestionnaire d'énergie (EMS) inclus (obligatoire) ;
//   · modules conformes (empreinte carbone < 530 kg CO₂/kWc, argent < 14 mg/W,
//     plomb < 0,1 %, cadmium < 0,01 % — attestation ACV/PEP fournisseur).

/** Plafond de puissance pour la TVA réduite (kWc). Au-delà → 20 % automatique. */
export const SEUIL_KWC_TVA = 9;

export const TAUX_TVA_PV_REDUIT = 0.055;
export const TAUX_TVA_PV_PLEIN = 0.2;

/** Marge cible par défaut d'un devis solaire (PU vente = coût / 0,55). */
export const MARGE_SOLAIRE = 0.45;

/** Puissance totale installée (kWc) = Σ (quantité × Wc) des panneaux choisis. */
export function puissanceKwc(
  supplements: DevisSupplement[],
  articles: CatalogueArticle[],
): number {
  const byId = new Map(articles.map((a) => [a.id, a]));
  let wc = 0;
  for (const s of supplements) {
    const a = byId.get(s.article_id);
    if (a?.puissance_wc && s.quantite > 0) wc += a.puissance_wc * s.quantite;
  }
  return Math.round((wc / 1000) * 100) / 100; // kWc, 2 décimales
}

/** Un gestionnaire d'énergie (EMS) est-il présent dans la sélection ? */
export function emsPresent(
  supplements: DevisSupplement[],
  articles: CatalogueArticle[],
): boolean {
  const byId = new Map(articles.map((a) => [a.id, a]));
  return supplements.some(
    (s) => s.quantite > 0 && byId.get(s.article_id)?.categorie === "ems",
  );
}

export interface PvEligibilite {
  kwc: number;
  ems: boolean;
  modules_conformes: boolean;
  /** Critères cumulatifs réunis → la case 5,5 % est activable. */
  eligible: boolean;
  /** 5,5 % réellement appliqué (éligible ET case cochée), sinon 20 %. */
  taux: number;
  /** Raisons du blocage (pour l'UI). Vide si éligible. */
  manquants: string[];
}

/** Diagnostic complet d'éligibilité TVA d'un devis solaire. */
export function pvEligibilite(
  draft: DevisDraft,
  articles: CatalogueArticle[],
): PvEligibilite {
  const kwc = puissanceKwc(draft.supplements, articles);
  const ems = emsPresent(draft.supplements, articles);
  const modules_conformes = draft.pv.modules_conformes;

  const manquants: string[] = [];
  if (kwc <= 0) manquants.push("au moins un panneau");
  if (kwc > SEUIL_KWC_TVA) manquants.push(`puissance ≤ ${SEUIL_KWC_TVA} kWc`);
  if (!ems) manquants.push("gestionnaire d'énergie (EMS)");
  if (!modules_conformes) manquants.push("attestation modules conformes");

  const eligible = manquants.length === 0;
  const taux =
    eligible && draft.pv.tva_reduite ? TAUX_TVA_PV_REDUIT : TAUX_TVA_PV_PLEIN;
  return { kwc, ems, modules_conformes, eligible, taux, manquants };
}

/** Taux de TVA effectif d'un devis solaire (0,055 si éligible + coché, sinon 0,2). */
export function tauxTvaPv(
  draft: DevisDraft,
  articles: CatalogueArticle[],
): number {
  return pvEligibilite(draft, articles).taux;
}

// ── Sélections pré-cochées (points de départ MODIFIABLES, pas des forfaits) ──
// Chaque pack pose une composition de base ; le vendeur décoche/ajoute ensuite.
// Les articles sont résolus par (catégorie + fragment de désignation) pour ne
// pas dépendre d'un id de seed : robuste si Oury réordonne le catalogue.

export interface PackLigne {
  /** Reconnaît l'article cible dans le catalogue solaire. */
  match: (a: CatalogueArticle) => boolean;
  /** Quantité (fixe, ou dérivée du nombre de panneaux pour la pose/structure). */
  qty: number | ((panneaux: number, kwc: number) => number);
}

export interface PackSolaire {
  key: string;
  label: string;
  detail: string;
  /** Nombre de panneaux Jinko 630 W du point de départ. */
  panneaux: number;
  lignes: PackLigne[];
}

const estJinko = (a: CatalogueArticle) =>
  a.categorie === "panneau" && /jinko/i.test(a.designation);
const estOnduleur = (re: RegExp) => (a: CatalogueArticle) =>
  a.categorie === "onduleur" && re.test(a.designation);
const parCat = (c: CatalogueArticle["categorie"], re?: RegExp) => (a: CatalogueArticle) =>
  a.categorie === c && (!re || re.test(a.designation));

/** kWc rond de la pose (par kWc), calé sur la puissance du pack. */
const kwcArrondi = (_p: number, kwc: number) => Math.max(1, Math.round(kwc));

const LIGNES_COMMUNES = (ondRe: RegExp, avecEtudeStructure: boolean): PackLigne[] => [
  { match: estJinko, qty: 0 }, // remplacé par panneaux (posé dans buildPack)
  { match: estOnduleur(ondRe), qty: 1 },
  { match: parCat("ems"), qty: 1 },
  { match: parCat("structure_pv"), qty: 0 }, // = nb panneaux
  { match: parCat("protection_pv", /coffret/i), qty: 1 },
  { match: parCat("protection_pv", /câblage|cablage/i), qty: 1 },
  { match: parCat("pose"), qty: kwcArrondi },
  { match: parCat("etude", /pvgis|technique/i), qty: 1 },
  ...(avecEtudeStructure
    ? [{ match: parCat("etude", /structure|toiture/i), qty: 1 } as PackLigne]
    : []),
  { match: parCat("administratif"), qty: 1 },
];

export const PACKS_SOLAIRE: PackSolaire[] = [
  {
    key: "3kwc",
    label: "~3 kWc",
    detail: "5 panneaux · onduleur 3 kW · EMS — point de départ",
    panneaux: 5,
    lignes: LIGNES_COMMUNES(/3ktl|3\s*kw/i, false),
  },
  {
    key: "6kwc",
    label: "~6 kWc",
    detail: "10 panneaux · onduleur 6 kW · EMS — point de départ",
    panneaux: 10,
    lignes: LIGNES_COMMUNES(/6ktl|6\s*kw/i, false),
  },
  {
    key: "9kwc",
    label: "~9 kWc",
    detail: "14 panneaux (8,82 kWc) · onduleur 8 kW · EMS + étude structure",
    panneaux: 14,
    lignes: LIGNES_COMMUNES(/8ktl|8\s*kw/i, true),
  },
];

/**
 * Résout un pack en suppléments concrets (article_id + quantité), en fonction
 * du catalogue solaire réel. Les articles introuvables sont ignorés (le pack
 * reste un point de départ, pas une garantie). Structure & pose sont calées sur
 * le nombre de panneaux / la puissance.
 */
export function buildPackSupplements(
  pack: PackSolaire,
  articles: CatalogueArticle[],
): DevisSupplement[] {
  const solaires = articles.filter((a) => a.domaine === "solaire" && a.actif);
  const panneau = solaires.find(estJinko);
  const wc = panneau?.puissance_wc ?? 630;
  const kwc = Math.round(((pack.panneaux * wc) / 1000) * 100) / 100;

  const out: DevisSupplement[] = [];
  const pousse = (id: string, q: number) => {
    if (q <= 0) return;
    const existing = out.find((s) => s.article_id === id);
    if (existing) existing.quantite += q;
    else out.push({ article_id: id, quantite: q });
  };

  for (const ligne of pack.lignes) {
    const art = solaires.find(ligne.match);
    if (!art) continue;
    let q: number;
    if (art.categorie === "panneau") q = pack.panneaux;
    else if (art.categorie === "structure_pv") q = pack.panneaux;
    else q = typeof ligne.qty === "function" ? ligne.qty(pack.panneaux, kwc) : ligne.qty;
    pousse(art.id, q);
  }
  return out;
}

// ── Mentions PDF obligatoires / différenciantes (devis solaire) ──────────────

const pct = (t: number) => new Intl.NumberFormat("fr-FR").format(t * 100);

/**
 * Lignes de mentions du devis solaire, imprimées sur le PDF client. Couvre les
 * obligations (taux TVA + critères, rétractation 14 j) et la réassurance
 * (garanties, autoconsommation, monitoring, assurance habitation).
 */
export function mentionsSolaire(pv: DevisPv, kwc: number, taux: number): string[] {
  const L: string[] = [];
  L.push(
    `Installation photovoltaïque en autoconsommation${
      pv.autoconsommation === "avec_surplus" ? " avec vente du surplus" : " totale"
    } — puissance ${new Intl.NumberFormat("fr-FR").format(kwc)} kWc.`,
  );
  if (taux === TAUX_TVA_PV_REDUIT) {
    L.push(
      `TVA à ${pct(taux)} % — installation ≤ ${SEUIL_KWC_TVA} kWc avec gestionnaire d'énergie et modules conformes (attestation ACV/PEP).`,
    );
  } else {
    L.push(`TVA à ${pct(taux)} %.`);
  }
  L.push(
    "Garanties : panneaux 25-30 ans (produit), onduleur 10-12 ans, décennale installateur, garantie de production. Suivi de production inclus (application dédiée).",
  );
  L.push(
    "Raccordement & conformité : attestation Consuel, convention d'autoconsommation Enedis, déclaration préalable en mairie (démarches incluses).",
  );
  L.push(
    "Pensez à déclarer votre installation photovoltaïque à votre assureur habitation.",
  );
  L.push(
    "Vente à domicile : vous disposez d'un délai de rétractation de 14 jours (art. L221-18 du Code de la consommation).",
  );
  return L;
}
