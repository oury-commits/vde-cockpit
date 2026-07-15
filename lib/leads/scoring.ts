import type { Lead, Temperature } from "@/lib/types";

/**
 * Scoring température automatique (§6.1) — heuristique MVP.
 * Basée sur les signaux disponibles à l'ingestion : éligibilité ADVENIR,
 * type de logement (faisabilité), puissance (taille de projet ≈ budget) et
 * joignabilité (téléphone + email). Le commercial attaque les 🔴 d'abord.
 *
 * TODO: brancher données réelles — pondérations à affiner avec le délai projet
 * réel (champ non fourni par l'export Facebook actuel).
 */
export function scoreTemperature(
  lead: Pick<
    Lead,
    | "eligible_advenir"
    | "type_logement"
    | "telephone"
    | "email"
    | "puissance_souhaitee"
    | "montant_estime"
  >,
): Temperature {
  let score = 0;

  if (lead.eligible_advenir) score += 2;
  if (lead.type_logement === "maison") score += 1;
  if (lead.telephone) score += 1;
  if (lead.email) score += 1;

  if (lead.puissance_souhaitee === "11" || lead.puissance_souhaitee === "22") {
    score += 2;
  } else if (lead.puissance_souhaitee === "7.4") {
    score += 1;
  }

  if ((lead.montant_estime ?? 0) >= 3000) score += 1;

  if (score >= 5) return "chaud";
  if (score >= 3) return "tiede";
  return "froid";
}
