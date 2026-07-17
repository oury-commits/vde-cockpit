import type { Reseau } from "@/lib/types";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import type { ControleKey, ControleLigne, DevisConfig } from "@/lib/devis/types";

// Contrôle technique IRVE. Les valeurs de protection ci-dessous sont des
// références par défaut, pré-calculées depuis le type d'installation et la
// puissance de la borne.
// TODO: brancher données réelles — barème de protections VDE à valider
// (calibre, section de câble, type de différentiel) par un électricien.

/** Puissance (kW) déduite de la borne sélectionnée, sinon du réseau. */
export function puissanceKw(
  config: DevisConfig,
  articles: CatalogueArticle[],
): number {
  const borne = articles.find((a) => a.id === config.borne_id);
  if (borne) {
    const m = /(\d+(?:[.,]\d+)?)\s*kW/i.exec(borne.designation);
    if (m) return Number(m[1].replace(",", "."));
  }
  return config.reseau === "tri" ? 11 : 7.4;
}

function calibreA(reseau: Reseau, kw: number): number {
  if (reseau === "mono") return kw <= 3.7 ? 16 : 32;
  return kw <= 11 ? 16 : 32;
}

function cableSection(reseau: Reseau, calibre: number): string {
  const conducteurs = reseau === "mono" ? "3G" : "5G";
  const section = calibre <= 16 ? "2,5" : "6";
  return `${conducteurs}${section} mm²`;
}

/** Les 6 lignes du contrôle, valeurs calculées depuis la config. */
export function computeControle(
  config: DevisConfig,
  articles: CatalogueArticle[],
  nonConformes: ControleKey[],
): ControleLigne[] {
  const kw = puissanceKw(config, articles);
  const calibre = calibreA(config.reseau, kw);
  const mono = config.reseau === "mono";
  const nc = new Set(nonConformes);
  const rows: Omit<ControleLigne, "conforme">[] = [
    {
      key: "type",
      label: "Type d'installation",
      valeur: mono ? "Monophasé 230 V" : "Triphasé 400 V",
    },
    { key: "poles", label: "Nombre de pôles", valeur: mono ? "2P (Ph + N)" : "4P (3Ph + N)" },
    { key: "courbe", label: "Courbe disjoncteur", valeur: "Courbe C" },
    {
      key: "differentiel",
      label: "Différentiel",
      valeur: `30 mA type ${mono ? "A" : "B"} (détection 6 mA DC)`,
    },
    {
      key: "cable",
      label: "Section de câble",
      valeur: cableSection(config.reseau, calibre),
    },
    { key: "calibre", label: "Calibre", valeur: `${calibre} A` },
  ];
  return rows.map((r) => ({ ...r, conforme: !nc.has(r.key) }));
}

export function estConforme(controle: ControleLigne[]): boolean {
  return controle.every((c) => c.conforme);
}

// ── Indicateur de rentabilité (marge réelle vs cible) ───────────────────────

export type RentabiliteNiveau = "faible" | "correcte" | "elevee";

export interface Rentabilite {
  niveau: RentabiliteNiveau;
  label: string;
}

export function rentabilite(margePct: number): Rentabilite {
  if (margePct < 0.25) return { niveau: "faible", label: "Rentabilité faible" };
  if (margePct > 0.45) return { niveau: "elevee", label: "Marge élevée" };
  return { niveau: "correcte", label: "Rentabilité correcte" };
}
