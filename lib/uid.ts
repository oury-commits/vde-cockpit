/** Identifiant unique (UUID en contexte sécurisé, fallback sinon). */
export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
