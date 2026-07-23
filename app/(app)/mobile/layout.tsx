import { LeadsStoreProvider } from "@/lib/leads/store";

// « Ma tournée » lit les RDV portés par les leads (source unique) : le module
// mobile a donc besoin du store des leads.
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <LeadsStoreProvider>{children}</LeadsStoreProvider>;
}
