// Fiche société PAR ENTITÉ — source unique de l'identité sur devis & factures.
// Une instance = une ligne de `parametres_entreprise` (miroir TS du schéma 0020).
// `entite` reste un `string` (extensible : une 3ᵉ société = une ligne de plus).

export interface ParametresEntreprise {
  entite: string;
  // 2. Informations société
  raison_sociale: string | null;
  forme_juridique: string | null;
  capital_social: string | null;
  adresse_siege: string | null;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  // 1. Identité visuelle
  couleur_marque: string;
  logo_complet_url: string | null;
  logo_symbole_url: string | null;
  // 3. Identifiants légaux FR
  siret: string | null;
  tva_intra: string | null;
  rcs: string | null;
  code_ape: string | null;
  // 3. Identifiants légaux MA
  ice: string | null;
  rc: string | null;
  if_fiscal: string | null;
  patente: string | null;
  cnss: string | null;
  // 4. Fiscalité
  mention_regime: string | null;
  // 5. Coordonnées bancaires
  iban: string | null;
  bic: string | null;
  rib: string | null;
  banque: string | null;
  // 6. Mentions & conformité
  mentions_legales: string | null;
  certifications: string[];
  assurance_decennale_compagnie: string | null;
  assurance_decennale_police: string | null;
  // Méta
  updated_at: string;
  modifie_par: string | null;
}

/** Fiche vierge pour une entité (tous champs nuls, couleur de marque par défaut). */
export function ficheVide(
  entite: string,
  overrides: Partial<ParametresEntreprise> = {},
): ParametresEntreprise {
  return {
    entite,
    raison_sociale: null,
    forme_juridique: null,
    capital_social: null,
    adresse_siege: null,
    telephone: null,
    email: null,
    site_web: null,
    couleur_marque: "#0F3D2E",
    logo_complet_url: null,
    logo_symbole_url: null,
    siret: null,
    tva_intra: null,
    rcs: null,
    code_ape: null,
    ice: null,
    rc: null,
    if_fiscal: null,
    patente: null,
    cnss: null,
    mention_regime: null,
    iban: null,
    bic: null,
    rib: null,
    banque: null,
    mentions_legales: null,
    certifications: [],
    assurance_decennale_compagnie: null,
    assurance_decennale_police: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    modifie_par: null,
    ...overrides,
  };
}
