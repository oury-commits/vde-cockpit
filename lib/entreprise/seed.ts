import { ficheVide, type ParametresEntreprise } from "@/lib/entreprise/types";

// Fiches de démarrage (mode démo local + fallback si la table est vide). MÊMES
// valeurs que le seed SQL 0020 — l'identité société ACTUELLE, reprise de
// lib/entite/config.ts pour ne rien perdre. Oury complète le reste dans l'UI.
// TODO: brancher données réelles — logo, RIB, assurance décennale, certifs.

export function buildEntrepriseSeed(): ParametresEntreprise[] {
  return [
    ficheVide("FR", {
      raison_sociale: "Vision Digital Energies",
      adresse_siege: "870 rue Denis Papin, 54710 Ludres",
      siret: "91742112500019",
      tva_intra: "FR84 917 421 125",
    }),
    ficheVide("MA", {
      raison_sociale: "Vision Digitale Energies Maroc SARL",
      forme_juridique: "SARL",
      capital_social: "10 000 MAD",
      adresse_siege: "IMM 16 Rue Otawa, Océan — Rabat",
      ice: "003910477000069",
      rc: "Rabat 198269",
      if_fiscal: "72081360",
    }),
  ];
}
