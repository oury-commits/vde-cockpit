import type { Entite, Lead, Reseau } from "@/lib/types";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import { CATEGORIE_ORDER } from "@/lib/catalogue/meta";
import { entiteConfig } from "@/lib/entite/config";
import { uid } from "@/lib/uid";
import { puVenteHt, round2, MARGE_DEFAUT } from "@/lib/devis/pricing";
import type {
  DevisConfig,
  DevisDraft,
  DevisLigne,
  ModeDevis,
} from "@/lib/devis/types";

// Aucune aide/subvention n'entre dans la construction du devis (FR comme MA) :
// le total est strictement HT + TVA. Décision produit — zéro aide vaut mieux
// qu'un montant faux.

/** Palier de pose Pn attendu pour une distance (m). 0-5→1 … >30→7. */
export function palierPose(distance_m: number): number {
  if (distance_m <= 5) return 1;
  if (distance_m <= 10) return 2;
  if (distance_m <= 15) return 3;
  if (distance_m <= 20) return 4;
  if (distance_m <= 25) return 5;
  if (distance_m <= 30) return 6;
  return 7;
}

const RESEAU_MOT: Record<Reseau, string> = {
  mono: "Monophasé",
  tri: "Triphasé",
};

/** Article de pose du catalogue correspondant au palier + réseau (seed FR). */
export function suggestPoseId(
  articles: CatalogueArticle[],
  reseau: Reseau,
  distance_m: number,
): string | null {
  const n = palierPose(distance_m);
  const mot = RESEAU_MOT[reseau];
  const match = articles.find(
    (a) =>
      a.categorie === "pose" &&
      a.actif &&
      new RegExp(`\\bP${n}\\b`).test(a.designation) &&
      a.designation.includes(mot),
  );
  return match?.id ?? null;
}

/** Borne adaptée à la puissance souhaitée + au réseau (mono/tri). */
export function suggestBorneId(
  articles: CatalogueArticle[],
  reseau: Reseau,
  puissance: string | null | undefined,
): string | null {
  const bornes = articles.filter((a) => a.categorie === "borne" && a.actif);
  if (bornes.length === 0) return null;
  const tri = reseau === "tri" || puissance === "11" || puissance === "22";
  const triRe = /tri|22\s*kW|11\s*kW/i;
  const pool = tri
    ? bornes.filter((b) => triRe.test(b.designation))
    : bornes.filter((b) => !triRe.test(b.designation));
  const chosen = pool[0] ?? bornes[0];
  return chosen?.id ?? null;
}

function baseConfig(): DevisConfig {
  return {
    borne_id: null,
    reseau: "mono",
    distance_m: 5,
    pose_id: null,
    tableau_id: null,
    terre_id: null,
    consuel: true,
    schema: false,
  };
}

function isDisjoncteur(a: CatalogueArticle): boolean {
  return /disjoncteur/i.test(a.designation);
}

/** Un disjoncteur correspond-il au réseau ? (mono ↔ monophasé, tri ↔ 3P+N). */
function disjoncteurPourReseau(a: CatalogueArticle, reseau: Reseau): boolean {
  const tri = /3p\s*\+\s*n|\(tri\)|triphas/i.test(a.designation);
  const mono = /monophas/i.test(a.designation);
  return reseau === "tri" ? tri : mono;
}

/**
 * Consommables « inclus par défaut » à intégrer d'office en mode standard.
 * Le disjoncteur est filtré selon le réseau : le monophasé n'apparaît que sur
 * une install mono, le triphasé (3P+N) que sur une install tri — plus de
 * décoche manuelle.
 */
export function inclusDefautIds(
  articles: CatalogueArticle[],
  reseau: Reseau,
): string[] {
  return articles
    .filter((a) => a.actif && a.inclus_defaut)
    .filter((a) => !isDisjoncteur(a) || disjoncteurPourReseau(a, reseau))
    .map((a) => a.id);
}

/**
 * Construit un brouillon de devis.
 * - `standard` : compose automatiquement (borne, pose, consommables inclus).
 * - `libre` : accès complet, pré-remplissage minimal.
 */
export function buildDraft(
  mode: ModeDevis,
  entite: Entite,
  lead: Lead | null,
  articles: CatalogueArticle[],
): DevisDraft {
  const reseau: Reseau = lead?.reseau ?? "mono";
  const distance_m = lead?.distance_tableau ?? 5;

  const config: DevisConfig = {
    ...baseConfig(),
    reseau,
    distance_m,
    pose_id: suggestPoseId(articles, reseau, distance_m),
  };

  if (mode === "standard") {
    config.borne_id = suggestBorneId(articles, reseau, lead?.puissance_souhaitee);
  }

  return {
    entite,
    lead_id: lead?.id ?? null,
    mode,
    client: {
      nom: lead?.nom ?? "",
      telephone: lead?.telephone ?? "",
      email: lead?.email ?? "",
      adresse: lead?.adresse ?? "",
      code_postal: lead?.code_postal ?? "",
      ville: lead?.ville ?? "",
    },
    controle_non_conformes: [],
    config,
    // Les consommables inclus par défaut sont dérivés (réseau-dépendants),
    // pas des suppléments figés : voir deriveLignes. Les suppléments sont
    // uniquement les ajouts manuels de l'utilisateur.
    supplements: [],
    taux_marge: MARGE_DEFAUT,
    remise_type: "percent",
    remise_valeur: 0,
    remise_motif: "",
    mode_tva: entiteConfig(entite).tvaDefaut,
    mode_paiement: "50_50", // 2 versements par défaut (cas majoritaire)
    alma_propose: false,
    alma_plan: 4,
    notes: "",
  };
}

function ligneFromArticle(
  article: CatalogueArticle,
  quantite: number,
  marge: number,
  cout: number,
): DevisLigne {
  const pu = puVenteHt(cout, marge);
  // QR réservé aux bornes (réassurance client) : jamais sur pose/consommables.
  const url_produit =
    article.categorie === "borne" && article.afficher_qr && article.url_produit
      ? article.url_produit
      : null;
  return {
    id: uid(),
    article_id: article.id,
    designation: article.designation,
    categorie: article.categorie,
    unite: article.unite,
    quantite,
    cout_ht: cout, // coût dans la devise de l'entité (EUR ou MAD converti)
    taux_marge: marge,
    pu_ht: pu,
    total_ht: round2(pu * quantite),
    url_produit,
  };
}

/**
 * Dérive les lignes du devis depuis les sélections + le catalogue.
 * Ordre : borne → pose → tableau → terre → options (schéma, Consuel) →
 * suppléments (dans l'ordre des catégories du catalogue).
 */
export function deriveLignes(
  draft: DevisDraft,
  articles: CatalogueArticle[],
  marge: number,
  coutOf: (article: CatalogueArticle) => number,
): DevisLigne[] {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const lignes: DevisLigne[] = [];
  const push = (id: string | null, qty = 1) => {
    if (!id) return;
    const a = byId.get(id);
    if (a) lignes.push(ligneFromArticle(a, qty, marge, coutOf(a)));
  };

  push(draft.config.borne_id);
  push(draft.config.pose_id);
  push(draft.config.tableau_id);
  push(draft.config.terre_id);
  // Mode standard : consommables inclus par défaut (disjoncteur adapté au réseau).
  if (draft.mode === "standard") {
    for (const id of inclusDefautIds(articles, draft.config.reseau)) push(id);
  }
  if (draft.config.schema) {
    const schema = articles.find(
      (a) => a.categorie === "option" && /sch[ée]ma/i.test(a.designation),
    );
    push(schema?.id ?? null);
  }
  if (draft.config.consuel) {
    const consuel = articles.find((a) => /consuel/i.test(a.designation));
    push(consuel?.id ?? null);
  }

  const order = new Map(CATEGORIE_ORDER.map((c, i) => [c, i]));
  const sups = [...draft.supplements]
    .filter((s) => s.quantite > 0 && byId.has(s.article_id))
    .sort((a, b) => {
      const ca = order.get(byId.get(a.article_id)!.categorie) ?? 99;
      const cb = order.get(byId.get(b.article_id)!.categorie) ?? 99;
      return ca - cb;
    });
  for (const s of sups) push(s.article_id, s.quantite);

  return lignes;
}
