"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Upload, Users } from "lucide-react";
import { useLeadsStore } from "@/lib/leads/store";
import {
  EMPTY_FILTERS,
  SAVED_VIEWS,
  computeCounts,
  filterLeads,
  groupByPeriod,
  hasActiveFilters,
  sortLeads,
  type LeadFilters,
  type PeriodGroup,
  type SortDir,
  type SortKey,
} from "@/lib/leads/filters";
import { PageTitle } from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/Button";
import { DemoBanner } from "@/components/leads/DemoBanner";
import { KpiRow } from "@/components/leads/KpiRow";
import { FilterBar } from "@/components/leads/FilterBar";
import { LeadList } from "@/components/leads/LeadList";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { ImportDialog } from "@/components/leads/ImportDialog";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";

function defaultDir(key: SortKey): SortDir {
  return key === "relance" ? "asc" : "desc";
}

export function LeadsView() {
  const store = useLeadsStore();
  const now = useMemo(() => new Date(), []);

  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const { leads } = store;

  const searchBase = useMemo(
    () => filterLeads(leads, { ...EMPTY_FILTERS, search: filters.search }, now),
    [leads, filters.search, now],
  );
  const counts = useMemo(
    () => computeCounts(searchBase, now),
    [searchBase, now],
  );

  const groups = useMemo<PeriodGroup[]>(() => {
    const filtered = filterLeads(leads, filters, now);
    const sorted = sortLeads(filtered, sort.key, sort.dir);
    if (sort.key === "date") return groupByPeriod(sorted, now);
    return sorted.length ? [{ key: "all", label: "", leads: sorted }] : [];
  }, [leads, filters, sort, now]);

  const filteredCount = groups.reduce((n, g) => n + g.leads.length, 0);

  const change = (patch: Partial<LeadFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setActiveView(null);
  };
  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setActiveView(null);
  };
  const applyView = (viewId: string) => {
    const view = SAVED_VIEWS.find((v) => v.id === viewId);
    if (!view) return;
    if (activeView === viewId) {
      reset();
      return;
    }
    setFilters({ ...EMPTY_FILTERS, ...view.patch });
    setActiveView(viewId);
  };
  const onSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDir(key) },
    );
  };

  if (!store.loaded) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="py-24 text-center text-sm text-muted">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* En-tête */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-3">
          <PageTitle>Leads</PageTitle>
          <span className="font-mono text-sm text-muted">
            {filteredCount}
            {filteredCount !== leads.length ? ` / ${leads.length}` : ""}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            icon={Upload}
            onClick={() => setImportOpen(true)}
          >
            <span className="hidden sm:inline">Importer</span>
          </Button>
          <Button icon={Plus} onClick={() => setNewOpen(true)}>
            <span className="hidden sm:inline">Nouveau lead</span>
            <span className="sm:hidden">Lead</span>
          </Button>
        </div>
      </header>

      {store.isDemo ? <DemoBanner /> : null}

      {/* Recherche instantanée */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => change({ search: e.target.value })}
          placeholder="Rechercher un nom, téléphone, ville, n° devis…"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      <KpiRow leads={leads} now={now} />

      <FilterBar
        leads={leads}
        now={now}
        filters={filters}
        counts={counts}
        onChange={change}
        onReset={reset}
        activeView={activeView}
        onApplyView={applyView}
        sort={sort}
        onSort={onSort}
      />

      {/* Liste */}
      {leads.length === 0 ? (
        <EmptyState
          title="Aucun lead pour l'instant"
          hint="Importez un export CSV Facebook ou créez un lead manuellement."
        />
      ) : filteredCount === 0 ? (
        <EmptyState
          title="Aucun lead ne correspond"
          hint="Aucun résultat pour ces filtres."
          action={
            hasActiveFilters(filters) ? (
              <Button variant="secondary" onClick={reset}>
                Effacer les filtres
              </Button>
            ) : undefined
          }
        />
      ) : (
        <LeadList groups={groups} now={now} onSelect={setSelected} />
      )}

      <LeadDrawer leadId={selected} onClose={() => setSelected(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <NewLeadDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(lead) => {
          setNewOpen(false);
          setSelected(lead.id);
        }}
      />
    </div>
  );
}

function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface/60 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-cream text-muted">
        <Users className="size-6" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      {action}
    </div>
  );
}
