"use client";

import { useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  Clock,
  Lock,
  Receipt,
  Wallet,
} from "lucide-react";
import type { Lead, ReglementMode } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { generateFacturePdf } from "@/lib/leads/facture";
import { formatDate, formatMontant } from "@/lib/format";
import {
  MODE_REGLEMENT_LABEL,
  aEncaissement,
  estSolde,
  estSoldeAlma,
  peutGenererSolde,
  resteAPayer,
  soldeEnAttente,
  totalRegle,
} from "@/lib/leads/reglements";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";

const ECHEANCE_LABEL: Record<string, string> = {
  acompte: "Acompte",
  demarrage: "Démarrage",
  solde: "Solde",
};

const MODES: ReglementMode[] = ["virement", "cheque", "cb", "especes", "alma"];

export function PaiementsCard({ lead }: { lead: Lead }) {
  const store = useLeadsStore();
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ReglementMode>("virement");
  const [busy, setBusy] = useState(false);

  if (!lead.devis) return null;

  const devise = lead.devis.devise;
  const m = (n: number) => formatMontant(n, devise, { cents: true });
  const du = lead.devis.montant_ttc;
  const paye = totalRegle(lead);
  const reste = resteAPayer(lead);
  const soldeAlma = estSoldeAlma(lead);
  const solde = estSolde(lead);
  // Jauge cohérente avec le badge « Soldé » : un dossier soldé (Alma compris,
  // même encaissé pour un montant < TTC hors commission) affiche 100 %.
  const pct = solde ? 100 : du > 0 ? Math.min(100, Math.round((paye / du) * 100)) : 0;

  // Verrou RDV : « pas d'acompte, pas de RDV » (le passage à « planifié »).
  const rdvConfirme = lead.statut === "planifie" || lead.statut === "installe";
  const rdvConfirmable = aEncaissement(lead);
  const signe = lead.devis.statut === "signe";
  const reglements = lead.reglements ?? [];

  // Prochaine échéance attendue — proposée en un clic (jamais imposée).
  const prochaine = lead.echeancier?.find((x) => x.statut !== "encaisse");

  const enregistrer = async () => {
    const v = Number(montant.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || busy) return;
    setBusy(true);
    try {
      await store.enregistrerReglement(lead.id, { montant: v, mode });
      setMontant("");
      setMode("virement");
    } finally {
      setBusy(false);
    }
  };

  // Facture de solde (Bloc C) : gate installation.
  const aAcomptes = (lead.factures_acompte?.length ?? 0) > 0;
  const soldeDejaEmis = lead.facture?.type === "solde";
  const genererSolde = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const f = await store.genererFactureSolde(lead.id);
      if (f) generateFacturePdf(lead, f);
    } finally {
      setBusy(false);
    }
  };

  const confirmerRdv = () => {
    if (rdvConfirmable) store.changeStatut(lead.id, "planifie");
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wallet className="size-4 text-brand" strokeWidth={1.75} />
          Règlements
        </h3>
        {solde ? (
          <Badge tone="success">Soldé</Badge>
        ) : (
          <Badge tone="gold">Reste dû</Badge>
        )}
      </div>

      {/* Jauge Payé / Reste — source de vérité : le registre */}
      <div className="rounded-xl border border-line bg-cream/40 p-3">
        <div className="flex items-end justify-between font-mono">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">Payé</p>
            <p className="text-lg font-semibold text-ink">{m(paye)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Reste
            </p>
            <p className={`text-lg font-semibold ${reste > 0 ? "text-alert" : "text-success"}`}>
              {m(reste)}
            </p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full ${solde ? "bg-success" : "bg-brand"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right font-mono text-[11px] text-muted">
          {m(paye)} / {m(du)} · {pct} %
        </p>
      </div>

      {soldeAlma ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-[13px] text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Payé via Alma — VDE a encaissé l&apos;intégralité. Aucun solde à suivre.
        </p>
      ) : null}

      {/* Verrou RDV : pas d'acompte, pas de RDV */}
      {signe && !rdvConfirme ? (
        rdvConfirmable ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[13px] text-brand">
              <CalendarClock className="size-4" strokeWidth={2} />
              Acompte encaissé — RDV confirmable.
            </span>
            <Button size="sm" onClick={confirmerRdv}>
              Confirmer le RDV
            </Button>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
            <Lock className="size-4 shrink-0" strokeWidth={2} />
            RDV en attente d&apos;acompte — aucun encaissement enregistré.
          </p>
        )
      ) : null}

      {/* Échéancier prévu */}
      {lead.echeancier && lead.echeancier.length > 0 && !soldeAlma ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Échéancier
          </p>
          <div className="space-y-1 font-mono text-[13px]">
            {lead.echeancier.map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-muted">
                  {e.pct} % · {ECHEANCE_LABEL[e.label] ?? e.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-ink">{m(e.montant)}</span>
                  {e.statut === "encaisse" ? (
                    <CircleCheck className="size-3.5 text-success" strokeWidth={2} />
                  ) : (
                    <span className="text-[11px] text-muted">attendu</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Registre des encaissements */}
      {reglements.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Encaissements
          </p>
          <ul className="space-y-1.5">
            {reglements.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px]"
              >
                <span className="min-w-0">
                  <span className="font-mono text-ink">{m(r.montant)}</span>
                  <span className="ml-1.5 text-muted">
                    {MODE_REGLEMENT_LABEL[r.mode]}
                  </span>
                  {r.facture_acompte_ref ? (
                    <span className="ml-1.5 font-mono text-[11px] text-brand">
                      {r.facture_acompte_ref}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {formatDate(r.encaisse_le)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Saisie d'un encaissement */}
      {signe && !solde ? (
        <div className="mt-3 rounded-xl border border-line p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
            <Field label={`Montant (${devise === "MAD" ? "DH" : "€"})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                className="font-mono"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Moyen">
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as ReglementMode)}
              >
                {MODES.map((x) => (
                  <option key={x} value={x}>
                    {MODE_REGLEMENT_LABEL[x]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {prochaine && mode !== "alma" ? (
            <button
              type="button"
              onClick={() => setMontant(String(prochaine.montant))}
              className="mt-1.5 font-mono text-[12px] text-brand underline"
            >
              Remplir le prochain acompte ({m(prochaine.montant)})
            </button>
          ) : null}
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={enregistrer}
            disabled={busy || !montant}
          >
            {mode === "alma"
              ? "Enregistrer le paiement Alma (solde le dossier)"
              : "Enregistrer l'encaissement"}
          </Button>
          {mode !== "alma" ? (
            <p className="mt-1.5 text-center text-[11px] text-muted">
              Une facture d&apos;acompte numérotée sera émise (Art. 289 CGI).
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Facture de solde (Bloc C) — gate installation */}
      {aAcomptes && !soldeDejaEmis && !soldeAlma ? (
        peutGenererSolde(lead) ? (
          <div className="mt-3 rounded-xl border border-brand/25 bg-brand/5 p-3">
            <p className="mb-2 text-[13px] text-ink">
              Installation clôturée — la facture de solde déduit les acomptes
              déjà facturés et régularise la TVA.
            </p>
            <Button
              size="sm"
              icon={Receipt}
              className="w-full"
              onClick={genererSolde}
              disabled={busy}
            >
              Générer la facture de solde ({m(reste)})
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-cream/40 px-3 py-2 text-[13px] text-muted">
            <Receipt className="size-4 shrink-0" strokeWidth={1.75} />
            Facture de solde à générer après installation.
          </div>
        )
      ) : null}

      {/* Marqueur « solde en attente » (relance future — pas d'auto-relance) */}
      {soldeEnAttente(lead) && soldeDejaEmis ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
          <Clock className="size-4 shrink-0" strokeWidth={2} />
          Solde en attente de paiement — à relancer.
        </p>
      ) : null}

      {/* Facture de solde émise */}
      {lead.facture?.type === "solde" ? (
        <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-brand">
              {lead.facture.ref}
            </span>
            <Badge tone="gold">solde</Badge>
          </div>
          <div className="mt-2 flex justify-between border-t border-brand/15 pt-2 text-sm">
            <span className="text-muted">Solde à payer</span>
            <span className="font-mono font-semibold text-ink">
              {m(lead.facture.montant_ttc)}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={Receipt}
            className="mt-2"
            onClick={() => generateFacturePdf(lead, lead.facture!)}
          >
            Voir la facture de solde
          </Button>
        </div>
      ) : null}

      {/* Factures d'acompte émises */}
      {lead.factures_acompte && lead.factures_acompte.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Factures d&apos;acompte
          </p>
          <ul className="space-y-1 font-mono text-[13px]">
            {lead.factures_acompte.map((f) => (
              <li key={f.ref} className="flex justify-between">
                <span className="text-brand">{f.ref}</span>
                <span className="text-ink">{m(f.montant_ttc)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
