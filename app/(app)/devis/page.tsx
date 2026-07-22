import type { Metadata } from "next";
import { DevisView } from "@/components/devis/DevisView";

export const metadata: Metadata = {
  title: "Devis & Factures — VDE Cockpit",
};

export default function DevisPage() {
  return <DevisView />;
}
