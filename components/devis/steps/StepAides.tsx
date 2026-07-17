"use client";

import { Input } from "@/components/ui/Field";
import { useWizard } from "@/components/devis/context";
import { entiteConfig } from "@/lib/entite/config";

export function StepAides() {
  const { draft, patchAide } = useWizard();
  const symbole = entiteConfig(draft.entite).symbole;

  if (draft.aides.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucune aide modélisée pour cette entité.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Aides et remises déduites du reste à charge (montant indicatif, hors
        calcul HT/TVA).
      </p>
      {draft.aides.map((a) => (
        <div key={a.key} className="rounded-lg border border-line bg-surface p-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={a.actif}
              onChange={(e) => patchAide(a.key, { actif: e.target.checked })}
            />
            <span className="flex-1 text-sm text-ink">{a.label}</span>
          </label>
          {a.actif ? (
            <div className="mt-3 flex items-center gap-2 pl-7">
              <span className="text-xs text-muted">Montant</span>
              <Input
                type="number"
                inputMode="decimal"
                className="w-36 font-mono"
                value={a.montant || ""}
                onChange={(e) =>
                  patchAide(a.key, { montant: Number(e.target.value) || 0 })
                }
                placeholder="0"
              />
              <span className="text-xs text-muted">{symbole}</span>
            </div>
          ) : null}
          {a.note ? (
            <p className="mt-1.5 pl-7 text-[11px] text-muted">{a.note}</p>
          ) : null}
        </div>
      ))}
      {/* TODO: brancher données réelles — barème Advenir en vigueur. */}
    </div>
  );
}
