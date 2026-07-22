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

export type Acces = "full" | "read" | "partial" | "none";

export type ModuleKey =
  | "dashboard"
  | "leads"
  | "prospects"
  | "clients"
  | "devis"
  | "catalogue"
  | "validation"
  | "inbox"
  | "planning"
  | "mobile"
  | "sav"
  | "techniciens"
  | "equipe"
  | "rapports"
  | "parametres";

/**
 * Clés dérogeables. `montants` n'est pas un écran : c'est la règle transverse
 * « ce rôle ne voit jamais un montant ». On la rend dérogeable explicitement
 * plutôt que de la contourner en ouvrant un module financier — sinon on
 * obtiendrait un écran de devis aux chiffres masqués, donc inutilisable.
 */
export type OverrideKey = ModuleKey | "montants";

/** Dérogations accordées à UNE personne, par-dessus la matrice de son rôle. */
export type Overrides = Partial<Record<OverrideKey, Acces>>;

/**
 * Identité applicative courante. En mode construction elle vient du sélecteur
 * dev ; une fois l'auth activée elle viendra de `profiles`.
 * `role`/`entite` à `null` = compte non assigné → deny by default, aucun accès.
 */
export interface Identite {
  /** Id du profil quand l'identité vient de l'équipe ; null en identité libre. */
  id: string | null;
  nom: string;
  role: Role | null;
  entite: EntiteAcces | null;
  actif: boolean;
  overrides: Overrides;
}

/** Profil persisté (table `profiles`). */
export interface Profile {
  id: string;
  email: string;
  nom: string;
  telephone?: string | null;
  role: Role | null;
  entite: EntiteAcces | null;
  actif: boolean;
  overrides: Overrides;
  /** Compte de démonstration — jamais un vrai salarié. */
  demo: boolean;
  /**
   * Horodatage de l'invitation envoyée. Renseigné → « invitation en attente »
   * tant que `derniere_connexion` est null. Les comptes de démo l'ont à null.
   */
  invite_le?: string | null;
  /** Dernière connexion (auth réelle) ; null tant que jamais connecté → « — ». */
  derniere_connexion?: string | null;
  /** Traçabilité des droits : qui a modifié, et quand. */
  modifie_par: string | null;
  modifie_le: string | null;
  created_at: string;
}

/** Un membre invité mais pas encore connecté (invitation en attente). */
export function estInviteEnAttente(p: Profile): boolean {
  return Boolean(p.invite_le) && !p.derniere_connexion && p.actif;
}

/** Nature d'une entrée du journal des accès. */
export type AccessAction =
  | "creation"
  | "role"
  | "entite"
  | "override"
  | "activation"
  | "suppression";

/**
 * Entrée du journal des accès : toute création / changement de rôle / dérogation
 * / (dés)activation / suppression, horodatée et attribuée. Rien d'anonyme.
 */
export interface AccessLogEntry {
  id: string;
  at: string;
  auteur: string;
  action: AccessAction;
  /** Personne concernée (nom). */
  cible: string;
  /** Détail lisible : « rôle : technicien → chargé d'affaires ». */
  detail: string;
}

/** Identité dérivée d'un profil — le profil est la source de vérité. */
export function identiteDeProfil(p: Profile): Identite {
  return {
    id: p.id,
    nom: p.nom,
    role: p.role,
    entite: p.entite,
    actif: p.actif,
    overrides: p.overrides,
  };
}
