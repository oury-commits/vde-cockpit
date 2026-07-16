"use client";

import type { Lead, Temperature } from "@/lib/types";
import {
  type DevisState,
  type LeadCounts,
  type LeadFilters,
  type RelanceState,
  type SortKey,
  type SortDir,
  EMPTY_FILTERS,
  SAVED_VIEWS,
  countView,
  hasActiveFilters,
} from "@/lib/leads/filters";
import { STATUT_META, STATUT_ORDER, TEMPERATURE_META } from "@/lib/leads/meta";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { ArrowDownUp, X } from "lucide-react";

function Chip({
  active,
  onClick,
  children,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand bg-brand text-cream"
          : "border-line bg-surface text-muted hover:bg-cream hover:text-ink",
      )}
    >
      {dot ? <span className={cn("size-2 rounded-full", dot)} /> : null}
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "font-mono text-[11px]",
            active ? "text-cream/80" : "text-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

interface Props {
  leads: Lead[];
  now: Date;
  filters: LeadFilters;
  counts: LeadCounts;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
  activeView: string | null;
  onApplyView: (viewId: string) => void;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}

const RELANCE_LABEL: Record<RelanceState, string> = {
  en_retard: "En retard",
  aujourdhui: "Aujourd'hui",
  a_venir: "À venir",
};

const DEVIS_LABEL: Record<DevisState, string> = {
  sans: "Sans devis",
  envoye: "Devis envoyé",
  signe: "Devis signé",
};

export function FilterBar({
  leads,
  now,
  filters,
  counts,
  onChange,
  onReset,
  activeView,
  onApplyView,
  sort,
  onSort,
}: Props) {
  const toggle = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) =>
    onChange({ [key]: filters[key] === value ? null : value } as Partial<LeadFilters>);

  return (
    <div className="flex flex-col gap-3">
      {/* Vues sauvegardées */}
      <div className="flex flex-wrap gap-2">
        {SAVED_VIEWS.map((v) => {
          const n = countView(leads, v, now);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onApplyView(v.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                activeView === v.id
                  ? "border-brand bg-brand text-cream"
                  : "border-line bg-surface text-ink hover:bg-cream",
              )}
            >
              {v.label}
              <span
                className={cn(
                  "font-mono text-xs",
                  activeView === v.id ? "text-cream/80" : "text-gold-ink",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtres cumulables */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {(Object.keys(TEMPERATURE_META) as Temperature[]).map((t) => (
          <Chip
            key={t}
            active={filters.temperature === t}
            onClick={() => toggle("temperature", t)}
            dot={TEMPERATURE_META[t].dot}
            count={counts.temperature[t]}
          >
            {TEMPERATURE_META[t].label}
          </Chip>
        ))}

        <span className="mx-0.5 h-5 w-px bg-line" />

        {(Object.keys(RELANCE_LABEL) as RelanceState[]).map((r) => (
          <Chip
            key={r}
            active={filters.relance === r}
            onClick={() => toggle("relance", r)}
            count={counts.relance[r]}
          >
            {RELANCE_LABEL[r]}
          </Chip>
        ))}

        <span className="mx-0.5 h-5 w-px bg-line" />

        {(Object.keys(DEVIS_LABEL) as DevisState[]).map((d) => (
          <Chip
            key={d}
            active={filters.devis === d}
            onClick={() => toggle("devis", d)}
            count={counts.devis[d]}
          >
            {DEVIS_LABEL[d]}
          </Chip>
        ))}
      </div>

      {/* Statut · période · zone · tri */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Statut"
          value={filters.statut ?? ""}
          onChange={(e) =>
            onChange({ statut: (e.target.value || null) as LeadFilters["statut"] })
          }
          className="h-8 w-auto min-w-[9rem] text-[13px]"
        >
          <option value="">Tous les statuts</option>
          {STATUT_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUT_META[s].label} ({counts.statut[s]})
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-1">
          {(["jour", "7j", "30j"] as const).map((p) => (
            <Chip
              key={p}
              active={filters.periode === p}
              onClick={() => toggle("periode", p)}
            >
              {p === "jour" ? "Aujourd'hui" : p === "7j" ? "7 j" : "30 j"}
            </Chip>
          ))}
        </div>

        <input
          value={filters.zone}
          onChange={(e) => onChange({ zone: e.target.value })}
          placeholder="Zone (CP / ville)"
          className="h-8 w-36 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-muted focus:border-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/15"
        />

        <div className="ml-auto flex items-center gap-2">
          <Select
            aria-label="Trier par"
            value={sort.key}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="h-8 w-auto text-[13px]"
          >
            <option value="date">Date de réception</option>
            <option value="temperature">Température</option>
            <option value="montant">Montant devis</option>
            <option value="relance">Prochaine relance</option>
          </Select>
          <button
            type="button"
            aria-label="Inverser le tri"
            onClick={() => onSort(sort.key)}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            <ArrowDownUp className="size-4" strokeWidth={2} />
          </button>
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-alert"
            >
              <X className="size-3.5" strokeWidth={2} />
              Effacer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
