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
  Lead,
  ModeTva,
  MotifPerte,
  Statut,
  StatutEcheance,
} from "@/lib/types";
import type { LeadDraft } from "@/lib/leads/csv";
import { nextRef } from "@/lib/leads/ref";
import {
  canonicalRef,
  noteStatutInconnu,
  parseStatutSource,
} from "@/lib/leads/appsheet";
import { scoreTemperature } from "@/lib/leads/scoring";
import { buildDevis, buildEcheancier, nextDevisRef } from "@/lib/leads/devis";
import { buildFacture, nextFactureRef } from "@/lib/leads/facture";
import { isSameContact } from "@/lib/leads/filters";
import { STATUT_META } from "@/lib/leads/meta";
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
  updateLead: (id: string, patch: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  deleteLeads: (ids: string[]) => void;
  changeStatut: (id: string, statut: Statut, motif?: MotifPerte) => void;
  addActivite: (leadId: string, type: ActiviteType, contenu: string) => void;
  generateDevis: (leadId: string, mode?: ModeTva) => Devis | null;
  /** Rattache un devis construit par le générateur (wizard) à un lead. */
  attachDevis: (leadId: string, devis: Devis, echeancier: Echeance[]) => void;
  markDevisEnvoye: (leadId: string) => void;
  signDevis: (leadId: string) => void;
  generateFacture: (leadId: string) => Facture | null;
  setEcheanceStatut: (
    leadId: string,
    index: number,
    statut: StatutEcheance,
  ) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function LeadsStoreProvider({ children }: { children: ReactNode }) {
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

  const pushActivite = useCallback(
    (leadId: string, type: ActiviteType, contenu: string) => {
      setActivites((prev) => [
        {
          id: uid(),
          lead_id: leadId,
          type,
          contenu,
          auteur: "Oury",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
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

  const updateLead = useCallback<StoreValue["updateLead"]>((id, patch) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, ...patch, updated_at: new Date().toISOString() }
          : l,
      ),
    );
  }, []);

  const deleteLead = useCallback<StoreValue["deleteLead"]>((id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setActivites((prev) => prev.filter((a) => a.lead_id !== id));
    void getRepository().deleteLead(id);
  }, []);

  const deleteLeads = useCallback<StoreValue["deleteLeads"]>((ids) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    setLeads((prev) => prev.filter((l) => !set.has(l.id)));
    setActivites((prev) => prev.filter((a) => !set.has(a.lead_id)));
    void getRepository().deleteLeads(ids);
  }, []);

  const changeStatut = useCallback<StoreValue["changeStatut"]>(
    (id, statut, motif) => {
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
    },
    [pushActivite],
  );

  const generateDevis = useCallback<StoreValue["generateDevis"]>(
    (leadId, mode) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;
      const existingRefs = leads
        .map((l) => l.devis?.ref)
        .filter((r): r is string => Boolean(r));
      const ref = nextDevisRef(existingRefs, lead.entite);
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
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                devis,
                echeancier,
                statut:
                  l.statut === "nouveau" ||
                  l.statut === "a_qualifier" ||
                  l.statut === "qualifie"
                    ? "devis_envoye"
                    : l.statut,
                updated_at: now,
              }
            : l,
        ),
      );
      pushActivite(leadId, "devis", `Devis ${devis.ref} enregistré (générateur)`);
    },
    [pushActivite],
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
          return {
            ...l,
            devis: { ...l.devis, statut: "signe" },
            echeancier: buildEcheancier(l.devis.montant_ttc),
            statut: "signe",
            statut_change_at: now,
            updated_at: now,
          };
        }),
      );
      pushActivite(leadId, "signature", "Devis signé — échéancier 40/40/20 créé");
    },
    [pushActivite],
  );

  const generateFacture = useCallback<StoreValue["generateFacture"]>(
    (leadId) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || !lead.devis || lead.devis.statut !== "signe") return null;
      if (lead.facture) return lead.facture; // déjà émise (numérotation unique)
      const existingRefs = leads
        .map((l) => l.facture?.ref)
        .filter((r): r is string => Boolean(r));
      const ref = nextFactureRef(existingRefs, lead.entite);
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

  const value = useMemo<StoreValue>(
    () => ({
      loaded,
      isDemo: repositoryKind === "local",
      leads,
      activites,
      activitesFor,
      addLead,
      importDrafts,
      updateLead,
      deleteLead,
      deleteLeads,
      changeStatut,
      addActivite: pushActivite,
      generateDevis,
      attachDevis,
      markDevisEnvoye,
      signDevis,
      generateFacture,
      setEcheanceStatut,
      resetDemo,
    }),
    [
      loaded,
      leads,
      activites,
      activitesFor,
      addLead,
      importDrafts,
      updateLead,
      deleteLead,
      deleteLeads,
      changeStatut,
      pushActivite,
      generateDevis,
      attachDevis,
      markDevisEnvoye,
      signDevis,
      generateFacture,
      setEcheanceStatut,
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
