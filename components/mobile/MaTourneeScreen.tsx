"use client";

import { useMemo } from "react";
import { CalendarClock, MapPin, Navigation, Phone } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useLeadsStore } from "@/lib/leads/store";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { formatDate } from "@/lib/format";
import type { Lead, RdvType } from "@/lib/types";
import { adresseComplete, mapsLink } from "@/components/leads/fiche/rdvSync";

// SOURCE UNIQUE : la tournée du technicien est dérivée des RDV portés par les
// leads (lead.rdv), exactement ce que le planning desktop pose au confirmerRdv.
// Plus de jeu de démo `interventions` divergent. Aucun montant ici (le
// technicien n'en voit jamais) : seulement créneau, client, adresse, contact.

const TYPE_LABEL: Record<RdvType, string> = {
  pose: "Pose",
  visite_technique: "Visite technique",
  sav: "SAV",
};
const TON_TYPE: Record<RdvType, "success" | "alert" | "gold"> = {
  pose: "success",
  sav: "alert",
  visite_technique: "gold",
};

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function CarteRdv({ lead }: { lead: Lead }) {
  const rdv = lead.rdv!;
  const adr = adresseComplete(lead);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[15px] font-semibold text-ink">
            <CalendarClock className="size-4 text-brand" strokeWidth={2} />
            {heure(rdv.debut)} – {heure(rdv.fin)}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink">{lead.nom}</p>
        </div>
        <Badge tone={TON_TYPE[rdv.type]}>{TYPE_LABEL[rdv.type]}</Badge>
      </div>

      <div className="mt-3 space-y-2 text-[13px]">
        {adr ? (
          <p className="flex items-start gap-2 text-muted">
            <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="text-ink">{adr}</span>
          </p>
        ) : null}
        {lead.telephone ? (
          <a
            href={`tel:${lead.telephone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-brand"
          >
            <Phone className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="font-mono">{lead.telephone}</span>
          </a>
        ) : null}
        {adr ? (
          <a
            href={mapsLink(adr)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-brand underline"
          >
            <Navigation className="size-4 shrink-0" strokeWidth={2} />
            Y aller
          </a>
        ) : null}
      </div>
    </Card>
  );
}

export function MaTourneeScreen() {
  const { loaded, leads } = useLeadsStore();
  const { identite } = useIdentity();

  // Mes RDV = les leads dont le RDV m'est assigné, groupés par jour.
  const jours = useMemo(() => {
    if (!identite.id) return [];
    const mine = leads.filter((l) => l.rdv && l.rdv.technicien_id === identite.id);
    const par = new Map<string, Lead[]>();
    for (const l of mine.sort((a, b) => a.rdv!.debut.localeCompare(b.rdv!.debut))) {
      const j = localDay(l.rdv!.debut);
      par.set(j, [...(par.get(j) ?? []), l]);
    }
    return [...par.entries()];
  }, [leads, identite.id]);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>Ma tournée</PageTitle>
      <p className="mt-1.5 text-sm text-muted">
        {identite.nom} — vos RDV, et uniquement les vôtres.
      </p>

      {!loaded ? (
        <p className="py-16 text-center text-sm text-muted">Chargement…</p>
      ) : jours.length === 0 ? (
        <Card className="mt-5">
          <p className="text-sm text-ink">Aucun RDV à votre nom.</p>
          <p className="mt-1.5 text-[13px] text-muted">
            {identite.id
              ? "Votre tournée est vide : aucun RDV confirmé ne vous est affecté."
              : "Cette identité n'est rattachée à aucun membre de l'équipe. Incarnez un technicien dans la barre de simulation pour voir une tournée."}
          </p>
        </Card>
      ) : (
        <div className="mt-5 space-y-6">
          {jours.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                <span className="font-mono">{formatDate(`${date}T12:00:00`)}</span> ·{" "}
                <span className="font-mono">{items.length}</span> RDV
              </h2>
              <div className="space-y-3">
                {items.map((l) => (
                  <CarteRdv key={l.id} lead={l} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
