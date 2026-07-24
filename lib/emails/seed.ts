import type { ModeleEmail } from "@/lib/emails/types";

// Seed FR (mode démo local + fallback si la table est vide). MÊME contenu que
// le seed SQL 0023. Les 6 premiers (qualif/devis) sont des brouillons de ton
// chaleureux à remplacer par la bibliothèque validée d'Oury ; les 5 du cycle de
// vie = texte fourni. Aucun modèle MA.

const TS = "2026-01-01T00:00:00.000Z";

function mel(
  o: Pick<ModeleEmail, "cle" | "declencheur" | "nom" | "objet" | "corps" | "ordre">,
): ModeleEmail {
  return {
    id: `MEL-FR-${o.cle}`,
    entite: "FR",
    canal: "email",
    actif: true,
    version: 0,
    modifie_par: null,
    updated_at: TS,
    ...o,
  };
}

export function buildModelesSeed(): ModeleEmail[] {
  return [
    mel({
      cle: "qualif_j2",
      declencheur: "a_qualifier",
      nom: "Qualif — relance J+2",
      objet: "Votre projet de borne de recharge — quelques précisions",
      corps:
        "Bonjour {{nom}}, merci pour votre demande d'installation d'une borne de recharge. Pour vous préparer un devis au plus juste, j'aurais besoin de quelques précisions sur votre installation électrique. Auriez-vous 5 minutes pour en échanger ? Je m'occupe de tout le reste. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 10,
    }),
    mel({
      cle: "qualif_j5",
      declencheur: "a_qualifier",
      nom: "Qualif — relance J+5",
      objet: "On s'occupe de tout — 5 minutes au téléphone ?",
      corps:
        "Bonjour {{nom}}, je reviens vers vous au sujet de votre projet de borne. Nos techniciens certifiés gèrent l'installation de A à Z, avec la TVA réduite à 5,5 %. Un court appel suffit pour lancer votre devis — quand seriez-vous disponible ? — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 20,
    }),
    mel({
      cle: "qualif_j10",
      declencheur: "a_qualifier",
      nom: "Qualif — clôture J+10",
      objet: "Souhaitez-vous que l'on garde votre projet de côté ?",
      corps:
        "Bonjour {{nom}}, sans retour de votre part, je préfère ne pas vous importuner. Si votre projet de borne est simplement reporté, dites-le moi : je garde votre dossier de côté et reviens vers vous au bon moment. Belle journée. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 30,
    }),
    mel({
      cle: "devis_j2",
      declencheur: "devis_envoye",
      nom: "Devis — relance J+2",
      objet: "Votre devis {{numero_devis}} — bien reçu ?",
      corps:
        "Bonjour {{nom}}, je voulais m'assurer que vous avez bien reçu votre devis {{numero_devis}} pour l'installation de votre borne. Je reste à votre entière disposition pour toute question ou ajustement. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 40,
    }),
    mel({
      cle: "devis_j5",
      declencheur: "devis_envoye",
      nom: "Devis — relance J+5",
      objet: "Votre devis {{numero_devis}} — pour réserver votre créneau",
      corps:
        "Bonjour {{nom}}, votre devis {{numero_devis}} ({{montant}}) est prêt. Pour réserver un créneau d'installation avec notre technicien certifié, il suffit de le valider. Je peux aussi vous proposer un règlement en plusieurs fois. Une question ? Je suis là. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 50,
    }),
    mel({
      cle: "devis_j14",
      declencheur: "devis_envoye",
      nom: "Devis — avant échéance J+14",
      objet: "Votre devis {{numero_devis}} arrive à échéance",
      corps:
        "Bonjour {{nom}}, votre devis {{numero_devis}} arrive à échéance le {{date_echeance}}. Si vous souhaitez en profiter aux conditions actuelles, il est encore temps de le valider. Je reste disponible pour en discuter. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 60,
    }),
    mel({
      cle: "devis_valide",
      declencheur: "signe",
      nom: "Cycle — devis validé",
      objet: "Bienvenue chez VDE — prochaines étapes de votre installation",
      corps:
        "Bonjour {{civilite}} {{nom}}, un grand merci pour votre confiance. Votre devis {{numero_devis}} est validé. Voici les prochaines étapes : à réception de votre acompte, nous calons ensemble la date d'installation avec notre technicien certifié. Vous pouvez régler en toute sécurité via ce lien : {{lien_paiement}}. Je reste à votre disposition. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 70,
    }),
    mel({
      cle: "acompte_recu",
      declencheur: "acompte",
      nom: "Cycle — acompte reçu",
      objet: "Acompte bien reçu — on cale votre date d'installation",
      corps:
        "Bonjour {{civilite}} {{nom}}, nous confirmons la réception de votre acompte. Votre projet passe en planification ! Quelle période vous arrangerait pour l'intervention ? Notre technicien prévoit {{duree_pose}} sur place. À très vite. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 80,
    }),
    mel({
      cle: "rdv_confirme",
      declencheur: "planifie",
      nom: "Cycle — RDV confirmé",
      objet: "Votre installation est planifiée le {{date_rdv}}",
      corps:
        "Bonjour {{civilite}} {{nom}}, c'est confirmé : votre borne sera installée le {{date_rdv}}. Notre technicien {{nom_technicien}} interviendra à l'adresse {{adresse_client}}. Prévoyez un accès au tableau électrique. En cas d'imprévu, prévenez-moi et nous décalons sans souci. À bientôt. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 90,
    }),
    mel({
      cle: "installe_solde",
      declencheur: "installe",
      nom: "Cycle — installé, solde dû",
      objet: "Votre installation est terminée — dernière étape",
      corps:
        "Bonjour {{civilite}} {{nom}}, votre borne est installée et opérationnelle, nous en sommes ravis. Pour clôturer le dossier, il reste le solde de {{montant_solde}}, réglable ici : {{lien_paiement}}. Le procès-verbal de réception vous a été remis à signer. Merci encore de votre confiance. — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 100,
    }),
    mel({
      cle: "avis_google",
      declencheur: "solde",
      nom: "Cycle — demande d'avis",
      objet: "Merci pour votre confiance",
      corps:
        "Bonjour {{civilite}} {{nom}}, toute l'équipe VDE vous remercie. Si vous êtes satisfait de votre installation, un avis Google nous aiderait énormément : {{lien_avis}}. Cela ne prend qu'une minute et nous permet d'accompagner d'autres particuliers comme vous. Belle route électrique ! — {{expediteur_prenom}}, Vision Digital Énergies",
      ordre: 110,
    }),
  ];
}
