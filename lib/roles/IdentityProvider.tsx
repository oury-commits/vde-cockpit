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
import { ROLE_LABEL } from "@/lib/roles/types";
import { isAuthDisabled } from "@/lib/auth/config";

// Identité applicative courante.
// - Mode construction (NEXT_PUBLIC_AUTH_DISABLED=true) : simulée par le
//   sélecteur dev, persistée en localStorage. Permet de tester chaque
//   combinaison (rôle × entité) sans login.
// - TODO P3 : une fois l'auth activée, lire la ligne `profiles` de auth.uid()
//   et supprimer entièrement le sélecteur.

const KEY = "vde.dev.identite";

const ADMIN: Identite = { nom: "Oury", role: "admin", entite: "ALL", actif: true };

/** Nom affiché déduit du rôle simulé (lisible dans la timeline en test). */
export function nomSimule(role: Role | null, entite: EntiteAcces | null): string {
  if (!role) return "Non assigné";
  if (role === "admin") return "Oury";
  const suffixe = entite && entite !== "ALL" ? ` ${entite}` : "";
  return `${ROLE_LABEL[role]}${suffixe}`;
}

interface IdentityValue {
  identite: Identite;
  /** true en mode construction : le sélecteur dev est disponible. */
  simulation: boolean;
  setRole: (role: Role | null) => void;
  setEntite: (entite: EntiteAcces | null) => void;
  setActif: (actif: boolean) => void;
}

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identite, setIdentite] = useState<Identite>(ADMIN);

  useEffect(() => {
    if (!isAuthDisabled) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Identite>;
        setIdentite({
          role: p.role ?? null,
          entite: p.entite ?? null,
          actif: p.actif ?? true,
          nom: nomSimule(p.role ?? null, p.entite ?? null),
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Identite) => {
    setIdentite(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setRole = useCallback<IdentityValue["setRole"]>(
    (role) =>
      persist({
        ...identite,
        role,
        // `ALL` est réservé à l'admin : tout autre rôle retombe sur une entité.
        entite:
          role === "admin"
            ? identite.entite ?? "ALL"
            : identite.entite === "ALL" || !identite.entite
              ? "FR"
              : identite.entite,
        nom: nomSimule(
          role,
          role === "admin" ? "ALL" : identite.entite === "ALL" ? "FR" : identite.entite,
        ),
      }),
    [identite, persist],
  );

  const setEntite = useCallback<IdentityValue["setEntite"]>(
    (entite) =>
      persist({ ...identite, entite, nom: nomSimule(identite.role, entite) }),
    [identite, persist],
  );

  const setActif = useCallback<IdentityValue["setActif"]>(
    (actif) => persist({ ...identite, actif }),
    [identite, persist],
  );

  const value = useMemo<IdentityValue>(
    () => ({ identite, simulation: isAuthDisabled, setRole, setEntite, setActif }),
    [identite, setRole, setEntite, setActif],
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
