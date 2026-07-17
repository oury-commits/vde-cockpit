"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import { useCatalogueStore } from "@/lib/catalogue/store";
import { useEntity } from "@/lib/entite/EntityProvider";
import {
  CATEGORIE_LABEL,
  CATEGORIE_ORDER,
  UNITE_LABEL,
} from "@/lib/catalogue/meta";
import { ENTITE_LABEL, entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { PageTitle } from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/Button";
import { ArticleDialog } from "@/components/catalogue/ArticleDialog";
import { cn } from "@/lib/cn";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ArticleRow({
  article,
  onEdit,
  onToggle,
}: {
  article: CatalogueArticle;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const devise = entiteConfig(article.entite).devise;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-line px-2 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3 sm:py-2",
        !article.actif && "opacity-45",
      )}
    >
      {/* Désignation : pleine ligne sur mobile, colonne extensible sur desktop. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <span className="text-sm text-ink sm:truncate">
          {article.designation}
        </span>
        {article.a_confirmer ? (
          <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-ink">
            à confirmer
          </span>
        ) : null}
        {article.inclus_defaut ? (
          <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
            inclus
          </span>
        ) : null}
      </div>
      {/* Méta + actions : 2e ligne sur mobile, alignées à droite sur desktop. */}
      <div className="flex items-center gap-3 sm:shrink-0">
        <span className="w-12 text-left text-xs text-muted sm:w-16 sm:text-right">
          {UNITE_LABEL[article.unite]}
        </span>
        <span className="flex-1 text-right font-mono text-sm text-ink sm:w-28 sm:flex-none">
          {formatMontant(article.cout_ht, devise, { cents: true })}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-16 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
            article.actif
              ? "bg-success/10 text-success hover:bg-success/20"
              : "bg-muted/15 text-muted hover:bg-muted/25",
          )}
        >
          {article.actif ? "Actif" : "Inactif"}
        </button>
        <button
          type="button"
          aria-label="Modifier"
          onClick={onEdit}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink"
        >
          <Pencil className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export function CatalogueView() {
  const store = useCatalogueStore();
  const { active } = useEntity();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogueArticle | null>(null);
  const [creating, setCreating] = useState(false);

  const entityArticles = useMemo(
    () =>
      store.articles.filter((a) => active === "ALL" || a.entite === active),
    [store.articles, active],
  );

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return q
      ? entityArticles.filter((a) => norm(a.designation).includes(q))
      : entityArticles;
  }, [entityArticles, search]);

  const byCategory = useMemo(
    () =>
      CATEGORIE_ORDER.map((cat) => ({
        cat,
        items: filtered.filter((a) => a.categorie === cat),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  if (!store.loaded) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="py-24 text-center text-sm text-muted">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-3">
          <PageTitle>Catalogue</PageTitle>
          <span className="font-mono text-sm text-muted">
            {entityArticles.length}
          </span>
        </div>
        <Button
          icon={Plus}
          className="ml-auto"
          onClick={() => setCreating(true)}
        >
          <span className="hidden sm:inline">Nouvel article</span>
          <span className="sm:hidden">Article</span>
        </Button>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un article…"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      {entityArticles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface/60 py-16 text-center">
          <p className="text-sm font-medium text-ink">
            Catalogue {active !== "ALL" ? ENTITE_LABEL[active] : ""} vide
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {active === "MA"
              ? "La conversion des prix en DH arrive au bloc 3."
              : "Ajoutez un article pour commencer."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {byCategory.map(({ cat, items }) => (
            <section key={cat}>
              <div className="mb-1 flex items-baseline gap-2 px-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {CATEGORIE_LABEL[cat]}
                </h3>
                <span className="font-mono text-[11px] text-muted">
                  {items.length}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface px-2">
                {items.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    onEdit={() => setEditing(a)}
                    onToggle={() => store.toggleActif(a.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ArticleDialog
        open={creating}
        onClose={() => setCreating(false)}
        entite={active === "ALL" ? "FR" : active}
      />
      <ArticleDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        entite={editing?.entite ?? "FR"}
        article={editing}
      />
    </div>
  );
}
