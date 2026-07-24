"use client";

import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import type { Lead } from "@/lib/types";
import { jalonsDerives } from "@/lib/leads/jalons";
import { estSolde, resteAPayer } from "@/lib/leads/reglements";
import {
  prochainGeste,
  signauxException,
  type Ton,
} from "@/lib/leads/etats";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

// Bandeau d'état consolidé (§E.4) : « Devis signé ✓ · Acompte reçu ✓ · Installé ✓
// · Solde dû 531 € » + le prochain geste + les signaux d'exception. Une seule
// source par élément (jalons dérivés, registre des règlements, machine à états).

const TON_GESTE: Record<Ton, string> = {
  neutre: "bg-cream text-muted",
  brand: "bg-brand text-cream",
  attention: "bg-gold/20 text-gold-ink",
  alerte: "bg-alert/12 text-alert",
  succes: "bg-success/12 text-success",
};

const TON_SIGNAL: Record<Ton, string> = {
  neutre: "bg-cream text-muted",
  brand: "bg-brand/10 text-brand",
  attention: "bg-gold/20 text-gold-ink",
  alerte: "bg-alert/12 text-alert",
  succes: "bg-success/12 text-success",
};

export function EtatDossier({ lead }: { lead: Lead }) {
  const jalons = jalonsDerives(lead);
  const geste = prochainGeste(lead);
  const signaux = signauxException(lead);
  const reste = resteAPayer(lead);
  const solde = estSolde(lead);
  const devise = entiteConfig(lead.entite).devise;

  return (
    <Card className="border-brand/20 bg-brand/[0.03]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Jalons dérivés — état d'avancement, lecture seule */}
        <ol className="flex flex-wrap items-center gap-1.5">
          {jalons.map((j) => (
            <li
              key={j.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                j.actif ? "bg-success/12 text-success" : "bg-cream text-muted",
              )}
              title={j.source}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full",
                  j.actif ? "bg-success text-cream" : "border border-line text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              {j.label}
            </li>
          ))}
        </ol>

        {/* Solde dû / soldé */}
        {lead.devis ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-sm font-semibold",
              solde ? "bg-success/12 text-success" : reste > 0.005 ? "bg-alert/10 text-alert" : "bg-cream text-muted",
            )}
          >
            {solde
              ? "Soldé"
              : reste > 0.005
                ? `Solde dû ${formatMontant(reste, devise, { cents: true })}`
                : "À encaisser"}
          </span>
        ) : null}
      </div>

      {/* Prochain geste — l'unique action évidente */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Prochain geste
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
            TON_GESTE[geste.ton],
          )}
        >
          {geste.ton === "alerte" ? (
            <AlertTriangle className="size-3.5" strokeWidth={2.25} />
          ) : (
            <ArrowRight className="size-3.5" strokeWidth={2.25} />
          )}
          {geste.label}
        </span>

        {/* Signaux d'exception (ce qui demande une action) */}
        {signaux.map((s) => (
          <span
            key={s.cle}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
              TON_SIGNAL[s.ton],
            )}
          >
            {(s.ton === "alerte" || s.ton === "attention") && (
              <AlertTriangle className="size-3" strokeWidth={2.25} />
            )}
            {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
