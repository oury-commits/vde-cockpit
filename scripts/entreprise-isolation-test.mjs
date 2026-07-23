// TEST ANTI-CONFUSION (le plus important) : les mentions d'un document ne
// laissent JAMAIS fuiter les données de l'autre pays, même si une fiche contient
// (par erreur/malice) à la fois des champs FR et MA. + validation des formats.
// Réplique la logique pure de lib/entreprise/{document,validation}.ts en JS.

const ok = (v) => Boolean(v && String(v).trim());

function mentionsEntreprise(fiche, entite) {
  if (!fiche) return [];
  const L = [];
  const soc = [
    ok(fiche.forme_juridique) ? fiche.forme_juridique : null,
    ok(fiche.capital_social) ? `capital ${fiche.capital_social}` : null,
  ].filter(Boolean).join(" · ");
  if (soc) L.push(soc);
  if (ok(fiche.adresse_siege)) L.push(fiche.adresse_siege);
  if (entite === "FR") {
    const ids = [
      ok(fiche.siret) ? `SIRET ${fiche.siret}` : null,
      ok(fiche.tva_intra) ? `TVA ${fiche.tva_intra}` : null,
      ok(fiche.rcs) ? `RCS ${fiche.rcs}` : null,
      ok(fiche.code_ape) ? `APE ${fiche.code_ape}` : null,
    ].filter(Boolean).join(" · ");
    if (ids) L.push(ids);
    if (ok(fiche.assurance_decennale_compagnie)) {
      L.push(`Assurance décennale : ${fiche.assurance_decennale_compagnie}` +
        (ok(fiche.assurance_decennale_police) ? ` — police ${fiche.assurance_decennale_police}` : ""));
    }
  } else if (entite === "MA") {
    const ids = [
      ok(fiche.ice) ? `ICE ${fiche.ice}` : null,
      ok(fiche.rc) ? `RC ${fiche.rc}` : null,
      ok(fiche.if_fiscal) ? `IF ${fiche.if_fiscal}` : null,
      ok(fiche.patente) ? `Patente ${fiche.patente}` : null,
      ok(fiche.cnss) ? `CNSS ${fiche.cnss}` : null,
    ].filter(Boolean).join(" · ");
    if (ids) L.push(ids);
  }
  if (fiche.certifications?.length) L.push(`Certifications : ${fiche.certifications.join(", ")}`);
  if (entite === "FR" && ok(fiche.iban)) {
    L.push(`IBAN ${fiche.iban}` + (ok(fiche.bic) ? ` · BIC ${fiche.bic}` : "") + (ok(fiche.banque) ? ` · ${fiche.banque}` : ""));
  } else if (entite === "MA" && ok(fiche.rib)) {
    L.push(`RIB ${fiche.rib}` + (ok(fiche.banque) ? ` · ${fiche.banque}` : ""));
  }
  if (ok(fiche.mention_regime)) L.push(fiche.mention_regime);
  if (ok(fiche.mentions_legales)) for (const l of fiche.mentions_legales.split("\n")) if (l.trim()) L.push(l.trim());
  return L;
}

const sansEspace = (s) => (s ?? "").replace(/\s+/g, "");
function validerFiche(entite, f) {
  const err = [];
  const has = (v) => Boolean(v && String(v).trim());
  if (entite === "FR") {
    if (has(f.siret) && !/^\d{14}$/.test(sansEspace(f.siret))) err.push("siret");
    if (has(f.tva_intra) && !/^FR[0-9A-Z]{2}\d{9}$/i.test(sansEspace(f.tva_intra))) err.push("tva_intra");
    if (has(f.iban) && !/^FR76/i.test(sansEspace(f.iban))) err.push("iban");
  } else if (entite === "MA") {
    if (has(f.ice) && !/^\d{15}$/.test(sansEspace(f.ice))) err.push("ice");
    if (has(f.rc) && !/\d/.test(f.rc ?? "")) err.push("rc");
    if (has(f.rib) && !/^\d{20,24}$/.test(sansEspace(f.rib))) err.push("rib");
  }
  return err;
}

let pass = 0, fail = 0;
const t = (n, v) => { console.log(`  ${v ? "OK  " : "FAIL"} ${n}`); v ? pass++ : fail++; };
const joint = (arr) => arr.join(" || ");

// Fiche PIÉGÉE : contient À LA FOIS des champs FR et MA (cas malveillant/erreur).
const fichePiegee = {
  raison_sociale: "VDE", forme_juridique: "SAS", capital_social: null, adresse_siege: "Ludres",
  siret: "91742112500019", tva_intra: "FR84 917 421 125", rcs: "Nancy 917421125", code_ape: "4321A",
  ice: "003910477000069", rc: "Rabat 198269", if_fiscal: "72081360", patente: "X", cnss: "Y",
  iban: "FR7630006000011234567890189", bic: "AGRIFRPP", rib: "011780000012345678901234", banque: "BQ",
  certifications: ["RGE"], assurance_decennale_compagnie: "AXA", assurance_decennale_police: "P-42",
  mention_regime: null, mentions_legales: null,
};

const fr = joint(mentionsEntreprise(fichePiegee, "FR"));
const ma = joint(mentionsEntreprise(fichePiegee, "MA"));

// FR : contient SIRET / TVA / IBAN FR76, et AUCUNE trace Maroc.
t("FR affiche SIRET", fr.includes("91742112500019"));
t("FR affiche IBAN FR76", fr.includes("FR7630006000011234567890189"));
t("FR NE contient PAS l'ICE", !fr.includes("003910477000069"));
t("FR NE contient PAS le RC Rabat", !fr.includes("Rabat 198269"));
t("FR NE contient PAS le RIB Maroc", !fr.includes("011780000012345678901234"));

// MA : contient ICE / RC / RIB Maroc, et AUCUNE trace France.
t("MA affiche ICE", ma.includes("003910477000069"));
t("MA affiche RIB Maroc", ma.includes("011780000012345678901234"));
t("MA NE contient PAS le SIRET", !ma.includes("91742112500019"));
t("MA NE contient PAS la TVA FR", !ma.includes("FR84 917 421 125"));
t("MA NE contient PAS l'IBAN FR76", !ma.includes("FR7630006000011234567890189"));

// Validation des formats — la fausse info est bloquée.
t("SIRET à 12 chiffres → erreur", validerFiche("FR", { siret: "123456789012" }).includes("siret"));
t("SIRET à 14 chiffres → OK", !validerFiche("FR", { siret: "91742112500019" }).includes("siret"));
t("IBAN sans FR76 → erreur", validerFiche("FR", { iban: "DE89370400440532013000" }).includes("iban"));
t("TVA FR valide → OK", !validerFiche("FR", { tva_intra: "FR84 917 421 125" }).includes("tva_intra"));
t("ICE à 14 chiffres → erreur", validerFiche("MA", { ice: "00391047700006" }).includes("ice"));
t("ICE à 15 chiffres → OK", !validerFiche("MA", { ice: "003910477000069" }).includes("ice"));

console.log(`\nRÉSULTAT : ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
