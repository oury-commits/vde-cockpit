import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";

export const metadata: Metadata = {
  title: "Devis & Factures — VDE Cockpit",
};

export default function DevisPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center gap-3">
        <PageTitle>Devis &amp; Factures</PageTitle>
        <Link
          href="/devis/nouveau"
          className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-cream transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Plus className="size-4 shrink-0" strokeWidth={2} />
          Nouveau devis
        </Link>
      </header>

      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center">
        <FileText className="mx-auto size-8 text-muted" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-ink">Générateur de devis</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Construisez un devis en 5 étapes depuis le catalogue — marge, TVA par
          entité, aperçu client/interne en direct et échéancier paramétrable.
        </p>
        {/* TODO: brancher données réelles — liste des devis émis, filtrée par entité. */}
      </div>
    </div>
  );
}
