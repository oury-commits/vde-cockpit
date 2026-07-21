import type { Devis, Facture, VentilationTva } from "@/lib/types";

// Helpers de ventilation TVA partagés (aperçu figé, PDF, factures d'acompte et
// de solde). Un document peut porter plusieurs taux : la ventilation par taux
// est la source de vérité (Art. 242 nonies A CGI).

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Taux formaté « 5,5 % ». */
export function pctTva(t: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(t * 100)} %`;
}

/**
 * Ventilation d'un document. Utilise `ventilation_tva` si présente ; sinon
 * (documents émis avant la TVA par ligne) retombe sur le taux global unique.
 */
export function ventilationDe(doc: Devis | Facture): VentilationTva[] {
  if (doc.ventilation_tva && doc.ventilation_tva.length > 0) {
    return doc.ventilation_tva;
  }
  return [
    {
      taux: doc.taux_tva,
      base_ht: doc.montant_ht,
      montant_tva: doc.montant_tva,
    },
  ];
}

/**
 * Ventilation d'un acompte : la ventilation du marché mise au prorata du
 * versement (acompte TTC / marché TTC). Le dernier taux absorbe l'arrondi pour
 * que le TTC ventilé retombe EXACTEMENT sur le montant encaissé.
 */
export function ventilationProrata(
  ventMarche: VentilationTva[],
  cibleTtc: number,
  totalTtc: number,
): VentilationTva[] {
  if (totalTtc <= 0 || ventMarche.length === 0) return [];
  const ratio = cibleTtc / totalTtc;
  const rows = ventMarche.map((v) => ({
    taux: v.taux,
    base_ht: round2(v.base_ht * ratio),
    montant_tva: round2(v.montant_tva * ratio),
  }));
  // Corrige le cumul pour tomber pile sur cibleTtc (écart mis sur la base du
  // dernier taux — n'affecte pas la TVA collectée par taux).
  const somme = round2(rows.reduce((s, r) => s + r.base_ht + r.montant_tva, 0));
  const delta = round2(cibleTtc - somme);
  if (delta !== 0 && rows.length > 0) {
    rows[rows.length - 1].base_ht = round2(rows[rows.length - 1].base_ht + delta);
  }
  return rows;
}

/**
 * Ventilation du solde : marché − acomptes, taux par taux. Chaque acompte a été
 * ventilé au prorata du même marché, donc la soustraction par taux régularise
 * naturellement la TVA (TVA solde = TVA totale − Σ TVA acomptes).
 */
export function ventilationSolde(
  ventMarche: VentilationTva[],
  ventsAcomptes: VentilationTva[][],
): VentilationTva[] {
  return ventMarche.map((v) => {
    const dejaBase = round2(
      ventsAcomptes.reduce(
        (s, va) => s + (va.find((x) => x.taux === v.taux)?.base_ht ?? 0),
        0,
      ),
    );
    const dejaTva = round2(
      ventsAcomptes.reduce(
        (s, va) => s + (va.find((x) => x.taux === v.taux)?.montant_tva ?? 0),
        0,
      ),
    );
    return {
      taux: v.taux,
      base_ht: round2(v.base_ht - dejaBase),
      montant_tva: round2(v.montant_tva - dejaTva),
    };
  });
}
