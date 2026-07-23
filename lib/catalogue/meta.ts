import type {
  CategorieArticle,
  DomaineArticle,
  Unite,
} from "@/lib/catalogue/types";

export const CATEGORIE_LABEL: Record<CategorieArticle, string> = {
  // IRVE
  borne: "Bornes",
  pose: "Main d'œuvre — pose",
  tableau: "Tableau électrique",
  terre: "Mise à la terre",
  option: "Options",
  consommable: "Consommables & suppléments",
  deplacement: "Frais de déplacement",
  // Solaire
  panneau: "Panneaux",
  onduleur: "Onduleurs",
  ems: "Gestionnaire d'énergie (EMS)",
  structure_pv: "Structure & fixation",
  protection_pv: "Protection & câblage",
  etude: "Études & simulation",
  administratif: "Démarches administratives",
  batterie: "Batterie de stockage",
  maintenance: "Maintenance & SAV",
};

/** Domaine de chaque catégorie. `pose` est partagée → tranchée par le champ
 *  `domaine` de l'article, pas par la catégorie (voir CatalogueArticle). */
export const CATEGORIE_DOMAINE: Record<CategorieArticle, DomaineArticle | "both"> = {
  borne: "irve",
  pose: "both",
  tableau: "irve",
  terre: "irve",
  option: "irve",
  consommable: "irve",
  deplacement: "irve",
  panneau: "solaire",
  onduleur: "solaire",
  ems: "solaire",
  structure_pv: "solaire",
  protection_pv: "solaire",
  etude: "solaire",
  administratif: "solaire",
  batterie: "solaire",
  maintenance: "solaire",
};

/** Ordre d'affichage IRVE (inchangé). */
export const CATEGORIE_ORDER: CategorieArticle[] = [
  "borne",
  "pose",
  "tableau",
  "terre",
  "option",
  "consommable",
  "deplacement",
];

/** Ordre d'affichage solaire (composition logique d'un devis PV). */
export const CATEGORIE_ORDER_SOLAIRE: CategorieArticle[] = [
  "panneau",
  "onduleur",
  "ems",
  "batterie",
  "structure_pv",
  "protection_pv",
  "pose",
  "etude",
  "administratif",
  "maintenance",
];

/** Ordre complet (catalogue admin : IRVE puis solaire). */
export const CATEGORIE_ORDER_ALL: CategorieArticle[] = [
  ...CATEGORIE_ORDER,
  ...CATEGORIE_ORDER_SOLAIRE.filter((c) => c !== "pose"),
];

export const DOMAINE_LABEL: Record<DomaineArticle, string> = {
  irve: "IRVE — bornes",
  solaire: "Solaire — photovoltaïque",
};

export const UNITE_LABEL: Record<Unite, string> = {
  u: "u",
  forfait: "forfait",
  m: "m",
};
