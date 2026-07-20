import QRCode from "qrcode";

// QR de la fiche produit, partagé par l'aperçu (React) et le PDF (jsPDF).
// Règle métier : réservé aux bornes — la décision est prise à la dérivation des
// lignes (lib/devis/builder.ts), ici on ne fait que rendre.

/** Couleurs du QR aux tokens du design system (encre sur surface). */
export const QR_OPTIONS = {
  margin: 1,
  color: { dark: "#1A1A1A", light: "#FFFFFF" },
} as const;

/** Libellé unique du QR produit (aperçu + PDF). */
export const QR_LABEL = "Scanner pour découvrir votre borne";

/** Data URL PNG du QR encodant l'URL de la fiche produit. */
export function qrDataUrl(url: string, width = 240): Promise<string> {
  return QRCode.toDataURL(url, { ...QR_OPTIONS, width });
}
