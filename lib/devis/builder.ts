import type { Entite, Lead, Reseau } from "@/lib/types";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import { CATEGORIE_ORDER } from "@/lib/catalogue/meta";
import { entiteConfig } from "@/lib/entite/config";
import { uid } from "@/lib/uid";
import { puVenteHt, round2, MARGE_DEFAUT } from "@/lib/devis/pricing";
import type {
  AideLigne,
  DevisConfig,
  DevisDraft,
  DevisLigne,
  DevisSupplement,
  ModeDevis,
} from "@/lib/devis/types";

// TODO: brancher données réelles — aides et barème à faire valider par Oury.
export function defaultAides(entite: Entite): AideLigne[] {
  if (entite === "MA") return [];
  return [
    {
      key: "grand_est",
      label: "Aide Locale Grand Est",
      actif: false,
      montant: 1000,
      note: "Subvention régionale — montant et éligibilité à confirmer",
    },
    {
      key: "advenir",
      label: "Prime Advenir — résidentiel",
      actif: false,
      montant: 0,
      note: "Montant selon barème Advenir en vigueur",
    },
    {
      key: "autre",
      label: "Autre aide / remise commerciale",
      actif: false,
      montant: 0,
    },
  ];
}

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

/** Consommables « inclus par défaut » (visserie, disjoncteurs) en mode standard. */
function standardSupplements(articles: CatalogueArticle[]): DevisSupplement[] {
  return articles
    .filter((a) => a.actif && a.inclus_defaut)
    .map((a) => ({ article_id: a.id, quantite: 1 }));
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
    aides: defaultAides(entite),
    config,
    supplements: mode === "standard" ? standardSupplements(articles) : [],
    taux_marge: MARGE_DEFAUT,
    remise: 0,
    mode_tva: entiteConfig(entite).tvaDefaut,
    mode_paiement: "40_40_20",
    notes: "",
  };
}

function ligneFromArticle(
  article: CatalogueArticle,
  quantite: number,
  marge: number,
): DevisLigne {
  const pu = puVenteHt(article.cout_ht, marge);
  return {
    id: uid(),
    article_id: article.id,
    designation: article.designation,
    categorie: article.categorie,
    unite: article.unite,
    quantite,
    cout_ht: article.cout_ht,
    taux_marge: marge,
    pu_ht: pu,
    total_ht: round2(pu * quantite),
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
): DevisLigne[] {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const lignes: DevisLigne[] = [];
  const push = (id: string | null, qty = 1) => {
    if (!id) return;
    const a = byId.get(id);
    if (a) lignes.push(ligneFromArticle(a, qty, marge));
  };

  push(draft.config.borne_id);
  push(draft.config.pose_id);
  push(draft.config.tableau_id);
  push(draft.config.terre_id);
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

export function aidesTotal(draft: DevisDraft): number {
  return round2(
    draft.aides
      .filter((a) => a.actif)
      .reduce((s, a) => s + (Number(a.montant) || 0), 0),
  );
}
