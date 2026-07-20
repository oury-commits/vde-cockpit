"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Intervention } from "@/lib/interventions/types";
import { buildInterventionsSeed } from "@/lib/interventions/seed";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirEntite } from "@/lib/roles/permissions";

const STORAGE_KEY = "vde.interventions.v1";

interface InterventionsValue {
  loaded: boolean;
  /** Interventions du périmètre PAYS de l'utilisateur. */
  interventions: Intervention[];
  /** Tournée de l'utilisateur courant — ses interventions à lui, rien d'autre. */
  maTournee: Intervention[];
}

const InterventionsContext = createContext<InterventionsValue | null>(null);

export function InterventionsProvider({ children }: { children: ReactNode }) {
  const { identite } = useIdentity();
  const [loaded, setLoaded] = useState(false);
  const [toutes, setToutes] = useState<Intervention[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setToutes(JSON.parse(raw) as Intervention[]);
        setLoaded(true);
        return;
      }
    } catch {
      /* ignore */
    }
    // TODO: brancher données réelles — pas encore de table `interventions` en
    // base ; le module Planning viendra alimenter ce store.
    setToutes(buildInterventionsSeed(new Date()));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toutes));
    } catch {
      /* ignore */
    }
  }, [loaded, toutes]);

  // Cloisonnement à la source, comme pour les leads : le store n'expose jamais
  // une intervention hors périmètre, quel que soit l'écran qui la demande.
  const interventions = useMemo(
    () => toutes.filter((i) => peutVoirEntite(identite, i.entite)),
    [toutes, identite],
  );

  // Une identité sans profil (simulation libre) n'a pas de tournée : on ne lui
  // en invente pas une, sinon la démonstration du cloisonnement serait fausse.
  const maTournee = useMemo(
    () =>
      identite.id
        ? interventions.filter((i) => i.technicien_id === identite.id)
        : [],
    [interventions, identite.id],
  );

  const value = useMemo<InterventionsValue>(
    () => ({ loaded, interventions, maTournee }),
    [loaded, interventions, maTournee],
  );

  return (
    <InterventionsContext.Provider value={value}>
      {children}
    </InterventionsContext.Provider>
  );
}

export function useInterventions(): InterventionsValue {
  const ctx = useContext(InterventionsContext);
  if (!ctx) {
    throw new Error("useInterventions doit être utilisé dans <InterventionsProvider>");
  }
  return ctx;
}
