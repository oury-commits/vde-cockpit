import type { Puissance, TypeLogement } from "@/lib/types";

/** Brouillon de lead issu d'une ligne CSV (avant insertion dans le store). */
export interface LeadDraft {
  /** Ref d'origine (FB-XXX) à conserver lors d'une migration AppSheet. */
  ref?: string;
  /** Statut d'origine, brut. Mappé sur le pipeline via lib/leads/appsheet.ts. */
  statut_source?: string;
  nom: string;
  telephone: string;
  email?: string;
  code_postal?: string;
  ville?: string;
  source_campagne?: string;
  type_logement?: TypeLogement;
  type_vehicule?: string;
  puissance_souhaitee?: Puissance;
  distance_tableau?: number;
  eligible_advenir?: boolean;
  montant_estime?: number;
  date_reception?: string;
  notes?: string;
}

export type ImportField = keyof LeadDraft;

export const IMPORT_FIELDS: {
  key: ImportField;
  label: string;
  required?: boolean;
}[] = [
  { key: "ref", label: "Ref d'origine (FB-XXX)" },
  { key: "nom", label: "Nom", required: true },
  { key: "telephone", label: "Téléphone", required: true },
  { key: "statut_source", label: "Statut d'origine" },
  { key: "email", label: "Email" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "source_campagne", label: "Source / campagne" },
  { key: "type_logement", label: "Type de logement" },
  { key: "type_vehicule", label: "Type de véhicule" },
  { key: "puissance_souhaitee", label: "Puissance souhaitée" },
  { key: "distance_tableau", label: "Distance tableau (m)" },
  { key: "eligible_advenir", label: "Éligible ADVENIR" },
  { key: "montant_estime", label: "Montant estimé (€)" },
  { key: "date_reception", label: "Date de réception" },
  { key: "notes", label: "Notes" },
];

// ── Parsing CSV ────────────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Parse un CSV (délimiteur auto `,`/`;`/tab, guillemets, retours \r\n). */
export function parseCsv(input: string): {
  headers: string[];
  rows: string[][];
} {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  const dataRows = rows.filter((r) => r.some((c) => c.trim() !== ""));
  return { headers, rows: dataRows };
}

// ── Mapping automatique colonnes → champs ───────────────────────────────────

/** Retire les diacritiques via les code points combinants (U+0300–U+036F). */
function stripDiacritics(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFD")) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += ch;
  }
  return out;
}

function normalize(s: string): string {
  return stripDiacritics(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SYNONYMS: Record<ImportField, string[]> = {
  ref: ["ref", "id", "identifiant", "reference", "lead id", "code", "n lead"],
  statut_source: ["statut", "status", "etape", "stage", "etat", "phase"],
  nom: ["nom", "name", "full name", "fullname", "client", "contact", "prenom nom"],
  telephone: ["telephone", "tel", "phone", "mobile", "numero", "phone number"],
  email: ["email", "e mail", "mail", "courriel"],
  code_postal: ["code postal", "cp", "zip", "postal", "zipcode"],
  ville: ["ville", "city", "commune", "localite"],
  source_campagne: ["source", "campagne", "campaign", "ad", "adset", "pub"],
  type_logement: ["type logement", "logement", "housing", "habitat"],
  type_vehicule: ["type vehicule", "vehicule", "voiture", "car", "vehicle", "modele"],
  puissance_souhaitee: ["puissance", "power", "kw", "borne"],
  distance_tableau: ["distance", "tableau", "distance tableau", "longueur"],
  eligible_advenir: ["advenir", "eligible advenir", "eligible", "subvention", "prime"],
  montant_estime: ["montant", "budget", "estimation", "montant estime", "prix"],
  date_reception: ["date reception", "date", "created", "timestamp", "recu le"],
  notes: ["notes", "note", "commentaire", "remarque", "message"],
};

export type Mapping = Partial<Record<ImportField, string>>;

/**
 * Correspondance nom de colonne ↔ synonyme, par tokens entiers.
 * Évite les faux positifs de sous-chaîne (ex. « ad » ⊄ « advenir »).
 */
function matchesSynonym(norm: string, syns: string[]): boolean {
  const tokens = norm.split(" ").filter(Boolean);
  return syns.some((s) => {
    if (norm === s) return true;
    if (s.includes(" ")) return norm.includes(s); // synonyme multi-mots
    return tokens.includes(s); // synonyme mono-mot : token entier
  });
}

/** Devine le mapping colonnes → champs par correspondance de noms. */
export function guessMapping(headers: string[]): Mapping {
  const normalized = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const mapping: Mapping = {};
  const used = new Set<string>();

  for (const { key } of IMPORT_FIELDS) {
    const hit = normalized.find(
      (h) => !used.has(h.raw) && matchesSynonym(h.norm, SYNONYMS[key]),
    );
    if (hit) {
      mapping[key] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

// ── Conversion valeurs ──────────────────────────────────────────────────────

function parseBool(v: string): boolean | undefined {
  const n = normalize(v);
  if (!n) return undefined;
  if (["oui", "yes", "true", "vrai", "1", "y", "o"].includes(n)) return true;
  if (["non", "no", "false", "faux", "0", "n"].includes(n)) return false;
  return undefined;
}

function parseNum(v: string): number | undefined {
  const cleaned = v.replace(/[^0-9,.-]/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parsePuissance(v: string): Puissance | undefined {
  const n = v.replace(",", ".");
  if (/22/.test(n)) return "22";
  if (/11/.test(n)) return "11";
  if (/7[.,]?4/.test(n)) return "7.4";
  if (/3[.,]?7/.test(n)) return "3.7";
  return undefined;
}

function parseLogement(v: string): TypeLogement | undefined {
  const n = normalize(v);
  if (n.includes("maison") || n.includes("house") || n.includes("pavillon")) {
    return "maison";
  }
  if (n.includes("appart") || n.includes("flat")) return "appartement";
  return undefined;
}

function cell(row: string[], headers: string[], header?: string): string {
  if (!header) return "";
  const i = headers.indexOf(header);
  return i >= 0 ? (row[i] ?? "").trim() : "";
}

/** Transforme les lignes CSV en brouillons de leads via le mapping. */
export function rowsToDrafts(
  headers: string[],
  rows: string[][],
  mapping: Mapping,
): LeadDraft[] {
  return rows.map((row) => {
    const get = (f: ImportField) => cell(row, headers, mapping[f]);
    const draft: LeadDraft = {
      nom: get("nom") || "—",
      telephone: get("telephone"),
    };
    const ref = get("ref");
    if (ref) draft.ref = ref;
    const statutSource = get("statut_source");
    if (statutSource) draft.statut_source = statutSource;
    const email = get("email");
    if (email) draft.email = email;
    const cp = get("code_postal");
    if (cp) draft.code_postal = cp;
    const ville = get("ville");
    if (ville) draft.ville = ville;
    const src = get("source_campagne");
    if (src) draft.source_campagne = src;
    const veh = get("type_vehicule");
    if (veh) draft.type_vehicule = veh;
    const notes = get("notes");
    if (notes) draft.notes = notes;

    const logement = parseLogement(get("type_logement"));
    if (logement) draft.type_logement = logement;
    const puissance = parsePuissance(get("puissance_souhaitee"));
    if (puissance) draft.puissance_souhaitee = puissance;
    const dist = parseNum(get("distance_tableau"));
    if (dist !== undefined) draft.distance_tableau = dist;
    const montant = parseNum(get("montant_estime"));
    if (montant !== undefined) draft.montant_estime = montant;
    const advenir = parseBool(get("eligible_advenir"));
    if (advenir !== undefined) draft.eligible_advenir = advenir;

    const rawDate = get("date_reception");
    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) draft.date_reception = d.toISOString();
    }
    return draft;
  });
}
