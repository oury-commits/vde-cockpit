import type {
  Canal,
  Emplacement,
  Fixation,
  MotifPerte,
  Occupation,
  Puissance,
  PvProjet,
  Reseau,
  Statut,
  Temperature,
  TypeLogement,
} from "@/lib/types";

/** Ordre du pipeline (§5). `perdu` est terminal, hors flux. */
export const STATUT_ORDER: Statut[] = [
  "nouveau",
  "a_qualifier",
  "qualifie",
  "devis_envoye",
  "signe",
  "planifie",
  "installe",
  "sav",
  "perdu",
];

/** Statuts du tunnel (colonnes Kanban à venir), sans `perdu`. */
export const PIPELINE_STATUTS: Statut[] = STATUT_ORDER.filter(
  (s) => s !== "perdu",
);

interface StatutMeta {
  label: string;
  /** Classes Tailwind (tokens CLAUDE.md uniquement) pour le badge. */
  badge: string;
}

export const STATUT_META: Record<Statut, StatutMeta> = {
  nouveau: { label: "Nouveau", badge: "bg-muted/12 text-muted" },
  a_qualifier: { label: "À qualifier", badge: "bg-gold/15 text-gold-ink" },
  qualifie: { label: "Qualifié", badge: "bg-gold/25 text-gold-ink" },
  devis_envoye: { label: "Devis envoyé", badge: "bg-brand/10 text-brand" },
  signe: { label: "Signé", badge: "bg-success/12 text-success" },
  planifie: { label: "Planifié", badge: "bg-brand/15 text-brand" },
  installe: { label: "Installé", badge: "bg-success/20 text-success" },
  sav: { label: "SAV", badge: "bg-gold-ink/12 text-gold-ink" },
  perdu: { label: "Perdu", badge: "bg-alert/10 text-alert" },
};

interface TemperatureMeta {
  label: string;
  order: number;
  /** Pastille de couleur (token). Froid = `muted` : aucun token bleu au design
   *  system, et zéro emoji — la cohérence chaud/tiède/froid passe par 3 tokens
   *  distincts (alert / gold / muted). */
  dot: string;
  text: string;
}

export const TEMPERATURE_META: Record<Temperature, TemperatureMeta> = {
  chaud: { label: "Chaud", order: 0, dot: "bg-alert", text: "text-alert" },
  tiede: { label: "Tiède", order: 1, dot: "bg-gold", text: "text-gold-ink" },
  froid: { label: "Froid", order: 2, dot: "bg-muted", text: "text-muted" },
};

export const CANAL_LABEL: Record<Canal, string> = {
  fb_ads: "Facebook Ads",
  import: "Import",
  manuel: "Manuel",
};

export const TYPE_LOGEMENT_LABEL: Record<TypeLogement, string> = {
  maison: "Maison",
  appartement: "Appartement",
};

export const PUISSANCE_LABEL: Record<Puissance, string> = {
  "3.7": "3,7 kW",
  "7.4": "7,4 kW",
  "11": "11 kW",
  "22": "22 kW",
};

export const MOTIF_PERTE_LABEL: Record<MotifPerte, string> = {
  prix: "Prix",
  delai: "Délai",
  injoignable: "Injoignable",
  concurrent: "Concurrent",
  autre: "Autre",
};

export const RESEAU_LABEL: Record<Reseau, string> = {
  mono: "Monophasé",
  tri: "Triphasé",
};

export const OCCUPATION_LABEL: Record<Occupation, string> = {
  proprietaire: "Propriétaire",
  locataire: "Locataire",
};

export const EMPLACEMENT_LABEL: Record<Emplacement, string> = {
  interieur: "Intérieur",
  exterieur: "Extérieur",
};

export const FIXATION_LABEL: Record<Fixation, string> = {
  murale: "Murale",
  pied: "Sur pied",
};

export const PV_PROJET_LABEL: Record<PvProjet, string> = {
  aucun: "Aucun",
  "3kwc": "3 kWc",
  "6kwc": "6 kWc",
  "9kwc": "9 kWc",
  autre: "Autre",
};

/** Membres de l'équipe VDE France (assignation). */
export const MEMBRES = ["Oury", "Shaima"] as const;
