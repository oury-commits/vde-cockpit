"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { QtyStepper } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { CATEGORIE_LABEL, UNITE_LABEL } from "@/lib/catalogue/meta";
import type { CategorieArticle } from "@/lib/catalogue/types";
import { entiteConfig } from "@/lib/entite/config";
import { puVenteHt } from "@/lib/devis/pricing";
import { formatMontant } from "@/lib/format";

// Catégories proposées comme suppléments (borne/pose/tableau/terre = étape
// Configuration). On exclut les options déjà gérées là-bas (Consuel, schéma).
const SUP_CATEGORIES: CategorieArticle[] = ["consommable", "deplacement", "option"];

export function StepSupplements() {
  const { draft, articles, coutOf, setSupplement, toggleSupplement } = useWizard();
  const devise = entiteConfig(draft.entite).devise;

  const qtyOf = (id: string) =>
    draft.supplements.find((s) => s.article_id === id)?.quantite ?? 0;

  // En mode standard, les consommables « inclus par défaut » sont intégrés
  // d'office (disjoncteur selon le réseau) : on ne les propose pas en manuel.
  const groups = useMemo(
    () =>
      SUP_CATEGORIES.map((cat) => ({
        cat,
        items: articles.filter(
          (a) =>
            a.categorie === cat &&
            !/consuel|sch[ée]ma/i.test(a.designation) &&
            !(draft.mode === "standard" && a.inclus_defaut),
        ),
      })).filter((g) => g.items.length > 0),
    [articles, draft.mode],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Coche un article — sa ligne et son prix s&apos;ajoutent au devis en direct.
        Ajuste la quantité si besoin.
      </p>
      {groups.map(({ cat, items }) => (
        <section key={cat}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            {CATEGORIE_LABEL[cat]}
          </h3>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {items.map((a) => {
              const qty = qtyOf(a.id);
              const coche = qty > 0;
              const pv = formatMontant(puVenteHt(coutOf(a), draft.taux_marge), devise, {
                cents: true,
              });
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
                >
                  <button
                    type="button"
                    aria-pressed={coche}
                    onClick={() => toggleSupplement(a.id)}
                    className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                      coche ? "border-brand bg-brand text-cream" : "border-line text-transparent"
                    }`}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{a.designation}</span>
                    <span className="block font-mono text-xs text-muted">
                      {pv} / {UNITE_LABEL[a.unite]}
                    </span>
                    {a.url_produit ? (
                      <a
                        href={a.url_produit}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-brand underline"
                      >
                        Voir la fiche produit
                      </a>
                    ) : null}
                  </span>
                  {coche ? (
                    <QtyStepper value={qty} onChange={(v) => setSupplement(a.id, v)} min={1} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
