import { Info } from "lucide-react";

/**
 * Bandeau permanent tant que les données sont des démos (Phase 2A).
 * TODO: brancher données réelles — retirer après import AppSheet réussi (2B).
 */
export function DemoBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13px] text-gold-ink">
      <Info className="size-4 shrink-0" strokeWidth={2} />
      <span>
        <span className="font-semibold">Données de démonstration</span>
        {" — import AppSheet en 2B. Aucun lead réel ici."}
      </span>
    </div>
  );
}
