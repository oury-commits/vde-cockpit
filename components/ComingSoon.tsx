"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Construction } from "lucide-react";
import { NAV_SECTIONS } from "@/components/layout/nav";
import { PageTitle } from "@/components/ui/PageTitle";

/** Retrouve le libellé du module depuis la nav (source unique). */
function moduleLabel(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.href === pathname || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return "Module";
}

/** Placeholder « en construction » aux tokens du design system. */
export function ComingSoon() {
  const pathname = usePathname();
  const title = moduleLabel(pathname);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center md:py-28">
      <div className="grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold">
        <Construction className="size-7" strokeWidth={1.75} />
      </div>
      <PageTitle>{title}</PageTitle>
      <p className="text-sm text-muted">
        Ce module arrive prochainement (M2 — Devis / M3 — Encaissements…).
      </p>
      <Link
        href="/dashboard"
        className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2} />
        Retour au Tableau de bord
      </Link>
    </div>
  );
}
