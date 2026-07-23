// Règles + indicateur de force du mot de passe — partagés par /reset-password
// et l'écran Paramètres (Sécurité). Volontairement BASIQUE : longueur + mélange.

export const MIN_MDP = 8;

export interface ForceMdp {
  /** 0 → 4. */
  score: number;
  label: string;
  /** Longueur minimale atteinte (condition nécessaire, pas suffisante). */
  ok: boolean;
}

const LABELS = ["Faible", "Faible", "Moyen", "Bon", "Fort"];

/** Force approximative d'un mot de passe (longueur, casse mixte, chiffre+symbole). */
export function forceMotDePasse(pw: string): ForceMdp {
  let score = 0;
  if (pw.length >= MIN_MDP) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const ok = pw.length >= MIN_MDP;
  return { score, label: ok ? LABELS[score] : "Trop court", ok };
}
