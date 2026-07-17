"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_TAUX_MAD } from "@/lib/catalogue/prix";

// Réglages transverses. MVP : persistance localStorage.
// TODO: brancher données réelles — déplacer le taux dans une table Supabase
// partagée (aujourd'hui local au navigateur).
const STORAGE_KEY = "vde.settings.v1";

interface SettingsValue {
  loaded: boolean;
  /** Taux de change EUR → MAD (paramétrable). */
  tauxMad: number;
  setTauxMad: (v: number) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [tauxMad, setTaux] = useState(DEFAULT_TAUX_MAD);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { tauxMad?: number };
        if (typeof s.tauxMad === "number" && s.tauxMad > 0) setTaux(s.tauxMad);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const setTauxMad = (v: number) => {
    const val = Number.isFinite(v) && v > 0 ? v : DEFAULT_TAUX_MAD;
    setTaux(val);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tauxMad: val }));
    } catch {
      /* ignore */
    }
  };

  return (
    <SettingsContext.Provider value={{ loaded, tauxMad, setTauxMad }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings doit être utilisé dans <SettingsProvider>");
  }
  return ctx;
}
