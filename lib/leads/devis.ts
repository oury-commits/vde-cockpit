import { jsPDF } from "jspdf";
import type { Devis, Echeance, Entite, Lead, ModeTva } from "@/lib/types";
import { formatDate, formatMontant } from "@/lib/format";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { QR_LABEL, qrDataUrl } from "@/lib/devis/qr";
import { MENTION_REMISE, remiseLabel } from "@/lib/devis/remise";
import { pctTva, ventilationDe } from "@/lib/devis/tva";
import { almaPhrase } from "@/lib/leads/reglements";
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

/**
 * Échéancier d'acomptes VDE par défaut : 2 versements (acompte 50 % + solde
 * 50 %), le cas majoritaire. Le solde absorbe l'arrondi. Le wizard peut imposer
 * un autre plan (3 versements) qui est alors conservé tel quel.
 */
export function buildEcheancier(ttc: number): Echeance[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const acompte = round(ttc * 0.5);
  const solde = round(ttc - acompte);
  return [
    { label: "acompte", pct: 50, montant: acompte, statut: "attendu" },
    { label: "solde", pct: 50, montant: solde, statut: "attendu" },
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

/** Sous-ensemble client requis par le PDF (un Lead le satisfait aussi). */
export interface DevisPdfClient {
  nom: string;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
}

/**
 * Génère le PDF du devis et déclenche le téléchargement (client only).
 * Devise, TVA et mentions suivent l'entité du devis. La marge interne
 * n'apparaît jamais : seules les lignes HT et le TTC sont imprimés. Police
 * Helvetica (standard PDF) : les règles de police UI ne s'appliquent pas ici.
 * L'échéancier peut être fourni (mode 50/50 ou 40/40/20) ; sinon 40/40/20.
 */
async function buildDevisDoc(
  client: DevisPdfClient,
  devis: Devis,
  echeancier?: Echeance[],
): Promise<jsPDF> {
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
  doc.text(client.nom || "—", mx, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const loc = [client.code_postal, client.ville].filter(Boolean).join(" ");
  for (const line of [client.adresse, loc, client.telephone, client.email]) {
    if (line && line.trim()) {
      y += 5;
      doc.text(line, mx, y);
    }
  }

  // Lignes
  y += 6;
  doc.setDrawColor(231, 226, 215);
  const ventilation = ventilationDe(devis);
  const multiTaux = ventilation.length > 1;
  const autoliq = devis.mode_tva === "fr_autoliquidation";

  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text("DÉSIGNATION", mx, y);
  // Colonne TVA par ligne uniquement quand le devis porte plusieurs taux.
  if (multiTaux) doc.text("TVA", pageW - 46, y, { align: "right" });
  doc.text("MONTANT HT", pageW - mx, y, { align: "right" });
  y += 2;
  doc.line(mx, y, pageW - mx, y);
  y += 6;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  for (const ligne of devis.lignes) {
    doc.text(ligne.label, mx, y);
    if (multiTaux) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(9);
      doc.text(pctTva(ligne.taux_tva ?? devis.taux_tva), pageW - 46, y, {
        align: "right",
      });
      doc.setFontSize(10);
      doc.setTextColor(...INK);
    }
    doc.text(eur(ligne.montant_ht), pageW - mx, y, { align: "right" });
    y += 7;
    // QR de la fiche produit (bornes uniquement — décidé à la dérivation).
    if (ligne.url_produit) {
      try {
        const png = await qrDataUrl(ligne.url_produit, 240);
        doc.addImage(png, "PNG", mx, y, 20, 20);
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(QR_LABEL, mx + 23, y + 11);
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        y += 24;
      } catch {
        /* QR indisponible : le devis reste valide sans lui */
      }
    }
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
  // Ordre conforme (I-14° CGI) : HT brut → − remise → HT net → TVA → TTC.
  if (devis.remise && devis.remise.montant > 0) {
    tot("Total HT brut", eur(devis.montant_ht_brut ?? devis.montant_ht));
    tot(remiseLabel(devis.remise), `− ${eur(devis.remise.montant)}`);
    tot("Total HT net", eur(devis.montant_ht));
  } else {
    tot("Total HT", eur(devis.montant_ht));
  }
  // Ventilation TVA par taux (Art. 242 nonies A) : une ligne par taux distinct.
  if (autoliq) {
    tot("TVA — autoliquidation", eur(0));
  } else {
    for (const v of ventilation) {
      tot(
        multiTaux
          ? `TVA ${pctTva(v.taux)} · base ${eur(v.base_ht)}`
          : `TVA ${pctTva(v.taux)}`,
        eur(v.montant_tva),
      );
    }
  }
  doc.setFontSize(11);
  tot("Total TTC", eur(devis.montant_ttc), true);

  // Option Alma (FR uniquement) : facilité de paiement affichée, pas un
  // échéancier VDE. « ou 4× 750,00 € sans frais avec Alma ».
  if (devis.entite === "FR" && devis.alma_propose && devis.alma_plan) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      almaPhrase(devis.montant_ttc, devis.alma_plan, eur),
      pageW - mx,
      y,
      { align: "right" },
    );
    doc.setTextColor(...INK);
    y += 6;
  }

  // Différenciateur commercial VDE (FR) — discret : la borne est achetée, pas
  // louée (vs offres à abonnement type Zeplug). MA n'est pas concerné.
  if (devis.entite === "FR") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Votre borne vous appartient — sans abonnement.",
      pageW - mx,
      y,
      { align: "right" },
    );
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    y += 6;
  }

  // Échéancier (fourni par l'appelant, sinon défaut 2 versements)
  const echeances = echeancier ?? buildEcheancier(devis.montant_ttc);
  const plan = echeances.map((e) => e.pct).join(" / ");
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text(`Échéancier de paiement — ${plan}`, mx, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const e of echeances) {
    doc.text(`${e.pct} % — ${ECHEANCE_LABEL[e.label]}`, mx, y);
    doc.text(eur(e.montant), pageW - mx, y, { align: "right" });
    y += 7;
  }

  // Mentions (légales par entité + mode TVA spécifique)
  y += 8;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  if (devis.remise && devis.remise.montant > 0) {
    doc.text(MENTION_REMISE, mx, y);
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

  return doc;
}

/** Génère le PDF et déclenche le téléchargement (client only). */
export async function generateDevisPdf(
  client: DevisPdfClient,
  devis: Devis,
  echeancier?: Echeance[],
): Promise<void> {
  const doc = await buildDevisDoc(client, devis, echeancier);
  doc.save(`${devis.ref}.pdf`);
}

/** Même PDF, en Blob — pour dépôt sur Supabase Storage (envoi client). */
export async function devisPdfBlob(
  client: DevisPdfClient,
  devis: Devis,
  echeancier?: Echeance[],
): Promise<Blob> {
  const doc = await buildDevisDoc(client, devis, echeancier);
  return doc.output("blob");
}
