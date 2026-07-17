"use client";

import { Coins } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { useSettings } from "@/lib/settings/store";
import { formatMontant } from "@/lib/format";
import { arrondiMad } from "@/lib/catalogue/prix";

export function ParametresView() {
  const { tauxMad, setTauxMad } = useSettings();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageTitle>Paramètres</PageTitle>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Coins className="size-4 text-brand" strokeWidth={1.75} />
          Change EUR → MAD (Maroc)
        </h3>
        <p className="mt-1 text-sm text-muted">
          Taux appliqué pour dériver les prix du catalogue en dirhams. Un prix
          surchargé manuellement sur un article ignore ce taux.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label="1 EUR =">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="w-32 font-mono"
                value={tauxMad}
                onChange={(e) => setTauxMad(Number(e.target.value))}
              />
              <span className="text-sm text-muted">MAD</span>
            </div>
          </Field>
          <div className="rounded-lg bg-cream/60 px-4 py-2.5 font-mono text-sm text-ink">
            <span className="text-muted">Exemple : </span>
            {formatMontant(100, "EUR")} → {formatMontant(arrondiMad(100 * tauxMad), "MAD")}
          </div>
        </div>
        {/* TODO: brancher données réelles — taux à tenir à jour + persistance Supabase partagée. */}
      </section>
    </div>
  );
}
