import type { Metadata } from "next";
import { LeadsStoreProvider } from "@/lib/leads/store";
import { LeadsView } from "@/components/leads/LeadsView";

export const metadata: Metadata = {
  title: "Leads — VDE Cockpit",
};

export default function LeadsPage() {
  return (
    <LeadsStoreProvider>
      <LeadsView />
    </LeadsStoreProvider>
  );
}
