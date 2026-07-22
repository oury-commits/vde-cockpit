import type { Entite } from "@/lib/types";
import type {
  Acces,
  Identite,
  ModuleKey,
  OverrideKey,
  Overrides,
  Role,
} from "@/lib/roles/types";

export type { Acces, ModuleKey, OverrideKey, Overrides };

// Matrice module × rôle, appliquée À L'INTÉRIEUR de l'entité du user.
// Accès effectif = entité ∩ rôle ∩ dérogations : le cloisonnement pays est
// porté par `entite`, la matrice dit « quoi faire dans son pays », et les
// dérogations ajustent une personne sans déformer son rôle.

/** Route → module. Sert au masquage de nav ET au blocage de route. */
export const MODULE_ROUTES: Record<string, ModuleKey> = {
  "/dashboard": "dashboard",
  "/leads": "leads",
  "/prospects": "prospects",
  "/clients": "clients",
  "/devis": "devis",
  "/catalogue": "catalogue",
  "/validation": "validation",
  "/inbox": "inbox",
  "/planning": "planning",
  "/mobile": "mobile",
  "/sav": "sav",
  "/equipe": "equipe",
  "/rapports": "rapports",
  "/parametres": "parametres",
};

export const MODULE_LABEL: Record<OverrideKey, string> = {
  dashboard: "Tableau de bord",
  leads: "Leads",
  prospects: "Prospects",
  clients: "Clients",
  devis: "Devis",
  catalogue: "Catalogue",
  validation: "Validation",
  inbox: "Inbox",
  planning: "Planning & tournées",
  mobile: "Ma tournée (mobile)",
  sav: "SAV",
  techniciens: "Techniciens",
  equipe: "Équipe",
  rapports: "Rapports",
  parametres: "Paramètres",
  montants: "Voir les montants",
};

const N: Acces = "none";

/**
 * Matrice de la spec. Les modules absents du tableau d'origine (catalogue,
 * validation, inbox, sav) sont déduits par cohérence — signalés ici pour que
 * tu puisses les corriger d'un coup d'œil.
 */
const MATRICE: Record<Role, Record<ModuleKey, Acces>> = {
  admin: {
    dashboard: "full", leads: "full", prospects: "full", clients: "full",
    devis: "full", catalogue: "full", validation: "full", inbox: "full",
    planning: "full", mobile: "full", sav: "full", techniciens: "full",
    equipe: "full", rapports: "full", parametres: "full",
  },
  charge_affaires: {
    dashboard: "read", leads: "full", prospects: "full", clients: "full",
    devis: "full", catalogue: "full", validation: "full", inbox: "full",
    planning: "read", mobile: N, sav: "read", techniciens: N,
    equipe: N, rapports: "read", parametres: N,
  },
  conducteur_travaux: {
    // Règle d'or : ne voit JAMAIS un montant (cf. peutVoirMontants).
    dashboard: "read", leads: N, prospects: N, clients: "read",
    devis: N, catalogue: N, validation: N, inbox: N,
    planning: "full", mobile: N, sav: "full", techniciens: "full",
    equipe: N, rapports: "read", parametres: N,
  },
  technicien: {
    // `mobile` est SA tournée à lui : le filtre par personne est dans l'écran.
    dashboard: N, leads: N, prospects: N, clients: "partial",
    devis: N, catalogue: N, validation: N, inbox: N,
    planning: "partial", mobile: "full", sav: "partial", techniciens: N,
    equipe: N, rapports: N, parametres: N,
  },
  assistante: {
    // Admin-light : clients, documents, relances — jamais la configuration.
    dashboard: "read", leads: "full", prospects: "read", clients: "full",
    devis: "full", catalogue: "read", validation: "read", inbox: "full",
    planning: "read", mobile: N, sav: "read", techniciens: N,
    equipe: N, rapports: N, parametres: N,
  },
};

/** Accès prévu par le RÔLE seul, dérogations ignorées. */
export function accesDuRole(role: Role | null, module: ModuleKey): Acces {
  return role ? MATRICE[role][module] : "none";
}

/**
 * Accès d'une identité à un module. Deny by default si non assignée/inactive.
 * Une dérogation ne peut PAS ressusciter un compte désactivé ou non assigné :
 * on ne contourne pas la porte d'entrée par un droit ponctuel.
 */
export function accesModule(identite: Identite, module: ModuleKey): Acces {
  if (!identite.actif || !identite.role || !identite.entite) return "none";
  return identite.overrides?.[module] ?? MATRICE[identite.role][module];
}

export function peutVoirModule(identite: Identite, module: ModuleKey): boolean {
  return accesModule(identite, module) !== "none";
}

/**
 * Cloisonnement pays, au niveau de l'ENREGISTREMENT.
 * Contrôler l'accès au module ne suffit pas : sans ce filtre, forcer une URL
 * (`/leads/FB-011` depuis un compte FR) afficherait un dossier de l'autre
 * entité. Appliqué à la source, dans le store, pour couvrir tous les écrans.
 */
export function peutVoirEntite(identite: Identite, entite: Entite): boolean {
  if (!identite.actif || !identite.entite) return false;
  return identite.entite === "ALL" || identite.entite === entite;
}

/**
 * Le conducteur de travaux et le technicien ne voient AUCUN montant (devis,
 * marge, CA, trésorerie), partout, sans exception — sauf dérogation nominative
 * assumée par l'admin (`montants`), qui est signalée comme sensible.
 */
export function peutVoirMontants(identite: Identite): boolean {
  if (!identite.actif || !identite.role) return false;
  const derogation = identite.overrides?.montants;
  if (derogation) return derogation !== "none";
  return !(
    identite.role === "conducteur_travaux" || identite.role === "technicien"
  );
}

/** Module correspondant à un chemin (préfixe le plus long). */
export function moduleForPath(pathname: string): ModuleKey | null {
  const hit = Object.keys(MODULE_ROUTES)
    .filter((r) => pathname === r || pathname.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? MODULE_ROUTES[hit] : null;
}

/** Première route autorisée — cible de repli quand un accès est refusé. */
export function routeDeRepli(identite: Identite): string {
  const ordre: ModuleKey[] = [
    "dashboard", "mobile", "planning", "leads", "clients", "sav", "inbox",
    "rapports",
  ];
  for (const m of ordre) {
    if (peutVoirModule(identite, m)) {
      const route = Object.entries(MODULE_ROUTES).find(([, k]) => k === m)?.[0];
      if (route) return route;
    }
  }
  return "/acces-refuse";
}

// ---------------------------------------------------------------------------
// Dérogations ponctuelles
// ---------------------------------------------------------------------------

/** Clés proposées à la dérogation, dans l'ordre d'affichage. */
export const OVERRIDE_KEYS: OverrideKey[] = [
  "montants", "dashboard", "leads", "prospects", "clients", "devis",
  "catalogue", "validation", "inbox", "planning", "mobile", "sav", "equipe",
  "rapports", "parametres",
];

/**
 * Accès dont l'ouverture engage l'entreprise : argent, configuration, ou
 * pouvoir sur les droits des autres. Ils restent accordables — c'est l'admin
 * qui décide — mais jamais d'un simple clic distrait.
 */
const CONSEQUENCE: Partial<Record<OverrideKey, string>> = {
  montants:
    "Cette personne verra les prix, les marges et la trésorerie. Pour un conducteur de travaux ou un technicien, c'est une règle métier qu'on lève, pas un réglage d'affichage.",
  equipe:
    "Cette personne pourra modifier les rôles et les droits de toute l'équipe — y compris les siens. C'est l'équivalent d'un accès administrateur.",
  parametres:
    "Cette personne pourra changer la configuration de l'entreprise (taux de change, mentions légales, numérotation).",
  validation:
    "Cette personne pourra valider un devis, donc engager l'entreprise auprès d'un client.",
  catalogue:
    "Cette personne verra les coûts d'achat et pourra modifier les prix de vente du catalogue.",
  devis:
    "Cette personne pourra établir et modifier des devis, avec les montants et les marges associés.",
  rapports:
    "Cette personne accédera aux indicateurs consolidés (chiffre d'affaires, marges).",
};

export function estSensible(cle: OverrideKey): boolean {
  return cle in CONSEQUENCE;
}

/**
 * Pourquoi une personne voit (ou non) les montants : par son rôle, ou par une
 * dérogation nominative. Sert à l'encart « Accès sensibles » de l'écran Équipe.
 */
export function raisonMontants(
  role: Role | null,
  overrides: Overrides | undefined,
): { voit: boolean; par: "role" | "derogation" } {
  const derog = overrides?.montants;
  if (derog) return { voit: derog !== "none", par: "derogation" };
  const parRole = !!role && role !== "conducteur_travaux" && role !== "technicien";
  return { voit: parRole, par: "role" };
}

/**
 * Message de confirmation, ou null si l'accès ne mérite pas d'interruption.
 * Retirer un droit n'est jamais sensible : on ne fait pas confirmer une
 * restriction, seulement une ouverture.
 */
export function confirmationRequise(
  cle: OverrideKey,
  acces: Acces,
  role: Role | null,
): string | null {
  if (acces === "none") return null; // on ne fait pas confirmer une restriction
  if (accordeParLeRole(cle, role)) return null; // pas une ouverture : un ajustement
  return CONSEQUENCE[cle] ?? null;
}

/** Le rôle donne-t-il déjà cet accès, sans dérogation ? */
function accordeParLeRole(cle: OverrideKey, role: Role | null): boolean {
  if (cle === "montants") {
    return !!role && role !== "conducteur_travaux" && role !== "technicien";
  }
  return accesDuRole(role, cle) !== "none";
}

/** Dérogations réellement divergentes du rôle (une case remise à l'identique n'en est pas une). */
export function overridesEffectifs(
  role: Role | null,
  overrides: Overrides | undefined,
): OverrideKey[] {
  if (!overrides) return [];
  return (Object.keys(overrides) as OverrideKey[]).filter((k) => {
    const valeur = overrides[k];
    if (!valeur) return false;
    if (k === "montants") return (valeur !== "none") !== accordeParLeRole(k, role);
    return valeur !== accesDuRole(role, k);
  });
}
