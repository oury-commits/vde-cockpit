"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { MARGE_MAX } from "@/lib/devis/pricing";
import type { ModePaiement } from "@/lib/devis/types";
import type { ModeTva } from "@/lib/types";

export function StepSynthese() {
  const { draft, totaux, patch } = useWizard();
  const cfgEntite = entiteConfig(draft.entite);
  const devise = cfgEntite.devise;
  const m = (n: number) => formatMontant(n, devise, { cents: true });

  const margePct = Math.round(draft.taux_marge * 100);
  const setMargePct = (v: number) => {
    const clamped = Math.max(0, Math.min(v, MARGE_MAX * 100));
    patch({ taux_marge: clamped / 100 });
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Marge &amp; TVA</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Taux de marge (sur PV)"
            hint="PU vente HT = coût ÷ (1 − marge)"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={MARGE_MAX * 100}
                className="w-24 font-mono"
                value={margePct}
                onChange={(e) => setMargePct(Number(e.target.value) || 0)}
              />
              <span className="text-sm text-muted">%</span>
            </div>
          </Field>
          <Field label="Régime de TVA">
            <Select
              value={draft.mode_tva}
              onChange={(e) => patch({ mode_tva: e.target.value as ModeTva })}
            >
              {cfgEntite.tvaOptions.map((o) => (
                <option key={o.mode} value={o.mode}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Paiement</h3>
        <Segmented
          value={draft.mode_paiement}
          onChange={(v) => patch({ mode_paiement: v as ModePaiement })}
          options={[
            { value: "40_40_20", label: "40 / 40 / 20" },
            { value: "50_50", label: "50 / 50" },
          ]}
        />
      </section>

      <section>
        <Field label="Notes (bas de devis)">
          <Textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Précisions, conditions particulières…"
          />
        </Field>
      </section>

      {/* Récap chiffré (le détail vit dans l'aperçu). */}
      <section className="rounded-xl border border-line bg-cream/40 p-4">
        <div className="grid grid-cols-2 gap-3 font-mono text-sm sm:grid-cols-4">
          <Stat label="Total HT" value={m(totaux.montant_ht)} />
          <Stat label="TVA" value={m(totaux.montant_tva)} />
          <Stat label="Total TTC" value={m(totaux.montant_ttc)} strong />
          <Stat
            label="Marge"
            value={`${m(totaux.marge_euro)} · ${Math.round(totaux.marge_pct * 100)} %`}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={strong ? "text-base text-ink" : "text-sm text-ink"}>{value}</p>
    </div>
  );
}
