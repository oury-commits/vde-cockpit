import type { CategorieArticle, Unite } from "@/lib/catalogue/types";

export const CATEGORIE_LABEL: Record<CategorieArticle, string> = {
  borne: "Bornes",
  pose: "Main d'œuvre — pose",
  tableau: "Tableau électrique",
  terre: "Mise à la terre",
  option: "Options",
  consommable: "Consommables & suppléments",
  deplacement: "Frais de déplacement",
};

export const CATEGORIE_ORDER: CategorieArticle[] = [
  "borne",
  "pose",
  "tableau",
  "terre",
  "option",
  "consommable",
  "deplacement",
];

export const UNITE_LABEL: Record<Unite, string> = {
  u: "u",
  forfait: "forfait",
  m: "m",
};
