import type {
  AcompteDeduit,
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

// ── Facture de solde (Bloc C) ───────────────────────────────────────────────

/**
 * Mention de déduction obligatoire sur une facture de solde (Art. 289 CGI) :
 * elle référence les acomptes déjà facturés et acte la régularisation de TVA.
 */
export const MENTION_SOLDE =
  "Facture de solde. Les acomptes déjà facturés ci-dessus sont déduits ; la TVA est régularisée en conséquence (Art. 289 CGI).";

/** Totaux cumulés des factures d'acompte déduites. */
export function totalAcomptes(acomptes: AcompteDeduit[]): {
  ht: number;
  tva: number;
  ttc: number;
} {
  return {
    ht: round2(acomptes.reduce((s, a) => s + a.montant_ht, 0)),
    tva: round2(acomptes.reduce((s, a) => s + a.montant_tva, 0)),
    ttc: round2(acomptes.reduce((s, a) => s + a.montant_ttc, 0)),
  };
}

/** Total du marché (reconstitué depuis le solde + les acomptes déduits). */
export function marcheDeSolde(facture: Facture): {
  ht: number;
  tva: number;
  ttc: number;
} {
  const a = totalAcomptes(facture.acomptes_deduits ?? []);
  return {
    ht: round2(facture.montant_ht + a.ht),
    tva: round2(facture.montant_tva + a.tva),
    ttc: round2(facture.montant_ttc + a.ttc),
  };
}

/**
 * Facture de SOLDE : le reste dû après déduction des acomptes déjà facturés.
 *
 * Le solde se calcule sur le TOTAL MARCHÉ APRÈS REMISE (le devis porte déjà la
 * remise) : on ne recompte ni ne réapplique la remise. La TVA est RÉGULARISÉE —
 * TVA du solde = TVA totale − TVA déjà facturée sur les acomptes.
 */
export function buildFactureSolde(
  lead: Lead,
  ref: string,
  dateISO: string,
): Facture | null {
  const d = lead.devis;
  if (!d) return null;
  const acomptes: AcompteDeduit[] = (lead.factures_acompte ?? []).map((f) => ({
    ref: f.ref,
    date: f.date_creation,
    montant_ht: f.montant_ht,
    montant_tva: f.montant_tva,
    montant_ttc: f.montant_ttc,
  }));
  const cumul = totalAcomptes(acomptes);
  return {
    ref,
    entite: d.entite,
    devise: d.devise,
    date_creation: dateISO,
    devis_ref: d.ref,
    type: "solde",
    // Lignes du marché (rappel de la prestation). La remise du devis est
    // reportée telle quelle — jamais recalculée.
    lignes: d.lignes,
    montant_ht_brut: d.montant_ht_brut,
    remise: d.remise ?? null,
    // Montants de CETTE facture = le solde (marché − acomptes), TVA régularisée.
    montant_ht: round2(d.montant_ht - cumul.ht),
    mode_tva: d.mode_tva,
    taux_tva: d.taux_tva,
    montant_tva: round2(d.montant_tva - cumul.tva),
    montant_ttc: round2(d.montant_ttc - cumul.ttc),
    acomptes_deduits: acomptes,
  };
}

/**
 * La facture de solde n'est générable qu'une fois l'installation clôturée
 * (jalon « Installé » = statut `installe`) et s'il reste effectivement un solde
 * à facturer. Un dossier Alma est soldé d'office : pas de facture de solde.
 */
export function peutGenererSolde(lead: Lead): boolean {
  return (
    lead.devis?.statut === "signe" &&
    lead.statut === "installe" &&
    !estSoldeAlma(lead) &&
    (lead.factures_acompte?.length ?? 0) > 0 &&
    !(lead.facture?.type === "solde") &&
    montantDu(lead) - totalAcomptes(
      (lead.factures_acompte ?? []).map((f) => ({
        ref: f.ref, date: f.date_creation,
        montant_ht: f.montant_ht, montant_tva: f.montant_tva, montant_ttc: f.montant_ttc,
      })),
    ).ttc > 0.005
  );
}

/**
 * Marqueur « solde en attente » : installation clôturée mais reste dû non nul.
 * Simple flag pour la relance future (tour de contrôle admin) — AUCUNE relance
 * automatique n'est déclenchée ici.
 */
export function soldeEnAttente(lead: Lead): boolean {
  return (
    lead.statut === "installe" && !estSoldeAlma(lead) && resteAPayer(lead) > 0.005
  );
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
