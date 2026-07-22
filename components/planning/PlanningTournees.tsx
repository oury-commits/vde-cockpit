"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Route,
  TriangleAlert,
  User,
} from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLeadsStore } from "@/lib/leads/store";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useEntity } from "@/lib/entite/EntityProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Lead } from "@/lib/types";
import { formatDuree, orderByProximity, type Pt } from "@/lib/planning/tour";
import { BUFFER_MINUTES, MAX_RDV_JOUR, SEUIL_ALERTE_KM } from "@/lib/planning/config";
import { fetchMatrix, geocodeAdresse } from "@/lib/planning/client";
import { adresseComplete, mapsLink } from "@/components/leads/fiche/rdvSync";

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameLocalDay = (iso: string, jour: string) => localDay(new Date(iso)) === jour;
const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const minutesEntre = (aIso: string, bIso: string) =>
  (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000;
const RDV_TYPE_LABEL: Record<string, string> = {
  pose: "Pose",
  visite_technique: "Visite technique",
  sav: "SAV",
};

interface Stop {
  leadId: string;
  lead: Lead;
  pt: Pt | null;
  debut: string;
  fin: string;
}
interface Leg {
  min: number;
  km: number;
  real: boolean;
}

const ptDe = (l: Lead): Pt | null =>
  typeof l.lat === "number" && typeof l.lng === "number" ? { lat: l.lat, lng: l.lng } : null;

export function PlanningTournees() {
  const { leads, setLeadGeo } = useLeadsStore();
  const { profiles } = useProfiles();
  const { active } = useEntity();
  const { session, enabled } = useAuth();
  const token = session?.access_token ?? null;

  const [jour, setJour] = useState(() => localDay(new Date()));
  const [legs, setLegs] = useState<Record<string, Leg>>({});

  // RDV confirmés (rdv porté par le lead) du jour, dans le périmètre actif.
  const rdvLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.rdv && sameLocalDay(l.rdv.debut, jour) && (active === "ALL" || l.entite === active),
      ),
    [leads, jour, active],
  );

  const techniciens = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.role === "technicien" &&
          p.actif &&
          (active === "ALL" || p.entite === active || p.entite === "ALL"),
      ),
    [profiles, active],
  );

  // Tournée par technicien : arrêts ordonnés par PROXIMITÉ depuis le 1er RDV du
  // jour (plus-proche-voisin, pas de TSP). N'optimise QUE les RDV confirmés.
  const tours = useMemo(() => {
    const byTech = new Map<string, Stop[]>();
    for (const l of rdvLeads) {
      const tid = l.rdv!.technicien_id;
      const stop: Stop = { leadId: l.id, lead: l, pt: ptDe(l), debut: l.rdv!.debut, fin: l.rdv!.fin };
      byTech.set(tid, [...(byTech.get(tid) ?? []), stop]);
    }
    return Array.from(byTech.entries())
      .map(([tid, stops]) => {
        const parTemps = [...stops].sort((a, b) => a.debut.localeCompare(b.debut));
        const ancre = parTemps[0];
        const ordered = ancre?.pt
          ? [ancre, ...orderByProximity(ancre.pt, parTemps.slice(1))]
          : parTemps;
        return { tid, tech: profiles.find((p) => p.id === tid) ?? null, stops: ordered };
      })
      .sort((a, b) => (a.tech?.nom ?? "").localeCompare(b.tech?.nom ?? ""));
  }, [rdvLeads, profiles]);

  // Géocodage best-effort des adresses non résolues (serveur → clé API).
  const aGeocoder = useMemo(
    () => rdvLeads.filter((l) => ptDe(l) === null && adresseComplete(l)).map((l) => l.id),
    [rdvLeads],
  );
  const geoKey = aGeocoder.join(",");
  useEffect(() => {
    if (!enabled || !token || !geoKey) return;
    let cancel = false;
    (async () => {
      for (const id of geoKey.split(",")) {
        if (cancel) break;
        const lead = leads.find((l) => l.id === id);
        if (!lead) continue;
        const pt = await geocodeAdresse(token, adresseComplete(lead), lead.entite);
        if (pt && !cancel) setLeadGeo(lead.id, pt.lat, pt.lng);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, enabled, token]);

  // Temps de trajet RÉEL entre arrêts consécutifs (routing API, fallback estimé).
  const coordSig = useMemo(
    () =>
      tours
        .map((t) => `${t.tid}:${t.stops.map((s) => (s.pt ? `${s.pt.lat},${s.pt.lng}` : "-")).join(">")}`)
        .join("|"),
    [tours],
  );
  useEffect(() => {
    if (!enabled || !token) return;
    let cancel = false;
    (async () => {
      const next: Record<string, Leg> = {};
      for (const t of tours) {
        for (let i = 1; i < t.stops.length; i++) {
          const a = t.stops[i - 1];
          const b = t.stops[i];
          if (a.pt && b.pt) {
            const m = await fetchMatrix(token, a.pt, [b.pt]);
            if (m && m.durations.length) {
              next[b.leadId] = { min: m.durations[0], km: m.distances[0], real: m.real };
            }
          }
        }
      }
      if (!cancel) setLegs(next);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordSig, enabled, token]);

  const decaler = (delta: number) => {
    const d = new Date(`${jour}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setJour(localDay(d));
  };

  const jourLisible = new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const dispo = techniciens.filter((t) => !tours.some((to) => to.tid === t.id));
  const alertes = tours.reduce(
    (n, t) =>
      n +
      t.stops.filter((s) => (legs[s.leadId]?.km ?? 0) > SEUIL_ALERTE_KM).length +
      (t.stops.length > MAX_RDV_JOUR ? 1 : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle>Tournées</PageTitle>
          <p className="mt-1 text-sm text-muted">
            RDV confirmés du jour, ordonnés par proximité. Un seul planning —
            l&apos;agenda vit sur le dossier.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => decaler(-1)} aria-label="Jour précédent" />
          <button
            type="button"
            onClick={() => setJour(localDay(new Date()))}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-cream"
          >
            Aujourd&apos;hui
          </button>
          <input
            type="date"
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[13px] text-ink"
          />
          <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => decaler(1)} aria-label="Jour suivant" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 capitalize text-ink">
          <CalendarDays className="size-3.5 text-brand" strokeWidth={2} />
          {jourLisible}
        </span>
        <span className="font-mono text-muted">
          {rdvLeads.length} RDV · {tours.length} technicien{tours.length > 1 ? "s" : ""}
        </span>
        {alertes > 0 ? (
          <Badge tone="alert">
            {alertes} alerte{alertes > 1 ? "s" : ""}
          </Badge>
        ) : null}
      </div>

      {!enabled || !token ? (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Géocodage et temps de trajet réels disponibles une fois
          l&apos;authentification activée (clés API serveur). En attendant, les
          tournées s&apos;affichent par heure, sans distances.
        </p>
      ) : null}

      {rdvLeads.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          Aucun RDV confirmé ce jour.
        </Card>
      ) : (
        tours.map((t) => {
          const surcharge = t.stops.length > MAX_RDV_JOUR;
          return (
            <Card key={t.tid}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <User className="size-4 text-brand" strokeWidth={1.75} />
                  {t.tech?.nom ?? "Technicien"}
                  {t.tech?.entite ? (
                    <span className="text-[11px] font-normal text-muted">({t.tech.entite})</span>
                  ) : null}
                </h3>
                <span className="flex items-center gap-2">
                  <Badge tone={surcharge ? "alert" : t.stops.length === MAX_RDV_JOUR ? "gold" : "muted"}>
                    {t.stops.length} RDV
                  </Badge>
                  {surcharge ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-alert">
                      <TriangleAlert className="size-3.5" strokeWidth={2} />
                      dépasse {MAX_RDV_JOUR}/jour
                    </span>
                  ) : null}
                </span>
              </div>

              <ol className="space-y-0">
                {t.stops.map((s, i) => {
                  const leg = i > 0 ? legs[s.leadId] : undefined;
                  const prev = t.stops[i - 1];
                  const loin = (leg?.km ?? 0) > SEUIL_ALERTE_KM;
                  // Créneau serré : le trajet + tampon dépasse le temps entre 2 RDV.
                  const gap = prev ? minutesEntre(prev.fin, s.debut) : null;
                  const serre = leg && gap !== null ? gap < leg.min + BUFFER_MINUTES : false;
                  const adr = adresseComplete(s.lead);
                  return (
                    <li key={s.leadId}>
                      {i > 0 ? (
                        <div className="flex items-center gap-2 py-1.5 pl-1 text-[12px]">
                          <Route className="size-3.5 shrink-0 text-muted" strokeWidth={2} />
                          {leg ? (
                            <span className="font-mono text-muted">
                              {formatDuree(leg.min)} · {leg.km} km
                              {leg.real ? "" : " (estimé)"}
                            </span>
                          ) : (
                            <span className="text-muted">trajet indisponible</span>
                          )}
                          {loin ? (
                            <span className="inline-flex items-center gap-1 text-alert">
                              <TriangleAlert className="size-3.5" strokeWidth={2} />
                              &gt; {SEUIL_ALERTE_KM} km
                            </span>
                          ) : null}
                          {serre ? (
                            <span className="inline-flex items-center gap-1 text-gold-ink">
                              <Clock className="size-3.5" strokeWidth={2} />
                              créneau serré
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex items-start gap-3 rounded-xl border border-line p-3">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 font-mono text-[12px] font-semibold text-brand">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-[13px] font-semibold text-ink">
                              {heure(s.debut)} – {heure(s.fin)}
                            </span>
                            <span className="text-[11px] text-muted">
                              {RDV_TYPE_LABEL[s.lead.rdv!.type] ?? "RDV"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink">{s.lead.nom}</p>
                          {adr ? (
                            <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-muted">
                              <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                              {adr}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[12px] text-gold-ink">Adresse non renseignée</p>
                          )}
                          {adr ? (
                            <a
                              href={mapsLink(adr)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-brand underline"
                            >
                              <Navigation className="size-3.5" strokeWidth={2} />
                              Y aller
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })
      )}

      {dispo.length > 0 ? (
        <p className="text-[13px] text-muted">
          Sans RDV ce jour :{" "}
          <span className="text-ink">{dispo.map((t) => t.nom).join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}
