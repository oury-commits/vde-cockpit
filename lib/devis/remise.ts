import type { RemiseInfo } from "@/lib/types";

/**
 * Mention légale obligatoire dès qu'une réduction figure sur le document
 * (art. 242 nonies A, I-14° CGI). Rendue sur le PDF devis ET facture.
 */
export const MENTION_REMISE =
  "Réduction commerciale déduite du total HT avant TVA (art. 242 nonies A, I-14° CGI).";

/**
 * Libellé de la ligne de remise. Le pourcentage saisi est rappelé quand la
 * remise a été exprimée en % (« Remise 10 % ») ; le motif, s'il existe, est mis
 * entre parenthèses pour la traçabilité (« Remise (geste commercial) »).
 */
export function remiseLabel(remise: RemiseInfo): string {
  const base =
    remise.type === "percent"
      ? `Remise ${new Intl.NumberFormat("fr-FR").format(remise.valeur)} %`
      : "Remise";
  const motif = remise.motif?.trim();
  return motif ? `${base} (${motif})` : base;
}
