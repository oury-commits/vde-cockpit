// Modèle d'email/SMS éditable (table modeles_email). Miroir TS du schéma 0023.

export type CanalModele = "email" | "sms";

export interface ModeleEmail {
  id: string;
  cle: string;
  entite: string;
  /** Contexte dossier associé (suggestion au bon moment). */
  declencheur: string | null;
  nom: string;
  objet: string;
  corps: string;
  canal: CanalModele;
  actif: boolean;
  ordre: number;
  /** Verrou optimiste (comme leads/catalogue). */
  version: number;
  modifie_par: string | null;
  updated_at: string;
}

/** Les merge tags disponibles, pour le sélecteur de l'éditeur (pas de faute de frappe). */
export const TAGS: { tag: string; libelle: string }[] = [
  { tag: "{{civilite}}", libelle: "Civilité" },
  { tag: "{{nom}}", libelle: "Nom du client" },
  { tag: "{{prenom}}", libelle: "Prénom" },
  { tag: "{{adresse_client}}", libelle: "Adresse client" },
  { tag: "{{numero_devis}}", libelle: "N° de devis" },
  { tag: "{{date_devis}}", libelle: "Date du devis" },
  { tag: "{{date_echeance}}", libelle: "Échéance du devis" },
  { tag: "{{montant}}", libelle: "Montant TTC" },
  { tag: "{{montant_solde}}", libelle: "Solde à payer" },
  { tag: "{{date_rdv}}", libelle: "Date du RDV" },
  { tag: "{{nom_technicien}}", libelle: "Technicien" },
  { tag: "{{duree_pose}}", libelle: "Durée de pose" },
  { tag: "{{lien_paiement}}", libelle: "Lien de paiement" },
  { tag: "{{lien_signature}}", libelle: "Lien de signature" },
  { tag: "{{expediteur_prenom}}", libelle: "Votre prénom" },
  { tag: "{{expediteur_tel}}", libelle: "Votre téléphone" },
  { tag: "{{signature}}", libelle: "Signature" },
  { tag: "{{lien_avis}}", libelle: "Lien avis Google" },
];
