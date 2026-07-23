"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useLeadsStore } from "@/lib/leads/store";
import { useEntity } from "@/lib/entite/EntityProvider";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirModule } from "@/lib/roles/permissions";
import { formatDate, formatMontant } from "@/lib/format";
import { resteAPayer, estSolde } from "@/lib/leads/reglements";
import type { Lead } from "@/lib/types";

interface DocLigne {
  lead: Lead;
  ref: string;
  clientNom: string;
  ttc: number;
  devise: "EUR" | "MAD";
  statut: "brouillon" | "envoye" | "signe";
  date: string;
  envoye_le?: string | null;
  facturesAcompte: number;
  facture: boolean;
  reste: number;
  solde: boolean;
}

const STATUT_META: Record<string, { label: string; tone: "muted" | "gold" | "success" }> = {
  brouillon: { label: "Brouillon", tone: "muted" },
  envoye: { label: "Envoyé", tone: "gold" },
  signe: { label: "Signé", tone: "success" },
};

export function DevisView() {
  const store = useLeadsStore();
  const { active } = useEntity();
  const { identite } = useIdentity();
  const [q, setQ] = useState("");

  const peutCreer = peutVoirModule(identite, "devis");

  const docs = useMemo<DocLigne[]>(() => {
    return store.leads
      .filter((l) => l.devis && (active === "ALL" || l.entite === active))
      .map((l) => ({
        lead: l,
        ref: l.devis!.ref,
        clientNom: l.nom,
        ttc: l.devis!.montant_ttc,
        devise: l.devis!.devise as "EUR" | "MAD",
        statut: l.devis!.statut,
        date: l.devis!.date_creation,
        envoye_le: l.devis!.envoye_le,
        facturesAcompte: l.factures_acompte?.length ?? 0,
        facture: Boolean(l.facture),
        reste: resteAPayer(l),
        solde: estSolde(l),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [store.leads, active]);

  const filtres = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter(
      (d) =>
        d.ref.toLowerCase().includes(needle) ||
        d.clientNom.toLowerCase().includes(needle),
    );
  }, [docs, q]);

  const m = (n: number, d: "EUR" | "MAD") => formatMontant(n, d, { cents: true });

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

      <div className="relative mt-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un n° ou un client…" className="pl-9" />
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
                : "Aucun devis ne correspond à cette recherche."}
            </p>
          </div>
        ) : (
          filtres.map((d) => (
            <Link
              key={d.lead.id + d.ref}
              href={`/leads/${d.lead.id}`}
              className="flex flex-col gap-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-cream/40 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{d.ref}</span>
                  <Badge tone={STATUT_META[d.statut].tone}>{STATUT_META[d.statut].label}</Badge>
                  {d.facturesAcompte > 0 ? (
                    <Badge tone="muted">
                      {d.facturesAcompte} acompte{d.facturesAcompte > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  {d.solde ? (
                    <Badge tone="success">soldé</Badge>
                  ) : d.reste > 0 && d.statut === "signe" ? (
                    <Badge tone="alert">reste {m(d.reste, d.devise)}</Badge>
                  ) : null}
                </div>
                <p className="truncate text-[13px] text-muted">{d.clientNom}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end sm:text-right">
                <span className="font-mono text-sm font-semibold text-ink">{m(d.ttc, d.devise)}</span>
                <span className="font-mono text-[12px] text-muted sm:w-24">
                  {d.envoye_le ? `env. ${formatDate(d.envoye_le)}` : formatDate(d.date)}
                </span>
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
