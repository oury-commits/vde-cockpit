// VDE Cockpit — Module CRM Leads : modèle de données.
// Tunnel unique : Lead → Qualif → Devis → Signé → Installé → SAV.
// Ce fichier est la source TypeScript ; le schéma SQL équivalent (prêt pour
// Supabase) vit dans supabase/migrations/. Tenir les deux alignés.

/**
 * Entité juridique / marché. Sépare TOUTES les données (VDE France / Maroc).
 * Ajouté dès maintenant pour la future architecture multi-entité (défaut FR) ;
 * le switch global + le filtrage viendront plus tard (hors périmètre actuel).
 */
export type Entite = "FR" | "MA";

/** Canal d'entrée du lead. */
export type Canal = "fb_ads" | "import" | "manuel";

/** Statuts du pipeline (§5). `perdu` est une sortie possible depuis tout statut. */
export type Statut =
  | "nouveau"
  | "a_qualifier"
  | "qualifie"
  | "devis_envoye"
  | "signe"
  | "planifie"
  | "installe"
  | "sav"
  | "perdu";

/** Température de scoring auto (§6.1). Pas d'emoji : rendu via token couleur. */
export type Temperature = "chaud" | "tiede" | "froid";

export type TypeLogement = "maison" | "appartement";

/** Puissance de borne souhaitée, en kW. */
export type Puissance = "3.7" | "7.4" | "11" | "22";

/** Motif de perte (obligatoire au passage en `perdu`). */
export type MotifPerte =
  | "prix"
  | "delai"
  | "injoignable"
  | "concurrent"
  | "autre";

/** Type d'entrée dans la timeline d'un lead (§6.10). */
export type ActiviteType =
  | "import"
  | "creation"
  | "appel"
  | "whatsapp"
  | "email"
  | "visite"
  | "note"
  | "devis"
  | "relance"
  | "statut"
  | "signature"
  | "paiement";

/** Statut d'une échéance de l'échéancier 40/40/20 (§6.6). */
export type StatutEcheance = "attendu" | "encaisse" | "en_retard";

/** Une échéance (acompte / démarrage / solde). */
export interface Echeance {
  label: "acompte" | "demarrage" | "solde";
  /** Pourcentage du TTC (40 / 40 / 20). */
  pct: number;
  /** Montant en euros (TTC × pct). */
  montant: number;
  statut: StatutEcheance;
  date_encaissement?: string | null;
}

/** Une ligne de devis. */
export interface LigneDevis {
  label: string;
  /** Montant HT de la ligne, en euros. */
  montant_ht: number;
}

/** Devis lié à un lead — format VDE-2026-XXX, TVA 5,5 % (IRVE résidentiel). */
export interface Devis {
  ref: string; // VDE-2026-XXX
  date_creation: string;
  lignes: LigneDevis[];
  montant_ht: number;
  taux_tva: number; // 0.055
  montant_tva: number;
  montant_ttc: number;
  statut: "brouillon" | "envoye" | "signe";
}

/** Entrée horodatée de la timeline. */
export interface Activite {
  id: string;
  lead_id: string;
  type: ActiviteType;
  contenu: string;
  auteur: string;
  created_at: string;
}

/** Un lead — cœur du CRM (§2). */
export interface Lead {
  id: string; // FB-XXX, incrémental, sans trou
  entite: Entite; // défaut FR
  date_reception: string;
  canal: Canal;
  source_campagne?: string | null;

  nom: string;
  telephone: string;
  email?: string | null;
  code_postal?: string | null;
  ville?: string | null;

  type_logement?: TypeLogement | null;
  type_vehicule?: string | null;
  puissance_souhaitee?: Puissance | null;
  distance_tableau?: number | null; // mètres
  eligible_advenir?: boolean | null;

  temperature: Temperature; // auto (§6.1)
  statut: Statut;
  montant_estime?: number | null;

  devis?: Devis | null;
  echeancier?: Echeance[] | null;

  prochaine_action?: string | null;
  date_relance?: string | null;
  motif_perte?: MotifPerte | null;

  assigne_a?: string | null; // Oury / Shaima
  notes?: string | null;

  created_at: string;
  updated_at: string;
  statut_change_at: string; // pour mesurer le temps par étape
}
