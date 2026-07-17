import { jsPDF } from "jspdf";
import type { Echeance } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import type { DevisDraft, DevisLigne } from "@/lib/devis/types";
import type { DevisTotaux } from "@/lib/devis/pricing";

const BRAND: [number, number, number] = [15, 61, 46];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [92, 107, 99];

const ECHEANCE_LABEL: Record<Echeance["label"], string> = {
  acompte: "Acompte à la commande",
  demarrage: "Démarrage des travaux",
  solde: "Solde à la réception",
};

/**
 * PDF du devis issu du générateur. Devise, TVA et mentions suivent l'entité.
 * Police Helvetica (standard PDF) : les règles de police UI ne s'appliquent
 * pas à un document imprimé.
 */
export function generateDevisPdfFromDraft(
  draft: DevisDraft,
  lignes: DevisLigne[],
  totaux: DevisTotaux,
  ref: string,
  dateISO: string,
  echeances: Echeance[],
): void {
  const cfg = entiteConfig(draft.entite);
  const opt = optionTva(draft.entite, draft.mode_tva);
  const money = (n: number) => formatMontant(n, cfg.devise, { cents: true });

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
  doc.text("IRVE — recharge de véhicules électriques", mx, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(ref, pageW - mx, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDate(dateISO), pageW - mx, 21, { align: "right" });

  // Client
  let y = 44;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text("DEVIS ÉTABLI POUR", mx, y);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y += 6;
  doc.text(draft.client.nom || "—", mx, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const clientLines = [
    draft.client.adresse,
    [draft.client.code_postal, draft.client.ville].filter(Boolean).join(" "),
    draft.client.telephone,
    draft.client.email,
  ].filter((s) => s && s.trim());
  for (const line of clientLines) {
    y += 5;
    doc.text(line, mx, y);
  }

  // Colonnes
  y += 10;
  const colQte = pageW - mx - 78;
  const colPu = pageW - mx - 40;
  doc.setDrawColor(231, 226, 215);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text("DÉSIGNATION", mx, y);
  doc.text("QTÉ", colQte, y, { align: "right" });
  doc.text("PU HT", colPu, y, { align: "right" });
  doc.text("TOTAL HT", pageW - mx, y, { align: "right" });
  y += 2;
  doc.line(mx, y, pageW - mx, y);
  y += 6;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  for (const l of lignes) {
    doc.text(l.designation, mx, y, { maxWidth: colQte - mx - 4 });
    doc.text(`${l.quantite} ${UNITE_LABEL[l.unite]}`, colQte, y, { align: "right" });
    doc.text(money(l.pu_ht), colPu, y, { align: "right" });
    doc.text(money(l.total_ht), pageW - mx, y, { align: "right" });
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
  tot("Total HT", money(totaux.montant_ht));
  const tvaLabel =
    draft.mode_tva === "fr_autoliquidation"
      ? "TVA — autoliquidation"
      : `TVA ${new Intl.NumberFormat("fr-FR").format(totaux.taux_tva * 100)} %`;
  tot(tvaLabel, money(totaux.montant_tva));
  doc.setFontSize(11);
  tot("Total TTC", money(totaux.montant_ttc), true);
  doc.setFontSize(10);

  const aidesActives = draft.aides.filter((a) => a.actif && a.montant > 0);
  if (aidesActives.length > 0) {
    for (const a of aidesActives) tot(a.label, `- ${money(a.montant)}`);
    doc.setFontSize(11);
    tot("Reste à charge", money(totaux.reste_a_charge), true);
    doc.setFontSize(10);
  }

  // Échéancier
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND);
  doc.text("Échéancier de paiement", mx, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  for (const e of echeances) {
    doc.text(`${e.pct} % — ${ECHEANCE_LABEL[e.label]}`, mx, y);
    doc.text(money(e.montant), pageW - mx, y, { align: "right" });
    y += 7;
  }

  // Notes
  if (draft.notes.trim()) {
    y += 4;
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    const notes = doc.splitTextToSize(draft.notes.trim(), pageW - 2 * mx);
    doc.text(notes, mx, y);
    y += notes.length * 5;
  }

  // Mentions légales (entité + mode TVA)
  y += 6;
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
    "Devis de démonstration — prix catalogue à valider avant émission réelle.",
    mx,
    y,
  );

  doc.save(`${ref}.pdf`);
}
