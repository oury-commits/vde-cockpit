"use client";

import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CalendarClock,
  Download,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  PenLine,
  Phone,
  StickyNote,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Activite, ActiviteType } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { VISIBILITE_META } from "@/lib/leads/meta";
import { cn } from "@/lib/cn";

const ICONS: Record<ActiviteType, LucideIcon> = {
  import: Download,
  creation: UserPlus,
  appel: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visite: MapPin,
  note: StickyNote,
  devis: FileText,
  relance: Bell,
  statut: ArrowLeftRight,
  signature: PenLine,
  paiement: Banknote,
  rdv: CalendarClock,
};

export function Timeline({ activites }: { activites: Activite[] }) {
  if (activites.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">Aucune activité pour l'instant.</p>
    );
  }
  return (
    <ol className="flex flex-col">
      {activites.map((a, i) => {
        const Icon = ICONS[a.type];
        const last = i === activites.length - 1;
        return (
          <li key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-muted">
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              {!last ? <span className="w-px flex-1 bg-line" /> : null}
            </div>
            <div className="pb-4">
              <p
                className={cn(
                  "flex flex-wrap items-center gap-1.5 text-sm",
                  // Une annulation reste tracée, mais en retrait visuel.
                  a.annule ? "text-muted" : "text-ink",
                )}
              >
                {a.contenu}
                {a.visibilite ? (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      VISIBILITE_META[a.visibilite].badge,
                    )}
                  >
                    {VISIBILITE_META[a.visibilite].label}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {a.auteur} · <span className="font-mono">{formatDateTime(a.created_at)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
