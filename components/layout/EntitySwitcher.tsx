"use client";

import { useEntity, type ActiveEntite } from "@/lib/entite/EntityProvider";
import { cn } from "@/lib/cn";

const OPTIONS: { value: ActiveEntite; label: string }[] = [
  { value: "FR", label: "FR · EUR" },
  { value: "MA", label: "MA · MAD" },
  { value: "ALL", label: "Tous" },
];

/**
 * Sélecteur d'entité global. Filtre tout (leads, clients, devis, KPI). Mémorisé.
 * « Tous » est une vue de consolidation réservée à l'admin : un utilisateur
 * mono-entité ne voit pas le sélecteur, seulement son pays (non modifiable).
 */
export function EntitySwitcher() {
  const { active, setActive, verrouille } = useEntity();

  if (verrouille) {
    const courant = OPTIONS.find((o) => o.value === active);
    return (
      <span className="flex shrink-0 items-center rounded-lg bg-cream px-2.5 py-1.5 text-xs font-semibold tracking-[0.03em] text-brand">
        {courant?.label ?? active}
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-cream p-[3px]">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setActive(o.value)}
          aria-pressed={active === o.value}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold tracking-[0.03em] transition-colors",
            active === o.value
              ? "bg-brand text-cream"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
