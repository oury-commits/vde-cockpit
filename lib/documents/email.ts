import type { Devis, Entite, Facture, LigneDevis } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import type { ParametresEntreprise } from "@/lib/entreprise/types";
import { mentionsEntreprise, raisonSociale } from "@/lib/entreprise/document";

// Modèles d'email « Envoi de devis / facture ». Expéditeur, mentions et devise
// suivent l'entité du document — on ne mélange jamais FR et MA.

/** Validité commerciale d'un devis, en jours. */
// TODO: brancher données réelles — durée de validité à confirmer par Oury.
export const VALIDITE_DEVIS_JOURS = 30;

/**
 * Expéditeur par entité.
 * FR : `devis@visiondigitalenergies.fr` — confirmé, domaine à vérifier dans Resend.
 * MA : cible `devis@vde.ma`. En attendant la vérification du domaine vde.ma chez
 * Resend, on retombe volontairement sur l'expéditeur FR (validé par Oury) —
 * envoyer depuis un domaine non vérifié ferait rejeter l'email.
 */
// TODO: brancher données réelles — basculer MA sur devis@vde.ma une fois le
// domaine vde.ma vérifié chez Resend.
const EXPEDITEUR: Record<Entite, string> = {
  FR: "Vision Digital Energies <devis@visiondigitalenergies.fr>",
  MA: "Vision Digitale Energies Maroc <devis@visiondigitalenergies.fr>",
};

export function expediteur(entite: Entite): string {
  return EXPEDITEUR[entite];
}

/** Modèle de borne du devis (première ligne de catégorie « borne »). */
export function modeleBorne(lignes: LigneDevis[]): string | null {
  const l = lignes.find((x) => x.categorie === "borne");
  return l ? l.label.replace(/\s*\(.*\)$/, "") : null;
}

function dateEcheance(dateISO: string, jours: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + jours);
  return formatDate(d.toISOString());
}

export interface EmailDocument {
  sujet: string;
  texte: string;
}

/** Email d'envoi d'un devis. `lienPdf` null → le PDF part en pièce jointe manuelle. */
export function emailDevis(
  devis: Devis,
  nomClient: string,
  lienPdf: string | null,
  fiche?: ParametresEntreprise | null,
): EmailDocument {
  const nom = raisonSociale(fiche ?? null, devis.entite);
  const ttc = formatMontant(devis.montant_ttc, devis.devise, { cents: true });
  const borne = modeleBorne(devis.lignes);
  const valide = dateEcheance(devis.date_creation, VALIDITE_DEVIS_JOURS);
  // Côté client, un devis se désigne par sa DATE, pas par un numéro (le n° reste
  // interne : lien lead, liste, classement storage). Cohérent avec le PDF + les relances.
  const dateDevis = formatDate(devis.date_creation);

  const lignes = [
    `Bonjour ${nomClient},`,
    "",
    `Vous trouverez votre devis du ${dateDevis} pour l'installation de votre borne de recharge${borne ? ` (${borne})` : ""}.`,
    "",
    `Montant total : ${ttc} TTC`,
    `Devis valable jusqu'au ${valide}.`,
    "",
    lienPdf
      ? `Votre devis en PDF : ${lienPdf}`
      : "Votre devis est joint à cet email.",
    "",
    "Nous restons à votre disposition pour toute question.",
    "",
    "Cordialement,",
    nom,
    ...mentionsEntreprise(fiche ?? null, devis.entite),
  ];

  return {
    sujet: `Votre devis du ${dateDevis} — ${nom}`,
    texte: lignes.join("\n"),
  };
}

/** Email d'envoi d'une facture. */
export function emailFacture(
  facture: Facture,
  nomClient: string,
  lienPdf: string | null,
  fiche?: ParametresEntreprise | null,
): EmailDocument {
  const nom = raisonSociale(fiche ?? null, facture.entite);
  const ttc = formatMontant(facture.montant_ttc, facture.devise, { cents: true });

  const lignes = [
    `Bonjour ${nomClient},`,
    "",
    `Vous trouverez votre facture ${facture.ref}, faisant suite au devis ${facture.devis_ref}.`,
    "",
    `Montant total : ${ttc} TTC`,
    "",
    lienPdf
      ? `Votre facture en PDF : ${lienPdf}`
      : "Votre facture est jointe à cet email.",
    "",
    "Cordialement,",
    nom,
    ...mentionsEntreprise(fiche ?? null, facture.entite),
  ];

  return {
    sujet: `Votre facture ${facture.ref} — ${nom}`,
    texte: lignes.join("\n"),
  };
}

/** Lien mailto: pré-rempli (fallback sans service d'envoi). */
export function mailtoHref(to: string, mail: EmailDocument): string {
  const q = new URLSearchParams({ subject: mail.sujet, body: mail.texte });
  return `mailto:${encodeURIComponent(to)}?${q.toString().replace(/\+/g, "%20")}`;
}
