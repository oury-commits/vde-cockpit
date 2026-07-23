// Identité société telle qu'elle apparaît sur un document — construite depuis
// UNE SEULE fiche, STRICTEMENT selon l'entité. C'est le cœur anti-confusion :
// les champs FR (SIRET, IBAN…) ne sont rendus QUE si entite === "FR" ; les
// champs MA (ICE, RC, RIB…) QUE si entite === "MA". Même si une mauvaise fiche
// était passée, aucun champ du mauvais pays ne peut atterrir sur le document.
//
// Source UNIQUE : devis.ts, facture.ts, DevisPreview et email.ts passent tous
// par ici — plus aucune mention société codée en dur dans ces fichiers.

import type { Entite } from "@/lib/types";
import type { ParametresEntreprise } from "@/lib/entreprise/types";
import { entiteConfig } from "@/lib/entite/config";

const ok = (v: string | null | undefined) => Boolean(v && v.trim());

/** Raison sociale (fiche), avec repli sur le nom court de l'entité si vide. */
export function raisonSociale(fiche: ParametresEntreprise | null, entite: Entite): string {
  return ok(fiche?.raison_sociale) ? (fiche!.raison_sociale as string) : entiteConfig(entite).nom;
}

/** Coordonnées de l'en-tête : adresse puis « tél · email · site ». */
export function coordonneesLignes(fiche: ParametresEntreprise | null): string[] {
  if (!fiche) return [];
  const lignes: string[] = [];
  if (ok(fiche.adresse_siege)) lignes.push(fiche.adresse_siege as string);
  const contact = [fiche.telephone, fiche.email, fiche.site_web].filter(ok).join(" · ");
  if (contact) lignes.push(contact);
  return lignes;
}

/**
 * Mentions du pied de document, cloisonnées par entité. Ordre : forme/capital →
 * identifiants légaux (FR ou MA, jamais les deux) → assurance décennale (FR) →
 * certifications → RIB (celui de l'entité, jamais l'autre) → régime → libre.
 */
export function mentionsEntreprise(
  fiche: ParametresEntreprise | null,
  entite: Entite,
): string[] {
  if (!fiche) return [];
  const L: string[] = [];

  const soc = [
    ok(fiche.forme_juridique) ? fiche.forme_juridique : null,
    ok(fiche.capital_social) ? `capital ${fiche.capital_social}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (soc) L.push(soc);
  if (ok(fiche.adresse_siege)) L.push(fiche.adresse_siege as string);

  if (entite === "FR") {
    const ids = [
      ok(fiche.siret) ? `SIRET ${fiche.siret}` : null,
      ok(fiche.tva_intra) ? `TVA ${fiche.tva_intra}` : null,
      ok(fiche.rcs) ? `RCS ${fiche.rcs}` : null,
      ok(fiche.code_ape) ? `APE ${fiche.code_ape}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (ids) L.push(ids);
    if (ok(fiche.assurance_decennale_compagnie)) {
      L.push(
        `Assurance décennale : ${fiche.assurance_decennale_compagnie}` +
          (ok(fiche.assurance_decennale_police) ? ` — police ${fiche.assurance_decennale_police}` : ""),
      );
    }
  } else if (entite === "MA") {
    const ids = [
      ok(fiche.ice) ? `ICE ${fiche.ice}` : null,
      ok(fiche.rc) ? `RC ${fiche.rc}` : null,
      ok(fiche.if_fiscal) ? `IF ${fiche.if_fiscal}` : null,
      ok(fiche.patente) ? `Patente ${fiche.patente}` : null,
      ok(fiche.cnss) ? `CNSS ${fiche.cnss}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (ids) L.push(ids);
  }

  if (fiche.certifications?.length) L.push(`Certifications : ${fiche.certifications.join(", ")}`);

  // RIB — jamais celui de l'autre pays.
  if (entite === "FR" && ok(fiche.iban)) {
    L.push(
      `IBAN ${fiche.iban}` +
        (ok(fiche.bic) ? ` · BIC ${fiche.bic}` : "") +
        (ok(fiche.banque) ? ` · ${fiche.banque}` : ""),
    );
  } else if (entite === "MA" && ok(fiche.rib)) {
    L.push(`RIB ${fiche.rib}` + (ok(fiche.banque) ? ` · ${fiche.banque}` : ""));
  }

  if (ok(fiche.mention_regime)) L.push(fiche.mention_regime as string);
  if (ok(fiche.mentions_legales)) {
    for (const ligne of (fiche.mentions_legales as string).split("\n")) {
      if (ligne.trim()) L.push(ligne.trim());
    }
  }
  return L;
}
