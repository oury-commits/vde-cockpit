"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import {
  catalogueRepoKind,
  getCatalogueRepository,
} from "@/lib/catalogue/repository";
import { useToast } from "@/components/ui/Toast";

/** Champs saisis à la création/édition d'un article. */
export type ArticleInput = Omit<
  CatalogueArticle,
  "id" | "created_at" | "updated_at"
>;

interface CatalogueStoreValue {
  loaded: boolean;
  isDemo: boolean;
  articles: CatalogueArticle[];
  addArticle: (input: ArticleInput) => void;
  updateArticle: (id: string, patch: Partial<CatalogueArticle>) => void;
  toggleActif: (id: string) => void;
}

const CatalogueContext = createContext<CatalogueStoreValue | null>(null);

function nextId(articles: CatalogueArticle[]): string {
  const max = articles.reduce((m, a) => {
    const n = Number(/^CAT-(\d+)$/.exec(a.id)?.[1] ?? 0);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `CAT-${String(max + 1).padStart(3, "0")}`;
}

export function CatalogueStoreProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const persistErr = useRef<string | null>(null);
  // Empreinte des données déjà en base : on ne ré-upsert QUE sur mutation réelle.
  // Le chargement seul ne doit rien ré-écrire — l'écriture catalogue est réservée
  // aux rôles autorisés (admin/CA), un lecteur seul déclencherait un « violates RLS ».
  const persisted = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [articles, setArticles] = useState<CatalogueArticle[]>([]);

  useEffect(() => {
    let active = true;
    getCatalogueRepository()
      .loadAll()
      .then((data) => {
        if (!active) return;
        persisted.current = JSON.stringify(data); // référence = état chargé
        setArticles(data);
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // Ne persiste QUE sur mutation réelle (le chargement ne ré-upsert rien).
    const snap = JSON.stringify(articles);
    if (snap === persisted.current) return;
    void getCatalogueRepository()
      .persistAll(articles)
      .then((res) => {
        if (res.error) {
          if (persistErr.current !== res.error) {
            persistErr.current = res.error;
            console.error("[persist] catalogue:", res.error);
            notify(`Sauvegarde impossible (${res.error}). Recharge la page.`, "alert");
          }
        } else {
          persistErr.current = null;
          persisted.current = snap;
        }
      });
  }, [loaded, articles, notify]);

  const addArticle = useCallback<CatalogueStoreValue["addArticle"]>((input) => {
    setArticles((prev) => {
      const ts = new Date().toISOString();
      const article: CatalogueArticle = {
        ...input,
        id: nextId(prev),
        created_at: ts,
        updated_at: ts,
      };
      return [article, ...prev];
    });
  }, []);

  const updateArticle = useCallback<CatalogueStoreValue["updateArticle"]>(
    (id, patch) => {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, ...patch, version: (a.version ?? 0) + 1, updated_at: new Date().toISOString() }
            : a,
        ),
      );
    },
    [],
  );

  const toggleActif = useCallback<CatalogueStoreValue["toggleActif"]>((id) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, actif: !a.actif, updated_at: new Date().toISOString() }
          : a,
      ),
    );
  }, []);

  const value = useMemo<CatalogueStoreValue>(
    () => ({
      loaded,
      isDemo: catalogueRepoKind === "local",
      articles,
      addArticle,
      updateArticle,
      toggleActif,
    }),
    [loaded, articles, addArticle, updateArticle, toggleActif],
  );

  return (
    <CatalogueContext.Provider value={value}>
      {children}
    </CatalogueContext.Provider>
  );
}

export function useCatalogueStore(): CatalogueStoreValue {
  const ctx = useContext(CatalogueContext);
  if (!ctx) {
    throw new Error(
      "useCatalogueStore doit être utilisé dans <CatalogueStoreProvider>",
    );
  }
  return ctx;
}
