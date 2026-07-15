import type { Lead } from "@/lib/types";
import { StatCard } from "@/components/ui/StatCard";
import { formatEuros } from "@/lib/format";
import { relanceState } from "@/lib/leads/filters";

/** Bandeau KPI compact — valeurs dérivées du store (aucune donnée inventée). */
export function KpiRow({ leads, now }: { leads: Lead[]; now: Date }) {
  const actifs = leads.filter((l) => l.statut !== "perdu").length;

  const aRelancer = leads.filter((l) => {
    const r = relanceState(l, now);
    return r === "en_retard" || r === "aujourdhui";
  }).length;

  const devisAttente = leads.filter(
    (l) => l.devis && l.devis.statut !== "signe",
  ).length;

  let encaisse = 0;
  let attendu = 0;
  for (const l of leads) {
    for (const e of l.echeancier ?? []) {
      attendu += e.montant;
      if (e.statut === "encaisse") encaisse += e.montant;
    }
  }

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
        value={formatEuros(encaisse)}
        hint={`sur ${formatEuros(attendu)} attendus`}
        monoHint
      />
    </div>
  );
}
