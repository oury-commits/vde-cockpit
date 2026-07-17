import type { Entite, ModeTva, Reseau } from "@/lib/types";
import type { CategorieArticle, Unite } from "@/lib/catalogue/types";

// Modèle du devis en construction (wizard). Les lignes sont DÉRIVÉES des
// sélections + du catalogue (voir builder.ts) ; à l'enregistrement on fige les
// prix (snapshot) pour que l'édition ultérieure du catalogue ne bouge pas un
// devis déjà émis.

/** Ligne de devis dérivée (prix figés au moment du calcul). */
export interface DevisLigne {
  id: string;
  article_id: string | null; // null = ligne libre / hors catalogue
  designation: string; // snapshot
  categorie: CategorieArticle | "libre";
  unite: Unite;
  quantite: number;
  cout_ht: number; // snapshot du coût de revient HT
  taux_marge: number; // marge sur PV appliquée à cette ligne
  pu_ht: number; // PU vente HT dérivé = cout_ht / (1 − marge)
  total_ht: number; // pu_ht × quantite
}

export interface ConformitePoint {
  key: string;
  label: string;
  ok: boolean;
}

export interface AideLigne {
  key: string;
  label: string;
  actif: boolean;
  montant: number; // déduction indicative sur le reste à charge
  note?: string;
}

export type ModePaiement = "40_40_20" | "50_50";

export const MODE_PAIEMENT_LABEL: Record<ModePaiement, string> = {
  "40_40_20": "40 / 40 / 20",
  "50_50": "50 / 50",
};

export interface DevisClient {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  code_postal: string;
  ville: string;
}

/** Sélections de l'étape « Configuration technique ». */
export interface DevisConfig {
  borne_id: string | null;
  reseau: Reseau;
  distance_m: number;
  pose_id: string | null; // article de pose retenu (auto-suggéré depuis la distance)
  tableau_id: string | null; // null = aucun
  terre_id: string | null; // null = aucune
  consuel: boolean;
  schema: boolean;
}

export interface DevisSupplement {
  article_id: string;
  quantite: number;
}

export interface DevisDraft {
  entite: Entite;
  lead_id: string | null;
  client: DevisClient;
  conformite: ConformitePoint[];
  aides: AideLigne[];
  config: DevisConfig;
  supplements: DevisSupplement[];
  taux_marge: number; // global (0.35 par défaut)
  mode_tva: ModeTva;
  mode_paiement: ModePaiement;
  notes: string;
}

/** Vue de l'aperçu : interne (coûts + marge) ou client (prix de vente seuls). */
export type VueDevis = "client" | "interne";

export const WIZARD_STEPS = [
  { key: "client", label: "Client" },
  { key: "aides", label: "Aides" },
  { key: "config", label: "Configuration" },
  { key: "supplements", label: "Suppléments" },
  { key: "synthese", label: "Synthèse" },
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number]["key"];
