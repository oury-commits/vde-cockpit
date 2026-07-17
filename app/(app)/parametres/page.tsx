import type { Metadata } from "next";
import { ParametresView } from "@/components/settings/ParametresView";

export const metadata: Metadata = {
  title: "Paramètres — VDE Cockpit",
};

export default function ParametresPage() {
  return <ParametresView />;
}
