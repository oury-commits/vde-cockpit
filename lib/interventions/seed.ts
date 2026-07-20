import type { Intervention } from "@/lib/interventions/types";

// TODO: brancher données réelles — tournées de démonstration. Clients fictifs,
// aucune donnée client réelle. Elles existent pour PROUVER à l'écran qu'un
// technicien ne voit que sa propre tournée : deux techniciens français le même
// jour, plus un marocain, c'est le minimum pour que le cloisonnement soit
// observable et pas seulement affirmé.

function jour(base: Date, decalage: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + decalage);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function buildInterventionsSeed(now: Date): Intervention[] {
  const aujourdhui = jour(now, 0);
  const demain = jour(now, 1);

  return [
    // — Julien (démo), technicien France
    {
      id: "itv-fr-1",
      entite: "FR",
      lead_id: "FB-003",
      technicien_id: "u-demo-tech-fr",
      date: aujourdhui,
      creneau: "08:30 – 10:30",
      type: "pose",
      statut: "planifiee",
      client_nom: "Client Démo 3",
      telephone: "06 00 00 00 03",
      adresse: "12 rue des Vergers",
      ville: "Mulhouse",
      consigne: "Portail code 4512. Compteur au sous-sol.",
    },
    {
      id: "itv-fr-2",
      entite: "FR",
      lead_id: "FB-005",
      technicien_id: "u-demo-tech-fr",
      date: aujourdhui,
      creneau: "11:00 – 12:00",
      type: "visite_technique",
      statut: "planifiee",
      client_nom: "Client Démo 5",
      telephone: "06 00 00 00 05",
      adresse: "4 allée des Tilleuls",
      ville: "Colmar",
      consigne: "Mesurer la distance tableau → garage.",
    },
    {
      id: "itv-fr-3",
      entite: "FR",
      lead_id: "FB-002",
      technicien_id: "u-demo-tech-fr",
      date: demain,
      creneau: "14:00 – 16:00",
      type: "sav",
      statut: "planifiee",
      client_nom: "Client Démo 2",
      telephone: "06 00 00 00 02",
      adresse: "31 rue du Rhin",
      ville: "Strasbourg",
      consigne: null,
    },

    // — Damien (démo), technicien France : même jour, même pays, autre tournée
    {
      id: "itv-fr-4",
      entite: "FR",
      lead_id: "FB-007",
      technicien_id: "u-demo-tech-fr-2",
      date: aujourdhui,
      creneau: "09:00 – 11:00",
      type: "pose",
      statut: "planifiee",
      client_nom: "Client Démo 7",
      telephone: "06 00 00 00 07",
      adresse: "8 route de Bâle",
      ville: "Saint-Louis",
      consigne: "Prévoir échelle 3 m.",
    },
    {
      id: "itv-fr-5",
      entite: "FR",
      lead_id: "FB-009",
      technicien_id: "u-demo-tech-fr-2",
      date: aujourdhui,
      creneau: "14:30 – 16:00",
      type: "sav",
      statut: "planifiee",
      client_nom: "Client Démo 9",
      telephone: "06 00 00 00 09",
      adresse: "17 rue de la Gare",
      ville: "Haguenau",
      consigne: null,
    },

    // — Karim (démo), technicien Maroc
    {
      id: "itv-ma-1",
      entite: "MA",
      lead_id: "FB-011",
      technicien_id: "u-demo-tech-ma",
      date: aujourdhui,
      creneau: "09:30 – 11:30",
      type: "pose",
      statut: "planifiee",
      client_nom: "Client Démo 11",
      telephone: "06 00 00 00 11",
      adresse: "45 boulevard Zerktouni",
      ville: "Casablanca",
      consigne: "Accès parking niveau -1.",
    },
    {
      id: "itv-ma-2",
      entite: "MA",
      lead_id: "FB-012",
      technicien_id: "u-demo-tech-ma",
      date: demain,
      creneau: "10:00 – 12:00",
      type: "visite_technique",
      statut: "planifiee",
      client_nom: "Client Démo 12",
      telephone: "06 00 00 00 12",
      adresse: "9 avenue Hassan II",
      ville: "Rabat",
      consigne: null,
    },
  ];
}
