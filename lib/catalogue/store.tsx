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
import type { CatalogueArticle } from "@/lib/catalogue/types";
import {
  catalogueRepoKind,
  getCatalogueRepository,
} from "@/lib/catalogue/repository";

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
  const [loaded, setLoaded] = useState(false);
  const [articles, setArticles] = useState<CatalogueArticle[]>([]);

  useEffect(() => {
    let active = true;
    getCatalogueRepository()
      .loadAll()
      .then((data) => {
        if (!active) return;
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
    void getCatalogueRepository().persistAll(articles);
  }, [loaded, articles]);

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
            ? { ...a, ...patch, updated_at: new Date().toISOString() }
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
