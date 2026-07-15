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
  Lead,
  MotifPerte,
  Statut,
  StatutEcheance,
} from "@/lib/types";
import type { LeadDraft } from "@/lib/leads/csv";
import { nextRef } from "@/lib/leads/ref";
import { scoreTemperature } from "@/lib/leads/scoring";
import { buildDevis, buildEcheancier, nextDevisRef } from "@/lib/leads/devis";
import { isSameContact } from "@/lib/leads/filters";
import { buildSeed } from "@/lib/leads/seed";
import { STATUT_META } from "@/lib/leads/meta";

const STORAGE_KEY = "vde.crm.v1";

/** Entrée créée manuellement ou via import. */
export type LeadInput = LeadDraft & {
  canal?: Canal;
  assigne_a?: string | null;
  statut?: Statut;
};

export interface ImportReport {
  imported: Lead[];
  duplicates: { draft: LeadDraft; existing: Lead }[];
}

interface StoreValue {
  loaded: boolean;
  leads: Lead[];
  activites: Activite[];
  activitesFor: (leadId: string) => Activite[];
  addLead: (input: LeadInput) => { lead: Lead | null; duplicate?: Lead };
  importDrafts: (drafts: LeadDraft[]) => ImportReport;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  changeStatut: (id: string, statut: Statut, motif?: MotifPerte) => void;
  addActivite: (leadId: string, type: ActiviteType, contenu: string) => void;
  generateDevis: (leadId: string) => Devis | null;
  markDevisEnvoye: (leadId: string) => void;
  signDevis: (leadId: string) => void;
  setEcheanceStatut: (
    leadId: string,
    index: number,
    statut: StatutEcheance,
  ) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

interface Persisted {
  leads: Lead[];
  activites: Activite[];
}

function seedState(): Persisted {
  const now = new Date();
  const leads = buildSeed(now);
  const activites: Activite[] = leads.map((l) => ({
    id: uid(),
    lead_id: l.id,
    type: "import",
    contenu: "Lead importé (démonstration)",
    auteur: "Système",
    created_at: l.date_reception,
  }));
  return { leads, activites };
}

export function LeadsStoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);

  // Hydratation client (localStorage) — sinon seed de démo.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const state: Persisted = raw ? JSON.parse(raw) : seedState();
      setLeads(state.leads);
      setActivites(state.activites);
    } catch {
      const state = seedState();
      setLeads(state.leads);
      setActivites(state.activites);
    }
    setLoaded(true);
  }, []);

  // Sauvegarde continue.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ leads, activites }));
    } catch {
      /* quota / mode privé : on ignore silencieusement */
    }
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
        date_reception: recv,
        canal: input.canal ?? "manuel",
        source_campagne: input.source_campagne ?? null,
        nom: input.nom,
        telephone: input.telephone,
        email: input.email ?? null,
        code_postal: input.code_postal ?? null,
        ville: input.ville ?? null,
        type_logement: input.type_logement ?? null,
        type_vehicule: input.type_vehicule ?? null,
        puissance_souhaitee: input.puissance_souhaitee ?? null,
        distance_tableau: input.distance_tableau ?? null,
        eligible_advenir: input.eligible_advenir ?? null,
        temperature: scoreTemperature(input),
        statut: input.statut ?? "nouveau",
        montant_estime: input.montant_estime ?? null,
        devis: null,
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
        const id = nextRef(ids);
        ids = [...ids, id];
        const lead = makeLead({ ...draft, canal: "import" }, id);
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
    (leadId) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return null;
      const existingRefs = leads
        .map((l) => l.devis?.ref)
        .filter((r): r is string => Boolean(r));
      const ref = nextDevisRef(existingRefs);
      const devis = buildDevis(lead, ref, new Date().toISOString());
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
      leads,
      activites,
      activitesFor,
      addLead,
      importDrafts,
      updateLead,
      changeStatut,
      addActivite: pushActivite,
      generateDevis,
      markDevisEnvoye,
      signDevis,
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
      changeStatut,
      pushActivite,
      generateDevis,
      markDevisEnvoye,
      signDevis,
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
