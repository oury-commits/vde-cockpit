import type { AlmaPlan, Entite, ModeTva, Reseau } from "@/lib/types";
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
  taux_tva: number; // TVA de la ligne (0.055 / 0.10 / 0.20 en FR, 0.20 en MA)
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

// Échéancier d'ACOMPTES VDE (versements directs du client). À ne pas confondre
// avec Alma (mode de paiement par un tiers). Défaut = 2 versements, le cas
// majoritaire ; 3 versements reste disponible.
export type ModePaiement = "50_50" | "40_40_20";

export const MODE_PAIEMENT_LABEL: Record<ModePaiement, string> = {
  "50_50": "2 versements · 50 / 50",
  "40_40_20": "3 versements · 40 / 40 / 20",
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
  /** Réduction commerciale : saisie en % du HT ou en montant fixe, + motif. */
  remise_type: "percent" | "montant";
  remise_valeur: number;
  remise_motif: string;
  /**
   * Régime TVA du devis : `fr_5_5` = taux PAR LIGNE (France),
   * `fr_autoliquidation` = tout à 0 % (B2B BTP), `ma_20` = MA figé 20 %.
   */
  mode_tva: ModeTva;
  /**
   * Surcharges de taux TVA par article (France). Clé = article_id (les ids de
   * ligne ne sont pas stables entre deux dérivations, l'article_id l'est).
   * Absent = taux par défaut de la catégorie.
   */
  taux_tva_overrides: Record<string, number>;
  mode_paiement: ModePaiement;
  /** Proposer Alma 2x/3x/4x au client (FR uniquement — ignoré/masqué en MA). */
  alma_propose: boolean;
  alma_plan: AlmaPlan;
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
