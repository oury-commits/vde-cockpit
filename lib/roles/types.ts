import type { Entite } from "@/lib/types";

// Rôles × entités. Le champ ENTITÉ cloisonne le pays ; le RÔLE définit ce qu'on
// fait à l'intérieur. Un chargé d'affaires MA = charge_affaires + entite=MA —
// il n'existe pas de « rôle marocain ».

export type Role =
  | "admin"
  | "charge_affaires"
  | "conducteur_travaux"
  | "technicien"
  | "assistante";

/** Périmètre pays. `ALL` est RÉSERVÉ à l'admin (Oury). */
export type EntiteAcces = Entite | "ALL";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin (Président)",
  charge_affaires: "Chargé d'affaires",
  conducteur_travaux: "Conducteur de travaux",
  technicien: "Technicien",
  assistante: "Assistante",
};

/**
 * Identité applicative courante. En mode construction elle vient du sélecteur
 * dev ; une fois l'auth activée elle viendra de `profiles`.
 * `role`/`entite` à `null` = compte non assigné → deny by default, aucun accès.
 */
export interface Identite {
  nom: string;
  role: Role | null;
  entite: EntiteAcces | null;
  actif: boolean;
}

/** Profil persisté (table `profiles`, créée à l'activation de l'auth). */
export interface Profile extends Identite {
  id: string;
  email: string;
  created_at: string;
}
