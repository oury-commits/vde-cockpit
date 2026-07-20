"use client";

import { Check, Lock } from "lucide-react";
import type { Activite, Lead } from "@/lib/types";
import { JALONS_MANUELS, jalonActif, jalonsDerives } from "@/lib/leads/jalons";
import { useLeadsStore } from "@/lib/leads/store";
import { cn } from "@/lib/cn";

/**
 * Jalons de suivi. Les 4 premiers se cochent à la main (chaque clic écrit dans
 * l'historique, décocher aussi). Les 3 derniers sont DÉRIVÉS de l'état réel
 * (devis / échéancier / statut) donc en lecture seule : une case ne peut jamais
 * contredire le pipeline.
 */
export function JalonsRow({
  lead,
  activites,
}: {
  lead: Lead;
  activites: Activite[];
}) {
  const store = useLeadsStore();
  const derives = jalonsDerives(lead);

  return (
    <div className="flex flex-wrap gap-2">
      {JALONS_MANUELS.map((j) => {
        const actif = jalonActif(activites, j.key);
        return (
          <button
            key={j.key}
            type="button"
            aria-pressed={actif}
            onClick={() => store.toggleJalon(lead.id, j.key)}
            className={cn(
              // min-h-11 : cible tapable au pouce (44 px).
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              actif
                ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
                : "border-line bg-surface text-muted hover:bg-cream hover:text-ink",
            )}
          >
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border",
                actif ? "border-success bg-success text-cream" : "border-line",
              )}
            >
              {actif ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {j.label}
          </button>
        );
      })}

      {derives.map((d) => (
        <span
          key={d.key}
          title={`Automatique — ${d.source}`}
          className={cn(
            "inline-flex min-h-11 cursor-default items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium",
            d.actif
              ? "border-brand/25 bg-brand/8 text-brand"
              : "border-dashed border-line text-muted",
          )}
        >
          <span
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded-full border",
              d.actif ? "border-brand bg-brand text-cream" : "border-line",
            )}
          >
            {d.actif ? <Check className="size-2.5" strokeWidth={3} /> : null}
          </span>
          {d.label}
          <Lock className="size-3 shrink-0 opacity-40" strokeWidth={2} />
        </span>
      ))}
    </div>
  );
}
