/**
 * Banc d'essai de la machine à états du dossier (lib/leads/etats.ts) — vrai code,
 * exécuté via tsx (résolution des alias `@/` par tsconfig). On teste les seuils
 * temporels (30 j / 7 j), le prochain geste, la transition « Transformer en
 * facture » (+ raison) et les INVARIANTS du cycle de vie.
 *
 * Ancre temporelle FIXE (pas de Date.now()) : les seuils sont déterministes.
 */
import type { Devis, Facture, Lead, Reglement } from "@/lib/types";
import {
  devisARelancer,
  devisExpire,
  peutTransformerEnFacture,
  prochainGeste,
  statutApresAcompte,
  statutDevisAffiche,
} from "@/lib/leads/etats";
import {
  aEncaissement,
  estSolde,
  peutGenererSolde,
  resteAPayer,
} from "@/lib/leads/reglements";

let pass = 0;
let fail = 0;
const echecs: string[] = [];
function verifie(nom: string, cond: boolean, detail = ""): void {
  if (cond) {
    pass++;
    console.log(`  OK   ${nom}`);
  } else {
    fail++;
    echecs.push(nom);
    console.log(`  FAIL ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = new Date("2026-07-24T12:00:00.000Z").getTime();
const JOUR = 86_400_000;
const ilYA = (jours: number) => new Date(NOW - jours * JOUR).toISOString();

function mkDevis(o: Partial<Devis> = {}): Devis {
  return {
    ref: "VDE-2026-001",
    entite: "FR",
    devise: "EUR",
    date_creation: ilYA(1),
    lignes: [],
    montant_ht: 1000,
    mode_tva: "fr_5_5",
    taux_tva: 0.055,
    montant_tva: 55,
    montant_ttc: 1055,
    statut: "envoye",
    ...o,
  } as Devis;
}

function mkFac(o: Partial<Facture> = {}): Facture {
  return {
    ref: "FAC-2026-001",
    entite: "FR",
    devise: "EUR",
    date_creation: ilYA(1),
    devis_ref: "VDE-2026-001",
    type: "acompte",
    lignes: [],
    montant_ht: 300,
    mode_tva: "fr_5_5",
    taux_tva: 0.055,
    montant_tva: 16.5,
    montant_ttc: 316.5,
    ...o,
  } as Facture;
}

const reglement = (montant: number, mode: Reglement["mode"] = "virement"): Reglement => ({
  id: "R1",
  lead_id: "FB-001",
  entite: "FR",
  montant,
  mode,
  facture_acompte_ref: null,
  encaisse_le: ilYA(0),
  auteur: "Test",
});

function mkLead(o: Partial<Lead> = {}): Lead {
  return {
    id: "FB-001",
    entite: "FR",
    nom: "Client Test",
    telephone: "0600000000",
    statut: "devis_envoye",
    temperature: "tiede",
    canal: "manuel",
    date_reception: ilYA(10),
    created_at: ilYA(10),
    updated_at: ilYA(1),
    statut_change_at: ilYA(1),
    archived: false,
    reglements: [],
    ...o,
  } as unknown as Lead;
}

// ── statutDevisAffiche + seuils 30 j / 7 j ──────────────────────────────────
console.log("=== statutDevisAffiche — seuils 30 j / 7 j ===");
verifie("brouillon → brouillon",
  statutDevisAffiche(mkLead({ devis: mkDevis({ statut: "brouillon" }) }), NOW) === "brouillon");
verifie("signé → accepté",
  statutDevisAffiche(mkLead({ devis: mkDevis({ statut: "signe" }) }), NOW) === "accepte");
{
  const l = mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(2) }) });
  verifie("envoyé 2 j → envoyé", statutDevisAffiche(l, NOW) === "envoye");
  verifie("envoyé 2 j → PAS à relancer (< 7 j)", devisARelancer(l, NOW) === false);
}
{
  const l = mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(8) }) });
  verifie("envoyé 8 j → envoyé", statutDevisAffiche(l, NOW) === "envoye");
  verifie("envoyé 8 j → à relancer (≥ 7 j)", devisARelancer(l, NOW) === true);
}
verifie("envoyé pile 7 j → à relancer (seuil inclus)",
  devisARelancer(mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(7) }) }), NOW) === true);
verifie("envoyé pile 30 j → PAS expiré (seuil strict)",
  statutDevisAffiche(mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(30) }) }), NOW) === "envoye");
{
  const l = mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(31) }) });
  verifie("envoyé 31 j → expiré", statutDevisAffiche(l, NOW) === "expire");
  verifie("devisExpire(31 j) = true", devisExpire(l, NOW) === true);
}
verifie("fallback date_creation (envoye_le absent) → expiré à 31 j",
  statutDevisAffiche(mkLead({ devis: mkDevis({ statut: "envoye", envoye_le: null, date_creation: ilYA(31) }) }), NOW) === "expire");

// ── prochainGeste — la séquence du dossier ──────────────────────────────────
console.log("\n=== prochainGeste — la séquence du dossier ===");
const geste = (o: Partial<Lead>) => prochainGeste(mkLead(o), NOW).cle;
verifie("aucun devis → creer_devis", geste({ devis: undefined }) === "creer_devis");
verifie("devis brouillon → envoyer_devis", geste({ devis: mkDevis({ statut: "brouillon" }) }) === "envoyer_devis");
verifie("envoyé récent → attente_reponse", geste({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(2) }) }) === "attente_reponse");
verifie("envoyé 8 j → relancer_devis", geste({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(8) }) }) === "relancer_devis");
verifie("envoyé 31 j → devis_expire", geste({ devis: mkDevis({ statut: "envoye", envoye_le: ilYA(31) }) }) === "devis_expire");
verifie("signé sans acompte → encaisser_acompte", geste({ statut: "signe", devis: mkDevis({ statut: "signe" }) }) === "encaisser_acompte");
verifie("signé + acompte → planifier_rdv",
  geste({ statut: "signe", devis: mkDevis({ statut: "signe" }), reglements: [reglement(300)] }) === "planifier_rdv");
verifie("planifié → installer",
  geste({ statut: "planifie", devis: mkDevis({ statut: "signe" }), reglements: [reglement(300)] }) === "installer");
verifie("installé + solde dû + acompte facturé → generer_solde",
  geste({
    statut: "installe",
    devis: mkDevis({ statut: "signe", montant_ttc: 1055 }),
    reglements: [reglement(316.5)],
    factures_acompte: [mkFac()],
  }) === "generer_solde");
verifie("soldé (100 %) → solde",
  geste({ statut: "installe", devis: mkDevis({ statut: "signe", montant_ttc: 1055 }), reglements: [reglement(1055)] }) === "solde");
verifie("perdu → perdu", geste({ statut: "perdu", devis: mkDevis({ statut: "envoye" }) }) === "perdu");

// ── peutTransformerEnFacture — transition + raison ──────────────────────────
console.log("\n=== peutTransformerEnFacture — transition + raison ===");
{
  const r = peutTransformerEnFacture(mkLead({ devis: undefined }));
  verifie("aucun devis → refusé + raison", r.ok === false && /aucun devis/i.test(r.raison ?? ""), r.raison);
}
{
  const r = peutTransformerEnFacture(mkLead({ devis: mkDevis({ statut: "envoye" }) }));
  verifie("devis non accepté → refusé + raison « accepté »", r.ok === false && /accept/i.test(r.raison ?? ""), r.raison);
}
{
  const r = peutTransformerEnFacture(mkLead({ statut: "signe", devis: mkDevis({ statut: "signe" }) }));
  verifie("devis accepté, sans facture ni acompte → autorisé", r.ok === true && r.raison === undefined);
}
{
  const r = peutTransformerEnFacture(mkLead({ statut: "signe", devis: mkDevis({ statut: "signe" }), facture: mkFac({ type: "normale" }) }));
  verifie("facture déjà émise → refusé + raison", r.ok === false && /émise/i.test(r.raison ?? ""), r.raison);
}
{
  const r = peutTransformerEnFacture(mkLead({ statut: "signe", devis: mkDevis({ statut: "signe" }), factures_acompte: [mkFac()] }));
  verifie("dossier avec acomptes → refusé (→ facture de solde)", r.ok === false && /solde/i.test(r.raison ?? ""), r.raison);
}

// ── Invariants du cycle de vie ──────────────────────────────────────────────
console.log("\n=== Invariants du cycle de vie ===");
// (a) acompte → devis Accepté, SANS régression du pipeline
verifie("devis_envoye → signe (acompte accepte)", statutApresAcompte("devis_envoye") === "signe");
verifie("nouveau → signe", statutApresAcompte("nouveau") === "signe");
verifie("qualifie → signe", statutApresAcompte("qualifie") === "signe");
verifie("planifie → planifie (aucune régression)", statutApresAcompte("planifie") === "planifie");
verifie("installe → installe (aucune régression)", statutApresAcompte("installe") === "installe");
verifie("sav → sav (aucune régression)", statutApresAcompte("sav") === "sav");

// (b) pas d'acompte, pas de RDV : aEncaissement est la porte
verifie("sans règlement → aEncaissement false (RDV bloqué)", aEncaissement(mkLead({ reglements: [] })) === false);
verifie("avec règlement → aEncaissement true (RDV possible)", aEncaissement(mkLead({ reglements: [reglement(300)] })) === true);

// (c) solde ⇒ installé : peutGenererSolde exige le statut « installe »
{
  const base = {
    devis: mkDevis({ statut: "signe" as const, montant_ttc: 1055 }),
    reglements: [reglement(316.5)],
    factures_acompte: [mkFac()],
  };
  verifie("solde NON générable si pas installé (signé)", peutGenererSolde(mkLead({ ...base, statut: "signe" })) === false);
  verifie("solde générable une fois installé", peutGenererSolde(mkLead({ ...base, statut: "installe" })) === true);
}

// (d) soldé ⇒ reste = 0
{
  const l = mkLead({ statut: "installe", devis: mkDevis({ statut: "signe", montant_ttc: 1055 }), reglements: [reglement(1055)] });
  verifie("soldé (cumul) ⇒ estSolde && reste ≈ 0", estSolde(l) === true && resteAPayer(l) <= 0.005);
}
{
  const l = mkLead({ statut: "installe", devis: mkDevis({ statut: "signe", montant_ttc: 1055 }), reglements: [reglement(1055, "alma")] });
  verifie("soldé Alma ⇒ estSolde && reste = 0", estSolde(l) === true && resteAPayer(l) === 0);
}
{
  const l = mkLead({ devis: mkDevis({ statut: "signe", montant_ttc: 1055 }), reglements: [reglement(300)] });
  verifie("reste dû ⇒ PAS soldé (contre-exemple)", estSolde(l) === false && resteAPayer(l) > 0.005);
}

console.log("\n============================================================");
console.log(`RÉSULTAT : ${pass} OK, ${fail} FAIL`);
if (fail > 0) {
  console.log("Échecs : " + echecs.join(" · "));
  process.exit(1);
}
