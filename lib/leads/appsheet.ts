import type { Statut } from "@/lib/types";

// Correspondances spécifiques à la migration AppSheet → pipeline VDE.
// Module volontairement autonome (aucun import runtime) : il est utilisé aussi
// bien par l'app que par scripts/import-appsheet.ts exécuté par Node.

function normalize(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFD")) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue; // diacritiques
    out += ch;
  }
  return out.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Normalise une ref d'origine ("FB-41", "fb 041", "FB_41") → "FB-041".
 * Retourne null si la valeur n'est pas une ref FB exploitable.
 */
export function canonicalRef(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim().toUpperCase();
  const m = /^FB[-\s_]?(\d{1,6})$/.exec(s);
  if (!m) return null;
  return `FB-${String(Number(m[1])).padStart(3, "0")}`;
}

/** Libellés AppSheet connus → statut du pipeline. Ordre = priorité. */
const STATUT_RULES: [RegExp, Statut][] = [
  [/^(perdu|perdue|lost|abandonne|abandon|annule|ko|refus|refuse)/, "perdu"],
  [/^(sav|apres vente|maintenance|depannage)/, "sav"],
  [/^(installe|installee|pose|posee|termine|terminee|fini|finie|done)/, "installe"],
  [/^(planifie|planifiee|a planifier|programme|programmee|rdv pose)/, "planifie"],
  [/^(signe|signee|gagne|gagnee|won|accepte|acceptee|commande)/, "signe"],
  [/^(devis envoye|devis|devis envoyee|proposition|offre|quote)/, "devis_envoye"],
  [/^(qualifie|qualifiee|qualified)/, "qualifie"],
  [/^(a qualifier|a rappeler|a contacter|en cours de qualification)/, "a_qualifier"],
  [/^(nouveau|nouvelle|new|a traiter|non traite)/, "nouveau"],
];

/**
 * Mappe un statut AppSheet sur le pipeline. Retourne null si non reconnu :
 * l'appelant doit alors basculer sur `nouveau` + tracer une note d'import
 * (aucune donnée de statut n'est perdue silencieusement).
 */
export function parseStatutSource(raw: string | undefined | null): Statut | null {
  const n = normalize(raw ?? "");
  if (!n) return null;
  for (const [re, statut] of STATUT_RULES) {
    if (re.test(n)) return statut;
  }
  return null;
}

/** Note ajoutée au lead quand le statut d'origine n'a pas pu être mappé. */
export function noteStatutInconnu(raw: string): string {
  return `[Import AppSheet] Statut d'origine non reconnu : « ${raw.trim()} » → importé en « nouveau ».`;
}
