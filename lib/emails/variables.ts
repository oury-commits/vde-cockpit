// Remplissage des merge tags {{...}} depuis les données DÉJÀ en base (source
// unique, jamais retapé) + suggestion des modèles selon l'état du dossier.

import type { Lead } from "@/lib/types";
import type { ParametresEntreprise } from "@/lib/entreprise/types";
import { formatDate, formatDateTime, formatMontant } from "@/lib/format";
import { aEncaissement, estSolde, resteAPayer } from "@/lib/leads/reglements";
import { VALIDITE_DEVIS_JOURS } from "@/lib/documents/email";
import { adresseComplete } from "@/components/leads/fiche/rdvSync";

export interface ContexteModele {
  lead: Lead;
  /** Profil du membre connecté (expéditeur). */
  expediteur: { nom: string; telephone?: string | null } | null;
  /** Fiche entreprise de l'entité (lien avis, raison sociale). */
  fiche: ParametresEntreprise | null;
}

const dureePose = (debut: string, fin: string): string => {
  const min = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000);
  if (!Number.isFinite(min) || min <= 0) return "environ 2 heures";
  const h = Math.floor(min / 60);
  const r = min % 60;
  return h === 0 ? `environ ${r} min` : r === 0 ? `environ ${h} h` : `environ ${h} h ${r}`;
};

/** Table des valeurs de tags pour un dossier. `null` = donnée absente. */
export function variablesDe(ctx: ContexteModele): Record<string, string | null> {
  const { lead, expediteur, fiche } = ctx;
  const devis = lead.devis ?? null;
  const rdv = lead.rdv ?? null;
  const devise = devis?.devise ?? "EUR";
  const m = (n: number) => formatMontant(n, devise, { cents: true });

  const echeance = devis
    ? (() => {
        const d = new Date(devis.date_creation);
        d.setDate(d.getDate() + VALIDITE_DEVIS_JOURS);
        return formatDate(d.toISOString());
      })()
    : null;
  const reste = resteAPayer(lead);

  return {
    // Pas de champ civilité/prénom séparé sur le lead → « à compléter ».
    civilite: null,
    nom: lead.nom?.trim() || null,
    prenom: null,
    adresse_client: adresseComplete(lead) || null,
    numero_devis: devis?.ref ?? null,
    date_devis: devis ? formatDate(devis.date_creation) : null,
    date_echeance: echeance,
    montant: devis ? m(devis.montant_ttc) : null,
    montant_solde: reste > 0 ? m(reste) : null,
    date_rdv: rdv ? formatDateTime(rdv.debut) : null,
    nom_technicien: rdv?.technicien_nom ?? null,
    duree_pose: rdv ? dureePose(rdv.debut, rdv.fin) : null,
    // Liens de paiement/signature : intégrations futures (Alma/e-sign) → à compléter.
    lien_paiement: null,
    lien_signature: null,
    expediteur_prenom: expediteur?.nom ?? null,
    expediteur_tel: expediteur?.telephone ?? null,
    signature: expediteur?.nom
      ? `${expediteur.nom}${fiche?.raison_sociale ? ` — ${fiche.raison_sociale}` : ""}`
      : null,
    lien_avis: fiche?.lien_avis ?? null,
  };
}

const TAG_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Remplace les tags renseignés ; laisse `{{tag}}` visible pour les manquants. */
export function remplir(
  texte: string,
  vars: Record<string, string | null>,
): { texte: string; manquantes: string[] } {
  const manquantes = new Set<string>();
  const out = texte.replace(TAG_RE, (full, tag: string) => {
    const v = vars[tag];
    if (v != null && v !== "") return v;
    manquantes.add(tag);
    return full; // reste visible → « à compléter »
  });
  return { texte: out, manquantes: [...manquantes] };
}

/** Prépare objet + corps d'un modèle pour un dossier. */
export function preparerModele(
  objet: string,
  corps: string,
  ctx: ContexteModele,
): { objet: string; corps: string; manquantes: string[] } {
  const vars = variablesDe(ctx);
  const o = remplir(objet, vars);
  const c = remplir(corps, vars);
  return {
    objet: o.texte,
    corps: c.texte,
    manquantes: [...new Set([...o.manquantes, ...c.manquantes])],
  };
}

/** Le modèle est-il PERTINENT pour l'état actuel du dossier ? (suggestion). */
export function declencheurActif(declencheur: string | null, lead: Lead): boolean {
  switch (declencheur) {
    case "a_qualifier":
      return ["nouveau", "a_qualifier", "qualifie"].includes(lead.statut);
    case "devis_envoye":
      return lead.statut === "devis_envoye";
    case "signe":
      return lead.statut === "signe";
    case "acompte":
      return aEncaissement(lead);
    case "planifie":
      return Boolean(lead.rdv);
    case "installe":
      return lead.statut === "installe";
    case "solde":
      return estSolde(lead);
    default:
      return false;
  }
}
