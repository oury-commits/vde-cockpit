import { Bell, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";

export function Topbar() {
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
        {/* Action réservée au module M2 — désactivée (même pattern que MA·MAD). */}
        <span title="Disponible au module M2 — Devis">
          <Button icon={Plus} disabled aria-disabled="true">
            <span className="hidden sm:inline">Créer un devis</span>
            <span className="sm:hidden">Devis</span>
          </Button>
        </span>
      </div>
    </header>
  );
}
