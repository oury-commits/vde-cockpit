import type { Activite, JalonKey, Lead } from "@/lib/types";

// Jalons de suivi de la fiche. Deux natures, jamais mélangées :
// - MANUELS : cochés à la main, l'état vit dans la timeline (une seule trace).
// - DÉRIVÉS : lus depuis l'état réel (devis / échéancier / statut) et donc en
//   lecture seule — une case ne peut pas contredire le pipeline.

export interface JalonManuel {
  key: JalonKey;
  label: string;
  /** Libellé écrit dans la timeline quand on coche. */
  fait: string;
}

export const JALONS_MANUELS: JalonManuel[] = [
  { key: "appel", label: "Appel effectué", fait: "Appel effectué" },
  { key: "email", label: "Email envoyé", fait: "Email envoyé" },
  { key: "visite", label: "Visite technique", fait: "Visite technique réalisée" },
  { key: "relance", label: "Relance faite", fait: "Relance faite" },
];

export interface JalonDerive {
  key: string;
  label: string;
  actif: boolean;
  /** D'où vient l'état — affiché en aide, pour lever toute ambiguïté. */
  source: string;
}

/** Jalons lus depuis l'état réel du dossier (lecture seule). */
export function jalonsDerives(lead: Lead): JalonDerive[] {
  return [
    {
      key: "devis_signe",
      label: "Devis signé",
      actif: lead.devis?.statut === "signe",
      source: "défini par « Marquer signé » sur le devis",
    },
    {
      key: "acompte",
      label: "Acompte reçu",
      // Allumé dès qu'un encaissement figure au registre (acompte VDE ou Alma) —
      // ou, à défaut de registre, depuis l'échéancier (compat).
      actif:
        (lead.reglements?.length ?? 0) > 0 ||
        Boolean(
          lead.echeancier?.some(
            (e) => e.label === "acompte" && e.statut === "encaisse",
          ),
        ),
      source: "défini par le registre des règlements",
    },
    {
      key: "installe",
      label: "Installé",
      actif: lead.statut === "installe",
      source: "défini par le statut du dossier",
    },
  ];
}

/**
 * État d'un jalon manuel : la dernière entrée de timeline le concernant fait
 * foi. Décocher n'efface rien — ça écrit une entrée « annulé ».
 */
export function jalonActif(activites: Activite[], key: JalonKey): boolean {
  // `activitesFor` renvoie déjà du plus récent au plus ancien.
  const derniere = activites.find((a) => a.jalon === key);
  return Boolean(derniere && !derniere.annule);
}
