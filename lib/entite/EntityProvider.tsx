"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Entite } from "@/lib/types";
import { useIdentity } from "@/lib/roles/IdentityProvider";

/** Entité active du sélecteur global. "ALL" = vue admin « Tous ». */
export type ActiveEntite = Entite | "ALL";

interface EntityValue {
  active: ActiveEntite;
  setActive: (e: ActiveEntite) => void;
  /** Entité à appliquer aux nouveaux enregistrements (FR par défaut en "Tous"). */
  entiteForCreate: Entite;
  /**
   * true pour un utilisateur mono-entité : l'entité est imposée par son profil,
   * le toggle est masqué et `setActive` sans effet. Seul l'admin (entite=ALL)
   * peut basculer.
   */
  verrouille: boolean;
}

const STORAGE_KEY = "vde.entite";
const EntityContext = createContext<EntityValue | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const { identite } = useIdentity();
  const [choisie, setChoisie] = useState<ActiveEntite>("FR");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as ActiveEntite | null;
      if (raw === "FR" || raw === "MA" || raw === "ALL") setChoisie(raw);
    } catch {
      /* ignore */
    }
  }, []);

  // Cloisonnement : un user mono-entité est ÉPINGLÉ sur la sienne. Le toggle ne
  // vaut que pour l'admin (entite = ALL). Un compte non assigné ne voit rien.
  const imposee: ActiveEntite | null =
    identite.entite && identite.entite !== "ALL" ? identite.entite : null;
  const verrouille = imposee !== null;
  const active: ActiveEntite = imposee ?? choisie;

  const setActive = useCallback(
    (e: ActiveEntite) => {
      if (verrouille) return; // jamais de bascule pour un mono-entité
      setChoisie(e);
      try {
        localStorage.setItem(STORAGE_KEY, e);
      } catch {
        /* ignore */
      }
    },
    [verrouille],
  );

  const value: EntityValue = {
    active,
    setActive,
    entiteForCreate: active === "ALL" ? "FR" : active,
    verrouille,
  };

  return (
    <EntityContext.Provider value={value}>{children}</EntityContext.Provider>
  );
}

export function useEntity(): EntityValue {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error("useEntity doit être utilisé dans <EntityProvider>");
  return ctx;
}
