import { LeadsStoreProvider } from "@/lib/leads/store";

// Les tournées lisent les RDV portés par les leads (source unique) : le module
// Planning a donc besoin du store des leads, non monté par le layout (app).
export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return <LeadsStoreProvider>{children}</LeadsStoreProvider>;
}
