"use client";

import { StatCard } from "@/components/ui/StatCard";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirMontants } from "@/lib/roles/permissions";

// TODO: brancher données réelles — les valeurs ci-dessous sont statiques.
const KPIS: {
  label: string;
  value: string;
  hint: string;
  monoHint?: boolean;
  accent?: boolean;
  /** Porte un montant (CA, encaissements, marge) → masqué aux rôles terrain. */
  montant: boolean;
}[] = [
  { label: "CA du mois", value: "12 480 €", hint: "juillet · entité France", montant: true },
  { label: "Devis en attente", value: "41", hint: "52 300 € en jeu", monoHint: true, montant: true },
  { label: "Encaissements dus", value: "8 940 €", hint: "échéancier 40 / 40 / 20", montant: true },
  { label: "Leads chauds", value: "6", hint: "à rappeler sous 24 h", accent: true, montant: true },
];

/**
 * KPI du tableau de bord. Règle d'or : le conducteur de travaux et le
 * technicien ne voient JAMAIS un montant — on n'affiche pas une version
 * tronquée, on retire purement la carte.
 */
export function DashboardKpis() {
  const { identite } = useIdentity();
  const montants = peutVoirMontants(identite);
  const cartes = KPIS.filter((k) => montants || !k.montant);

  if (cartes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/60 py-12 text-center">
        <p className="text-sm font-medium text-ink">KPI opérationnels</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Les indicateurs financiers ne sont pas accessibles à ton rôle. Les KPI
          de chantier (interventions, tournées, SAV) arriveront avec le module
          Planning.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cartes.map((k) => (
        <StatCard
          key={k.label}
          label={k.label}
          value={k.value}
          hint={k.hint}
          monoHint={k.monoHint}
          accent={k.accent}
        />
      ))}
    </div>
  );
}
