import type { Lead } from "@/lib/types";
import { buildDevis, buildEcheancier } from "@/lib/leads/devis";

// Données de démonstration — CLAIREMENT fictives (« Client Démo N »,
// téléphones 06 00 00 00 0N, emails @exemple.test). Aucune donnée réelle.
// TODO: brancher données réelles — retirer ce seed après import AppSheet (2B).

const DAY = 86_400_000;

function iso(now: Date, daysAgo: number, hour = 9): string {
  const d = new Date(now.getTime() - daysAgo * DAY);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

function base(now: Date, n: number, daysAgo: number, over: Partial<Lead>): Lead {
  const recv = iso(now, daysAgo);
  return {
    id: `FB-${String(n).padStart(3, "0")}`,
    date_reception: recv,
    canal: "import",
    source_campagne: "Démo — Borne maison FB",
    nom: `Client Démo ${n}`,
    telephone: `06 00 00 00 ${String(n).padStart(2, "0")}`,
    email: `demo${n}@exemple.test`,
    temperature: "froid",
    statut: "nouveau",
    created_at: recv,
    updated_at: recv,
    statut_change_at: recv,
    ...over,
  };
}

/** ~10 leads fictifs répartis sur le pipeline, dates relatives à `now`. */
export function buildSeed(now: Date): Lead[] {
  const leads: Lead[] = [
    base(now, 1, 0, {
      ville: "Mulhouse",
      code_postal: "68100",
      type_logement: "maison",
      type_vehicule: "Renault Megane E-Tech",
      puissance_souhaitee: "11",
      distance_tableau: 8,
      eligible_advenir: true,
      montant_estime: 2400,
      temperature: "chaud",
      statut: "nouveau",
      prochaine_action: "Premier appel de qualification",
      date_relance: iso(now, 0),
    }),
    base(now, 2, 1, {
      ville: "Colmar",
      code_postal: "68000",
      type_logement: "appartement",
      puissance_souhaitee: "7.4",
      distance_tableau: 4,
      eligible_advenir: false,
      temperature: "tiede",
      statut: "a_qualifier",
      prochaine_action: "Confirmer faisabilité copropriété",
      date_relance: iso(now, -1),
    }),
    base(now, 3, 3, {
      ville: "Strasbourg",
      code_postal: "67000",
      type_logement: "maison",
      type_vehicule: "Tesla Model 3",
      puissance_souhaitee: "22",
      distance_tableau: 12,
      eligible_advenir: true,
      montant_estime: 3200,
      temperature: "chaud",
      statut: "qualifie",
      assigne_a: "Oury",
      prochaine_action: "Envoyer le devis",
      date_relance: iso(now, 1),
    }),
    base(now, 4, 6, {
      ville: "Sélestat",
      code_postal: "67600",
      type_logement: "maison",
      puissance_souhaitee: "7.4",
      distance_tableau: 6,
      eligible_advenir: true,
      temperature: "tiede",
      statut: "devis_envoye",
      assigne_a: "Shaima",
      prochaine_action: "Relancer signature devis",
      date_relance: iso(now, -2),
    }),
    base(now, 5, 10, {
      ville: "Haguenau",
      code_postal: "67500",
      type_logement: "maison",
      puissance_souhaitee: "11",
      distance_tableau: 9,
      eligible_advenir: true,
      montant_estime: 2600,
      temperature: "chaud",
      statut: "signe",
      assigne_a: "Oury",
    }),
    base(now, 6, 14, {
      ville: "Mulhouse",
      code_postal: "68200",
      type_logement: "maison",
      puissance_souhaitee: "7.4",
      distance_tableau: 5,
      eligible_advenir: false,
      temperature: "tiede",
      statut: "planifie",
      assigne_a: "Shaima",
      prochaine_action: "Confirmer date de pose",
      date_relance: iso(now, 2),
    }),
    base(now, 7, 30, {
      ville: "Belfort",
      code_postal: "90000",
      type_logement: "appartement",
      puissance_souhaitee: "3.7",
      distance_tableau: 3,
      eligible_advenir: false,
      temperature: "froid",
      statut: "installe",
      assigne_a: "Oury",
    }),
    base(now, 8, 45, {
      ville: "Épinal",
      code_postal: "88000",
      type_logement: "maison",
      puissance_souhaitee: "11",
      distance_tableau: 7,
      eligible_advenir: true,
      temperature: "tiede",
      statut: "sav",
      prochaine_action: "Rappel entretien annuel",
    }),
    base(now, 9, 20, {
      ville: "Besançon",
      code_postal: "25000",
      type_logement: "appartement",
      puissance_souhaitee: "3.7",
      eligible_advenir: false,
      temperature: "froid",
      statut: "perdu",
      motif_perte: "prix",
      notes: "A trouvé moins cher chez un concurrent.",
    }),
    base(now, 10, 1, {
      ville: "Thann",
      code_postal: "68800",
      type_logement: "appartement",
      puissance_souhaitee: "3.7",
      email: null,
      eligible_advenir: false,
      temperature: "froid",
      statut: "nouveau",
      prochaine_action: "Recontacter — email manquant",
      date_relance: iso(now, 3),
    }),
  ];

  // Devis + échéancier sur les leads assez avancés.
  attachDevis(leads, "FB-004", now, 6, "envoye");
  attachDevis(leads, "FB-005", now, 10, "signe");
  attachDevis(leads, "FB-006", now, 14, "signe");
  attachDevis(leads, "FB-007", now, 30, "signe", true);

  return leads;
}

function attachDevis(
  leads: Lead[],
  id: string,
  now: Date,
  daysAgo: number,
  statut: "envoye" | "signe",
  encaisseAcompte = false,
): void {
  const lead = leads.find((l) => l.id === id);
  if (!lead) return;
  const num = id.replace("FB-", "");
  const devis = buildDevis(lead, `VDE-2026-${num}`, iso(now, daysAgo));
  devis.statut = statut;
  lead.devis = devis;
  if (statut === "signe") {
    const ech = buildEcheancier(devis.montant_ttc);
    if (encaisseAcompte && ech[0]) {
      ech[0].statut = "encaisse";
      ech[0].date_encaissement = iso(now, daysAgo - 2);
    }
    lead.echeancier = ech;
  }
}
