import type { Lead, Reseau } from "@/lib/types";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import { CATEGORIE_ORDER } from "@/lib/catalogue/meta";
import { entiteConfig } from "@/lib/entite/config";
import type { Entite } from "@/lib/types";
import { uid } from "@/lib/uid";
import { puVenteHt, round2, MARGE_DEFAUT } from "@/lib/devis/pricing";
import type {
  AideLigne,
  ConformitePoint,
  DevisConfig,
  DevisDraft,
  DevisLigne,
} from "@/lib/devis/types";

// ── Contenu métier à valider ────────────────────────────────────────────────
// TODO: brancher données réelles — les 6 points de conformité et les aides
// ci-dessous sont une proposition à faire valider par Oury (montants Advenir,
// libellés exacts) avant livraison MVP.

export function defaultConformite(): ConformitePoint[] {
  return [
    { key: "compteur", label: "Puissance du compteur suffisante (kVA)", ok: false },
    { key: "reseau", label: "Réseau (mono/tri) compatible avec la borne", ok: false },
    { key: "terre", label: "Prise de terre < 100 Ω", ok: false },
    { key: "tableau", label: "Tableau conforme / emplacement disjoncteur", ok: false },
    { key: "cheminement", label: "Cheminement du câble praticable", ok: false },
    { key: "consuel", label: "Attestation Consuel prévue", ok: false },
  ];
}

export function defaultAides(entite: Entite): AideLigne[] {
  if (entite === "MA") return []; // pas d'aide IRVE marocaine modélisée pour l'instant
  return [
    {
      key: "advenir",
      label: "Prime Advenir — résidentiel",
      actif: false,
      montant: 0,
      note: "Montant à confirmer selon barème Advenir en vigueur",
    },
    {
      key: "autre",
      label: "Autre aide / remise commerciale",
      actif: false,
      montant: 0,
    },
  ];
}

function defaultConfig(): DevisConfig {
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

export function emptyDraft(entite: Entite): DevisDraft {
  return {
    entite,
    lead_id: null,
    client: { nom: "", telephone: "", email: "", adresse: "", code_postal: "", ville: "" },
    conformite: defaultConformite(),
    aides: defaultAides(entite),
    config: defaultConfig(),
    supplements: [],
    taux_marge: MARGE_DEFAUT,
    mode_tva: entiteConfig(entite).tvaDefaut,
    mode_paiement: "40_40_20",
    notes: "",
  };
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

/** Pré-remplit un devis depuis un lead (client + qualif → configuration). */
export function draftFromLead(
  lead: Lead,
  articles: CatalogueArticle[],
): DevisDraft {
  const base = emptyDraft(lead.entite);
  const reseau: Reseau = lead.reseau ?? "mono";
  const distance_m = lead.distance_tableau ?? 5;

  const config: DevisConfig = {
    ...base.config,
    reseau,
    distance_m,
    pose_id: suggestPoseId(articles, reseau, distance_m),
  };

  // Pré-cochage conformité depuis la qualif (ce qui est déductible).
  const conformite = base.conformite.map((p) => {
    if (p.key === "reseau" && lead.reseau) return { ...p, ok: true };
    if (p.key === "compteur" && (lead.puissance_compteur_kva ?? 0) >= 6)
      return { ...p, ok: true };
    return p;
  });

  return {
    ...base,
    lead_id: lead.id,
    client: {
      nom: lead.nom ?? "",
      telephone: lead.telephone ?? "",
      email: lead.email ?? "",
      adresse: lead.adresse ?? "",
      code_postal: lead.code_postal ?? "",
      ville: lead.ville ?? "",
    },
    conformite,
    config,
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

  // Suppléments, triés selon l'ordre des catégories du catalogue.
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
