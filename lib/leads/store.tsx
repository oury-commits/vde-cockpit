"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Activite,
  ActiviteType,
  Canal,
  Devis,
  Echeance,
  Entite,
  Facture,
  JalonKey,
  Lead,
  ModeTva,
  MotifPerte,
  RdvInstall,
  RdvSync,
  RdvType,
  Reglement,
  ReglementMode,
  Statut,
  StatutEcheance,
  Visibilite,
} from "@/lib/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { JALONS_MANUELS, jalonActif } from "@/lib/leads/jalons";
import type { LeadDraft } from "@/lib/leads/csv";
import { nextRef } from "@/lib/leads/ref";
import {
  canonicalRef,
  noteStatutInconnu,
  parseStatutSource,
} from "@/lib/leads/appsheet";
import { scoreTemperature } from "@/lib/leads/scoring";
import { buildDevis, buildEcheancier } from "@/lib/leads/devis";
import { buildFacture } from "@/lib/leads/facture";
import {
  aEncaissement,
  buildFactureAcompte,
  buildFactureSolde,
  MODE_REGLEMENT_LABEL,
  peutGenererSolde,
} from "@/lib/leads/reglements";
import { reserveRef } from "@/lib/leads/sequences";
import { isSameContact } from "@/lib/leads/filters";
import { MEMBRES, STATUT_META, isLeadProtege } from "@/lib/leads/meta";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { peutVoirEntite } from "@/lib/roles/permissions";
import { formatDate, formatDateTime, formatMontant } from "@/lib/format";
import { uid } from "@/lib/uid";
import { getRepository, repositoryKind, seedState } from "@/lib/leads/repository";

/** Entrée créée manuellement ou via import. */
export type LeadInput = LeadDraft & {
  canal?: Canal;
  entite?: Entite;
  assigne_a?: string | null;
  statut?: Statut;
};

export interface ImportReport {
  imported: Lead[];
  duplicates: { draft: LeadDraft; existing: Lead }[];
}

interface StoreValue {
  loaded: boolean;
  isDemo: boolean;
  leads: Lead[];
  activites: Activite[];
  activitesFor: (leadId: string) => Activite[];
  addLead: (input: LeadInput) => { lead: Lead | null; duplicate?: Lead };
  importDrafts: (drafts: LeadDraft[]) => ImportReport;
  /**
   * Met à jour un lead. Si `versionAttendue` est fourni (édition utilisateur),
   * l'écriture est gardée : elle échoue au lieu d'écraser le travail d'un
   * collègue passé entre-temps.
   */
  updateLead: (
    id: string,
    patch: Partial<Lead>,
    versionAttendue?: number,
  ) => Promise<{ ok: true } | { ok: false; auteur: string | null }>;
  deleteLead: (id: string) => void;
  deleteLeads: (ids: string[]) => void;
  /** Archive un lead (conserve la pièce comptable au lieu de la détruire). */
  archiveLead: (id: string) => void;
  /**
   * Change le statut. Renvoie false si la transition est refusée (verrou RDV :
   * passage à « planifié » sans encaissement).
   */
  changeStatut: (id: string, statut: Statut, motif?: MotifPerte) => boolean;
  /**
   * Confirme (ou reprogramme) le RDV d'installation : capture date + technicien
   * assigné et passe le lead à « planifié ». Même verrou que `changeStatut` —
   * renvoie false si aucun acompte n'est encaissé. La synchro Google est un
   * effet de bord séparé, best-effort (voir `setRdvSync`).
   */
  confirmerRdv: (
    leadId: string,
    input: {
      type: RdvType;
      debut: string;
      fin: string;
      technicien_id: string;
      technicien_nom: string;
      technicien_email: string;
    },
  ) => boolean;
  /** Reporte l'état de synchro Google d'un RDV (id d'événement + statut). */
  setRdvSync: (
    leadId: string,
    sync: RdvSync,
    google_event_id?: string | null,
  ) => void;
  /** Annule le RDV : repasse le lead à « signé », efface le RDV, trace l'annulation. */
  annulerRdv: (leadId: string) => void;
  /** Enregistre le géocodage d'un lead (silencieux : ni timeline, ni verrou). */
  setLeadGeo: (leadId: string, lat: number, lng: number) => void;
  addActivite: (leadId: string, type: ActiviteType, contenu: string) => void;
  /** Note typée (appel / email / visite / note) avec portée interne ou client. */
  addNote: (
    leadId: string,
    type: ActiviteType,
    contenu: string,
    visibilite: Visibilite,
  ) => void;
  /** Coche / décoche un jalon manuel — décocher laisse une trace « annulé ». */
  toggleJalon: (leadId: string, jalon: JalonKey) => void;
  /** Passe le dossier à un collègue (assignation + trace). */
  transferer: (leadId: string, vers: string) => void;
  generateDevis: (leadId: string, mode?: ModeTva) => Promise<Devis | null>;
  /** Rattache un devis construit par le générateur (wizard) à un lead. */
  attachDevis: (leadId: string, devis: Devis, echeancier: Echeance[]) => void;
  markDevisEnvoye: (leadId: string) => void;
  /** Trace l'envoi d'un document au client (horodatage + statut + timeline). */
  recordEnvoi: (
    leadId: string,
    kind: "devis" | "facture",
    email: string,
  ) => void;
  signDevis: (leadId: string) => void;
  generateFacture: (leadId: string) => Promise<Facture | null>;
  setEcheanceStatut: (
    leadId: string,
    index: number,
    statut: StatutEcheance,
  ) => void;
  /**
   * Enregistre un encaissement (source de vérité du payé/reste). Un acompte VDE
   * émet une facture d'acompte numérotée ; un paiement Alma solde le dossier.
   */
  enregistrerReglement: (
    leadId: string,
    input: {
      montant: number;
      mode: ReglementMode;
      echeanceIndex?: number | null;
    },
  ) => Promise<Reglement | null>;
  /**
   * Génère la facture de solde (déduit les acomptes, régularise la TVA). Gatée :
   * renvoie null tant que l'installation n'est pas clôturée ou qu'il n'y a pas
   * de solde à facturer.
   */
  genererFactureSolde: (leadId: string) => Promise<Facture | null>;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Nom affiché de l'utilisateur courant, depuis son email de session. */
function displayName(email: string | null): string {
  if (!email) return MEMBRES[0]; // mode démo / auth désactivée
  const local = email.split("@")[0];
  const connu = MEMBRES.find((m) => m.toLowerCase() === local.toLowerCase());
  return connu ?? local.charAt(0).toUpperCase() + local.slice(1);
}

export function LeadsStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { identite } = useIdentity();
  const [loaded, setLoaded] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);

  // Hydratation via le repository actif (local en 2A, Supabase en 2B).
  useEffect(() => {
    let active = true;
    getRepository()
      .loadAll()
      .then((state) => {
        if (!active) return;
        setLeads(state.leads);
        setActivites(state.activites);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        const state = seedState();
        setLeads(state.leads);
        setActivites(state.activites);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Sauvegarde continue via le repository.
  useEffect(() => {
    if (!loaded) return;
    void getRepository().persistAll({ leads, activites });
  }, [loaded, leads, activites]);

  // Rien d'anonyme : l'auteur est l'utilisateur connecté (fallback démo).
  const auteur = useMemo(() => displayName(user?.email ?? null), [user?.email]);

  const pushActivite = useCallback(
    (
      leadId: string,
      type: ActiviteType,
      contenu: string,
      extra?: {
        jalon?: JalonKey | null;
        annule?: boolean;
        visibilite?: Visibilite | null;
      },
    ) => {
      setActivites((prev) => [
        {
          id: uid(),
          lead_id: leadId,
          type,
          contenu,
          auteur,
          created_at: new Date().toISOString(),
          ...extra,
        },
        ...prev,
      ]);
    },
    [auteur],
  );

  const makeLead = useCallback(
    (input: LeadInput, id: string): Lead => {
      const now = new Date().toISOString();
      const recv = input.date_reception ?? now;
      return {
        id,
        entite: input.entite ?? "FR",
        date_reception: recv,
        canal: input.canal ?? "manuel",
        source_campagne: input.source_campagne ?? null,
        nom: input.nom,
        telephone: input.telephone,
        email: input.email ?? null,
        adresse: input.adresse ?? null,
        code_postal: input.code_postal ?? null,
        ville: input.ville ?? null,
        type_logement: input.type_logement ?? null,
        type_vehicule: input.type_vehicule ?? null,
        puissance_souhaitee: input.puissance_souhaitee ?? null,
        distance_tableau: input.distance_tableau ?? null,
        eligible_advenir: input.eligible_advenir ?? null,
        reseau: input.reseau ?? null,
        puissance_compteur_kva: input.puissance_compteur_kva ?? null,
        occupation: input.occupation ?? null,
        emplacement: input.emplacement ?? null,
        fixation: input.fixation ?? null,
        obstacles: input.obstacles ?? null,
        budget: input.budget ?? null,
        delai: input.delai ?? null,
        pv_projet: input.pv_projet ?? null,
        pv_autre: null,
        temperature: scoreTemperature(input),
        statut: input.statut ?? "nouveau",
        montant_estime: input.montant_estime ?? null,
        devis: null,
        facture: null,
        echeancier: null,
        prochaine_action: null,
        date_relance: null,
        motif_perte: null,
        assigne_a: input.assigne_a ?? null,
        notes: input.notes ?? null,
        version: 0, // verrou optimiste : point de départ
        modifie_par: null,
        created_at: now,
        updated_at: now,
        statut_change_at: now,
      };
    },
    [],
  );

  const addLead = useCallback<StoreValue["addLead"]>(
    (input) => {
      const duplicate = leads.find((l) => isSameContact(l, input));
      if (duplicate) return { lead: null, duplicate };
      const id = nextRef(leads.map((l) => l.id));
      const lead = makeLead({ ...input, canal: input.canal ?? "manuel" }, id);
      setLeads((prev) => [lead, ...prev]);
      pushActivite(
        id,
        lead.canal === "manuel" ? "creation" : "import",
        lead.canal === "manuel" ? "Lead créé manuellement" : "Lead importé",
      );
      return { lead };
    },
    [leads, makeLead, pushActivite],
  );

  const importDrafts = useCallback<StoreValue["importDrafts"]>(
    (drafts) => {
      const report: ImportReport = { imported: [], duplicates: [] };
      const existing = [...leads];
      const newActivites: Activite[] = [];
      let ids = leads.map((l) => l.id);

      for (const draft of drafts) {
        const dup = existing.find((l) => isSameContact(l, draft));
        if (dup) {
          report.duplicates.push({ draft, existing: dup });
          continue;
        }
        // Conserve la ref d'origine (FB-XXX) si elle est exploitable et libre.
        const canon = canonicalRef(draft.ref);
        const id = canon && !ids.includes(canon) ? canon : nextRef(ids);
        ids = [...ids, id];

        // Statut d'origine mappé sur le pipeline ; inconnu → nouveau + note.
        const mapped = parseStatutSource(draft.statut_source);
        const lead = makeLead(
          { ...draft, canal: "import", statut: mapped ?? undefined },
          id,
        );
        if (!mapped && draft.statut_source) {
          lead.notes = [lead.notes, noteStatutInconnu(draft.statut_source)]
            .filter(Boolean)
            .join("\n");
        }
        report.imported.push(lead);
        existing.push(lead);
        newActivites.push({
          id: uid(),
          lead_id: id,
          type: "import",
          contenu: "Lead importé (CSV Facebook)",
          auteur: "Système",
          created_at: lead.created_at,
        });
      }

      if (report.imported.length > 0) {
        setLeads((prev) => [...report.imported, ...prev]);
        setActivites((prev) => [...newActivites, ...prev]);
      }
      return report;
    },
    [leads, makeLead],
  );

  const updateLead = useCallback<StoreValue["updateLead"]>(
    async (id, patch, versionAttendue) => {
      // Édition utilisateur → écriture gardée (verrou optimiste).
      if (versionAttendue !== undefined) {
        const res = await getRepository().updateLeadGuarded(
          id,
          patch,
          versionAttendue,
          auteur,
        );
        if (!res.ok) return { ok: false, auteur: res.auteur };
        setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
        return { ok: true };
      }
      // Écriture interne (sans conflit possible côté utilisateur).
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                ...patch,
                version: (l.version ?? 0) + 1,
                modifie_par: auteur,
                updated_at: new Date().toISOString(),
              }
            : l,
        ),
      );
      return { ok: true };
    },
    [auteur],
  );

  const deleteLead = useCallback<StoreValue["deleteLead"]>(
    (id) => {
      const lead = leads.find((l) => l.id === id);
      if (lead && isLeadProtege(lead)) return; // pièce comptable : jamais détruite
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setActivites((prev) => prev.filter((a) => a.lead_id !== id));
      void getRepository().deleteLead(id);
    },
    [leads],
  );

  const deleteLeads = useCallback<StoreValue["deleteLeads"]>(
    (ids) => {
      if (ids.length === 0) return;
      // On ne détruit jamais un lead protégé (devis signé / facture émise).
      const protege = new Set(
        leads.filter(isLeadProtege).map((l) => l.id),
      );
      const target = ids.filter((id) => !protege.has(id));
      if (target.length === 0) return;
      const set = new Set(target);
      setLeads((prev) => prev.filter((l) => !set.has(l.id)));
      setActivites((prev) => prev.filter((a) => !set.has(a.lead_id)));
      void getRepository().deleteLeads(target);
    },
    [leads],
  );

  const addNote = useCallback<StoreValue["addNote"]>(
    (leadId, type, contenu, visibilite) => {
      pushActivite(leadId, type, contenu, { visibilite });
    },
    [pushActivite],
  );

  const toggleJalon = useCallback<StoreValue["toggleJalon"]>(
    (leadId, jalon) => {
      const meta = JALONS_MANUELS.find((j) => j.key === jalon);
      if (!meta) return;
      const duLead = activites
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const actif = jalonActif(duLead, jalon);
      // Le type d'activité suit le jalon (icône cohérente dans la timeline).
      const type: ActiviteType = jalon === "relance" ? "relance" : jalon;
      pushActivite(
        leadId,
        type,
        actif ? `${meta.fait} — annulé` : meta.fait,
        { jalon, annule: actif },
      );
    },
    [activites, pushActivite],
  );

  const transferer = useCallback<StoreValue["transferer"]>(
    (leadId, vers) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.assigne_a === vers) return;
      const de = lead.assigne_a ?? "non assigné";
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, assigne_a: vers, updated_at: new Date().toISOString() }
            : l,
        ),
      );
      pushActivite(leadId, "statut", `Dossier transféré de ${de} à ${vers}`);
    },
    [leads, pushActivite],
  );

  const archiveLead = useCallback<StoreValue["archiveLead"]>(
    (id) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, archived: true, updated_at: new Date().toISOString() }
            : l,
        ),
      );
      pushActivite(id, "note", "Lead archivé — pièce comptable conservée");
    },
    [pushActivite],
  );

  const changeStatut = useCallback<StoreValue["changeStatut"]>(
    (id, statut, motif) => {
      const lead = leads.find((l) => l.id === id);
      // « Pas d'acompte, pas de RDV » : on ne confirme pas le RDV d'installation
      // (passage à « planifié ») tant qu'aucun encaissement n'existe. Bloqué au
      // niveau du store, pas seulement masqué dans l'UI.
      if (statut === "planifie" && lead && !aEncaissement(lead)) {
        return false;
      }
      const now = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                statut,
                motif_perte: statut === "perdu" ? (motif ?? "autre") : null,
                statut_change_at: now,
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(
        id,
        "statut",
        `Statut → ${STATUT_META[statut].label}${
          statut === "perdu" && motif ? ` (${motif})` : ""
        }`,
      );
      return true;
    },
    [leads, pushActivite],
  );

  const confirmerRdv = useCallback<StoreValue["confirmerRdv"]>(
    (leadId, input) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return false;
      // Même verrou que changeStatut : « pas d'acompte, pas de RDV ».
      if (!aEncaissement(lead)) return false;
      const reprog = Boolean(lead.rdv);
      const now = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                statut: "planifie",
                statut_change_at: l.statut === "planifie" ? l.statut_change_at : now,
                rdv: {
                  type: input.type,
                  debut: input.debut,
                  fin: input.fin,
                  technicien_id: input.technicien_id,
                  technicien_nom: input.technicien_nom,
                  technicien_email: input.technicien_email,
                  // On conserve l'id d'événement en reprogrammation : l'appelant
                  // fera un UPDATE (pas un doublon). Synchro remise à « à faire ».
                  google_event_id: l.rdv?.google_event_id ?? null,
                  sync: "non_synchronise",
                },
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(
        leadId,
        "rdv",
        `RDV ${reprog ? "reprogrammé" : "posé"} pour ${input.technicien_nom} le ${formatDateTime(input.debut)}`,
      );
      return true;
    },
    [leads, pushActivite],
  );

  const setRdvSync = useCallback<StoreValue["setRdvSync"]>(
    (leadId, sync, google_event_id) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId && l.rdv
            ? {
                ...l,
                rdv: {
                  ...l.rdv,
                  sync,
                  google_event_id:
                    google_event_id !== undefined
                      ? google_event_id
                      : l.rdv.google_event_id,
                },
              }
            : l,
        ),
      );
    },
    [],
  );

  const annulerRdv = useCallback<StoreValue["annulerRdv"]>(
    (leadId) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      const now = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                // Retour à « signé » : devis signé + acompte encaissé, RDV à reposer.
                statut: l.statut === "planifie" ? "signe" : l.statut,
                rdv: null,
                statut_change_at: now,
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(
        leadId,
        "rdv",
        `RDV annulé${lead.rdv ? ` (${lead.rdv.technicien_nom})` : ""}`,
      );
    },
    [leads, pushActivite],
  );

  const setLeadGeo = useCallback<StoreValue["setLeadGeo"]>((leadId, lat, lng) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, lat, lng } : l)),
    );
  }, []);

  const generateDevis = useCallback<StoreValue["generateDevis"]>(
    async (leadId, mode) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;
      // Numéro réservé atomiquement au compteur (jamais recalculé).
      const ref = await reserveRef(lead.entite, "devis");
      const devis = buildDevis(lead, ref, new Date().toISOString(), lead.entite, mode);
      const now = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                devis,
                statut: l.statut === "nouveau" || l.statut === "a_qualifier" || l.statut === "qualifie"
                  ? "devis_envoye"
                  : l.statut,
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(leadId, "devis", `Devis ${ref} généré`);
      return devis;
    },
    [leads, pushActivite],
  );

  const attachDevis = useCallback<StoreValue["attachDevis"]>(
    (leadId, devis, echeancier) => {
      const now = new Date().toISOString();
      // Un brouillon n'avance pas le pipeline ; un devis validé (envoye) oui.
      const advance = devis.statut === "envoye";
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                devis,
                echeancier,
                statut:
                  advance &&
                  (l.statut === "nouveau" ||
                    l.statut === "a_qualifier" ||
                    l.statut === "qualifie")
                    ? "devis_envoye"
                    : l.statut,
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(
        leadId,
        "devis",
        `Devis ${devis.ref} ${advance ? "validé" : "en brouillon"} (générateur)`,
      );
    },
    [pushActivite],
  );

  const recordEnvoi = useCallback<StoreValue["recordEnvoi"]>(
    (leadId, kind, email) => {
      const lead = leads.find((l) => l.id === leadId);
      const doc = kind === "devis" ? lead?.devis : lead?.facture;
      if (!lead || !doc) return;
      const now = new Date().toISOString();

      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          if (kind === "devis" && l.devis) {
            return {
              ...l,
              devis: {
                ...l.devis,
                // Un devis signé ne redescend pas à « envoyé ».
                statut: l.devis.statut === "signe" ? "signe" : "envoye",
                envoye_le: now,
                envoye_a: email,
              },
              statut:
                l.statut === "nouveau" ||
                l.statut === "a_qualifier" ||
                l.statut === "qualifie"
                  ? "devis_envoye"
                  : l.statut,
              updated_at: now,
            };
          }
          if (kind === "facture" && l.facture) {
            return {
              ...l,
              facture: { ...l.facture, envoye_le: now, envoye_a: email },
              updated_at: now,
            };
          }
          return l;
        }),
      );

      // Alimente les relances (« envoyé, pas de réponse à J+2 »).
      pushActivite(
        leadId,
        "devis",
        `${kind === "devis" ? "Devis" : "Facture"} ${doc.ref} envoyé à ${email} le ${formatDate(now)}`,
      );
    },
    [leads, pushActivite],
  );

  const markDevisEnvoye = useCallback<StoreValue["markDevisEnvoye"]>(
    (leadId) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId && l.devis
            ? {
                ...l,
                devis: { ...l.devis, statut: "envoye" },
                statut: "devis_envoye",
                updated_at: new Date().toISOString(),
              }
            : l,
        ),
      );
      pushActivite(leadId, "devis", "Devis marqué comme envoyé");
    },
    [pushActivite],
  );

  const signDevis = useCallback<StoreValue["signDevis"]>(
    (leadId) => {
      const now = new Date().toISOString();
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId || !l.devis) return l;
          // On NE réécrit pas l'échéancier choisi dans le wizard : on ne le crée
          // que s'il manque (chemin « générer le devis » en 1 clic).
          const echeancier =
            l.echeancier && l.echeancier.length > 0
              ? l.echeancier
              : buildEcheancier(l.devis.montant_ttc);
          return {
            ...l,
            devis: { ...l.devis, statut: "signe" },
            echeancier,
            statut: "signe",
            statut_change_at: now,
            updated_at: now,
          };
        }),
      );
      pushActivite(leadId, "signature", "Devis signé — échéancier d'acomptes prêt");
    },
    [pushActivite],
  );

  const generateFacture = useCallback<StoreValue["generateFacture"]>(
    async (leadId) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || !lead.devis || lead.devis.statut !== "signe") return null;
      if (lead.facture) return lead.facture; // déjà émise (numérotation unique)
      // Défense : un dossier avec acomptes se clôture par une facture de SOLDE
      // (genererFactureSolde), pas une facture normale — sinon on facturerait le
      // total une 2e fois. Le numéro n'est réservé qu'après cette garde.
      if ((lead.factures_acompte?.length ?? 0) > 0) return null;
      // Facture = séquence continue par entité, réservée à l'émission.
      const ref = await reserveRef(lead.entite, "facture");
      const facture = buildFacture(lead.devis, ref, new Date().toISOString());
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, facture, updated_at: new Date().toISOString() }
            : l,
        ),
      );
      pushActivite(leadId, "devis", `Facture ${ref} générée depuis ${lead.devis.ref}`);
      return facture;
    },
    [leads, pushActivite],
  );

  const setEcheanceStatut = useCallback<StoreValue["setEcheanceStatut"]>(
    (leadId, index, statut) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId || !l.echeancier) return l;
          const echeancier = l.echeancier.map((e, i) =>
            i === index
              ? {
                  ...e,
                  statut,
                  date_encaissement:
                    statut === "encaisse" ? new Date().toISOString() : null,
                }
              : e,
          );
          return { ...l, echeancier, updated_at: new Date().toISOString() };
        }),
      );
      const labels: Record<StatutEcheance, string> = {
        attendu: "en attente",
        encaisse: "encaissée",
        en_retard: "en retard",
      };
      pushActivite(leadId, "paiement", `Échéance ${index + 1} — ${labels[statut]}`);
    },
    [pushActivite],
  );

  const enregistrerReglement = useCallback<StoreValue["enregistrerReglement"]>(
    async (leadId, input) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || !lead.devis) return null;
      const montant = Math.round((input.montant + Number.EPSILON) * 100) / 100;
      if (montant <= 0) return null;
      const now = new Date().toISOString();

      // Un acompte VDE encaissé exige une facture d'acompte (Art. 289 CGI), donc
      // un numéro de la série factures. Un paiement Alma n'est PAS un acompte :
      // Alma paie VDE en une fois → pas de facture d'acompte à ce stade.
      let factureAcompte: Facture | null = null;
      let factureRef: string | null = null;
      if (input.mode !== "alma") {
        factureRef = await reserveRef(lead.entite, "facture");
        factureAcompte = buildFactureAcompte(lead.devis, montant, factureRef, now);
      }

      const reglement: Reglement = {
        id: uid(),
        lead_id: leadId,
        entite: lead.entite,
        montant,
        mode: input.mode,
        facture_acompte_ref: factureRef,
        encaisse_le: now,
        auteur,
      };

      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const reglements = [...(l.reglements ?? []), reglement];
          const factures_acompte = factureAcompte
            ? [...(l.factures_acompte ?? []), factureAcompte]
            : (l.factures_acompte ?? null);
          // Alma solde tout : chaque échéance passe encaissée. Sinon on marque
          // l'échéance visée (ou la première encore attendue).
          let echeancier = l.echeancier ?? null;
          if (echeancier) {
            if (input.mode === "alma") {
              echeancier = echeancier.map((e) => ({
                ...e,
                statut: "encaisse" as const,
                date_encaissement: e.date_encaissement ?? now,
              }));
            } else {
              const cible =
                input.echeanceIndex ??
                echeancier.findIndex((e) => e.statut !== "encaisse");
              echeancier = echeancier.map((e, i) =>
                i === cible
                  ? { ...e, statut: "encaisse" as const, date_encaissement: now }
                  : e,
              );
            }
          }
          return {
            ...l,
            reglements,
            factures_acompte,
            echeancier,
            updated_at: now,
          };
        }),
      );

      const modeLabel = MODE_REGLEMENT_LABEL[input.mode];
      pushActivite(
        leadId,
        "paiement",
        input.mode === "alma"
          ? `Paiement Alma encaissé (${formatMontant(montant, lead.devis.devise, { cents: true })}) — dossier soldé`
          : `Règlement ${formatMontant(montant, lead.devis.devise, { cents: true })} (${modeLabel})${factureRef ? ` — facture d'acompte ${factureRef}` : ""}`,
      );
      return reglement;
    },
    [leads, auteur, pushActivite],
  );

  const genererFactureSolde = useCallback<StoreValue["genererFactureSolde"]>(
    async (leadId) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;
      // Gate installation + solde réellement dû (Bloc C).
      if (!peutGenererSolde(lead)) return null;
      const ref = await reserveRef(lead.entite, "facture");
      const facture = buildFactureSolde(lead, ref, new Date().toISOString());
      if (!facture) return null;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, facture, updated_at: new Date().toISOString() }
            : l,
        ),
      );
      const n = facture.acomptes_deduits?.length ?? 0;
      pushActivite(
        leadId,
        "devis",
        `Facture de solde ${ref} générée — ${n} acompte${n > 1 ? "s" : ""} déduit${n > 1 ? "s" : ""} (${formatMontant(facture.montant_ttc, facture.devise, { cents: true })} à payer)`,
      );
      return facture;
    },
    [leads, pushActivite],
  );

  const resetDemo = useCallback(() => {
    const state = seedState();
    setLeads(state.leads);
    setActivites(state.activites);
  }, []);

  const activitesFor = useCallback(
    (leadId: string) =>
      activites
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [activites],
  );

  /**
   * Cloisonnement à la SOURCE : le store n'expose que les dossiers du périmètre
   * de l'utilisateur. Une seule barrière au lieu d'une par écran — la fiche, le
   * drawer, le wizard et les KPI en héritent, y compris sur une URL forcée.
   * (Le verrou définitif sera la RLS Supabase en P3 ; ceci est son pendant UI.)
   */
  const leadsVisibles = useMemo(
    () => leads.filter((l) => peutVoirEntite(identite, l.entite)),
    [leads, identite],
  );

  const value = useMemo<StoreValue>(
    () => ({
      loaded,
      isDemo: repositoryKind === "local",
      leads: leadsVisibles,
      activites,
      activitesFor,
      addLead,
      importDrafts,
      updateLead,
      deleteLead,
      deleteLeads,
      archiveLead,
      changeStatut,
      confirmerRdv,
      setRdvSync,
      annulerRdv,
      setLeadGeo,
      addActivite: pushActivite,
      addNote,
      toggleJalon,
      transferer,
      generateDevis,
      attachDevis,
      markDevisEnvoye,
      recordEnvoi,
      signDevis,
      generateFacture,
      setEcheanceStatut,
      enregistrerReglement,
      genererFactureSolde,
      resetDemo,
    }),
    [
      loaded,
      leadsVisibles,
      activites,
      activitesFor,
      addLead,
      importDrafts,
      updateLead,
      deleteLead,
      deleteLeads,
      archiveLead,
      changeStatut,
      confirmerRdv,
      setRdvSync,
      annulerRdv,
      setLeadGeo,
      pushActivite,
      addNote,
      toggleJalon,
      transferer,
      generateDevis,
      attachDevis,
      markDevisEnvoye,
      recordEnvoi,
      signDevis,
      generateFacture,
      setEcheanceStatut,
      enregistrerReglement,
      genererFactureSolde,
      resetDemo,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useLeadsStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useLeadsStore doit être utilisé dans <LeadsStoreProvider>");
  }
  return ctx;
}
