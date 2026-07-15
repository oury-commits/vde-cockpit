import { jsPDF } from "jspdf";
import type { Devis, Echeance, Lead, LigneDevis } from "@/lib/types";
import { formatDate, formatEuros } from "@/lib/format";
import { PUISSANCE_LABEL } from "@/lib/leads/meta";

/** TVA IRVE résidentiel B2C. */
export const TAUX_TVA = 0.055;

// TODO: brancher données réelles — grille tarifaire de démonstration.
// Ces montants HT sont des placeholders : à remplacer par la grille VDE réelle
// avant livraison MVP.
const PRIX_FOURNITURE: Record<string, number> = {
  "3.7": 490,
  "7.4": 690,
  "11": 1190,
  "22": 1590,
};
const INSTALLATION_BASE = 590; // HT, forfait pose + raccordement
const PRIX_METRE_SUP = 25; // HT par mètre au-delà de 5 m
const METRES_INCLUS = 5;

const DEVIS_RE = /^VDE-2026-(\d+)$/;

/** Prochaine ref VDE-2026-XXX au vu des devis existants. */
export function nextDevisRef(existingRefs: string[]): string {
  const max = existingRefs.reduce((acc, ref) => {
    const m = DEVIS_RE.exec(ref.trim());
    return m ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `VDE-2026-${String(max + 1).padStart(3, "0")}`;
}

/** Lignes de devis pré-remplies depuis la fiche lead (§6.5). */
export function buildLignes(lead: Lead): LigneDevis[] {
  const lignes: LigneDevis[] = [];
  const p = lead.puissance_souhaitee ?? "7.4";
  lignes.push({
    label: `Borne de recharge ${PUISSANCE_LABEL[p]} — fourniture`,
    montant_ht: PRIX_FOURNITURE[p] ?? PRIX_FOURNITURE["7.4"],
  });
  lignes.push({
    label: "Installation et raccordement",
    montant_ht: INSTALLATION_BASE,
  });
  const dist = lead.distance_tableau ?? 0;
  if (dist > METRES_INCLUS) {
    lignes.push({
      label: `Supplément distance tableau (+${dist - METRES_INCLUS} m)`,
      montant_ht: (dist - METRES_INCLUS) * PRIX_METRE_SUP,
    });
  }
  return lignes;
}

/** Construit un devis complet (HT / TVA 5,5 % / TTC) pour un lead. */
export function buildDevis(lead: Lead, ref: string, dateISO: string): Devis {
  const lignes = buildLignes(lead);
  const montant_ht = lignes.reduce((s, l) => s + l.montant_ht, 0);
  const montant_tva = Math.round(montant_ht * TAUX_TVA * 100) / 100;
  const montant_ttc = Math.round((montant_ht + montant_tva) * 100) / 100;
  return {
    ref,
    date_creation: dateISO,
    lignes,
    montant_ht,
    taux_tva: TAUX_TVA,
    montant_tva,
    montant_ttc,
    statut: "brouillon",
  };
}

/** Échéancier 40 / 40 / 20 généré à la signature (§6.6). */
export function buildEcheancier(ttc: number): Echeance[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const acompte = round(ttc * 0.4);
  const demarrage = round(ttc * 0.4);
  const solde = round(ttc - acompte - demarrage); // absorbe l'arrondi
  return [
    { label: "acompte", pct: 40, montant: acompte, statut: "attendu" },
    { label: "demarrage", pct: 40, montant: demarrage, statut: "attendu" },
    { label: "solde", pct: 20, montant: solde, statut: "attendu" },
  ];
}

const ECHEANCE_LABEL: Record<Echeance["label"], string> = {
  acompte: "Acompte à la commande",
  demarrage: "Démarrage des travaux",
  solde: "Solde à la réception",
};

const BRAND: [number, number, number] = [15, 61, 46];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [92, 107, 99];

/**
 * Génère le PDF du devis et déclenche le téléchargement (client only).
 * Le PDF utilise Helvetica (police standard PDF) : les règles de police UI
 * du cockpit ne s'appliquent pas à un document imprimable.
 */
export function generateDevisPdf(lead: Lead, devis: Devis): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const mx = 16;

  // Bandeau d'en-tête
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Vision Digital Energies", mx, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("IRVE résidentiel · VDE France", mx, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(devis.ref, pageW - mx, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDate(devis.date_creation), pageW - mx, 21, { align: "right" });

  // Client
  let y = 44;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text("DEVIS ÉTABLI POUR", mx, y);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y += 6;
  doc.text(lead.nom, mx, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  y += 5;
  const loc = [lead.code_postal, lead.ville].filter(Boolean).join(" ");
  if (loc) doc.text(loc, mx, y), (y += 5);
  if (lead.telephone) doc.text(lead.telephone, mx, y), (y += 5);
  if (lead.email) doc.text(lead.email, mx, y), (y += 5);

  // Tableau des lignes
  y += 6;
  doc.setDrawColor(231, 226, 215);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text("DÉSIGNATION", mx, y);
  doc.text("MONTANT HT", pageW - mx, y, { align: "right" });
  y += 2;
  doc.line(mx, y, pageW - mx, y);
  y += 6;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  for (const ligne of devis.lignes) {
    doc.text(ligne.label, mx, y);
    doc.text(formatEuros(ligne.montant_ht, { cents: true }), pageW - mx, y, {
      align: "right",
    });
    y += 7;
  }

  // Totaux
  y += 2;
  doc.line(pageW - 80, y, pageW - mx, y);
  y += 6;
  const totLabel = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, pageW - 80, y);
    doc.text(val, pageW - mx, y, { align: "right" });
    y += 6;
  };
  totLabel("Total HT", formatEuros(devis.montant_ht, { cents: true }));
  totLabel(
    "TVA 5,5 %",
    formatEuros(devis.montant_tva, { cents: true }),
  );
  doc.setFontSize(11);
  totLabel(
    "Total TTC",
    formatEuros(devis.montant_ttc, { cents: true }),
    true,
  );

  // Échéancier 40/40/20
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text("Échéancier de paiement — 40 / 40 / 20", mx, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const e of buildEcheancier(devis.montant_ttc)) {
    doc.text(`${e.pct} % — ${ECHEANCE_LABEL[e.label]}`, mx, y);
    doc.text(formatEuros(e.montant, { cents: true }), pageW - mx, y, {
      align: "right",
    });
    y += 7;
  }

  // Mentions
  y += 8;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(
    "TVA à 5,5 % applicable à l'installation de bornes de recharge en résidentiel.",
    mx,
    y,
  );
  y += 4;
  doc.text(
    "Devis de démonstration — grille tarifaire à valider avant émission réelle.",
    mx,
    y,
  );

  doc.save(`${devis.ref}.pdf`);
}
