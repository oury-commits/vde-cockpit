import { LeadsStoreProvider } from "@/lib/leads/store";

export default function LeadsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <LeadsStoreProvider>{children}</LeadsStoreProvider>;
}
