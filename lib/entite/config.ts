import type { Devise, Entite, ModeTva } from "@/lib/types";

// Config par entité : la devise, la TVA, la numérotation et les mentions
// SUIVENT l'entité du client — jamais un choix libre. VDE France = EUR/TVA FR ;
// VDE Maroc = MAD/TVA MA. Interdit de mélanger (devis FR en DH, etc.).

export interface OptionTva {
  mode: ModeTva;
  label: string;
  taux: number;
  /** Mention légale imposée sur le PDF pour ce mode (ex. autoliquidation). */
  mention?: string;
}

export interface EntiteConfig {
  code: Entite;
  nom: string;
  devise: Devise;
  symbole: string; // "€" / "DH"
  locale: string;
  prefixeDevis: string; // VDE-2026 / VDE-MA-2026
  prefixeFacture: string; // FAC-2026 / FAC-MA-2026
  tvaOptions: OptionTva[];
  tvaDefaut: ModeTva;
  /** Mentions légales (pied de devis/facture). */
  mentions: string[];
}

const AUTOLIQ_MENTION =
  "Autoliquidation de la TVA — Art. 283-2 nonies du CGI. TVA due par le preneur.";

export const ENTITES: Record<Entite, EntiteConfig> = {
  FR: {
    code: "FR",
    nom: "VDE France",
    devise: "EUR",
    symbole: "€",
    locale: "fr-FR",
    prefixeDevis: "VDE-2026",
    prefixeFacture: "FAC-2026",
    tvaDefaut: "fr_5_5",
    tvaOptions: [
      { mode: "fr_5_5", label: "5,5 % — IRVE résidentiel", taux: 0.055 },
      { mode: "fr_10", label: "10 % — rénovation", taux: 0.1 },
      { mode: "fr_20", label: "20 % — pro / neuf", taux: 0.2 },
      {
        mode: "fr_autoliquidation",
        label: "Autoliquidation (B2B BTP)",
        taux: 0,
        mention: AUTOLIQ_MENTION,
      },
    ],
    mentions: [
      "Vision Digital Energies — 870 rue Denis Papin, 54710 Ludres",
      "SIREN 917 421 125 · SIRET 917 421 125 00019 · TVA FR84 917 421 125",
      // TODO: brancher données réelles — n° d'assurance décennale (obligatoire
      // IRVE), fourni par Oury.
      "Assurance décennale : (à compléter)",
    ],
  },
  MA: {
    code: "MA",
    nom: "VDE Maroc",
    devise: "MAD",
    symbole: "DH",
    locale: "fr-MA",
    prefixeDevis: "VDE-MA-2026",
    prefixeFacture: "FAC-MA-2026",
    tvaDefaut: "ma_20",
    tvaOptions: [{ mode: "ma_20", label: "20 % — standard", taux: 0.2 }],
    mentions: [
      "Vision Digitale Energies Maroc SARL — capital 10 000 MAD",
      "IMM 16 Rue Otawa, Océan — Rabat",
      "ICE 003910477000069 · RC Rabat 198269 · IF 72081360",
    ],
  },
};

export function entiteConfig(entite: Entite): EntiteConfig {
  return ENTITES[entite];
}

export function optionTva(entite: Entite, mode: ModeTva): OptionTva {
  const cfg = ENTITES[entite];
  return cfg.tvaOptions.find((o) => o.mode === mode) ?? cfg.tvaOptions[0];
}

export const ENTITE_LABEL: Record<Entite, string> = {
  FR: "France",
  MA: "Maroc",
};
