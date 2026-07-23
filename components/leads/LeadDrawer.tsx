"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  MessageCircle,
  Phone,
  PenLine,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { ActiviteType, MotifPerte, Statut, StatutEcheance } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import {
  CANAL_LABEL,
  MEMBRES,
  MOTIF_PERTE_LABEL,
  PUISSANCE_LABEL,
  STATUT_META,
  STATUT_ORDER,
  TYPE_LOGEMENT_LABEL,
} from "@/lib/leads/meta";
import { generateDevisPdf } from "@/lib/leads/devis";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { StatutBadge, TemperatureDot } from "@/components/leads/badges";
import { Timeline } from "@/components/leads/Timeline";
import { formatDate, formatMontant } from "@/lib/format";
import { estimationLead } from "@/lib/leads/estimation";
import { entiteConfig } from "@/lib/entite/config";
import { cn } from "@/lib/cn";

const ECHEANCE_STATUT: Record<StatutEcheance, { label: string; cls: string }> = {
  attendu: { label: "Attendu", cls: "text-muted" },
  encaisse: { label: "Encaissé", cls: "text-success" },
  en_retard: { label: "En retard", cls: "text-alert" },
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted first:mt-0">
      {children}
    </h4>
  );
}

const QUICK_ACTS: { type: ActiviteType; label: string; icon: typeof Phone }[] = [
  { type: "appel", label: "Appel", icon: Phone },
  { type: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { type: "note", label: "Note", icon: PenLine },
];

export function LeadDrawer({
  leadId,
  onClose,
}: {
  leadId: string | null;
  onClose: () => void;
}) {
  const store = useLeadsStore();
  const { fiche } = useEntreprise();
  const lead = store.leads.find((l) => l.id === leadId) ?? null;

  const [askPerdu, setAskPerdu] = useState(false);
  const [motif, setMotif] = useState<MotifPerte>("prix");
  const [actType, setActType] = useState<ActiviteType>("appel");
  const [actText, setActText] = useState("");

  if (!lead) return null;

  const estim = estimationLead(lead, lead.entite);

  const onStatut = (v: Statut) => {
    if (v === "perdu") {
      setAskPerdu(true);
    } else {
      store.changeStatut(lead.id, v);
    }
  };

  const addActivite = () => {
    const text = actText.trim();
    if (!text) return;
    store.addActivite(lead.id, actType, text);
    setActText("");
  };

  const onGenerateDevis = async () => {
    const devis = await store.generateDevis(lead.id);
    if (devis) await generateDevisPdf(lead, devis, undefined, fiche(lead.entite));
  };

  return (
    <Drawer
      open={leadId !== null}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <TemperatureDot temperature={lead.temperature} />
          {lead.nom}
        </span>
      }
      subtitle={
        <span className="flex items-center gap-2">
          <span className="font-mono">{lead.id}</span>
          <StatutBadge statut={lead.statut} />
        </span>
      }
    >
      {/* Statut */}
      <SectionTitle>Statut du pipeline</SectionTitle>
      <Select
        aria-label="Statut"
        value={lead.statut}
        onChange={(e) => onStatut(e.target.value as Statut)}
      >
        {STATUT_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUT_META[s].label}
          </option>
        ))}
      </Select>
      {askPerdu ? (
        <div className="mt-2 flex items-end gap-2 rounded-lg border border-alert/30 bg-alert/5 p-2.5">
          <Field label="Motif de perte" className="flex-1">
            <Select
              value={motif}
              onChange={(e) => setMotif(e.target.value as MotifPerte)}
            >
              {(Object.keys(MOTIF_PERTE_LABEL) as MotifPerte[]).map((m) => (
                <option key={m} value={m}>
                  {MOTIF_PERTE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            size="sm"
            onClick={() => {
              store.changeStatut(lead.id, "perdu", motif);
              setAskPerdu(false);
            }}
          >
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAskPerdu(false)}>
            Annuler
          </Button>
        </div>
      ) : null}

      {/* Devis */}
      <SectionTitle>Devis & échéancier</SectionTitle>
      {lead.devis ? (
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-ink">
              {lead.devis.ref}
            </span>
            <StatutBadge
              statut={lead.devis.statut === "signe" ? "signe" : "devis_envoye"}
            />
          </div>
          <div className="mt-2 space-y-0.5 border-t border-line pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total HT</span>
              <span className="font-mono text-ink">
                {formatMontant(lead.devis.montant_ht, lead.devis.devise, { cents: true })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">
                {lead.devis.mode_tva === "fr_autoliquidation"
                  ? "TVA — autoliq."
                  : `TVA ${new Intl.NumberFormat("fr-FR").format(lead.devis.taux_tva * 100)} %`}
              </span>
              <span className="font-mono text-ink">
                {formatMontant(lead.devis.montant_tva, lead.devis.devise, { cents: true })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-ink">Total TTC</span>
              <span className="font-mono text-ink">
                {formatMontant(lead.devis.montant_ttc, lead.devis.devise, { cents: true })}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Download}
              onClick={() => void generateDevisPdf(lead, lead.devis!, undefined, fiche(lead.entite))}
            >
              Télécharger le PDF
            </Button>
            {lead.devis.statut !== "signe" ? (
              <Button size="sm" icon={PenLine} onClick={() => store.signDevis(lead.id)}>
                Marquer signé
              </Button>
            ) : null}
          </div>

          {lead.echeancier ? (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
              {lead.echeancier.map((e, i) => (
                <li key={e.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">
                    <span className="font-mono">{e.pct} %</span> · {e.label}
                    <span className="ml-2 font-mono text-xs text-muted">
                      {formatMontant(e.montant, lead.devis!.devise, { cents: true })}
                    </span>
                  </span>
                  <Select
                    aria-label={`Statut échéance ${i + 1}`}
                    value={e.statut}
                    onChange={(ev) =>
                      store.setEcheanceStatut(
                        lead.id,
                        i,
                        ev.target.value as StatutEcheance,
                      )
                    }
                    className={cn(
                      "h-7 w-auto text-[12px] font-medium",
                      ECHEANCE_STATUT[e.statut].cls,
                    )}
                  >
                    {(Object.keys(ECHEANCE_STATUT) as StatutEcheance[]).map((s) => (
                      <option key={s} value={s}>
                        {ECHEANCE_STATUT[s].label}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={`/devis/nouveau?lead=${lead.id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-hover"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            Créer le devis (catalogue)
          </Link>
          <button
            type="button"
            onClick={onGenerateDevis}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            <FileText className="size-4" strokeWidth={1.75} />
            Brouillon rapide (1 clic)
          </button>
        </div>
      )}

      {/* Coordonnées & projet */}
      <SectionTitle>Coordonnées</SectionTitle>
      <div className="rounded-xl border border-line px-3">
        <InfoRow label="Téléphone" value={lead.telephone} />
        <InfoRow label="Email" value={lead.email} />
        <InfoRow
          label="Adresse"
          value={[lead.code_postal, lead.ville].filter(Boolean).join(" ")}
        />
        <InfoRow label="Canal" value={CANAL_LABEL[lead.canal]} />
        <InfoRow label="Source" value={lead.source_campagne} />
        <InfoRow label="Reçu le" value={formatDate(lead.date_reception)} />
      </div>

      <SectionTitle>Projet</SectionTitle>
      <div className="rounded-xl border border-line px-3">
        <InfoRow
          label="Logement"
          value={lead.type_logement ? TYPE_LOGEMENT_LABEL[lead.type_logement] : null}
        />
        <InfoRow label="Véhicule" value={lead.type_vehicule} />
        <InfoRow
          label="Puissance"
          value={lead.puissance_souhaitee ? PUISSANCE_LABEL[lead.puissance_souhaitee] : null}
        />
        <InfoRow
          label="Distance tableau"
          value={lead.distance_tableau != null ? `${lead.distance_tableau} m` : null}
        />
        {/* eligible_advenir masqué : usage interne (import + scoring) seulement. */}
        {/* Source unique : devis TTC → montant saisi → estimation auto (même
            valeur que la liste et la fiche). */}
        <InfoRow
          label={estim.source === "devis" ? "Devis TTC" : "Montant estimé"}
          value={
            estim.fixe
              ? formatMontant(estim.min, entiteConfig(lead.entite).devise)
              : `${formatMontant(estim.min, entiteConfig(lead.entite).devise)} – ${formatMontant(estim.max, entiteConfig(lead.entite).devise)}`
          }
        />
      </div>

      {/* Suivi */}
      <SectionTitle>Suivi</SectionTitle>
      <div className="flex flex-col gap-3">
        <Field label="Assigné à">
          <Select
            value={lead.assigne_a ?? ""}
            onChange={(e) =>
              store.updateLead(lead.id, { assigne_a: e.target.value || null })
            }
          >
            <option value="">Non assigné</option>
            {MEMBRES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prochaine action">
            <Input
              defaultValue={lead.prochaine_action ?? ""}
              onBlur={(e) =>
                store.updateLead(lead.id, {
                  prochaine_action: e.target.value || null,
                })
              }
            />
          </Field>
          <Field label="Date de relance">
            <Input
              type="date"
              defaultValue={lead.date_relance ? lead.date_relance.slice(0, 10) : ""}
              onBlur={(e) =>
                store.updateLead(lead.id, {
                  date_relance: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            defaultValue={lead.notes ?? ""}
            onBlur={(e) => store.updateLead(lead.id, { notes: e.target.value || null })}
          />
        </Field>
      </div>

      {/* Timeline */}
      <SectionTitle>Historique</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {QUICK_ACTS.map((q) => (
          <button
            key={q.type}
            type="button"
            onClick={() => setActType(q.type)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              actType === q.type
                ? "border-brand bg-brand text-cream"
                : "border-line text-muted hover:bg-cream",
            )}
          >
            <q.icon className="size-3.5" strokeWidth={2} />
            {q.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <Input
          value={actText}
          onChange={(e) => setActText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addActivite();
          }}
          placeholder="Ajouter au journal…"
        />
        <Button size="sm" icon={Plus} onClick={addActivite}>
          Ajouter
        </Button>
      </div>
      <Timeline activites={store.activitesFor(lead.id)} />
    </Drawer>
  );
}
