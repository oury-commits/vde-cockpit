"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { Lead, RdvType } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { haversineKm } from "@/lib/planning/tour";
import { MAX_RDV_JOUR, SEUIL_ALERTE_KM } from "@/lib/planning/config";
import { adresseComplete, borneLabel, buildEventInput, syncRdv } from "./rdvSync";

const TYPES: { value: RdvType; label: string }[] = [
  { value: "pose", label: "Pose (installation)" },
  { value: "visite_technique", label: "Visite technique" },
  { value: "sav", label: "SAV" },
];

// Durées proposées (minutes). Une pose borne standard tient en ~2 h.
const DUREES: { value: number; label: string }[] = [
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 h" },
  { value: 180, label: "3 h" },
  { value: 240, label: "4 h" },
  { value: 480, label: "Journée" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Composantes locales (date + heure) d'un ISO, pour préremplir les champs. */
function localParts(iso: string): { date: string; heure: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    heure: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** date=YYYY-MM-DD + heure=HH:MM (heure locale) → ISO. */
function toIso(date: string, heure: string): string {
  return new Date(`${date}T${heure}`).toISOString();
}

export function RdvDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const store = useLeadsStore();
  const { profiles } = useProfiles();
  const { session, enabled } = useAuth();
  const token = session?.access_token ?? null;

  const rdv = lead.rdv ?? null;
  const reprog = Boolean(rdv);
  const init = rdv ? localParts(rdv.debut) : null;

  const [type, setType] = useState<RdvType>(rdv?.type ?? "pose");
  const [date, setDate] = useState(init?.date ?? "");
  const [heure, setHeure] = useState(init?.heure ?? "09:00");
  const [duree, setDuree] = useState(
    rdv ? (new Date(rdv.fin).getTime() - new Date(rdv.debut).getTime()) / 60000 : 120,
  );
  const [technicienId, setTechnicienId] = useState(rdv?.technicien_id ?? "");
  const [busy, setBusy] = useState(false);

  // Techniciens assignables : rôle technicien, actifs, dans l'entité du dossier.
  const techniciens = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.role === "technicien" &&
          p.actif &&
          (p.entite === lead.entite || p.entite === "ALL"),
      ),
    [profiles, lead.entite],
  );

  // Garde-fous tournée : charge du jour (max 2/tech) + proximité géographique
  // (indicative, à vol d'oiseau — l'écran Tournées confirme au temps réel).
  const infoTech = useMemo(() => {
    const clientLat = lead.lat;
    const clientLng = lead.lng;
    const m = new Map<string, { count: number; distKm: number | null }>();
    for (const t of techniciens) {
      const memeJour = date
        ? store.leads.filter(
            (l) =>
              l.id !== lead.id &&
              l.rdv &&
              l.rdv.technicien_id === t.id &&
              localDay(l.rdv.debut) === date,
          )
        : [];
      let distKm: number | null = null;
      if (typeof clientLat === "number" && typeof clientLng === "number") {
        for (const l of memeJour) {
          if (typeof l.lat === "number" && typeof l.lng === "number") {
            const d = haversineKm({ lat: clientLat, lng: clientLng }, { lat: l.lat, lng: l.lng });
            distKm = distKm === null ? d : Math.min(distKm, d);
          }
        }
      }
      m.set(t.id, { count: memeJour.length, distKm });
    }
    return m;
  }, [techniciens, store.leads, date, lead.id, lead.lat, lead.lng]);

  // Suggestion : le plus proche parmi ceux qui n'ont pas atteint la limite ;
  // à défaut de géo, le moins chargé.
  const suggestionId = useMemo(() => {
    const libres = techniciens.filter((t) => (infoTech.get(t.id)?.count ?? 0) < MAX_RDV_JOUR);
    if (libres.length === 0) return null;
    const avecDist = libres.filter((t) => infoTech.get(t.id)?.distKm != null);
    if (avecDist.length) {
      return avecDist.reduce((a, b) =>
        infoTech.get(a.id)!.distKm! <= infoTech.get(b.id)!.distKm! ? a : b,
      ).id;
    }
    return libres.reduce((a, b) =>
      (infoTech.get(a.id)?.count ?? 0) <= (infoTech.get(b.id)?.count ?? 0) ? a : b,
    ).id;
  }, [techniciens, infoTech]);

  const suggestion = techniciens.find((t) => t.id === suggestionId) ?? null;
  const suggDist = suggestionId ? infoTech.get(suggestionId)?.distKm ?? null : null;

  const tech = techniciens.find((t) => t.id === technicienId) ?? null;
  const selInfo = tech ? infoTech.get(tech.id) : undefined;
  const tropDeRdv = (selInfo?.count ?? 0) >= MAX_RDV_JOUR;
  const trajetLoin = (selInfo?.distKm ?? 0) > SEUIL_ALERTE_KM;
  const peut = Boolean(date && heure && tech) && !tropDeRdv && !busy;
  const adresse = adresseComplete(lead);
  const borne = borneLabel(lead);

  async function confirmer() {
    if (!peut || !tech) return;
    setBusy(true);
    const debut = toIso(date, heure);
    const fin = new Date(new Date(debut).getTime() + duree * 60000).toISOString();
    const ok = store.confirmerRdv(lead.id, {
      type,
      debut,
      fin,
      technicien_id: tech.id,
      technicien_nom: tech.nom,
      technicien_email: tech.email,
    });
    if (!ok) {
      // Verrou acompte (ne devrait pas arriver : l'ouverture est déjà gardée).
      setBusy(false);
      return;
    }
    // Synchro agenda VDE : best-effort, uniquement si l'auth réelle est active
    // et l'utilisateur connecté (sinon le RDV reste « local », non bloquant).
    if (enabled && token) {
      const event = buildEventInput(lead, {
        type,
        debut,
        fin,
        technicien_id: tech.id,
        technicien_nom: tech.nom,
        technicien_email: tech.email,
        google_event_id: rdv?.google_event_id ?? null,
        sync: "non_synchronise",
      });
      const r = await syncRdv(token, event, rdv?.google_event_id ?? null);
      store.setRdvSync(
        lead.id,
        r.synced ? "synchronise" : "non_synchronise",
        r.google_event_id,
      );
    }
    onClose();
  }

  const aucunTech = techniciens.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={reprog ? "Reprogrammer le RDV" : "Poser le RDV d'installation"}
      description="Acompte encaissé — le RDV est créé dans l'agenda VDE et le technicien est invité par email."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={CalendarClock} onClick={confirmer} disabled={!peut}>
            {busy ? "Confirmation…" : reprog ? "Mettre à jour le RDV" : "Confirmer le RDV"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as RdvType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Technicien assigné">
          <Select
            value={technicienId}
            onChange={(e) => setTechnicienId(e.target.value)}
            disabled={aucunTech}
          >
            <option value="">— Choisir —</option>
            {techniciens.map((t) => {
              const info = infoTech.get(t.id);
              const charge = info?.count ? ` · ${info.count}/${MAX_RDV_JOUR}` : "";
              return (
                <option key={t.id} value={t.id} disabled={(info?.count ?? 0) >= MAX_RDV_JOUR}>
                  {t.nom}
                  {charge}
                </option>
              );
            })}
          </Select>
          {suggestion && suggestion.id !== technicienId ? (
            <button
              type="button"
              onClick={() => setTechnicienId(suggestion.id)}
              className="mt-1 text-left text-[12px] text-brand underline"
            >
              Suggéré : {suggestion.nom}
              {suggDist != null ? ` — le plus proche (≈ ${Math.round(suggDist)} km)` : " — disponible"}
            </button>
          ) : null}
        </Field>
        <Field label="Date">
          <Input
            type="date"
            className="font-mono"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Heure de début">
          <Input
            type="time"
            className="font-mono"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
          />
        </Field>
        <Field label="Durée">
          <Select value={String(duree)} onChange={(e) => setDuree(Number(e.target.value))}>
            {DUREES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Récap de ce que verra l'agenda — transparence avant création */}
      <div className="mt-3 rounded-lg border border-line bg-cream/50 px-3 py-2.5 text-[13px]">
        <p className="font-semibold text-ink">
          {lead.nom} — {TYPES.find((t) => t.value === type)?.label.split(" ")[0]}
          {borne ? <span className="font-mono"> · {borne}</span> : null}
        </p>
        <p className="mt-0.5 text-muted">{adresse || "Adresse non renseignée"}</p>
        <p className="mt-0.5 font-mono text-[12px] text-muted">
          Dossier {lead.id} · {lead.telephone}
        </p>
      </div>

      {tech && tropDeRdv ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2 text-[13px] text-alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {tech.nom} a déjà {MAX_RDV_JOUR} RDV ce jour-là (limite atteinte).
          Choisis un autre technicien ou un autre jour.
        </p>
      ) : tech && trajetLoin ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Trajet éloigné : ≈ {Math.round(selInfo!.distKm!)} km du RDV le plus
          proche de {tech.nom} ce jour (seuil {SEUIL_ALERTE_KM} km, à vol
          d&apos;oiseau). L&apos;écran Tournées confirme au temps réel.
        </p>
      ) : null}

      {aucunTech ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2 text-[13px] text-alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Aucun technicien actif dans cette entité. Ajoute-en un depuis
          l&apos;écran Équipe pour l&apos;assigner et l&apos;inviter.
        </p>
      ) : !enabled || !token ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Le RDV sera enregistré dans le CRM. La création dans Google Calendar et
          l&apos;invitation du technicien se feront une fois l&apos;agenda VDE
          connecté (Paramètres).
        </p>
      ) : null}
    </Modal>
  );
}
