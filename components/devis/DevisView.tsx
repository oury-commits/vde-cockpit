"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileText, MailPlus, MoreHorizontal, Plus, Receipt, Search, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useLeadsStore } from "@/lib/leads/store";
import { useEntity } from "@/lib/entite/EntityProvider";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirModule } from "@/lib/roles/permissions";
import { formatDate, formatMontant } from "@/lib/format";
import { resteAPayer, estSolde } from "@/lib/leads/reglements";
import {
  devisARelancer,
  devisExpire,
  peutTransformerEnFacture,
  statutDevisAffiche,
  STATUT_DEVIS_LABEL,
  VALIDITE_DEVIS_JOURS,
  type StatutDevisAffiche,
  type Transition,
} from "@/lib/leads/etats";
import { RelanceDialog } from "@/components/emails/RelanceDialog";
import { cn } from "@/lib/cn";
import type { Lead } from "@/lib/types";

type Devise = "EUR" | "MAD";

interface DocLigne {
  lead: Lead;
  ref: string;
  clientNom: string;
  ttc: number;
  ht: number;
  devise: Devise;
  statut: StatutDevisAffiche;
  date: string;
  envoye_le?: string | null;
  validite: string;
  aRelancer: boolean;
  facturesAcompte: number;
  reste: number;
  solde: boolean;
  transfo: Transition;
}

const TONE: Record<StatutDevisAffiche, "muted" | "gold" | "success" | "alert"> = {
  brouillon: "muted",
  envoye: "gold",
  accepte: "success",
  expire: "alert",
};

const FILTRES: { key: "all" | StatutDevisAffiche; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "brouillon", label: "Brouillon" },
  { key: "envoye", label: "Envoyé" },
  { key: "accepte", label: "Accepté" },
  { key: "expire", label: "Expiré" },
];

function memeMois(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function validiteDe(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + VALIDITE_DEVIS_JOURS);
  return formatDate(d.toISOString());
}

export function DevisView() {
  const store = useLeadsStore();
  const router = useRouter();
  const { active } = useEntity();
  const { identite } = useIdentity();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"all" | StatutDevisAffiche>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [relanceLead, setRelanceLead] = useState<Lead | null>(null);

  const peutCreer = peutVoirModule(identite, "devis");

  const docs = useMemo<DocLigne[]>(() => {
    return store.leads
      .filter((l) => l.devis && (active === "ALL" || l.entite === active))
      .map((l) => ({
        lead: l,
        ref: l.devis!.ref,
        clientNom: l.nom,
        ttc: l.devis!.montant_ttc,
        ht: l.devis!.montant_ht,
        devise: l.devis!.devise as Devise,
        statut: statutDevisAffiche(l)!,
        date: l.devis!.date_creation,
        envoye_le: l.devis!.envoye_le,
        validite: validiteDe(l.devis!.date_creation),
        aRelancer: devisARelancer(l) || devisExpire(l),
        facturesAcompte: l.factures_acompte?.length ?? 0,
        reste: resteAPayer(l),
        solde: estSolde(l),
        transfo: peutTransformerEnFacture(l),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [store.leads, active]);

  // ── KPI (§D) — calculés sur le périmètre entité courant ──
  const kpi = useMemo(() => {
    const now = new Date();
    const ceMois = docs.filter((d) => memeMois(d.date, now)).length;
    const enCours = docs.filter((d) => d.statut !== "brouillon" && !d.solde);
    const devises = new Set(enCours.map((d) => d.devise));
    const htMono = devises.size <= 1;
    const htSum = enCours.reduce((s, d) => s + d.ht, 0);
    const envoyes = docs.filter((d) => d.statut !== "brouillon").length;
    const acceptes = docs.filter((d) => d.statut === "accepte").length;
    const taux = envoyes > 0 ? Math.round((acceptes / envoyes) * 100) : 0;
    const relances = docs.filter((d) => d.aRelancer).length;
    return {
      ceMois,
      htEnAttente: htMono
        ? formatMontant(htSum, [...devises][0] ?? "EUR", { cents: false })
        : `${enCours.length} devis`,
      htMono,
      envoyes,
      acceptes,
      taux,
      relances,
    };
  }, [docs]);

  const filtres = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter(
      (d) =>
        (filtre === "all" || d.statut === filtre) &&
        (!needle ||
          d.ref.toLowerCase().includes(needle) ||
          d.clientNom.toLowerCase().includes(needle)),
    );
  }, [docs, q, filtre]);

  const m = (n: number, d: Devise) => formatMontant(n, d, { cents: true });

  const onTransform = async (lead: Lead) => {
    setMenuOpen(null);
    const facture = await store.generateFacture(lead.id);
    if (facture) router.push(`/leads/${lead.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Devis &amp; factures</PageTitle>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-mono">{docs.length}</span> document
            {docs.length > 1 ? "s" : ""} émis
            {active !== "ALL" ? ` · ${active === "MA" ? "Maroc" : "France"}` : ""}.
          </p>
        </div>
        {peutCreer ? (
          <Link
            href="/devis/nouveau"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-cream transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} />
            Nouveau devis
          </Link>
        ) : null}
      </div>

      {/* KPI */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devis ce mois" value={String(kpi.ceMois)} hint="émis ce mois-ci" />
        <StatCard
          label="HT en attente"
          value={kpi.htEnAttente}
          hint={kpi.htMono ? "réponse ou paiement en attente" : "devises mixtes (FR+MA)"}
        />
        <StatCard
          label="Transformation"
          value={`${kpi.taux} %`}
          hint={`${kpi.acceptes}/${kpi.envoyes} acceptés`}
          monoHint
        />
        <StatCard
          label="Relances à faire"
          value={String(kpi.relances)}
          hint="devis sans réponse"
          accent={kpi.relances > 0}
        />
      </div>

      {/* Recherche + filtres statut */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un n° ou un client…" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltre(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
                filtre === f.key ? "bg-brand text-cream" : "bg-cream text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-3 p-0">
        {!store.loaded ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Chargement…</p>
        ) : filtres.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FileText className="mx-auto size-8 text-muted" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-ink">
              {docs.length === 0 ? "Aucun devis émis" : "Aucun résultat"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {docs.length === 0
                ? "Les devis validés depuis un dossier apparaîtront ici."
                : "Aucun devis ne correspond à ce filtre."}
            </p>
          </div>
        ) : (
          filtres.map((d) => {
            const key = d.lead.id + d.ref;
            return (
              <div
                key={key}
                className="flex flex-col gap-2 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/leads/${d.lead.id}`} className="font-mono text-sm font-semibold text-ink hover:text-brand">
                      {d.ref}
                    </Link>
                    <Badge tone={TONE[d.statut]}>{STATUT_DEVIS_LABEL[d.statut]}</Badge>
                    {d.aRelancer ? <Badge tone="gold">à relancer</Badge> : null}
                    {d.facturesAcompte > 0 ? (
                      <Badge tone="muted">
                        {d.facturesAcompte} acompte{d.facturesAcompte > 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                    {d.solde ? (
                      <Badge tone="success">soldé</Badge>
                    ) : d.reste > 0 && d.statut === "accepte" ? (
                      <Badge tone="alert">reste {m(d.reste, d.devise)}</Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-[13px] text-muted">
                    {d.clientNom} · validité {d.validite}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end sm:text-right">
                  <span className="font-mono text-sm font-semibold text-ink">{m(d.ttc, d.devise)}</span>

                  {/* Actions */}
                  <div className="relative flex items-center gap-1">
                    {d.aRelancer ? (
                      <button
                        type="button"
                        onClick={() => setRelanceLead(d.lead)}
                        title="Relancer le client"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gold/15 px-2.5 text-[12px] font-semibold text-gold-ink transition-colors hover:bg-gold/25"
                      >
                        <MailPlus className="size-3.5" strokeWidth={2} />
                        <span className="hidden sm:inline">Relancer</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Actions"
                      onClick={() => setMenuOpen(menuOpen === key ? null : key)}
                      className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink"
                    >
                      <MoreHorizontal className="size-4" strokeWidth={2} />
                    </button>
                    {menuOpen === key ? (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
                          <Link href={`/leads/${d.lead.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-cream">
                            <Eye className="size-4 text-muted" strokeWidth={1.75} /> Voir le dossier
                          </Link>
                          <button
                            type="button"
                            disabled={!d.transfo.ok}
                            title={d.transfo.raison}
                            onClick={() => void onTransform(d.lead)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Receipt className="size-4 text-muted" strokeWidth={1.75} /> Transformer en facture
                          </button>
                          <Link href={`/leads/${d.lead.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-cream">
                            <SlidersHorizontal className="size-4 text-muted" strokeWidth={1.75} /> Modifier le statut
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(null);
                              setRelanceLead(d.lead);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-cream"
                          >
                            <MailPlus className="size-4 text-muted" strokeWidth={1.75} /> Écrire / Relancer
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {relanceLead ? (
        <RelanceDialog lead={relanceLead} onClose={() => setRelanceLead(null)} />
      ) : null}
    </div>
  );
}
