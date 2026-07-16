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

/** Entité active du sélecteur global. "ALL" = vue admin « Tous ». */
export type ActiveEntite = Entite | "ALL";

interface EntityValue {
  active: ActiveEntite;
  setActive: (e: ActiveEntite) => void;
  /** Entité à appliquer aux nouveaux enregistrements (FR par défaut en "Tous"). */
  entiteForCreate: Entite;
}

const STORAGE_KEY = "vde.entite";
const EntityContext = createContext<EntityValue | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState<ActiveEntite>("FR");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as ActiveEntite | null;
      if (raw === "FR" || raw === "MA" || raw === "ALL") setActiveState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setActive = useCallback((e: ActiveEntite) => {
    setActiveState(e);
    try {
      localStorage.setItem(STORAGE_KEY, e);
    } catch {
      /* ignore */
    }
  }, []);

  const value: EntityValue = {
    active,
    setActive,
    entiteForCreate: active === "ALL" ? "FR" : active,
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
