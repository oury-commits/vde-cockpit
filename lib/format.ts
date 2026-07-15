// Formatage FR — montants, dates. Les valeurs numériques sont rendues en
// JetBrains Mono côté UI (règle CLAUDE.md).

const NBSP = " ";

/** "12 480 €" (défaut) ou "1 234,56 €" avec centimes. */
export function formatEuros(
  value: number,
  opts: { cents?: boolean } = {},
): string {
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(value);
  // Intl utilise des espaces insécables étroits ; on normalise en NBSP.
  return `${n.replace(/ /g, NBSP)}${NBSP}€`;
}

/** "15/07/2026". Accepte une date ISO. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** "15/07· 09:24" — pour la timeline. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

/** Ancienneté lisible : "aujourd'hui", "3 j", "5 sem". */
export function anciennete(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `${days} j`;
  if (days < 30) return `${Math.floor(days / 7)} sem`;
  return `${Math.floor(days / 30)} mois`;
}
