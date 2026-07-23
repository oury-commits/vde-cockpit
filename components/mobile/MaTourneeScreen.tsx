"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MapPin, Navigation, Phone } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useLeadsStore } from "@/lib/leads/store";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchMesRdv, type ChantierRdv } from "@/lib/mobile/tournee";
import { adresseComplete, mapsLink } from "@/components/leads/fiche/rdvSync";
import type { RdvType } from "@/lib/types";

// SOURCE UNIQUE = lead.rdv. Deux lectures selon le contexte, jamais deux données :
//  · Supabase : le technicien est AVEUGLE AUX MONTANTS → il ne lit pas `leads`
//    mais la vue `chantiers` (projection sans montants de lead.rdv, scopée à ses
//    RDV par la RLS).
//  · Démo/local : pas de RLS → on lit lead.rdv directement dans le store.
// Aucun montant affiché dans les deux cas.

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

interface Stop {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string;
  debut: string;
  fin: string;
  type: RdvType;
}

function CarteRdv({ s }: { s: Stop }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[15px] font-semibold text-ink">
            <CalendarClock className="size-4 text-brand" strokeWidth={2} />
            {heure(s.debut)} – {heure(s.fin)}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink">{s.nom}</p>
        </div>
        <Badge tone={TON_TYPE[s.type]}>{TYPE_LABEL[s.type]}</Badge>
      </div>

      <div className="mt-3 space-y-2 text-[13px]">
        {s.adresse ? (
          <p className="flex items-start gap-2 text-muted">
            <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span className="text-ink">{s.adresse}</span>
          </p>
        ) : null}
        {s.telephone ? (
          <a
            href={`tel:${s.telephone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-brand"
          >
            <Phone className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="font-mono">{s.telephone}</span>
          </a>
        ) : null}
        {s.adresse ? (
          <a
            href={mapsLink(s.adresse)}
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

const chantierAdresse = (c: ChantierRdv) =>
  [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export function MaTourneeScreen() {
  const { loaded: leadsLoaded, leads } = useLeadsStore();
  const { identite } = useIdentity();

  // En Supabase, on passe par la vue `chantiers` (sans montants).
  const [chantiers, setChantiers] = useState<ChantierRdv[] | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || !identite.id) {
      setChantiers(null);
      return;
    }
    let actif = true;
    fetchMesRdv(identite.id).then((r) => actif && setChantiers(r));
    return () => {
      actif = false;
    };
  }, [identite.id]);

  const loaded = isSupabaseConfigured ? chantiers !== null : leadsLoaded;

  // Mes RDV, normalisés en `Stop`, groupés par jour.
  const jours = useMemo(() => {
    let stops: Stop[] = [];
    if (isSupabaseConfigured) {
      stops = (chantiers ?? [])
        .filter((c) => c.rdv_debut && c.rdv_fin)
        .map((c) => ({
          id: c.id,
          nom: c.nom,
          telephone: c.telephone,
          adresse: chantierAdresse(c),
          debut: c.rdv_debut as string,
          fin: c.rdv_fin as string,
          type: (c.rdv_type as RdvType) ?? "pose",
        }));
    } else if (identite.id) {
      stops = leads
        .filter((l) => l.rdv && l.rdv.technicien_id === identite.id)
        .map((l) => ({
          id: l.id,
          nom: l.nom,
          telephone: l.telephone,
          adresse: adresseComplete(l),
          debut: l.rdv!.debut,
          fin: l.rdv!.fin,
          type: l.rdv!.type,
        }));
    }
    const par = new Map<string, Stop[]>();
    for (const s of stops.sort((a, b) => a.debut.localeCompare(b.debut))) {
      const j = localDay(s.debut);
      par.set(j, [...(par.get(j) ?? []), s]);
    }
    return [...par.entries()];
  }, [chantiers, leads, identite.id]);

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
                {items.map((s) => (
                  <CarteRdv key={s.id} s={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
