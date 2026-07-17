"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Lead } from "@/lib/types";
import type { PeriodGroup } from "@/lib/leads/filters";
import { relanceState, leadMontant } from "@/lib/leads/filters";
import { StatutBadge, TemperatureDot } from "@/components/leads/badges";
import { entiteConfig } from "@/lib/entite/config";
import { anciennete, formatMontant } from "@/lib/format";
import { cn } from "@/lib/cn";

function RelanceHint({ lead, now }: { lead: Lead; now: Date }) {
  const r = relanceState(lead, now);
  if (r === "en_retard")
    return <span className="text-alert">Relance en retard</span>;
  if (r === "aujourdhui")
    return <span className="text-gold-ink">À relancer aujourd'hui</span>;
  if (r === "a_venir")
    return <span className="text-muted">Relance à venir</span>;
  return <span className="text-muted">Reçu {anciennete(lead.date_reception, now)}</span>;
}

function LeadRow({
  lead,
  now,
  selected,
  onSelect,
  onToggleSelect,
  onDeleteOne,
}: {
  lead: Lead;
  now: Date;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDeleteOne: (id: string) => void;
}) {
  const montant = leadMontant(lead);
  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-3 border-b border-line px-2 py-2.5 text-left transition-colors last:border-0 hover:bg-cream/60",
        selected && "bg-brand/5",
      )}
    >
      {/* Clic sur la ligne = aperçu (drawer) ; clic sur le nom = fiche complète. */}
      <button
        type="button"
        aria-label={`Aperçu de ${lead.nom}`}
        onClick={() => onSelect(lead.id)}
        className="absolute inset-0"
      />
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(lead.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Sélectionner ${lead.nom}`}
        className="relative z-10 size-4 shrink-0 cursor-pointer accent-brand"
      />
      <TemperatureDot temperature={lead.temperature} />
      <span className="w-16 shrink-0 font-mono text-xs text-muted">{lead.id}</span>
      <span className="min-w-0 flex-1">
        <Link
          href={`/leads/${lead.id}`}
          className="relative z-10 block w-fit max-w-full truncate text-sm font-medium text-ink hover:text-brand hover:underline"
        >
          {lead.nom}
        </Link>
        <span className="block truncate text-xs text-muted">
          {[lead.code_postal, lead.ville].filter(Boolean).join(" ") || "—"}
          {lead.devis ? (
            <span className="font-mono"> · {lead.devis.ref}</span>
          ) : null}
        </span>
      </span>
      <span className="hidden w-32 shrink-0 sm:block">
        <StatutBadge statut={lead.statut} />
      </span>
      <span className="hidden w-24 shrink-0 text-right font-mono text-sm text-ink md:block">
        {montant > 0 ? formatMontant(montant, entiteConfig(lead.entite).devise) : "—"}
      </span>
      <span className="hidden w-32 shrink-0 text-right text-xs lg:block">
        <RelanceHint lead={lead} now={now} />
      </span>
      <button
        type="button"
        aria-label={`Supprimer ${lead.nom}`}
        onClick={() => onDeleteOne(lead.id)}
        className="relative z-10 grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-alert/10 hover:text-alert"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function LeadList({
  groups,
  now,
  selectedIds,
  onSelect,
  onToggleSelect,
  onDeleteOne,
}: {
  groups: PeriodGroup[];
  now: Date;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDeleteOne: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key}>
          {g.label ? (
            <div className="mb-1 flex items-baseline gap-2 px-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {g.label}
              </h3>
              <span className="font-mono text-[11px] text-muted">
                {g.leads.length}
              </span>
            </div>
          ) : null}
          <div className={cn("rounded-xl border border-line bg-surface px-2")}>
            {g.leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                now={now}
                selected={selectedIds.has(lead.id)}
                onSelect={onSelect}
                onToggleSelect={onToggleSelect}
                onDeleteOne={onDeleteOne}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
