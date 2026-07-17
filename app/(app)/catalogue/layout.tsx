import { CatalogueStoreProvider } from "@/lib/catalogue/store";

export default function CatalogueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CatalogueStoreProvider>{children}</CatalogueStoreProvider>;
}
