"use client";

import Link from "next/link";
import { Bell, Plus, Search } from "lucide-react";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirModule } from "@/lib/roles/permissions";

export function Topbar() {
  const { identite } = useIdentity();
  // Pas de raccourci vers un module inaccessible : ce serait une impasse.
  const peutCreerDevis = peutVoirModule(identite, "devis");

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-6">
      <EntitySwitcher />

      {/* Recherche */}
      <div className="relative hidden max-w-[430px] flex-1 md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
        />
        <input
          type="search"
          placeholder="Rechercher un client, un devis, un lead…"
          className="h-9 w-full rounded-lg border border-line bg-cream/50 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand/30 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {/* TODO: brancher données réelles — indicateur de notifications statique */}
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-alert" />
        </button>
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
