import { CatalogueStoreProvider } from "@/lib/catalogue/store";

// Le store des leads vient du layout parent /devis ; ici on ajoute seulement
// le catalogue, nécessaire au wizard.
export default function DevisNouveauLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CatalogueStoreProvider>{children}</CatalogueStoreProvider>;
}
