import { LeadsStoreProvider } from "@/lib/leads/store";

// Le store des leads porte les devis/factures (JSONB sur le lead). La liste
// /devis et le wizard /devis/nouveau en héritent via ce layout.
export default function DevisLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <LeadsStoreProvider>{children}</LeadsStoreProvider>;
}
