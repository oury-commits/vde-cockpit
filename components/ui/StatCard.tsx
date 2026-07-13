import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  /** Libellé en capitales, ex. « CA du mois ». */
  label: string;
  /** Valeur mise en avant — rendue en JetBrains Mono. */
  value: string;
  /** Précision optionnelle sous la valeur. */
  hint?: string;
  /** Passe la valeur en or (accent), pour les métriques à surveiller. */
  accent?: boolean;
  /** Rend l'indice en chiffres monospace (montants, échéanciers). */
  monoHint?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  monoHint = false,
}: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-[26px] font-semibold leading-none",
          accent ? "text-gold" : "text-ink",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div
          className={cn(
            "mt-1.5 text-xs text-muted",
            monoHint && "font-mono",
          )}
        >
          {hint}
        </div>
      ) : null}
    </Card>
  );
}
