// Paramètres & garde-fous des tournées techniciens. UN SEUL endroit pour les
// régler — pas de nombre magique éparpillé dans l'UI.

/** Nombre maximum de RDV par technicien et par jour (garde-fou de charge). */
export const MAX_RDV_JOUR = 2;

/**
 * Seuil d'alerte de trajet, en km. Au-delà d'un déplacement entre deux points
 * de la tournée → alerte. « Configurable » = cette constante (un futur réglage
 * d'équipe pourra la surcharger ; backlog, pas bloquant).
 */
export const SEUIL_ALERTE_KM = 50;

/** Marge tampon entre deux poses (préparation + aléas), en minutes. */
export const BUFFER_MINUTES = 30;

/** Vitesse moyenne pour l'ESTIMATION de trajet (fallback sans API de routage). */
export const VITESSE_MOY_KMH = 50;

/** Facteur route / vol d'oiseau pour l'ESTIMATION (fallback). */
export const FACTEUR_DETOUR = 1.3;
