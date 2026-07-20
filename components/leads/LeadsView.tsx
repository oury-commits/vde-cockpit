"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { useLeadsStore } from "@/lib/leads/store";
import { isLeadProtege } from "@/lib/leads/meta";
import { useEntity } from "@/lib/entite/EntityProvider";
import { ENTITE_LABEL } from "@/lib/entite/config";
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
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";

function defaultDir(key: SortKey): SortDir {
  return key === "relance" ? "asc" : "desc";
}

export function LeadsView() {
  const store = useLeadsStore();
  const { active } = useEntity();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOne, setConfirmOne] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null);
  const [confirmSelection, setConfirmSelection] = useState(false);
  const [viderOpen, setViderOpen] = useState(false);
  const [viderText, setViderText] = useState("");

  // Filtre entité (ne jamais mélanger FR/MA) + exclusion des archivés.
  const leads = useMemo(
    () =>
      store.leads.filter(
        (l) => !l.archived && (active === "ALL" || l.entite === active),
      ),
    [store.leads, active],
  );

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

  // Ids de l'entité active uniquement — garde-fou : ne jamais toucher l'autre.
  const entityIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);

  // Changer d'entité réinitialise la sélection (évite de supprimer l'autre).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [active]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllDisplayed = () =>
    setSelectedIds(new Set(groups.flatMap((g) => g.leads.map((l) => l.id))));
  const clearSelection = () => setSelectedIds(new Set());

  // Un lead avec devis signé / facture ne se supprime pas → propose l'archivage.
  const requestDelete = (id: string) => {
    const lead = store.leads.find((l) => l.id === id);
    if (lead && isLeadProtege(lead)) setArchiveConfirm(id);
    else setConfirmOne(id);
  };
  const doDeleteOne = () => {
    if (confirmOne) {
      store.deleteLead(confirmOne);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(confirmOne);
        return n;
      });
    }
    setConfirmOne(null);
  };
  const doArchive = () => {
    if (archiveConfirm) store.archiveLead(archiveConfirm);
    setArchiveConfirm(null);
  };
  const doDeleteSelection = () => {
    store.deleteLeads([...selectedIds].filter((id) => entityIds.has(id)));
    clearSelection();
    setConfirmSelection(false);
  };
  const doVider = () => {
    store.deleteLeads(leads.map((l) => l.id));
    clearSelection();
    setViderOpen(false);
    setViderText("");
  };

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
          <button
            type="button"
            onClick={() => {
              setViderText("");
              setViderOpen(true);
            }}
            disabled={active === "ALL" || leads.length === 0}
            title={
              active === "ALL"
                ? "Choisis une entité FR ou MA pour vider"
                : "Vider les leads de l'entité active (test)"
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-alert/30 px-3 text-[13px] font-medium text-alert transition-colors hover:bg-alert/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Vider (test)</span>
          </button>
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

      <KpiRow leads={leads} now={now} active={active} />

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

      {/* Barre de sélection multiple */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
          <span className="font-medium text-ink">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={selectAllDisplayed}
            className="text-brand hover:underline"
          >
            Tout sélectionner ({filteredCount})
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-muted hover:text-ink"
          >
            Désélectionner
          </button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            className="ml-auto"
            onClick={() => setConfirmSelection(true)}
          >
            Supprimer la sélection
          </Button>
        </div>
      ) : null}

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
        <LeadList
          groups={groups}
          now={now}
          selectedIds={selectedIds}
          onSelect={setSelected}
          onToggleSelect={toggleSelect}
          onDeleteOne={requestDelete}
        />
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

      {/* Suppression individuelle */}
      <Modal
        open={confirmOne !== null}
        onClose={() => setConfirmOne(null)}
        title="Supprimer ce lead ?"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOne(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={doDeleteOne}>
              Supprimer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Supprimer définitivement ce lead et tout son historique ? Cette action
          est irréversible.
        </p>
      </Modal>

      {/* Lead protégé (devis signé / facture) → archivage, pas suppression */}
      <Modal
        open={archiveConfirm !== null}
        onClose={() => setArchiveConfirm(null)}
        title="Archiver ce lead ?"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveConfirm(null)}>
              Annuler
            </Button>
            <Button onClick={doArchive}>Archiver</Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Ce lead porte un devis signé ou une facture émise : il ne peut pas
          être supprimé (obligation de conservation des pièces comptables). Il
          sera <span className="font-medium">archivé</span> — retiré des listes
          actives, mais conservé avec ses documents.
        </p>
      </Modal>

      {/* Suppression de la sélection */}
      <Modal
        open={confirmSelection}
        onClose={() => setConfirmSelection(false)}
        title="Supprimer la sélection ?"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSelection(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={doDeleteSelection}>
              Supprimer {selectedIds.size}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Supprimer définitivement{" "}
          <span className="font-semibold">{selectedIds.size}</span> lead
          {selectedIds.size > 1 ? "s" : ""} sélectionné
          {selectedIds.size > 1 ? "s" : ""} ? Cette action est irréversible.
        </p>
      </Modal>

      {/* Vider l'entité active (confirmation forte) */}
      <Modal
        open={viderOpen}
        onClose={() => {
          setViderOpen(false);
          setViderText("");
        }}
        title={`Vider tous les leads${active !== "ALL" ? ` — ${ENTITE_LABEL[active]}` : ""}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setViderOpen(false);
                setViderText("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={viderText !== "VIDER"}
              onClick={doVider}
            >
              Vider définitivement
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Cette action supprime{" "}
          <span className="font-mono font-semibold">{leads.length}</span> lead
          {leads.length > 1 ? "s" : ""} de l'entité{" "}
          <span className="font-semibold">
            {active === "ALL" ? "affichée" : ENTITE_LABEL[active]}
          </span>{" "}
          — l'autre entité n'est pas touchée. Irréversible.
        </p>
        <p className="mt-3 text-sm text-muted">
          Tape{" "}
          <span className="font-mono font-semibold text-alert">VIDER</span> pour
          confirmer :
        </p>
        <Input
          value={viderText}
          onChange={(e) => setViderText(e.target.value)}
          placeholder="VIDER"
          autoFocus
          className="mt-1"
        />
      </Modal>
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
