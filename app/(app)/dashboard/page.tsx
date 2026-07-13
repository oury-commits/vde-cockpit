import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/PageTitle";
import { StatCard } from "@/components/ui/StatCard";

export const metadata: Metadata = {
  title: "Tableau de bord — VDE Cockpit",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <PageTitle>Tableau de bord</PageTitle>
        {/* TODO: brancher données réelles — période/entité statiques de démo */}
        <span className="text-sm text-muted">juillet · entité France</span>
      </header>

      {/* TODO: brancher données réelles — les 4 StatCards ci-dessous sont des
          valeurs statiques de démonstration (aucun chiffre réel). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="CA du mois"
          value="12 480 €"
          hint="juillet · entité France"
        />
        <StatCard
          label="Devis en attente"
          value="41"
          hint="52 300 € en jeu"
          monoHint
        />
        <StatCard
          label="Encaissements dus"
          value="8 940 €"
          hint="échéancier 40 / 40 / 20"
        />
        <StatCard
          label="Leads chauds"
          value="6"
          hint="à rappeler sous 24 h"
          accent
        />
      </div>
    </div>
  );
}
