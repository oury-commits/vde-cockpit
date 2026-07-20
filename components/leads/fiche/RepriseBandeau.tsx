"use client";

import { CircleUser, Clock, History, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Activite, Lead } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { MEMBRES } from "@/lib/leads/meta";
import { useLeadsStore } from "@/lib/leads/store";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

function Bloc({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        <Icon className="size-3.5" strokeWidth={2} />
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Bandeau de reprise : ce qu'un collègue doit savoir en 2 secondes —
 * dernière action (qui/quand), prochaine action (quoi/échéance), responsable.
 */
export function RepriseBandeau({
  lead,
  activites,
}: {
  lead: Lead;
  activites: Activite[];
}) {
  const store = useLeadsStore();
  // `activitesFor` trie du plus récent au plus ancien.
  const derniere = activites[0] ?? null;
  const enRetard =
    Boolean(lead.date_relance) && new Date(lead.date_relance!) < new Date();

  return (
    <section className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Bloc icon={History} label="Dernière action">
          {derniere ? (
            <>
              <p className="truncate text-sm text-ink">{derniere.contenu}</p>
              <p className="text-[11px] text-muted">
                {derniere.auteur} ·{" "}
                <span className="font-mono">
                  {formatDateTime(derniere.created_at)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Aucune action enregistrée</p>
          )}
        </Bloc>

        <Bloc icon={Clock} label="Prochaine action">
          <p className="truncate text-sm text-ink">
            {lead.prochaine_action || "À définir"}
          </p>
          {lead.date_relance ? (
            <p
              className={cn(
                "text-[11px]",
                enRetard ? "font-medium text-alert" : "text-muted",
              )}
            >
              Échéance{" "}
              <span className="font-mono">{formatDate(lead.date_relance)}</span>
              {enRetard ? " — en retard" : ""}
            </p>
          ) : (
            <p className="text-[11px] text-muted">Pas d&apos;échéance</p>
          )}
        </Bloc>

        <Bloc icon={CircleUser} label="Assigné à">
          <p className="truncate text-sm text-ink">
            {lead.assigne_a || "Non assigné"}
          </p>
          <Select
            aria-label="Passer le dossier à un collègue"
            value=""
            onChange={(e) => {
              if (e.target.value) store.transferer(lead.id, e.target.value);
            }}
            className="mt-1 h-8 w-auto text-[12px]"
          >
            <option value="">Passer le relais…</option>
            {MEMBRES.filter((m) => m !== lead.assigne_a).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Bloc>
      </div>
    </section>
  );
}
