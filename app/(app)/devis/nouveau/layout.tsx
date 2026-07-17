import { LeadsStoreProvider } from "@/lib/leads/store";
import { CatalogueStoreProvider } from "@/lib/catalogue/store";

export default function DevisNouveauLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <LeadsStoreProvider>
      <CatalogueStoreProvider>{children}</CatalogueStoreProvider>
    </LeadsStoreProvider>
  );
}
