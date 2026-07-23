import type { CatalogueArticle } from "@/lib/catalogue/types";
import { buildCatalogueSeed } from "@/lib/catalogue/seed";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "vde.catalogue.v1";

export interface CatalogueRepository {
  readonly kind: "local" | "supabase";
  loadAll(): Promise<CatalogueArticle[]>;
  /** `error` null = OK ; sinon message à REMONTER (jamais avalé). */
  persistAll(articles: CatalogueArticle[]): Promise<{ error: string | null }>;
}

class LocalCatalogueRepository implements CatalogueRepository {
  readonly kind = "local" as const;

  async loadAll(): Promise<CatalogueArticle[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CatalogueArticle[];
    } catch {
      /* ignore */
    }
    return buildCatalogueSeed(new Date());
  }

  async persistAll(articles: CatalogueArticle[]): Promise<{ error: string | null }> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "stockage local indisponible" };
    }
  }
}

class SupabaseCatalogueRepository implements CatalogueRepository {
  readonly kind = "supabase" as const;

  async loadAll(): Promise<CatalogueArticle[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from("catalogue").select("*");
    if (error) return []; // table absente → migration 0006 à appliquer
    if ((data?.length ?? 0) === 0) {
      // Premier chargement : on seed le catalogue dans Supabase.
      const seed = buildCatalogueSeed(new Date());
      await sb.from("catalogue").insert(seed);
      return seed;
    }
    return data as CatalogueArticle[];
  }

  async persistAll(articles: CatalogueArticle[]): Promise<{ error: string | null }> {
    const sb = getSupabase();
    if (!sb || articles.length === 0) return { error: null };
    const { error } = await sb.from("catalogue").upsert(articles);
    return { error: error ? `catalogue : ${error.message}` : null };
  }
}

let repository: CatalogueRepository | null = null;

export function getCatalogueRepository(): CatalogueRepository {
  if (!repository) {
    repository = isSupabaseConfigured
      ? new SupabaseCatalogueRepository()
      : new LocalCatalogueRepository();
  }
  return repository;
}

export const catalogueRepoKind: CatalogueRepository["kind"] =
  isSupabaseConfigured ? "supabase" : "local";
