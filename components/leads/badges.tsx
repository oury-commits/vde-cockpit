import type { Statut, Temperature } from "@/lib/types";
import { STATUT_META, TEMPERATURE_META } from "@/lib/leads/meta";
import { cn } from "@/lib/cn";

export function StatutBadge({ statut }: { statut: Statut }) {
  const m = STATUT_META[statut];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        m.badge,
      )}
    >
      {m.label}
    </span>
  );
}

export function TemperatureDot({
  temperature,
  withLabel = false,
}: {
  temperature: Temperature;
  withLabel?: boolean;
}) {
  const m = TEMPERATURE_META[temperature];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", m.dot)} aria-hidden />
      {withLabel ? (
        <span className={cn("text-xs font-medium", m.text)}>{m.label}</span>
      ) : (
        <span className="sr-only">{m.label}</span>
      )}
    </span>
  );
}
