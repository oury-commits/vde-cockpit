import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";

export const metadata: Metadata = {
  title: "Accès non autorisé — VDE Cockpit",
};

/**
 * Deny by default : un compte sans rôle ni entité assignés (ou désactivé)
 * n'atteint aucun module. L'admin doit lui attribuer un rôle + une entité.
 */
export default function AccesRefusePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center md:py-28">
      <div className="grid size-14 place-items-center rounded-2xl bg-alert/10 text-alert">
        <ShieldAlert className="size-7" strokeWidth={1.75} />
      </div>
      <PageTitle>Accès non autorisé</PageTitle>
      <p className="text-sm text-muted">
        Ton compte n&apos;a pas encore de rôle ni d&apos;entité, ou il a été
        désactivé. Un administrateur doit t&apos;attribuer un accès depuis
        l&apos;écran Équipe.
      </p>
    </div>
  );
}
