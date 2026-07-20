import type { Entite } from "@/lib/types";
import type { Identite, Role } from "@/lib/roles/types";

// Matrice module × rôle, appliquée À L'INTÉRIEUR de l'entité du user.
// Accès effectif = entité ∩ rôle : le cloisonnement pays est porté par
// `entite`, la matrice ci-dessous ne dit que « quoi faire dans son pays ».

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
  | "sav"
  | "techniciens"
  | "equipe"
  | "rapports"
  | "parametres";

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
  "/sav": "sav",
  "/equipe": "equipe",
  "/rapports": "rapports",
  "/parametres": "parametres",
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
    planning: "full", sav: "full", techniciens: "full", equipe: "full",
    rapports: "full", parametres: "full",
  },
  charge_affaires: {
    dashboard: "read", leads: "full", prospects: "full", clients: "full",
    devis: "full", catalogue: "full", validation: "full", inbox: "full",
    planning: "read", sav: "read", techniciens: N, equipe: N,
    rapports: "read", parametres: N,
  },
  conducteur_travaux: {
    // Règle d'or : ne voit JAMAIS un montant (cf. peutVoirMontants).
    dashboard: "read", leads: N, prospects: N, clients: "read",
    devis: N, catalogue: N, validation: N, inbox: N,
    planning: "full", sav: "full", techniciens: "full", equipe: N,
    rapports: "read", parametres: N,
  },
  technicien: {
    dashboard: N, leads: N, prospects: N, clients: "partial",
    devis: N, catalogue: N, validation: N, inbox: N,
    planning: "partial", sav: "partial", techniciens: N, equipe: N,
    rapports: N, parametres: N,
  },
  assistante: {
    // Admin-light : clients, documents, relances — jamais la configuration.
    dashboard: "read", leads: "full", prospects: "read", clients: "full",
    devis: "full", catalogue: "read", validation: "read", inbox: "full",
    planning: "read", sav: "read", techniciens: N, equipe: N,
    rapports: N, parametres: N,
  },
};

/** Accès d'une identité à un module. Deny by default si non assignée/inactive. */
export function accesModule(identite: Identite, module: ModuleKey): Acces {
  if (!identite.actif || !identite.role || !identite.entite) return "none";
  return MATRICE[identite.role][module];
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
 * marge, CA, trésorerie), partout, sans exception.
 */
export function peutVoirMontants(identite: Identite): boolean {
  if (!identite.actif || !identite.role) return false;
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
    "dashboard", "planning", "leads", "clients", "sav", "inbox", "rapports",
  ];
  for (const m of ordre) {
    if (peutVoirModule(identite, m)) {
      const route = Object.entries(MODULE_ROUTES).find(([, k]) => k === m)?.[0];
      if (route) return route;
    }
  }
  return "/acces-refuse";
}
