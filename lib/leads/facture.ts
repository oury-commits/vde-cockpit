import { jsPDF } from "jspdf";
import type { Devis, Entite, Facture, Lead } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { MENTION_REMISE, remiseLabel } from "@/lib/devis/remise";
import { MENTION_SOLDE, marcheDeSolde } from "@/lib/leads/reglements";
import { pctTva, ventilationDe } from "@/lib/devis/tva";
import type { ParametresEntreprise } from "@/lib/entreprise/types";
import { coordonneesLignes, mentionsEntreprise, raisonSociale } from "@/lib/entreprise/document";
import { chargerImageDataUrl } from "@/lib/entreprise/image";

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

async function buildFactureDoc(
  lead: Lead,
  facture: Facture,
  fiche?: ParametresEntreprise | null,
): Promise<jsPDF> {
  // Identité = fiche de CETTE entité uniquement (aucune donnée de l'autre pays).
  const opt = optionTva(facture.entite, facture.mode_tva);
  const m = (n: number) => formatMontant(n, facture.devise, { cents: true });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const mx = 16;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  let nomX = mx;
  const logoData = await chargerImageDataUrl(fiche?.logo_complet_url);
  if (logoData) {
    try {
      const fmt = logoData.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(logoData, fmt, mx, 7, 16, 16);
      nomX = mx + 20;
    } catch {
      /* format non embarquable → en-tête texte */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(raisonSociale(fiche ?? null, facture.entite), nomX, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    facture.type === "solde"
      ? "FACTURE DE SOLDE"
      : facture.type === "acompte"
        ? "FACTURE D'ACOMPTE"
        : "FACTURE",
    nomX,
    21,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(facture.ref, pageW - mx, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatDate(facture.date_creation), pageW - mx, 21, { align: "right" });

  // Coordonnées émetteur (sous l'en-tête, à droite) — issues de la fiche.
  let yh = 36;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  for (const l of coordonneesLignes(fiche ?? null)) {
    doc.text(l, pageW - mx, yh, { align: "right" });
    yh += 4;
  }

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
  const autoliq = facture.mode_tva === "fr_autoliquidation";
  const ventilation = ventilationDe(facture);
  const multiTaux = ventilation.length > 1;
  // Rend la ventilation TVA par taux (Art. 242 nonies A). `regularisee` sur la
  // facture de solde pour acter la régularisation.
  const rendTva = (regularisee = false) => {
    if (autoliq) {
      tot("TVA — autoliquidation", m(0));
      return;
    }
    for (const v of ventilation) {
      const base = multiTaux ? ` · base ${m(v.base_ht)}` : "";
      tot(
        `TVA ${pctTva(v.taux)}${base}${regularisee ? " (régularisée)" : ""}`,
        m(v.montant_tva),
      );
    }
  };

  if (facture.type === "solde") {
    // Facture de SOLDE : rappel du marché (remise reportée, jamais recomptée) →
    // acomptes déjà facturés, déduits → solde à payer, TVA régularisée par taux.
    const marche = marcheDeSolde(facture);
    if (facture.remise && facture.remise.montant > 0) {
      tot("Total HT brut (marché)", m(facture.montant_ht_brut ?? marche.ht));
      tot(remiseLabel(facture.remise), `− ${m(facture.remise.montant)}`);
      tot("Total HT net (marché)", m(marche.ht));
    } else {
      tot("Total HT (marché)", m(marche.ht));
    }
    tot("TVA (marché)", m(marche.tva));
    tot("Total TTC (marché)", m(marche.ttc));

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("ACOMPTES DÉJÀ FACTURÉS — DÉDUITS", pageW - 80, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    for (const a of facture.acomptes_deduits ?? []) {
      doc.text(`${a.ref} · ${formatDate(a.date)}`, pageW - 80, y);
      doc.text(`− ${m(a.montant_ttc)}`, pageW - mx, y, { align: "right" });
      y += 5;
    }
    doc.setFontSize(10);
    y += 1;
    tot("Solde HT", m(facture.montant_ht));
    rendTva(true); // TVA du solde, ventilée et régularisée par taux
    doc.setFontSize(11);
    tot("Solde à payer (TTC)", m(facture.montant_ttc), true);
  } else {
    // Facture normale / d'acompte : HT brut → − remise → HT net → TVA → TTC.
    if (facture.remise && facture.remise.montant > 0) {
      tot("Total HT brut", m(facture.montant_ht_brut ?? facture.montant_ht));
      tot(remiseLabel(facture.remise), `− ${m(facture.remise.montant)}`);
      tot("Total HT net", m(facture.montant_ht));
    } else {
      tot("Total HT", m(facture.montant_ht));
    }
    rendTva();
    doc.setFontSize(11);
    tot("Total TTC", m(facture.montant_ttc), true);
  }

  y += 8;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  if (facture.type === "solde") {
    doc.text(MENTION_SOLDE, mx, y);
    y += 4;
  }
  if (multiTaux) {
    doc.text(
      "Document soumis à plusieurs taux de TVA — ventilation ci-dessus (Art. 242 nonies A, I CGI).",
      mx,
      y,
    );
    y += 4;
  }
  if (facture.remise && facture.remise.montant > 0) {
    doc.text(MENTION_REMISE, mx, y);
    y += 4;
  }
  if (opt.mention) {
    doc.text(opt.mention, mx, y);
    y += 4;
  }
  // Identité légale + RIB + assurance + certifs — STRICTEMENT de l'entité.
  for (const line of mentionsEntreprise(fiche ?? null, facture.entite)) {
    doc.text(line, mx, y);
    y += 4;
  }

  return doc;
}

/** PDF de facture — identité (fiche), mentions et devise de l'entité. Client only. */
export async function generateFacturePdf(
  lead: Lead,
  facture: Facture,
  fiche?: ParametresEntreprise | null,
): Promise<void> {
  const doc = await buildFactureDoc(lead, facture, fiche);
  doc.save(`${facture.ref}.pdf`);
}

/** Même PDF, en Blob — pour dépôt sur Supabase Storage (envoi client). */
export async function facturePdfBlob(
  lead: Lead,
  facture: Facture,
  fiche?: ParametresEntreprise | null,
): Promise<Blob> {
  const doc = await buildFactureDoc(lead, facture, fiche);
  return doc.output("blob");
}
