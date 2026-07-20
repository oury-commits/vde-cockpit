import type { Entite } from "@/lib/types";

export type TypeIntervention = "pose" | "sav" | "visite_technique";
export type StatutIntervention = "planifiee" | "en_cours" | "terminee";

export const TYPE_LABEL: Record<TypeIntervention, string> = {
  pose: "Pose",
  sav: "SAV",
  visite_technique: "Visite technique",
};

export const STATUT_LABEL: Record<StatutIntervention, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
};

/**
 * Une intervention sur le terrain.
 *
 * Ce modèle ne porte AUCUN montant, volontairement : le technicien et le
 * conducteur de travaux ne voient jamais un prix. La règle est donc portée par
 * la structure de la donnée, pas seulement par un masquage d'affichage —
 * il n'y a rien à masquer, rien à fuiter.
 */
export interface Intervention {
  id: string;
  entite: Entite;
  lead_id: string | null;
  /** Profil du technicien affecté. Base du cloisonnement « sa tournée à lui ». */
  technicien_id: string | null;
  date: string; // ISO (jour)
  creneau: string; // ex. « 08:30 – 10:30 »
  type: TypeIntervention;
  statut: StatutIntervention;
  client_nom: string;
  telephone: string;
  adresse: string;
  ville: string;
  consigne: string | null;
}
