"use client";

import { useMemo } from "react";
import { QtyStepper } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { CATEGORIE_LABEL, UNITE_LABEL } from "@/lib/catalogue/meta";
import type { CategorieArticle } from "@/lib/catalogue/types";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";

// Catégories proposées comme suppléments (le reste est piloté par l'étape
// Configuration). On exclut les options déjà gérées là-bas (Consuel, schéma).
const SUP_CATEGORIES: CategorieArticle[] = ["consommable", "deplacement", "option"];

export function StepSupplements() {
  const { draft, articles, setSupplement } = useWizard();
  const devise = entiteConfig(draft.entite).devise;

  const qtyOf = (id: string) =>
    draft.supplements.find((s) => s.article_id === id)?.quantite ?? 0;

  const groups = useMemo(
    () =>
      SUP_CATEGORIES.map((cat) => ({
        cat,
        items: articles.filter(
          (a) =>
            a.categorie === cat &&
            !/consuel|sch[ée]ma/i.test(a.designation),
        ),
      })).filter((g) => g.items.length > 0),
    [articles],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Ajoutez les fournitures et suppléments au-delà du forfait. La quantité à
        zéro exclut la ligne du devis.
      </p>
      {groups.map(({ cat, items }) => (
        <section key={cat}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            {CATEGORIE_LABEL[cat]}
          </h3>
          <div className="rounded-xl border border-line bg-surface">
            {items.map((a) => {
              const qty = qtyOf(a.id);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{a.designation}</span>
                    <span className="block font-mono text-xs text-muted">
                      {formatMontant(a.cout_ht, devise, { cents: true })} / {UNITE_LABEL[a.unite]}
                    </span>
                  </span>
                  <QtyStepper
                    value={qty}
                    onChange={(v) => setSupplement(a.id, v)}
                    step={a.unite === "m" ? 1 : 1}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
