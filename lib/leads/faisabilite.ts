import type { Lead } from "@/lib/types";
import { PUISSANCE_LABEL } from "@/lib/leads/meta";

export type NiveauFaisabilite = "simple" | "moyen" | "complexe";

export interface Faisabilite {
  niveau: NiveauFaisabilite;
  /** Score /100 (100 = installation idéale). */
  score: number;
  /** Points forts (installation simple) et points d'attention. */
  positifs: string[];
  frictions: string[];
  /** Phrase de synthèse prête à afficher. */
  synthese: string;
}

interface FaisabiliteMeta {
  label: string;
  dot: string; // token couleur
  text: string;
}

/** 🟢 = success · 🟠 = gold · 🔴 = alert (tokens, zéro emoji à l'écran). */
export const FAISABILITE_META: Record<NiveauFaisabilite, FaisabiliteMeta> = {
  simple: { label: "Simple", dot: "bg-success", text: "text-success" },
  moyen: { label: "Moyen", dot: "bg-gold", text: "text-gold-ink" },
  complexe: { label: "Complexe", dot: "bg-alert", text: "text-alert" },
};

const OBSTACLE_VIDE = new Set(["aucun", "non", "rien", "-", "aucune", "nc"]);

/**
 * Score de faisabilité auto (§4), dérivé de la qualification IRVE.
 * Additionne des « frictions » pondérées ; le niveau et le score en découlent.
 */
export function computeFaisabilite(lead: Lead): Faisabilite {
  const positifs: string[] = [];
  const frictions: string[] = [];
  let poids = 0;

  // Réseau électrique
  const p = lead.puissance_souhaitee;
  if (lead.reseau === "tri") {
    positifs.push("triphasé");
  } else if (lead.reseau === "mono") {
    if (p === "11" || p === "22") {
      frictions.push(`monophasé insuffisant pour ${PUISSANCE_LABEL[p]}`);
      poids += 2;
    } else if ((lead.puissance_compteur_kva ?? 99) < 6) {
      frictions.push(
        `monophasé faible puissance (${lead.puissance_compteur_kva} kVA)`,
      );
      poids += 1;
    } else {
      positifs.push("monophasé compatible");
    }
  }

  // Distance au tableau
  const d = lead.distance_tableau;
  if (d != null) {
    if (d <= 10) positifs.push(`${d} m du tableau`);
    else if (d <= 20) {
      frictions.push(`distance moyenne (${d} m)`);
      poids += 1;
    } else {
      frictions.push(`longue distance (${d} m)`);
      poids += 2;
    }
  }

  // Obstacles
  const obs = (lead.obstacles ?? "").trim();
  if (obs) {
    if (OBSTACLE_VIDE.has(obs.toLowerCase())) positifs.push("sans obstacle");
    else {
      frictions.push(`obstacles : ${obs}`);
      poids += 1;
    }
  }

  // Occupation
  if (lead.occupation === "proprietaire") positifs.push("propriétaire");
  else if (lead.occupation === "locataire") {
    frictions.push("locataire (accord propriétaire requis)");
    poids += 1;
  }

  const niveau: NiveauFaisabilite =
    poids === 0 ? "simple" : poids >= 3 ? "complexe" : "moyen";
  const score = Math.max(30, Math.min(100, 100 - poids * 18));

  const synthese =
    niveau === "simple"
      ? `Installation simple${positifs.length ? " : " + positifs.join(", ") : ""}.`
      : niveau === "moyen"
        ? `Point d'attention : ${frictions.join(", ")}.`
        : `Installation complexe : ${frictions.join(", ")}.`;

  return { niveau, score, positifs, frictions, synthese };
}
