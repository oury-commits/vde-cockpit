import type { Lead, Statut, Temperature } from "@/lib/types";
import { TEMPERATURE_META } from "@/lib/leads/meta";

export type RelanceState = "en_retard" | "aujourdhui" | "a_venir";
export type DevisState = "sans" | "envoye" | "signe";
export type PeriodeFilter = "jour" | "7j" | "30j";
export type SortKey = "date" | "temperature" | "montant" | "relance";
export type SortDir = "asc" | "desc";

export interface LeadFilters {
  search: string;
  statut: Statut | null;
  temperature: Temperature | null;
  relance: RelanceState | null;
  devis: DevisState | null;
  periode: PeriodeFilter | null;
  zone: string; // préfixe code postal / département
}

export const EMPTY_FILTERS: LeadFilters = {
  search: "",
  statut: null,
  temperature: null,
  relance: null,
  devis: null,
  periode: null,
  zone: "",
};

export function hasActiveFilters(f: LeadFilters): boolean {
  return (
    f.statut !== null ||
    f.temperature !== null ||
    f.relance !== null ||
    f.devis !== null ||
    f.periode !== null ||
    f.zone.trim() !== "" ||
    f.search.trim() !== ""
  );
}

// ── Dates ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date | string): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** État de relance d'un lead (null si terminal ou sans date). */
export function relanceState(lead: Lead, now: Date): RelanceState | null {
  if (!lead.date_relance || lead.statut === "perdu") return null;
  const due = startOfDay(lead.date_relance);
  const today = startOfDay(now);
  if (due < today) return "en_retard";
  if (due === today) return "aujourdhui";
  return "a_venir";
}

export function devisState(lead: Lead): DevisState {
  if (!lead.devis) return "sans";
  return lead.devis.statut === "signe" ? "signe" : "envoye";
}

/** Montant de référence d'un lead (devis TTC sinon estimation). */
export function leadMontant(lead: Lead): number {
  return lead.devis?.montant_ttc ?? lead.montant_estime ?? 0;
}

// ── Recherche / filtres ─────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9@. ]+/g, " ")
    .trim();
}

function matchesSearch(lead: Lead, q: string): boolean {
  if (!q) return true;
  const needle = norm(q);
  const hay = norm(
    [
      lead.id,
      lead.nom,
      lead.telephone,
      lead.email ?? "",
      lead.ville ?? "",
      lead.code_postal ?? "",
      lead.devis?.ref ?? "",
    ].join(" "),
  );
  return hay.includes(needle);
}

export function matchesFilters(
  lead: Lead,
  f: LeadFilters,
  now: Date,
): boolean {
  if (!matchesSearch(lead, f.search)) return false;
  if (f.statut && lead.statut !== f.statut) return false;
  if (f.temperature && lead.temperature !== f.temperature) return false;
  if (f.relance && relanceState(lead, now) !== f.relance) return false;
  if (f.devis && devisState(lead) !== f.devis) return false;
  if (f.zone.trim()) {
    const z = f.zone.trim().toLowerCase();
    const cp = (lead.code_postal ?? "").toLowerCase();
    const ville = (lead.ville ?? "").toLowerCase();
    if (!cp.startsWith(z) && !ville.includes(z)) return false;
  }
  if (f.periode) {
    const days = f.periode === "jour" ? 1 : f.periode === "7j" ? 7 : 30;
    const limit = startOfDay(now) - (days - 1) * 86_400_000;
    if (new Date(lead.date_reception).getTime() < limit) return false;
  }
  return true;
}

export function filterLeads(
  leads: Lead[],
  f: LeadFilters,
  now: Date,
): Lead[] {
  return leads.filter((l) => matchesFilters(l, f, now));
}

// ── Tri ─────────────────────────────────────────────────────────────────────

export function sortLeads(
  leads: Lead[],
  key: SortKey,
  dir: SortDir,
): Lead[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (l: Lead): number => {
    switch (key) {
      case "date":
        return new Date(l.date_reception).getTime();
      case "temperature":
        // chaud (0) → froid (2) ; inversé pour que "desc" = chaud d'abord.
        return -TEMPERATURE_META[l.temperature].order;
      case "montant":
        return leadMontant(l);
      case "relance":
        return l.date_relance
          ? new Date(l.date_relance).getTime()
          : Number.POSITIVE_INFINITY;
    }
  };
  return [...leads].sort((a, b) => {
    const d = val(a) - val(b);
    return d === 0 ? a.id.localeCompare(b.id) : sign * d;
  });
}

// ── Regroupement par période ────────────────────────────────────────────────

export interface PeriodGroup {
  key: string;
  label: string;
  leads: Lead[];
}

export function groupByPeriod(leads: Lead[], now: Date): PeriodGroup[] {
  const today = startOfDay(now);
  const week = today - 6 * 86_400_000;
  const month = today - 29 * 86_400_000;
  const groups: Record<string, Lead[]> = {
    jour: [],
    semaine: [],
    mois: [],
    ancien: [],
  };
  for (const l of leads) {
    const t = startOfDay(l.date_reception);
    if (t >= today) groups.jour.push(l);
    else if (t >= week) groups.semaine.push(l);
    else if (t >= month) groups.mois.push(l);
    else groups.ancien.push(l);
  }
  const order: [string, string][] = [
    ["jour", "Aujourd'hui"],
    ["semaine", "Cette semaine"],
    ["mois", "Ce mois"],
    ["ancien", "Plus ancien"],
  ];
  return order
    .map(([key, label]) => ({ key, label, leads: groups[key] }))
    .filter((g) => g.leads.length > 0);
}

// ── Compteurs live ──────────────────────────────────────────────────────────

export interface LeadCounts {
  statut: Record<Statut, number>;
  temperature: Record<Temperature, number>;
  relance: Record<RelanceState, number>;
  devis: Record<DevisState, number>;
}

/** Compteurs calculés sur la base filtrée par la recherche uniquement. */
export function computeCounts(leads: Lead[], now: Date): LeadCounts {
  const counts: LeadCounts = {
    statut: {
      nouveau: 0,
      a_qualifier: 0,
      qualifie: 0,
      devis_envoye: 0,
      signe: 0,
      planifie: 0,
      installe: 0,
      sav: 0,
      perdu: 0,
    },
    temperature: { chaud: 0, tiede: 0, froid: 0 },
    relance: { en_retard: 0, aujourdhui: 0, a_venir: 0 },
    devis: { sans: 0, envoye: 0, signe: 0 },
  };
  for (const l of leads) {
    counts.statut[l.statut]++;
    counts.temperature[l.temperature]++;
    counts.devis[devisState(l)]++;
    const r = relanceState(l, now);
    if (r) counts.relance[r]++;
  }
  return counts;
}

// ── Vues sauvegardées (§4) ──────────────────────────────────────────────────

export interface SavedView {
  id: string;
  label: string;
  patch: Partial<LeadFilters>;
}

export const SAVED_VIEWS: SavedView[] = [
  { id: "relance_jour", label: "À relancer aujourd'hui", patch: { relance: "aujourdhui" } },
  { id: "devis_attente", label: "Devis en attente de signature", patch: { devis: "envoye" } },
  { id: "chauds_sans_devis", label: "Leads chauds sans devis", patch: { temperature: "chaud", devis: "sans" } },
  { id: "signes_installer", label: "Signés à installer", patch: { statut: "signe" } },
];

/** Nombre de leads correspondant à une vue sauvegardée (compteur du raccourci). */
export function countView(leads: Lead[], view: SavedView, now: Date): number {
  const f: LeadFilters = { ...EMPTY_FILTERS, ...view.patch };
  return leads.reduce((n, l) => (matchesFilters(l, f, now) ? n + 1 : n), 0);
}

// ── Anti-doublon (§1) ───────────────────────────────────────────────────────

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Deux contacts sont un doublon s'ils partagent téléphone OU email. */
export function isSameContact(
  a: { telephone?: string | null; email?: string | null },
  b: { telephone?: string | null; email?: string | null },
): boolean {
  const aTel = digits(a.telephone ?? "");
  const bTel = digits(b.telephone ?? "");
  if (aTel && bTel && aTel === bTel) return true;
  const aMail = (a.email ?? "").trim().toLowerCase();
  const bMail = (b.email ?? "").trim().toLowerCase();
  return Boolean(aMail && bMail && aMail === bMail);
}
