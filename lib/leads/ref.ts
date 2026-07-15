// Attribution des identifiants FB-XXX (incrémental, jamais de trou).

const RE = /^FB-(\d+)$/;

export function refNumber(id: string): number {
  const m = RE.exec(id.trim());
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** Prochaine ref FB-XXX au vu des ids existants. */
export function nextRef(existingIds: string[]): string {
  const max = existingIds.reduce((acc, id) => Math.max(acc, refNumber(id)), 0);
  return `FB-${String(max + 1).padStart(3, "0")}`;
}
