import type { Devise, Lead } from "@/lib/types";
import type { ActiveEntite } from "@/lib/entite/EntityProvider";
import { StatCard } from "@/components/ui/StatCard";
import { formatMontant } from "@/lib/format";
import { relanceState } from "@/lib/leads/filters";
import { totalRegle } from "@/lib/leads/reglements";

/** Bandeau KPI compact — valeurs dérivées du store, dans la devise de l'entité. */
export function KpiRow({
  leads,
  now,
  active,
}: {
  leads: Lead[];
  now: Date;
  active: ActiveEntite;
}) {
  const actifs = leads.filter((l) => l.statut !== "perdu").length;

  const aRelancer = leads.filter((l) => {
    const r = relanceState(l, now);
    return r === "en_retard" || r === "aujourdhui";
  }).length;

  const devisAttente = leads.filter(
    (l) => l.devis && l.devis.statut !== "signe",
  ).length;

  // « Encaissé » = registre des règlements (source de vérité), PAS l'échéancier :
  // un règlement partiel ne marque pas l'échéance à son montant plein, et une
  // échéance peut être basculée sans règlement. On lit donc `totalRegle`, comme
  // la fiche (PaiementsCard), pour que les deux écrans ne divergent jamais.
  let encaisse = 0;
  let attendu = 0;
  for (const l of leads) {
    encaisse += totalRegle(l);
    for (const e of l.echeancier ?? []) attendu += e.montant;
  }

  // En "Tous", les montants mêlent EUR et MAD → on ne les additionne pas.
  const devise: Devise | null = active === "ALL" ? null : active === "MA" ? "MAD" : "EUR";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="Leads actifs" value={String(actifs)} hint="hors perdus" />
      <StatCard
        label="À relancer"
        value={String(aRelancer)}
        hint="en retard + aujourd'hui"
        accent={aRelancer > 0}
      />
      <StatCard
        label="Devis en attente"
        value={String(devisAttente)}
        hint="signature à obtenir"
      />
      <StatCard
        label="Encaissé"
        value={devise ? formatMontant(encaisse, devise) : "—"}
        hint={devise ? `sur ${formatMontant(attendu, devise)} attendus` : "multi-devise"}
        monoHint
      />
    </div>
  );
}
