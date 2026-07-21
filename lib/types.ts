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

/** Devise d'une entité (EUR pour FR, MAD/DH pour MA). */
export type Devise = "EUR" | "MAD";

/** Mode de TVA appliqué à un devis (dépend de l'entité). */
export type ModeTva =
  | "fr_5_5"
  | "fr_10"
  | "fr_20"
  | "fr_autoliquidation"
  | "ma_20";

/** Canal d'entrée du lead. */
export type Canal = "fb_ads" | "import" | "manuel";

/** Qualification IRVE (réponses du formulaire). */
export type Reseau = "mono" | "tri";
export type Occupation = "proprietaire" | "locataire";
export type Emplacement = "interieur" | "exterieur";
export type Fixation = "murale" | "pied";

/** Projet panneaux solaires — remplace l'ancien oui/non (cross-sell énergie). */
export type PvProjet = "aucun" | "3kwc" | "6kwc" | "9kwc" | "autre";

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

/**
 * Moyen d'un règlement REÇU par VDE.
 * `alma` est à part : Alma paie VDE en une fois (le client rembourse Alma).
 * Un règlement Alma solde donc le dossier — voir `estSoldeAlma`. Les autres
 * modes sont des versements directs du client (acomptes / solde VDE).
 */
export type ReglementMode = "virement" | "cheque" | "cb" | "especes" | "alma";

/**
 * Un encaissement réellement reçu. Source de vérité du « payé / reste » : le
 * solde se calcule TOUJOURS depuis ce registre, jamais saisi à la main.
 */
export interface Reglement {
  id: string;
  lead_id: string;
  entite: Entite;
  montant: number;
  mode: ReglementMode;
  /** Facture d'acompte émise pour ce versement (null pour un solde/Alma). */
  facture_acompte_ref?: string | null;
  encaisse_le: string;
  auteur: string;
}

/** Plan de paiement fractionné Alma proposé au client (FR uniquement). */
export type AlmaPlan = 2 | 3 | 4;

/** Une ligne de devis. */
export interface LigneDevis {
  label: string;
  /** Montant HT de la ligne, en euros. */
  montant_ht: number;
  /**
   * Taux de TVA de CETTE ligne (0.055, 0.10, 0.20…). Un devis peut porter
   * plusieurs taux (France) ; MA est figé à 0.20. Optionnel pour compat avec
   * les documents émis avant la TVA par ligne → on retombe alors sur le taux
   * global du document.
   */
  taux_tva?: number;
  /** Fiche produit à encoder en QR sur le PDF (bornes uniquement). */
  url_produit?: string | null;
  /** Catégorie catalogue d'origine (sert au modèle d'email : « votre borne »). */
  categorie?: string | null;
}

/**
 * Ventilation de la TVA par taux (Art. 242 nonies A, I CGI) : un document à
 * plusieurs taux doit présenter, PAR TAUX distinct, la base HT et la TVA — pas
 * un unique bloc global. `base_ht` est la base APRÈS remise (remise allouée au
 * prorata de chaque taux).
 */
export interface VentilationTva {
  taux: number;
  base_ht: number;
  montant_tva: number;
}

/**
 * Réduction commerciale. Déduite du HT **avant** TVA (ordre imposé par le
 * I-14° de l'art. 242 nonies A CGI) : HT brut − remise → HT net → TVA → TTC.
 * `montant` est toujours le montant € effectif ; `type`/`valeur` gardent la
 * saisie d'origine (10 % ou 500 €) pour l'afficher et la ré-éditer sans dérive.
 */
export interface RemiseInfo {
  type: "percent" | "montant";
  valeur: number; // 10 (= 10 %) ou 500 (= 500 €)
  montant: number; // € réellement déduit du HT brut
  motif?: string | null;
}

/** Devis lié à un lead. Devise, TVA et numérotation suivent l'entité. */
export interface Devis {
  ref: string; // VDE-2026-XXX (FR) / VDE-MA-2026-XXX (MA)
  entite: Entite;
  devise: Devise; // EUR (FR) / MAD (MA)
  date_creation: string;
  lignes: LigneDevis[];
  /**
   * HT AVANT remise (somme des lignes). Optionnel : absent des devis émis avant
   * l'introduction de la remise structurée → alors égal à `montant_ht`.
   */
  montant_ht_brut?: number;
  /** Réduction commerciale, ou null/absent si aucune. */
  remise?: RemiseInfo | null;
  montant_ht: number; // HT NET (après remise) — base de la TVA
  mode_tva: ModeTva;
  /** Taux global (compat). 0 = « mixte » quand plusieurs taux → voir ventilation. */
  taux_tva: number;
  /** Ventilation TVA par taux (source de vérité quand plusieurs taux). */
  ventilation_tva?: VentilationTva[];
  montant_tva: number;
  montant_ttc: number;
  statut: "brouillon" | "envoye" | "signe";
  /**
   * Option Alma 2x/3x/4x proposée au client (FR uniquement — jamais en MA).
   * C'est une facilité de paiement affichée, PAS un échéancier VDE : Alma paie
   * VDE en une fois, donc aucun solde à suivre côté VDE quand le client la choisit.
   */
  alma_propose?: boolean;
  alma_plan?: AlmaPlan;
  /** Horodatage de l'envoi au client (null tant que non envoyé). */
  envoye_le?: string | null;
  /** Destinataire du dernier envoi. */
  envoye_a?: string | null;
}

/**
 * Type d'une facture. `normale` = dossier payé en une fois. `acompte` = émise à
 * chaque versement (Art. 289 CGI). `solde` = facture finale qui déduit les
 * acomptes déjà facturés (Bloc C).
 */
export type FactureType = "normale" | "acompte" | "solde";

/** Facture d'acompte déduite sur une facture de solde (n° + date + montants). */
export interface AcompteDeduit {
  ref: string;
  date: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
}

/** Facture — issue d'un devis signé. Numérotation continue par entité. */
export interface Facture {
  ref: string; // FAC-2026-XXX (FR) / FAC-MA-2026-XXX (MA)
  entite: Entite;
  devise: Devise;
  date_creation: string;
  devis_ref: string; // devis d'origine
  /** Type (défaut `normale` pour les factures émises avant le fractionnement). */
  type?: FactureType;
  lignes: LigneDevis[];
  /** HT avant remise (reporté du devis). Absent = pas de remise. */
  montant_ht_brut?: number;
  /** Réduction commerciale reportée du devis. */
  remise?: RemiseInfo | null;
  montant_ht: number; // HT net (après remise)
  mode_tva: ModeTva;
  taux_tva: number; // 0 = mixte (plusieurs taux) → voir ventilation_tva
  /** Ventilation TVA par taux (Art. 242 nonies A). */
  ventilation_tva?: VentilationTva[];
  montant_tva: number;
  montant_ttc: number;
  /** Factures d'acompte déduites (facture de solde uniquement — Bloc C). */
  acomptes_deduits?: AcompteDeduit[];
  /** Horodatage de l'envoi au client (null tant que non envoyée). */
  envoye_le?: string | null;
  /** Destinataire du dernier envoi. */
  envoye_a?: string | null;
}

/**
 * Jalons de suivi cochables manuellement. Les jalons « Devis signé / Acompte
 * reçu / Installé » n'en font PAS partie : ils sont dérivés de l'état réel
 * (devis, échéancier, statut) pour qu'une case ne contredise jamais le pipeline.
 */
export type JalonKey = "appel" | "email" | "visite" | "relance";

/** Note interne (mémo équipe) vs échange réellement tenu avec le client. */
export type Visibilite = "interne" | "client";

/** Entrée horodatée de la timeline. Rien d'anonyme : auteur + date toujours. */
export interface Activite {
  id: string;
  lead_id: string;
  type: ActiviteType;
  contenu: string;
  auteur: string;
  created_at: string;
  /** Jalon coché/décoché par cette entrée. */
  jalon?: JalonKey | null;
  /** true = cette entrée annule le jalon (décoché) — jamais d'effacement. */
  annule?: boolean;
  /** Portée d'une note : mémo interne ou échange client. */
  visibilite?: Visibilite | null;
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
  adresse?: string | null; // rue (STREET_ADDRESS de l'export Facebook)
  code_postal?: string | null;
  ville?: string | null;

  type_logement?: TypeLogement | null;
  type_vehicule?: string | null;
  puissance_souhaitee?: Puissance | null;
  distance_tableau?: number | null; // mètres
  eligible_advenir?: boolean | null;

  // ── Qualification IRVE (formulaire Facebook, colonnes 0→11) ──
  reseau?: Reseau | null; // 0
  puissance_compteur_kva?: number | null; // 1
  occupation?: Occupation | null; // 3
  emplacement?: Emplacement | null; // 4
  fixation?: Fixation | null; // 5
  obstacles?: string | null; // 7
  budget?: string | null; // 10 (réponse brute du formulaire)
  delai?: string | null; // 11 (délai projet, réponse brute)
  pv_projet?: PvProjet | null; // 9 (panneaux solaires, enrichi en kWc)
  pv_autre?: string | null; // précision si pv_projet = "autre"

  temperature: Temperature; // auto (§6.1)
  statut: Statut;
  montant_estime?: number | null;

  devis?: Devis | null;
  /** Facture de clôture : `normale` (dossier simple) ou `solde` (après acomptes). */
  facture?: Facture | null;
  /** Factures d'acompte émises au fil des versements (Art. 289 CGI). */
  factures_acompte?: Facture[] | null;
  echeancier?: Echeance[] | null;
  /** Registre des encaissements — source de vérité du payé / reste. */
  reglements?: Reglement[] | null;

  prochaine_action?: string | null;
  date_relance?: string | null;
  motif_perte?: MotifPerte | null;
  /** Archivé : sorti des listes actives mais conservé (pièce comptable émise). */
  archived?: boolean | null;

  assigne_a?: string | null; // Oury / Shaima
  notes?: string | null;

  created_at: string;
  updated_at: string;
  statut_change_at: string; // pour mesurer le temps par étape

  /**
   * Verrou optimiste. Incrémenté à chaque écriture ; une écriture basée sur une
   * version périmée est refusée au lieu d'écraser. Couvre le lead ET ses
   * documents (devis/facture sont en JSONB sur cette ligne).
   */
  version?: number;
  /** Dernier auteur d'une modification — affiché dans le message de conflit. */
  modifie_par?: string | null;
}
