"use client";

import { useMemo } from "react";
import { MapPin, Phone, StickyNote } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useInterventions } from "@/lib/interventions/store";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import {
  STATUT_LABEL,
  TYPE_LABEL,
  type Intervention,
} from "@/lib/interventions/types";
import { formatDate } from "@/lib/format";

const TON_TYPE = {
  pose: "success",
  sav: "alert",
  visite_technique: "gold",
} as const;

function CarteIntervention({ itv }: { itv: Intervention }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[15px] font-semibold text-ink">
            {itv.creneau}
          </p>
          <p className="truncate text-sm text-ink">{itv.client_nom}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={TON_TYPE[itv.type]}>{TYPE_LABEL[itv.type]}</Badge>
          <span className="text-[11px] text-muted">
            {STATUT_LABEL[itv.statut]}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[13px]">
        <p className="flex items-start gap-2 text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span className="text-ink">
            {itv.adresse}
            <br />
            {itv.ville}
          </span>
        </p>
        <a
          href={`tel:${itv.telephone.replace(/\s/g, "")}`}
          className="flex items-center gap-2 text-brand"
        >
          <Phone className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="font-mono">{itv.telephone}</span>
        </a>
        {itv.consigne ? (
          <p className="flex items-start gap-2 rounded-lg bg-cream px-2.5 py-2 text-muted">
            <StickyNote className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="text-ink">{itv.consigne}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function MaTourneeScreen() {
  const { loaded, maTournee } = useInterventions();
  const { identite } = useIdentity();

  // Regroupement par jour, dans l'ordre chronologique.
  const jours = useMemo(() => {
    const par = new Map<string, Intervention[]>();
    for (const i of [...maTournee].sort((a, b) =>
      a.date === b.date ? a.creneau.localeCompare(b.creneau) : a.date.localeCompare(b.date),
    )) {
      par.set(i.date, [...(par.get(i.date) ?? []), i]);
    }
    return [...par.entries()];
  }, [maTournee]);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>Ma tournée</PageTitle>
      <p className="mt-1.5 text-sm text-muted">
        {identite.nom} — vos interventions, et uniquement les vôtres.
      </p>

      {!loaded ? (
        <p className="py-16 text-center text-sm text-muted">Chargement…</p>
      ) : jours.length === 0 ? (
        <Card className="mt-5">
          <p className="text-sm text-ink">Aucune intervention à votre nom.</p>
          <p className="mt-1.5 text-[13px] text-muted">
            {identite.id
              ? "Votre tournée est vide : rien ne vous a été affecté pour le moment."
              : "Cette identité n'est rattachée à aucun membre de l'équipe. Incarnez un technicien dans la barre de simulation pour voir une tournée."}
          </p>
        </Card>
      ) : (
        <div className="mt-5 space-y-6">
          {jours.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                <span className="font-mono">{formatDate(date)}</span> ·{" "}
                <span className="font-mono">{items.length}</span> intervention
                {items.length > 1 ? "s" : ""}
              </h2>
              <div className="space-y-3">
                {items.map((i) => (
                  <CarteIntervention key={i.id} itv={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
