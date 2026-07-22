"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirModule } from "@/lib/roles/permissions";

export function Topbar() {
  const { identite } = useIdentity();
  // Pas de raccourci vers un module inaccessible : ce serait une impasse.
  const peutCreerDevis = peutVoirModule(identite, "devis");

  // Recherche globale et cloche de notifications RETIRÉES tant qu'elles ne sont
  // pas branchées : un champ/bouton stylé qui ne fait rien est un faux-actif
  // (cul-de-sac). À réintroduire une fois la recherche et les notifications
  // réellement implémentées.
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-6">
      <EntitySwitcher />

      <div className="ml-auto flex items-center gap-2">
        {peutCreerDevis ? (
          <Link
            href="/devis/nouveau"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-cream transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Créer un devis</span>
            <span className="sm:hidden">Devis</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
