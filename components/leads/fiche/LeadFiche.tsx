"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  PenLine,
  Phone,
  Plus,
  Receipt,
  Send,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import type { Lead, ModeTva, Statut } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { computeFaisabilite, FAISABILITE_META } from "@/lib/leads/faisabilite";
import { computeEstimation } from "@/lib/leads/estimation";
import { generateDevisPdf } from "@/lib/leads/devis";
import { generateFacturePdf } from "@/lib/leads/facture";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import { raisonSociale } from "@/lib/entreprise/document";
import { aEncaissement } from "@/lib/leads/reglements";
import { PaiementsCard } from "@/components/leads/fiche/PaiementsCard";
import { entiteConfig } from "@/lib/entite/config";
import {
  CANAL_LABEL,
  EMPLACEMENT_LABEL,
  FIXATION_LABEL,
  NOTE_TYPES,
  OCCUPATION_LABEL,
  PUISSANCE_LABEL,
  PV_PROJET_LABEL,
  RESEAU_LABEL,
  STATUT_META,
  STATUT_ORDER,
  TYPE_LOGEMENT_LABEL,
} from "@/lib/leads/meta";
import { anciennete, formatDate, formatMontant } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { StatutBadge, TemperatureDot } from "@/components/leads/badges";
import { EnvoiDialog } from "@/components/leads/EnvoiDialog";
import { RepriseBandeau } from "@/components/leads/fiche/RepriseBandeau";
import { JalonsRow } from "@/components/leads/fiche/JalonsRow";
import { Timeline } from "@/components/leads/Timeline";
import { EditLeadDialog } from "@/components/leads/fiche/EditLeadDialog";
import { cn } from "@/lib/cn";

// ── helpers ─────────────────────────────────────────────────────────────────

function waLink(tel: string, entite: Lead["entite"]): string {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("0")) d = (entite === "MA" ? "212" : "33") + d.slice(1);
  return `https://wa.me/${d}`;
}

function mapsLink(lead: Lead): string {
  const q = [lead.adresse, lead.code_postal, lead.ville].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const STEPPER = ["Nouveau", "Contacté", "Devis envoyé", "Signé", "Acompte", "Installé"];
function stepIndex(lead: Lead): number {
  const s = lead.statut;
  if (s === "installe" || s === "sav") return 5;
  // « Acompte » = un encaissement existe au registre (même règle que le jalon
  // dérivé « Acompte reçu ») ou RDV déjà planifié — jamais l'échéancier seul,
  // qui pourrait contredire le registre.
  if (aEncaissement(lead) || s === "planifie") return 4;
  if (s === "signe") return 3;
  if (s === "devis_envoye") return 2;
  if (s === "qualifie") return 1;
  return 0;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value || "—"}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-3 py-1">
      <div className="border-b border-line py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {title}
      </div>
      <div className="py-1">{children}</div>
    </div>
  );
}

function ActionLink({
  href,
  icon: Icon,
  children,
  external,
}: {
  href: string;
  icon: typeof Phone;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-cream"
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {children}
    </a>
  );
}

// ── composant principal ─────────────────────────────────────────────────────

export function LeadFiche() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useLeadsStore();
  const { fiche } = useEntreprise();
  const lead = store.leads.find((l) => l.id === id) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [tvaMode, setTvaMode] = useState<ModeTva | "">("");
  const [envoi, setEnvoi] = useState<"devis" | "facture" | null>(null);
  const [noteType, setNoteType] = useState(NOTE_TYPES[3].key);

  const faisabilite = useMemo(
    () => (lead ? computeFaisabilite(lead) : null),
    [lead],
  );
  const estimation = useMemo(
    () => (lead ? computeEstimation(lead, lead.entite) : null),
    [lead],
  );

  if (!store.loaded) {
    return <p className="py-24 text-center text-sm text-muted">Chargement…</p>;
  }
  if (!lead || !faisabilite || !estimation) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-sm text-muted">Lead introuvable.</p>
        <Link href="/leads" className="mt-3 inline-block text-sm font-medium text-brand underline">
          Retour aux leads
        </Link>
      </div>
    );
  }

  const cfg = entiteConfig(lead.entite);
  const devise = cfg.devise;
  const ficheEnt = fiche(lead.entite);
  const fm = FAISABILITE_META[faisabilite.niveau];
  const step = stepIndex(lead);
  const tel = lead.telephone.replace(/\s/g, "");
  // « Planifié » (RDV confirmé) reste verrouillé tant qu'aucun acompte encaissé,
  // sauf si le dossier y est déjà.
  const rdvDeverrouille =
    aEncaissement(lead) || lead.statut === "planifie" || lead.statut === "installe";

  const onGenerateDevis = async () => {
    const devis = await store.generateDevis(lead.id, tvaMode || undefined);
    if (devis) await generateDevisPdf(lead, devis, undefined, ficheEnt);
  };
  const onConvertFacture = async () => {
    const facture = await store.generateFacture(lead.id);
    if (facture) await generateFacturePdf(lead, facture, ficheEnt);
  };
  const activites = store.activitesFor(lead.id);

  const submitNote = () => {
    const t = note.trim();
    if (!t) return;
    const nt = NOTE_TYPES.find((n) => n.key === noteType) ?? NOTE_TYPES[3];
    store.addNote(lead.id, nt.type, t, nt.visibilite);
    setNote("");
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Barre de décision (sticky) ── */}
      <div className="sticky top-14 z-10 -mx-4 mb-4 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur md:top-0 md:mx-0 md:rounded-2xl md:border md:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href="/leads"
            aria-label="Retour"
            className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
          </Link>
          <TemperatureDot temperature={lead.temperature} />
          <PageTitle className="text-2xl">{lead.nom}</PageTitle>
          <span className="font-mono text-xs text-muted">{lead.id}</span>
          <span className="rounded-md bg-brand/8 px-2 py-1 font-mono text-xs font-semibold text-brand">
            {faisabilite.score}/100
          </span>
          <Select
            aria-label="Statut"
            value={lead.statut}
            onChange={(e) => store.changeStatut(lead.id, e.target.value as Statut)}
            className="ml-auto h-8 w-auto text-[13px]"
          >
            {STATUT_ORDER.map((s) => (
              <option
                key={s}
                value={s}
                // Verrou RDV : « planifié » indisponible tant qu'aucun acompte
                // n'est encaissé (le store refuse aussi la transition).
                disabled={s === "planifie" && !rdvDeverrouille}
              >
                {STATUT_META[s].label}
                {s === "planifie" && !rdvDeverrouille ? " — acompte requis" : ""}
              </option>
            ))}
          </Select>
        </div>

        {/* KPI décision */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-surface px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Faisabilité</div>
            <div className={cn("mt-0.5 flex items-center gap-1.5 text-sm font-semibold", fm.text)}>
              <span className={cn("size-2 rounded-full", fm.dot)} />
              {fm.label}
            </div>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Estimation</div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-ink">
              {formatMontant(estimation.min, devise)} – {formatMontant(estimation.max, devise)}
            </div>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Délai projet</div>
            <div className="mt-0.5 text-sm text-ink">{lead.delai || "—"}</div>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Reçu</div>
            <div className="mt-0.5 text-sm text-ink">{formatDate(lead.date_reception)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            icon={FileText}
            onClick={() => router.push(`/devis/nouveau?lead=${lead.id}`)}
            size="sm"
          >
            Créer le devis
          </Button>
          <ActionLink href={`tel:${tel}`} icon={Phone}>Appeler</ActionLink>
          <ActionLink href={waLink(lead.telephone, lead.entite)} icon={MessageCircle} external>WhatsApp</ActionLink>
          {lead.email ? <ActionLink href={`mailto:${lead.email}`} icon={Mail}>Email</ActionLink> : null}
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
            Modifier
          </Button>
          {lead.devis?.statut === "signe" && !lead.facture ? (
            <Button variant="secondary" size="sm" icon={Receipt} onClick={onConvertFacture}>
              Convertir en facture
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-alert transition-colors hover:bg-alert/10"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            Supprimer
          </button>
        </div>
      </div>

      {/* ── Reprise de dossier : où on en est, en 2 secondes ── */}
      <div className="mb-4 flex flex-col gap-3">
        <RepriseBandeau lead={lead} activites={activites} />
        <JalonsRow lead={lead} activites={activites} />
      </div>

      {/* ── Corps ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Qualification IRVE */}
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-ink">Qualification IRVE</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Block title="Réseau électrique">
              <InfoRow label="Réseau" value={lead.reseau ? RESEAU_LABEL[lead.reseau] : null} />
              <InfoRow label="Puissance compteur" value={lead.puissance_compteur_kva != null ? `${lead.puissance_compteur_kva} kVA` : null} />
            </Block>
            <Block title="Le bien">
              <InfoRow label="Logement" value={lead.type_logement ? TYPE_LOGEMENT_LABEL[lead.type_logement] : null} />
              <InfoRow label="Occupation" value={lead.occupation ? OCCUPATION_LABEL[lead.occupation] : null} />
            </Block>
            <Block title="La pose">
              <InfoRow label="Emplacement" value={lead.emplacement ? EMPLACEMENT_LABEL[lead.emplacement] : null} />
              <InfoRow label="Fixation" value={lead.fixation ? FIXATION_LABEL[lead.fixation] : null} />
              <InfoRow label="Distance tableau" value={lead.distance_tableau != null ? `${lead.distance_tableau} m` : null} />
              <InfoRow label="Obstacles" value={lead.obstacles} />
            </Block>
            <Block title="Le projet">
              <InfoRow label="Véhicule" value={lead.type_vehicule} />
              <InfoRow label="Puissance souhaitée" value={lead.puissance_souhaitee ? PUISSANCE_LABEL[lead.puissance_souhaitee] : null} />
              <InfoRow label="Budget" value={lead.budget} />
              {/* eligible_advenir n'est plus affiché : signal de qualification
                  interne (import CSV + scoring de température) uniquement. */}
            </Block>
          </div>

          {/* Panneaux solaires (cross-sell) */}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold-ink">
            <Sun className="size-4 shrink-0" strokeWidth={2} />
            <span className="font-semibold">Panneaux solaires :</span>
            <span>
              {lead.pv_projet ? PV_PROJET_LABEL[lead.pv_projet] : "non renseigné"}
              {lead.pv_projet === "autre" && lead.pv_autre ? ` — ${lead.pv_autre}` : ""}
            </span>
          </div>

          {/* Synthèse faisabilité */}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-cream/50 px-3 py-2.5">
            <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", fm.dot)} />
            <p className="text-sm text-ink">
              <span className={cn("font-semibold", fm.text)}>{fm.label} — </span>
              {faisabilite.synthese}
            </p>
          </div>
        </Card>

        {/* Contact & provenance */}
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-ink">Contact & provenance</h3>
          <a href={`tel:${tel}`} className="flex justify-between gap-4 py-1 text-sm hover:text-brand">
            <span className="text-muted">Téléphone</span>
            <span className="font-mono text-ink">{lead.telephone}</span>
          </a>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="flex justify-between gap-4 py-1 text-sm hover:text-brand">
              <span className="text-muted">Email</span>
              <span className="truncate text-ink">{lead.email}</span>
            </a>
          ) : (
            <InfoRow label="Email" value={null} />
          )}
          <InfoRow label="Adresse" value={lead.adresse} />
          <a href={mapsLink(lead)} target="_blank" rel="noopener noreferrer" className="flex justify-between gap-4 py-1 text-sm hover:text-brand">
            <span className="text-muted">Localisation</span>
            <span className="inline-flex items-center gap-1 text-ink">
              <MapPin className="size-3.5" strokeWidth={2} />
              {[lead.code_postal, lead.ville].filter(Boolean).join(" ") || "—"}
            </span>
          </a>
          <InfoRow label="Source" value={lead.source_campagne} />
          <InfoRow label="Canal" value={CANAL_LABEL[lead.canal]} />
          {/* Assigné à : affiché dans le bandeau de reprise (source unique).
              Édition via « Passer le relais » ou « Modifier ». */}
        </Card>

        {/* Pipeline */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Pipeline</h3>
          {lead.statut === "perdu" ? (
            <div className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">
              Lead perdu{lead.motif_perte ? ` — motif : ${lead.motif_perte}` : ""}.
            </div>
          ) : (
            <ol className="flex flex-wrap gap-1.5">
              {STEPPER.map((label, i) => (
                <li
                  key={label}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    i < step && "bg-success/10 text-success",
                    i === step && "bg-brand text-cream",
                    i > step && "bg-cream text-muted",
                  )}
                >
                  {label}
                </li>
              ))}
            </ol>
          )}
          {/* Prochaine action / relance : affichées dans le bandeau de reprise
              (source unique). Édition via « Modifier ». */}
        </Card>

        {/* Documents */}
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-ink">Documents</h3>
          {lead.devis ? (
            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-ink">{lead.devis.ref}</span>
                <StatutBadge statut={lead.devis.statut === "signe" ? "signe" : "devis_envoye"} />
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
                <span className="text-muted">Total TTC</span>
                <span className="font-mono font-semibold text-ink">
                  {formatMontant(lead.devis.montant_ttc, lead.devis.devise, { cents: true })}
                </span>
              </div>
              {lead.devis.envoye_le ? (
                <p className="mt-2 text-[11px] text-muted">
                  Envoyé le {formatDate(lead.devis.envoye_le)}
                  {lead.devis.envoye_a ? ` à ${lead.devis.envoye_a}` : ""}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Download} onClick={() => void generateDevisPdf(lead, lead.devis!, undefined, ficheEnt)}>
                  Voir le PDF
                </Button>
                {/* Jamais sur un brouillon : un devis s'envoie une fois validé. */}
                {lead.devis.statut !== "brouillon" ? (
                  <Button size="sm" variant="secondary" icon={Send} onClick={() => setEnvoi("devis")}>
                    Envoyer au client
                  </Button>
                ) : null}
                {lead.devis.statut !== "signe" ? (
                  <Button size="sm" icon={PenLine} onClick={() => store.signDevis(lead.id)}>
                    Marquer signé
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line p-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted">
                  TVA ({raisonSociale(ficheEnt, lead.entite)} — {devise === "MAD" ? "DH" : "€"})
                </span>
                <Select
                  value={tvaMode || cfg.tvaDefaut}
                  onChange={(e) => setTvaMode(e.target.value as ModeTva)}
                  disabled={cfg.tvaOptions.length <= 1}
                >
                  {cfg.tvaOptions.map((o) => (
                    <option key={o.mode} value={o.mode}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </label>
              <Link
                href={`/devis/nouveau?lead=${lead.id}`}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-hover"
              >
                <SlidersHorizontal className="size-4" strokeWidth={1.75} />
                Créer le devis (catalogue)
              </Link>
              <button
                type="button"
                onClick={onGenerateDevis}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-cream hover:text-ink"
              >
                <FileText className="size-4" strokeWidth={1.75} />
                Brouillon rapide (1 clic)
              </button>
            </div>
          )}

          {/* Facture */}
          {lead.facture ? (
            <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-brand">{lead.facture.ref}</span>
                <span className="text-xs text-muted">issue de {lead.facture.devis_ref}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-brand/15 pt-2 text-sm">
                <span className="text-muted">Total TTC</span>
                <span className="font-mono font-semibold text-ink">
                  {formatMontant(lead.facture.montant_ttc, lead.facture.devise, { cents: true })}
                </span>
              </div>
              {lead.facture.envoye_le ? (
                <p className="mt-2 text-[11px] text-muted">
                  Envoyée le {formatDate(lead.facture.envoye_le)}
                  {lead.facture.envoye_a ? ` à ${lead.facture.envoye_a}` : ""}
                </p>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                icon={Send}
                className="mt-3 mr-2"
                onClick={() => setEnvoi("facture")}
              >
                Envoyer au client
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={Download}
                className="mt-3"
                onClick={() => void generateFacturePdf(lead, lead.facture!, ficheEnt)}
              >
                Voir la facture
              </Button>
            </div>
          ) : lead.devis?.statut === "signe" &&
            (lead.factures_acompte?.length ?? 0) === 0 ? (
            // Dossier sans acompte : facture normale directe. Avec acomptes, la
            // clôture passe par la facture de SOLDE (carte Règlements).
            <Button variant="secondary" icon={Receipt} onClick={onConvertFacture} className="mt-3 w-full">
              Convertir en facture
            </Button>
          ) : null}
        </Card>

        {/* Règlements — jauge payé/reste, registre, verrou RDV (dès signature) */}
        {lead.devis?.statut === "signe" ? <PaiementsCard lead={lead} /> : null}

        {/* Historique */}
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-ink">Historique</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            <Select
              aria-label="Type de saisie"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="h-9 w-auto shrink-0 text-[13px]"
            >
              {NOTE_TYPES.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </Select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNote()}
              placeholder="Ajouter au suivi…"
              className="min-w-0 flex-1"
            />
            <Button size="sm" icon={Plus} onClick={submitNote}>
              Ajouter
            </Button>
          </div>
          <Timeline activites={activites} />
        </Card>
      </div>

      <EditLeadDialog lead={lead} open={editOpen} onClose={() => setEditOpen(false)} />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer ce lead ?"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.deleteLead(lead.id);
                router.push("/leads");
              }}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Supprimer définitivement <span className="font-semibold">{lead.nom}</span> (
          <span className="font-mono">{lead.id}</span>) et tout son historique ? Cette action est irréversible.
        </p>
      </Modal>

      {/* Envoi du document au client (devis validé / facture) */}
      {envoi ? (
        <EnvoiDialog
          open
          onClose={() => setEnvoi(null)}
          lead={lead}
          kind={envoi}
        />
      ) : null}
    </div>
  );
}
