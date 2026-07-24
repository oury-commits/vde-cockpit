import type { Lead } from "@/lib/types";
import {
  aEncaissement,
  estSolde,
  estSoldeAlma,
  peutGenererSolde,
  resteAPayer,
} from "@/lib/leads/reglements";

// ════════════════════════════════════════════════════════════════════════════
//  Cohérence du cycle de vie (§E) — la « machine à états » du dossier.
//
//  Principe : le pipeline réel (devis / registre des règlements / statut) fait
//  foi. Les statuts « Expiré » et « En retard » ne sont JAMAIS stockés : ils se
//  DÉRIVENT de l'âge des documents, pour qu'aucune donnée saisie ne puisse
//  contredire l'état réel. Un seul endroit calcule « le prochain geste » et les
//  signaux d'exception, pour que la fiche et la liste disent la même chose.
// ════════════════════════════════════════════════════════════════════════════

/** Validité d'un devis : au-delà, sans réponse → Expiré (mention PDF « 30 j »). */
export const VALIDITE_DEVIS_JOURS = 30;
/** Devis envoyé sans réponse au-delà de ce délai → « À relancer ». */
export const RELANCE_DEVIS_JOURS = 7;
/** Facture émise impayée au-delà de ce délai → « En retard ». */
export const DELAI_PAIEMENT_JOURS = 30;

const MS_JOUR = 86_400_000;
const joursDepuis = (iso: string, now: number) =>
  (now - new Date(iso).getTime()) / MS_JOUR;

// ── Statut d'AFFICHAGE dérivé du devis ──────────────────────────────────────
export type StatutDevisAffiche =
  | "brouillon"
  | "envoye"
  | "accepte"
  | "expire";

export const STATUT_DEVIS_LABEL: Record<StatutDevisAffiche, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  expire: "Expiré",
};

/** Statut affiché du devis : `signe` → Accepté ; `envoye` trop vieux → Expiré. */
export function statutDevisAffiche(
  lead: Lead,
  now: number = Date.now(),
): StatutDevisAffiche | null {
  const d = lead.devis;
  if (!d) return null;
  if (d.statut === "signe") return "accepte";
  if (d.statut === "brouillon") return "brouillon";
  const ref = d.envoye_le ?? d.date_creation;
  if (ref && joursDepuis(ref, now) > VALIDITE_DEVIS_JOURS) return "expire";
  return "envoye";
}

/** Devis envoyé, sans réponse, encore dans les temps mais à relancer (> 7 j). */
export function devisARelancer(lead: Lead, now: number = Date.now()): boolean {
  const d = lead.devis;
  if (!d || d.statut !== "envoye") return false;
  const ref = d.envoye_le ?? d.date_creation;
  return Boolean(ref) && joursDepuis(ref, now) >= RELANCE_DEVIS_JOURS;
}

export function devisExpire(lead: Lead, now: number = Date.now()): boolean {
  return statutDevisAffiche(lead, now) === "expire";
}

// ── Statut d'AFFICHAGE dérivé de la facture ─────────────────────────────────
export type StatutFactureAffiche =
  | "brouillon"
  | "envoyee"
  | "payee"
  | "en_retard";

export const STATUT_FACTURE_LABEL: Record<StatutFactureAffiche, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
};

/**
 * Facture en retard : facture émise, encore due, et passée le délai de paiement
 * (compté depuis l'envoi, à défaut depuis l'émission). Un dossier soldé par
 * Alma n'est jamais « en retard » (Alma a déjà payé VDE).
 */
export function factureEnRetard(lead: Lead, now: number = Date.now()): boolean {
  const f = lead.facture;
  if (!f || estSoldeAlma(lead)) return false;
  if (resteAPayer(lead) <= 0.005) return false;
  const ref = f.envoye_le ?? f.date_creation;
  return Boolean(ref) && joursDepuis(ref, now) > DELAI_PAIEMENT_JOURS;
}

/** Statut affiché de la facture (dérivé du registre + de l'âge). */
export function statutFactureAffiche(
  lead: Lead,
  now: number = Date.now(),
): StatutFactureAffiche | null {
  const f = lead.facture;
  if (!f) return null;
  if (estSolde(lead)) return "payee";
  if (factureEnRetard(lead, now)) return "en_retard";
  if (f.envoye_le) return "envoyee";
  return "brouillon";
}

// ── « Transformer en facture » : transition autorisée ? (raison sinon) ───────
export interface Transition {
  ok: boolean;
  raison?: string;
}

/** Miroir exact de la garde `generateFacture` du store — mais côté UI, avec la
 *  RAISON à afficher sur le bouton grisé (« pourquoi c'est bloqué »). */
export function peutTransformerEnFacture(lead: Lead): Transition {
  if (!lead.devis) return { ok: false, raison: "Aucun devis à transformer." };
  if (lead.devis.statut !== "signe")
    return { ok: false, raison: "Le devis doit d'abord être accepté (signé)." };
  if (lead.facture)
    return { ok: false, raison: "Une facture a déjà été émise pour ce dossier." };
  if ((lead.factures_acompte?.length ?? 0) > 0)
    return {
      ok: false,
      raison: "Dossier avec acomptes : clôture par la facture de solde.",
    };
  return { ok: true };
}

// ── Le « prochain geste » (une seule action évidente par dossier) ────────────
export type Ton = "neutre" | "brand" | "attention" | "alerte" | "succes";

export interface Geste {
  cle: string;
  label: string;
  ton: Ton;
}

/**
 * L'unique prochaine action qui fait avancer le dossier, dérivée de l'état réel.
 * Sert le bandeau « bien rangé » de la fiche et le signal des listes.
 */
export function prochainGeste(lead: Lead, now: number = Date.now()): Geste {
  if (lead.statut === "perdu") return { cle: "perdu", label: "Dossier perdu", ton: "neutre" };
  if (estSolde(lead)) return { cle: "solde", label: "Dossier soldé — rien à faire", ton: "succes" };

  const d = lead.devis;
  if (!d) return { cle: "creer_devis", label: "Créer le devis", ton: "brand" };
  if (d.statut === "brouillon")
    return { cle: "envoyer_devis", label: "Finaliser et envoyer le devis", ton: "brand" };

  if (d.statut === "envoye") {
    if (devisExpire(lead, now))
      return { cle: "devis_expire", label: "Devis expiré — relancer ou clôturer", ton: "alerte" };
    if (devisARelancer(lead, now))
      return { cle: "relancer_devis", label: "Relancer le client (sans réponse)", ton: "attention" };
    return { cle: "attente_reponse", label: "En attente de réponse du client", ton: "neutre" };
  }

  // Devis accepté (signé) à partir d'ici.
  if (!aEncaissement(lead))
    return { cle: "encaisser_acompte", label: "Encaisser l'acompte", ton: "brand" };
  if (lead.statut !== "planifie" && lead.statut !== "installe" && lead.statut !== "sav")
    return { cle: "planifier_rdv", label: "Planifier le RDV d'installation", ton: "brand" };
  if (lead.statut === "planifie")
    return { cle: "installer", label: "Réaliser l'installation", ton: "neutre" };
  // Installé / SAV, non soldé.
  if (peutGenererSolde(lead))
    return { cle: "generer_solde", label: "Générer la facture de solde", ton: "brand" };
  if (factureEnRetard(lead, now))
    return { cle: "relancer_solde", label: "Relancer le solde (facture en retard)", ton: "alerte" };
  return { cle: "encaisser_solde", label: "Encaisser le solde", ton: "attention" };
}

// ── Signaux d'exception (ce qui demande une action remonte tout seul) ────────
export interface Signal {
  cle: string;
  label: string;
  ton: Ton;
}

/**
 * Anomalies/relances du dossier, exposées sur la fiche ET la liste (elles
 * alimenteront le futur Tour de contrôle — non construit ici). Jamais d'action
 * automatique : on EXPOSE, l'humain décide.
 */
export function signauxException(lead: Lead, now: number = Date.now()): Signal[] {
  const out: Signal[] = [];
  if (lead.statut === "perdu" || estSolde(lead)) return out;

  if (devisExpire(lead, now)) out.push({ cle: "devis_expire", label: "Devis expiré", ton: "alerte" });
  else if (devisARelancer(lead, now)) out.push({ cle: "a_relancer", label: "À relancer", ton: "attention" });

  if (lead.devis?.statut === "signe" && !aEncaissement(lead))
    out.push({ cle: "signe_sans_acompte", label: "Signé sans acompte", ton: "attention" });

  if (lead.statut === "installe" && peutGenererSolde(lead))
    out.push({ cle: "solde_a_generer", label: "Solde à générer", ton: "attention" });

  if (factureEnRetard(lead, now))
    out.push({ cle: "facture_en_retard", label: "Facture en retard", ton: "alerte" });

  return out;
}
