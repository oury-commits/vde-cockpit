// Validation des formats PAR PAYS — empêche la fausse info dès la saisie
// (SIRET FR à 12 chiffres, IBAN sans FR76, ICE MA à 14 chiffres…). Un format
// invalide bloque l'enregistrement. Volontairement tolérant aux espaces.

import type { ParametresEntreprise } from "@/lib/entreprise/types";

export interface ChampErreur {
  champ: string;
  message: string;
}

const sansEspace = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "");

/**
 * Erreurs de format pour la fiche d'une entité. Ne valide QUE les champs
 * pertinents pour l'entité (les champs de l'autre pays ne sont pas contrôlés —
 * ils ne devraient de toute façon jamais être renseignés ici).
 */
export function validerFiche(entite: string, f: ParametresEntreprise): ChampErreur[] {
  const err: ChampErreur[] = [];
  const has = (v: string | null) => Boolean(v && v.trim());

  if (entite === "FR") {
    if (has(f.siret) && !/^\d{14}$/.test(sansEspace(f.siret))) {
      err.push({ champ: "siret", message: "SIRET = 14 chiffres." });
    }
    // TVA intracom FR = « FR » + 2 caractères de clé + 9 chiffres (SIREN) = 11 après FR.
    if (has(f.tva_intra) && !/^FR[0-9A-Z]{2}\d{9}$/i.test(sansEspace(f.tva_intra))) {
      err.push({ champ: "tva_intra", message: "TVA = FR + 11 caractères (ex. FR84 917 421 125)." });
    }
    if (has(f.iban) && !/^FR76/i.test(sansEspace(f.iban))) {
      err.push({ champ: "iban", message: "IBAN France : doit commencer par FR76." });
    }
  } else if (entite === "MA") {
    if (has(f.ice) && !/^\d{15}$/.test(sansEspace(f.ice))) {
      err.push({ champ: "ice", message: "ICE = 15 chiffres." });
    }
    // RC = « ville + numéro » : on exige la présence d'un numéro (pas de RC vide/bidon).
    if (has(f.rc) && !/\d/.test(f.rc ?? "")) {
      err.push({ champ: "rc", message: "RC doit contenir un numéro d'immatriculation." });
    }
    // RIB Maroc = 24 chiffres (format local).
    if (has(f.rib) && !/^\d{20,24}$/.test(sansEspace(f.rib))) {
      err.push({ champ: "rib", message: "RIB Maroc : ~24 chiffres (format local)." });
    }
  }

  // Champs transverses (email société), si renseignés.
  if (has(f.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email!.trim())) {
    err.push({ champ: "email", message: "Email invalide." });
  }

  return err;
}
