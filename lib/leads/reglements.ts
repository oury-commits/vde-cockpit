import type {
  AlmaPlan,
  Devis,
  Facture,
  Lead,
  Reglement,
} from "@/lib/types";

// Calculs de règlement. Règle d'or : le « payé / reste » se lit TOUJOURS depuis
// le registre `reglements`, jamais d'un champ saisi à la main.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Total réellement encaissé sur le dossier (somme du registre). */
export function totalRegle(lead: Lead): number {
  return round2((lead.reglements ?? []).reduce((s, r) => s + r.montant, 0));
}

/**
 * Un règlement Alma solde le dossier : Alma paie VDE en une fois (le client
 * rembourse Alma). On ne compte JAMAIS un Alma 4x comme « 3 versements
 * restants dus » — côté VDE, c'est payé.
 */
export function estSoldeAlma(lead: Lead): boolean {
  return (lead.reglements ?? []).some((r) => r.mode === "alma");
}

/** Montant total dû (TTC du devis). 0 si pas de devis. */
export function montantDu(lead: Lead): number {
  return lead.devis?.montant_ttc ?? 0;
}

/**
 * Reste à payer. Un dossier soldé par Alma n'a plus rien à devoir côté VDE,
 * quel que soit le nombre de mensualités Alma restantes pour le client.
 */
export function resteAPayer(lead: Lead): number {
  if (estSoldeAlma(lead)) return 0;
  return round2(Math.max(0, montantDu(lead) - totalRegle(lead)));
}

/** Dossier soldé : plus rien à payer (par acomptes cumulés ou par Alma). */
export function estSolde(lead: Lead): boolean {
  if (estSoldeAlma(lead)) return true;
  return montantDu(lead) > 0 && resteAPayer(lead) <= 0.005;
}

/**
 * « Pas d'acompte, pas de RDV » : le RDV d'installation ne se confirme que si un
 * encaissement existe sur le dossier (acompte VDE ou paiement Alma). La présence
 * dans le registre suffit — un centime encaissé engage le client.
 */
export function aEncaissement(lead: Lead): boolean {
  return (lead.reglements ?? []).length > 0;
}

/**
 * Facture d'acompte pour un versement `montant` (TTC). HT et TVA en sont
 * déduits au taux du devis (une seule TVA par devis). Réf. au devis obligatoire
 * (Art. 289 CGI). Le numéro (série factures) est réservé par l'appelant.
 */
export function buildFactureAcompte(
  devis: Devis,
  montantTtc: number,
  ref: string,
  dateISO: string,
): Facture {
  const taux = devis.taux_tva;
  const ht = round2(montantTtc / (1 + taux));
  const tva = round2(montantTtc - ht);
  return {
    ref,
    entite: devis.entite,
    devise: devis.devise,
    date_creation: dateISO,
    devis_ref: devis.ref,
    type: "acompte",
    lignes: [
      {
        label: `Acompte sur commande (réf. devis ${devis.ref})`,
        montant_ht: ht,
      },
    ],
    montant_ht: ht,
    mode_tva: devis.mode_tva,
    taux_tva: taux,
    montant_tva: tva,
    montant_ttc: round2(montantTtc),
  };
}

// ── Alma (FR uniquement) ────────────────────────────────────────────────────

export const ALMA_PLANS: AlmaPlan[] = [2, 3, 4];

/** Mensualité Alma affichée au client (TTC ÷ nombre d'échéances). */
export function almaMensualite(ttc: number, plan: AlmaPlan): number {
  return round2(ttc / plan);
}

/** Ex. « ou 4× 750,00 € sans frais avec Alma ». */
export function almaPhrase(
  ttc: number,
  plan: AlmaPlan,
  format: (n: number) => string,
): string {
  return `ou ${plan}× ${format(almaMensualite(ttc, plan))} sans frais avec Alma`;
}

/** Libellé court d'un moyen de règlement. */
export const MODE_REGLEMENT_LABEL: Record<Reglement["mode"], string> = {
  virement: "Virement",
  cheque: "Chèque",
  cb: "Carte bancaire",
  especes: "Espèces",
  alma: "Alma (paiement fractionné)",
};
