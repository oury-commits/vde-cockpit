import { jsPDF } from "jspdf";
import type { Devis, Echeance, Entite, Lead, ModeTva } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { buildLignes } from "@/lib/leads/pricing";

export { buildLignes } from "@/lib/leads/pricing";

/** Prochaine ref au format de l'entité (VDE-2026-XXX / VDE-MA-2026-XXX). */
export function nextDevisRef(existingRefs: string[], entite: Entite): string {
  const prefix = entiteConfig(entite).prefixeDevis;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = existingRefs.reduce((acc, ref) => {
    const m = re.exec(ref.trim());
    return m ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Construit un devis : devise + TVA + lignes selon l'entité du lead. */
export function buildDevis(
  lead: Lead,
  ref: string,
  dateISO: string,
  entite: Entite,
  mode?: ModeTva,
): Devis {
  const cfg = entiteConfig(entite);
  const modeTva = mode ?? cfg.tvaDefaut;
  const taux = optionTva(entite, modeTva).taux;
  const lignes = buildLignes(lead);
  const montant_ht = lignes.reduce((s, l) => s + l.montant_ht, 0);
  const montant_tva = Math.round(montant_ht * taux * 100) / 100;
  const montant_ttc = Math.round((montant_ht + montant_tva) * 100) / 100;
  return {
    ref,
    entite,
    devise: cfg.devise,
    date_creation: dateISO,
    lignes,
    montant_ht,
    mode_tva: modeTva,
    taux_tva: taux,
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
  const solde = round(ttc - acompte - demarrage);
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
 * Devise, TVA et mentions suivent l'entité du devis. Police Helvetica
 * (standard PDF) : les règles de police UI ne s'appliquent pas à un document.
 */
export function generateDevisPdf(lead: Lead, devis: Devis): void {
  const cfg = entiteConfig(devis.entite);
  const opt = optionTva(devis.entite, devis.mode_tva);
  const eur = (n: number) => formatMontant(n, devis.devise, { cents: true });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const mx = 16;

  // En-tête
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(cfg.nom, mx, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("IRVE résidentiel", mx, 21);
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

  // Lignes
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
    doc.text(eur(ligne.montant_ht), pageW - mx, y, { align: "right" });
    y += 7;
  }

  // Totaux
  y += 2;
  doc.line(pageW - 80, y, pageW - mx, y);
  y += 6;
  const tot = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, pageW - 80, y);
    doc.text(val, pageW - mx, y, { align: "right" });
    y += 6;
  };
  tot("Total HT", eur(devis.montant_ht));
  const tvaLabel =
    devis.mode_tva === "fr_autoliquidation"
      ? "TVA — autoliquidation"
      : `TVA ${new Intl.NumberFormat("fr-FR").format(devis.taux_tva * 100)} %`;
  tot(tvaLabel, eur(devis.montant_tva));
  doc.setFontSize(11);
  tot("Total TTC", eur(devis.montant_ttc), true);

  // Échéancier
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
    doc.text(eur(e.montant), pageW - mx, y, { align: "right" });
    y += 7;
  }

  // Mentions (légales par entité + mode TVA spécifique)
  y += 8;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  if (opt.mention) {
    doc.text(opt.mention, mx, y);
    y += 4;
  }
  for (const line of cfg.mentions) {
    doc.text(line, mx, y);
    y += 4;
  }
  doc.text(
    "Devis de démonstration — grille tarifaire et mentions à valider avant émission réelle.",
    mx,
    y,
  );

  doc.save(`${devis.ref}.pdf`);
}
