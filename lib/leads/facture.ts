import { jsPDF } from "jspdf";
import type { Devis, Entite, Facture, Lead } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { MENTION_REMISE, remiseLabel } from "@/lib/devis/remise";
import { buildEcheancier } from "@/lib/leads/devis";

/**
 * Prochaine ref de facture, NUMÉROTATION CONTINUE SANS TROU par entité
 * (obligation légale). FAC-2026-XXX (FR) / FAC-MA-2026-XXX (MA).
 */
export function nextFactureRef(existingRefs: string[], entite: Entite): string {
  const prefix = entiteConfig(entite).prefixeFacture;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = existingRefs.reduce((acc, ref) => {
    const m = re.exec(ref.trim());
    return m ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Construit une facture depuis un devis signé (reprend montants + TVA + devise). */
export function buildFacture(devis: Devis, ref: string, dateISO: string): Facture {
  return {
    ref,
    entite: devis.entite,
    devise: devis.devise,
    date_creation: dateISO,
    devis_ref: devis.ref,
    lignes: devis.lignes,
    montant_ht_brut: devis.montant_ht_brut,
    remise: devis.remise ?? null,
    montant_ht: devis.montant_ht,
    mode_tva: devis.mode_tva,
    taux_tva: devis.taux_tva,
    montant_tva: devis.montant_tva,
    montant_ttc: devis.montant_ttc,
  };
}

const BRAND: [number, number, number] = [15, 61, 46];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [92, 107, 99];

const ECHEANCE_LABEL = ["Acompte à la commande", "Démarrage des travaux", "Solde à la réception"];

function buildFactureDoc(lead: Lead, facture: Facture): jsPDF {
  const cfg = entiteConfig(facture.entite);
  const opt = optionTva(facture.entite, facture.mode_tva);
  const m = (n: number) => formatMontant(n, facture.devise, { cents: true });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const mx = 16;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(cfg.nom, mx, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("FACTURE", mx, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(facture.ref, pageW - mx, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDate(facture.date_creation), pageW - mx, 21, { align: "right" });

  let y = 44;
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(`FACTURE ÉTABLIE POUR (réf. devis ${facture.devis_ref})`, mx, y);
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
  for (const ligne of facture.lignes) {
    doc.text(ligne.label, mx, y);
    doc.text(m(ligne.montant_ht), pageW - mx, y, { align: "right" });
    y += 7;
  }

  y += 2;
  doc.line(pageW - 80, y, pageW - mx, y);
  y += 6;
  const tot = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, pageW - 80, y);
    doc.text(val, pageW - mx, y, { align: "right" });
    y += 6;
  };
  // Même ordre conforme que le devis : HT brut → − remise → HT net → TVA → TTC.
  if (facture.remise && facture.remise.montant > 0) {
    tot("Total HT brut", m(facture.montant_ht_brut ?? facture.montant_ht));
    tot(remiseLabel(facture.remise), `− ${m(facture.remise.montant)}`);
    tot("Total HT net", m(facture.montant_ht));
  } else {
    tot("Total HT", m(facture.montant_ht));
  }
  tot(
    facture.mode_tva === "fr_autoliquidation"
      ? "TVA — autoliquidation"
      : `TVA ${new Intl.NumberFormat("fr-FR").format(facture.taux_tva * 100)} %`,
    m(facture.montant_tva),
  );
  doc.setFontSize(11);
  tot("Total TTC", m(facture.montant_ttc), true);

  // Reprise de l'échéancier 40/40/20
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text("Conditions de paiement — 40 / 40 / 20", mx, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ech = buildEcheancier(facture.montant_ttc);
  ech.forEach((e, i) => {
    doc.text(`${e.pct} % — ${ECHEANCE_LABEL[i]}`, mx, y);
    doc.text(m(e.montant), pageW - mx, y, { align: "right" });
    y += 7;
  });

  y += 8;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  if (facture.remise && facture.remise.montant > 0) {
    doc.text(MENTION_REMISE, mx, y);
    y += 4;
  }
  if (opt.mention) {
    doc.text(opt.mention, mx, y);
    y += 4;
  }
  for (const line of cfg.mentions) {
    doc.text(line, mx, y);
    y += 4;
  }
  doc.text("Facture de démonstration — mentions légales à valider avant émission réelle.", mx, y);

  return doc;
}

/** PDF de facture — mentions légales et devise de l'entité. Client only. */
export function generateFacturePdf(lead: Lead, facture: Facture): void {
  buildFactureDoc(lead, facture).save(`${facture.ref}.pdf`);
}

/** Même PDF, en Blob — pour dépôt sur Supabase Storage (envoi client). */
export function facturePdfBlob(lead: Lead, facture: Facture): Blob {
  return buildFactureDoc(lead, facture).output("blob");
}
