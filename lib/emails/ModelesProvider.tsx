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
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { uid } from "@/lib/uid";
import type { ModeleEmail } from "@/lib/emails/types";
import {
  getModelesRepository,
  modelesRepoKind,
  type SaveResult,
} from "@/lib/emails/repository";

interface ModelesValue {
  loaded: boolean;
  modeles: ModeleEmail[];
  /** Enregistre (création ou MÀJ) — admin only, verrou optimiste. */
  save: (modele: ModeleEmail, estNouveau: boolean) => Promise<SaveResult>;
  /** Duplique un modèle (désactivé par défaut). */
  duplicate: (id: string) => Promise<SaveResult>;
  /** Supprime un modèle — admin only. */
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const ModelesContext = createContext<ModelesValue | null>(null);

const REFUS: SaveResult = { ok: false, error: "Réservé à l'administrateur." };

export function ModelesProvider({ children }: { children: ReactNode }) {
  const { identite } = useIdentity();
  const [loaded, setLoaded] = useState(false);
  const [modeles, setModeles] = useState<ModeleEmail[]>([]);

  useEffect(() => {
    let actif = true;
    getModelesRepository()
      .loadAll()
      .then((m) => {
        if (!actif) return;
        setModeles(m);
        setLoaded(true);
      })
      .catch(() => actif && setLoaded(true));
    return () => {
      actif = false;
    };
  }, []);

  const save = useCallback<ModelesValue["save"]>(
    async (modele, estNouveau) => {
      if (identite.role !== "admin") return REFUS;
      const withMeta: ModeleEmail = {
        ...modele,
        modifie_par: identite.nom,
        updated_at: new Date().toISOString(),
      };
      const res = await getModelesRepository().save(withMeta, estNouveau);
      if (res.ok) {
        setModeles((prev) =>
          estNouveau
            ? [...prev, res.modele]
            : prev.map((m) => (m.id === res.modele.id ? res.modele : m)),
        );
      }
      return res;
    },
    [identite.role, identite.nom],
  );

  const duplicate = useCallback<ModelesValue["duplicate"]>(
    async (id) => {
      if (identite.role !== "admin") return REFUS;
      const src = modeles.find((m) => m.id === id);
      if (!src) return { ok: false, error: "Modèle introuvable." };
      const suffixe = uid().slice(0, 4);
      const copie: ModeleEmail = {
        ...src,
        id: `MEL-${uid()}`,
        cle: `${src.cle}-${suffixe}`,
        nom: `${src.nom} (copie)`,
        actif: false,
        version: 0,
        modifie_par: identite.nom,
        updated_at: new Date().toISOString(),
      };
      const res = await getModelesRepository().save(copie, true);
      if (res.ok) setModeles((prev) => [...prev, res.modele]);
      return res;
    },
    [identite.role, identite.nom, modeles],
  );

  const remove = useCallback<ModelesValue["remove"]>(
    async (id) => {
      if (identite.role !== "admin") return { ok: false, error: "Réservé à l'administrateur." };
      const { error } = await getModelesRepository().remove(id);
      if (!error) setModeles((prev) => prev.filter((m) => m.id !== id));
      return { ok: !error, error: error ?? undefined };
    },
    [identite.role],
  );

  const value = useMemo<ModelesValue>(
    () => ({ loaded, modeles, save, duplicate, remove }),
    [loaded, modeles, save, duplicate, remove],
  );

  return <ModelesContext.Provider value={value}>{children}</ModelesContext.Provider>;
}

export function useModeles(): ModelesValue {
  const ctx = useContext(ModelesContext);
  if (!ctx) throw new Error("useModeles doit être utilisé dans <ModelesProvider>");
  return ctx;
}

export { modelesRepoKind };
