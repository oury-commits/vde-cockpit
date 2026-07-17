import type { Metadata } from "next";
import { DevisWizard } from "@/components/devis/DevisWizard";

export const metadata: Metadata = {
  title: "Nouveau devis — VDE Cockpit",
};

export default async function DevisNouveauPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  return <DevisWizard leadId={lead} />;
}
