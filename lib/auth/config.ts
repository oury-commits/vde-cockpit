/**
 * Mode ouvert (dev) — désactive la garde d'authentification.
 *
 * Activé UNIQUEMENT par NEXT_PUBLIC_AUTH_DISABLED=true dans .env.local.
 * Défaut : false (auth active). Toute autre valeur que "true" → false.
 *
 * ATTENTION : tant que ce flag vaut true, l'application ne doit tourner QU'EN LOCAL,
 * jamais être déployée. Voir le bloc « AVANT MISE EN LIGNE » du README.
 */
export const isAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";
