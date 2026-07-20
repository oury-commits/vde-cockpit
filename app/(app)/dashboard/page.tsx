import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/PageTitle";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";

export const metadata: Metadata = {
  title: "Tableau de bord — VDE Cockpit",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
        <PageTitle>Tableau de bord</PageTitle>
        {/* TODO: brancher données réelles — période statique de démo */}
        <span className="text-sm text-muted">juillet</span>
      </header>

      <DashboardKpis />
    </div>
  );
}
