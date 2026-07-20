import type { Entite, ModeTva, Reseau } from "@/lib/types";
import type { CategorieArticle, Unite } from "@/lib/catalogue/types";

// Modèle du devis en construction (wizard). Les lignes sont DÉRIVÉES des
// sélections + du catalogue (voir builder.ts) ; à la validation on fige les
// prix (snapshot) pour que l'édition ultérieure du catalogue ne bouge pas un
// devis déjà émis.

/** Deux modes d'entrée : forfait guidé ou accès complet au catalogue. */
export type ModeDevis = "standard" | "libre";

export const MODE_DEVIS_LABEL: Record<ModeDevis, string> = {
  standard: "Forfait Standard IRVE",
  libre: "Devis Libre",
};

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
  /**
   * URL de la fiche produit à encoder en QR sur le devis. Renseignée UNIQUEMENT
   * pour une borne dont le QR est activé — la règle est tranchée à la dérivation
   * (voir deriveLignes), l'aperçu et le PDF n'ont plus qu'à la lire.
   */
  url_produit?: string | null;
}

/** Contrôle technique /6 (sécurité électrique IRVE). */
export type ControleKey =
  | "type"
  | "poles"
  | "courbe"
  | "differentiel"
  | "cable"
  | "calibre";

export interface ControleLigne {
  key: ControleKey;
  label: string;
  valeur: string; // valeur calculée / attendue
  conforme: boolean;
}

// Note : aucune aide/subvention n'est affichée ni calculée sur le devis
// (décision produit : mieux vaut zéro aide qu'un montant faux). Le total est
// strictement HT + TVA. Voir `eligible_advenir` sur le lead : c'est un signal
// de qualification, sans effet sur le devis.

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
  mode: ModeDevis;
  client: DevisClient;
  /** Clés du contrôle marquées non conformes (les autres sont OK). */
  controle_non_conformes: ControleKey[];
  config: DevisConfig;
  supplements: DevisSupplement[];
  taux_marge: number; // marge cible globale (0.35 par défaut)
  remise: number; // réduction commerciale HT
  mode_tva: ModeTva;
  mode_paiement: ModePaiement;
  notes: string;
}

/** Vue de l'aperçu : interne (coûts + marge) ou client (prix de vente seuls). */
export type VueDevis = "client" | "interne";

export const WIZARD_STEPS = [
  { key: "client", label: "Client & conformité" },
  { key: "config", label: "Configuration" },
  { key: "supplements", label: "Suppléments" },
  { key: "synthese", label: "Synthèse" },
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number]["key"];
