"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EntiteAcces, Identite, Role } from "@/lib/roles/types";
import { ROLE_LABEL, identiteDeProfil } from "@/lib/roles/types";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAuthDisabled } from "@/lib/auth/config";

// Identité applicative courante. Trois modes :
// - AUTH RÉELLE (Supabase configuré + NEXT_PUBLIC_AUTH_DISABLED=false) :
//   l'identité DÉCOULE du profil de l'utilisateur connecté (profiles où
//   id = auth.uid()). Aucun repli admin : sans profil → « non assigné » = deny.
//   Le sélecteur de construction est retiré.
// - Construction (NEXT_PUBLIC_AUTH_DISABLED=true) : simulée par le sélecteur
//   dev (incarner un membre, ou identité libre rôle × entité), persistée en
//   localStorage. Sert à tester chaque combinaison sans login.
// - Démo local (pas de Supabase, auth non désactivée) : admin/ALL par défaut,
//   sans backend — vitrine sans données réelles.

const KEY = "vde.dev.identite";

/** Ce qui est persisté par le sélecteur (pas l'identité résolue). */
interface Simulation {
  profilId: string | null;
  role: Role | null;
  entite: EntiteAcces | null;
  actif: boolean;
}

const DEFAUT: Simulation = {
  profilId: null,
  role: "admin",
  entite: "ALL",
  actif: true,
};

/** Nom affiché déduit du rôle simulé (lisible dans la timeline en test). */
export function nomSimule(role: Role | null, entite: EntiteAcces | null): string {
  if (!role) return "Non assigné";
  if (role === "admin") return "Oury";
  const suffixe = entite && entite !== "ALL" ? ` ${entite}` : "";
  return `${ROLE_LABEL[role]}${suffixe}`;
}

interface IdentityValue {
  identite: Identite;
  /**
   * L'identité est résolue. Tant qu'elle ne l'est pas (profil en cours de
   * chargement), personne ne doit conclure « aucun droit » : on attendrait
   * sinon un refus d'accès à quelqu'un qui a parfaitement le droit d'entrer.
   */
  pret: boolean;
  /** true en mode construction : le sélecteur dev est disponible. */
  simulation: boolean;
  /** Profil incarné, ou null en identité libre. */
  profilId: string | null;
  incarner: (profilId: string | null) => void;
  setRole: (role: Role | null) => void;
  setEntite: (entite: EntiteAcces | null) => void;
  setActif: (actif: boolean) => void;
}

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { profilById, loaded: profilsCharges } = useProfiles();
  const { user, enabled, loading: authLoading } = useAuth();
  const [sim, setSim] = useState<Simulation>(DEFAUT);

  // Auth réelle = Supabase configuré ET mode construction désactivé. C'est le
  // seul cas où l'identité vient de l'utilisateur connecté (jamais du sélecteur).
  const authReelle = enabled && !isAuthDisabled;

  useEffect(() => {
    if (!isAuthDisabled) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<Simulation>;
      setSim({
        profilId: p.profilId ?? null,
        role: p.role ?? null,
        entite: p.entite ?? null,
        actif: p.actif ?? true,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Simulation) => {
    setSim(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const incarner = useCallback<IdentityValue["incarner"]>(
    (profilId) => persist({ ...sim, profilId }),
    [sim, persist],
  );

  // Bouger un curseur à la main sort du profil incarné : on ne laisse pas
  // croire qu'on regarde Julien alors qu'on a changé son rôle en local.
  const setRole = useCallback<IdentityValue["setRole"]>(
    (role) =>
      persist({
        ...sim,
        profilId: null,
        role,
        // `ALL` est réservé à l'admin : tout autre rôle retombe sur une entité.
        entite:
          role === "admin"
            ? (sim.entite ?? "ALL")
            : sim.entite === "ALL" || !sim.entite
              ? "FR"
              : sim.entite,
      }),
    [sim, persist],
  );

  const setEntite = useCallback<IdentityValue["setEntite"]>(
    (entite) => persist({ ...sim, profilId: null, entite }),
    [sim, persist],
  );

  const setActif = useCallback<IdentityValue["setActif"]>(
    (actif) => persist({ ...sim, profilId: null, actif }),
    [sim, persist],
  );

  // Source du profil :
  // - auth réelle → l'utilisateur connecté (id = auth.uid()) ;
  // - construction → le profil incarné par le sélecteur dev.
  const profil = profilById(authReelle ? (user?.id ?? null) : sim.profilId);

  const identite = useMemo<Identite>(() => {
    if (profil) return identiteDeProfil(profil);
    if (authReelle) {
      // Connecté mais SANS profil : aucun droit. On n'invente pas un admin.
      return {
        id: null,
        nom: user?.email ?? "Non assigné",
        role: null,
        entite: null,
        actif: false,
        overrides: {},
      };
    }
    // Construction / démo : identité libre du sélecteur (admin/ALL par défaut).
    return {
      id: null,
      nom: nomSimule(sim.role, sim.entite),
      role: sim.role,
      entite: sim.entite,
      actif: sim.actif,
      overrides: {},
    };
  }, [profil, authReelle, user?.email, sim.role, sim.entite, sim.actif]);

  // Identité non encore résolue → ne pas conclure « aucun droit » (sinon on
  // refuse l'accès à quelqu'un qui a le droit d'entrer, le temps du chargement).
  const pret = authReelle
    ? !authLoading && profilsCharges
    : !sim.profilId || profilsCharges;

  const value = useMemo<IdentityValue>(
    () => ({
      identite,
      pret,
      // Sélecteur dev disponible en construction UNIQUEMENT (jamais en auth réelle).
      simulation: isAuthDisabled,
      profilId: sim.profilId,
      incarner,
      setRole,
      setEntite,
      setActif,
    }),
    [identite, pret, sim.profilId, incarner, setRole, setEntite, setActif],
  );

  return (
    <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error("useIdentity doit être utilisé dans <IdentityProvider>");
  }
  return ctx;
}
