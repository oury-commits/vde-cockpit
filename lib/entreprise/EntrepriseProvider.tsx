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
import type { Entite } from "@/lib/types";
import { ficheVide, type ParametresEntreprise } from "@/lib/entreprise/types";
import { getEntrepriseRepository, entrepriseRepoKind } from "@/lib/entreprise/repository";
import { useIdentity } from "@/lib/roles/IdentityProvider";

interface EntrepriseValue {
  loaded: boolean;
  fiches: ParametresEntreprise[];
  /**
   * Fiche d'UNE entité. Renvoie toujours un objet (fiche vierge si absente) —
   * jamais celui d'une autre entité. C'est ce qui est passé aux générateurs :
   * un document ne voit QUE la fiche de sa propre société.
   */
  fiche: (entite: string) => ParametresEntreprise;
  /** Enregistre UNE fiche (admin uniquement). Ne touche jamais les autres entités. */
  enregistrer: (
    fiche: ParametresEntreprise,
  ) => Promise<{ ok: boolean; error?: string }>;
}

const EntrepriseContext = createContext<EntrepriseValue | null>(null);

export function EntrepriseProvider({ children }: { children: ReactNode }) {
  const { identite } = useIdentity();
  const [loaded, setLoaded] = useState(false);
  const [fiches, setFiches] = useState<ParametresEntreprise[]>([]);

  useEffect(() => {
    let actif = true;
    getEntrepriseRepository()
      .loadAll()
      .then((f) => {
        if (!actif) return;
        setFiches(f);
        setLoaded(true);
      })
      .catch(() => actif && setLoaded(true));
    return () => {
      actif = false;
    };
  }, []);

  const fiche = useCallback<EntrepriseValue["fiche"]>(
    (entite) => fiches.find((f) => f.entite === entite) ?? ficheVide(entite),
    [fiches],
  );

  const enregistrer = useCallback<EntrepriseValue["enregistrer"]>(
    async (input) => {
      // Garde-fou : seul l'admin écrit (miroir de la RLS). L'UI masque déjà
      // l'édition, ceci ferme la porte côté données.
      if (identite.role !== "admin") {
        return { ok: false, error: "Réservé à l'administrateur." };
      }
      const fiche: ParametresEntreprise = {
        ...input,
        updated_at: new Date().toISOString(),
        modifie_par: identite.nom,
      };
      const { error } = await getEntrepriseRepository().upsertOne(fiche);
      if (error) return { ok: false, error };
      // Mise à jour ciblée : uniquement la ligne de CETTE entité.
      setFiches((prev) =>
        prev.some((f) => f.entite === fiche.entite)
          ? prev.map((f) => (f.entite === fiche.entite ? fiche : f))
          : [...prev, fiche],
      );
      return { ok: true };
    },
    [identite.role, identite.nom],
  );

  const value = useMemo<EntrepriseValue>(
    () => ({ loaded, fiches, fiche, enregistrer }),
    [loaded, fiches, fiche, enregistrer],
  );

  return <EntrepriseContext.Provider value={value}>{children}</EntrepriseContext.Provider>;
}

export function useEntreprise(): EntrepriseValue {
  const ctx = useContext(EntrepriseContext);
  if (!ctx) throw new Error("useEntreprise doit être utilisé dans <EntrepriseProvider>");
  return ctx;
}

/** Raccourci typé pour un appelant qui a déjà l'entité du document. */
export function ficheDe(v: EntrepriseValue, entite: Entite): ParametresEntreprise {
  return v.fiche(entite);
}

export { entrepriseRepoKind };
