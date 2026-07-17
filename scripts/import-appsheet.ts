/**
 * Import AppSheet → Supabase (leads).
 *
 * DRY-RUN par défaut : lit le CSV, mappe les colonnes, détecte doublons et
 * anomalies, et affiche un rapport SANS rien écrire.
 *
 *   NODE_OPTIONS="--use-system-ca" node --experimental-strip-types \
 *     scripts/import-appsheet.ts <export.csv>
 *
 * Import réel (après validation d'Oury) : ajouter --commit.
 * Requiert alors NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 *
 * `--use-system-ca` est nécessaire sur ce poste (certificat d'entreprise),
 * sinon Node échoue en UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 *
 * Garanties : la ref FB-XXX d'origine est CONSERVÉE quand elle est exploitable
 * et libre ; le statut d'origine est mappé sur le pipeline, et tout statut non
 * reconnu bascule en `nouveau` avec une note d'import (rien n'est perdu).
 */
import { readFileSync } from "node:fs";
import {
  parseCsv,
  guessMapping,
  rowsToDrafts,
  type ImportField,
} from "../lib/leads/csv.ts";
import { scoreTemperature } from "../lib/leads/scoring.ts";
import { nextRef } from "../lib/leads/ref.ts";
import {
  canonicalRef,
  noteStatutInconnu,
  parseStatutSource,
} from "../lib/leads/appsheet.ts";

const file = process.argv[2];
const commit = process.argv.includes("--commit");

if (!file) {
  console.error("Usage: import-appsheet.ts <export.csv> [--commit]");
  process.exit(1);
}

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
function sameContact(
  a: { telephone?: string; email?: string },
  b: { telephone?: string; email?: string },
): boolean {
  const at = digits(a.telephone);
  const bt = digits(b.telephone);
  if (at && bt && at === bt) return true;
  const ae = (a.email ?? "").toLowerCase();
  const be = (b.email ?? "").toLowerCase();
  return Boolean(ae && be && ae === be);
}

/** Décode le fichier selon le BOM : UTF-16 LE/BE, UTF-8, ou heuristique. */
function readTextSmart(path: string): string {
  const buf = readFileSync(path);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    // UTF-16 LE + BOM — cas de l'export Facebook/Windows.
    return buf.subarray(2).toString("utf16le");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // UTF-16 BE — on permute les octets puis on décode en LE.
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString("utf16le");
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString("utf8"); // UTF-8 + BOM
  }
  // Heuristique : beaucoup d'octets NUL en position impaire -> UTF-16 LE sans BOM.
  let nul = 0;
  const scan = Math.min(buf.length, 2000);
  for (let i = 1; i < scan; i += 2) if (buf[i] === 0) nul++;
  if (nul > scan / 8) return buf.toString("utf16le");
  return buf.toString("utf8");
}

const text = readTextSmart(file);
console.log("Encodage détecté :", text.length ? "OK" : "vide", `(${text.length} caractères)`);
const { headers, rows } = parseCsv(text);
const mapping = guessMapping(headers);

// Colonnes IDENTITÉ de l'export Facebook — mapping explicite qui PRIME sur la
// détection auto (le nom DOIT venir de FULL_NAME, jamais de ad_name/la pub).
const FB_IDENTITE: Record<string, ImportField> = {
  full_name: "nom",
  email: "email",
  phone: "telephone",
  phone_number: "telephone",
  street_address: "adresse",
  city: "ville",
  zip_code: "code_postal",
  post_code: "code_postal",
  ad_name: "source_campagne",
  campaign_name: "source_campagne",
  created_time: "date_reception",
};
const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
for (const h of headers) {
  const f = FB_IDENTITE[norm(h)];
  // Prime pour les champs identité (écrase une éventuelle mauvaise détection).
  if (f === "nom" || f === "email" || f === "telephone" || f === "adresse") {
    mapping[f] = h;
  } else if (f && !mapping[f]) {
    mapping[f] = h;
  }
}

// Colonnes de qualification numérotées 0→11 de l'export Facebook/AppSheet
// (mapping positionnel spécifié par le cahier — n'écrase pas une colonne déjà
// mappée par son nom).
const APPSHEET_POSITIONAL: Record<string, ImportField> = {
  "0": "reseau",
  "1": "puissance_compteur_kva",
  "2": "type_logement",
  "3": "occupation",
  "4": "emplacement",
  "5": "fixation",
  "6": "distance_tableau",
  "7": "obstacles",
  "8": "type_vehicule",
  "9": "pv_projet",
  "10": "budget",
  "11": "delai",
};
for (const h of headers) {
  const f = APPSHEET_POSITIONAL[h.trim()];
  if (f && !mapping[f]) mapping[f] = h;
}

const drafts = rowsToDrafts(headers, rows, mapping);

const seen: typeof drafts = [];
const valid: typeof drafts = [];
const duplicates: typeof drafts = [];
const invalid: typeof drafts = [];

for (const d of drafts) {
  if (!d.telephone?.trim()) invalid.push(d);
  else if (seen.some((s) => sameContact(s, d))) duplicates.push(d);
  else {
    seen.push(d);
    valid.push(d);
  }
}

console.log("── Import AppSheet — rapport (DRY-RUN) ──");
console.log("Fichier           :", file);
console.log("Colonnes          :", headers.length, `[${headers.join(", ")}]`);
console.log("Mapping détecté   :");
for (const [field, col] of Object.entries(mapping)) {
  console.log(`   ${field.padEnd(20)} ← ${col}`);
}
const nonMappes = headers.filter((h) => !Object.values(mapping).includes(h));
if (nonMappes.length) console.log("Colonnes ignorées :", nonMappes.join(", "));

console.log("");
console.log("Lignes lues       :", drafts.length);
console.log("Valides           :", valid.length);
console.log("Doublons (fichier):", duplicates.length);
console.log("Sans téléphone    :", invalid.length);

// ── Refs d'origine ──────────────────────────────────────────────────────────
let refOk = 0;
let refAssignees = 0;
for (const d of valid) {
  if (canonicalRef(d.ref)) refOk++;
  else refAssignees++;
}
console.log("");
console.log("Refs d'origine    :", `${refOk} conservées · ${refAssignees} à attribuer`);
if (!mapping.ref) {
  console.log("  [!] Aucune colonne de ref détectée → toutes les refs seront réattribuées.");
}

// ── Statuts ─────────────────────────────────────────────────────────────────
const statutCounts = new Map<string, { cible: string; n: number }>();
for (const d of valid) {
  const raw = (d.statut_source ?? "").trim() || "(vide)";
  const mapped = parseStatutSource(d.statut_source);
  const cible = mapped ?? "nouveau (NON RECONNU)";
  const cur = statutCounts.get(raw) ?? { cible, n: 0 };
  cur.n++;
  statutCounts.set(raw, cur);
}
console.log("Statuts d'origine :");
if (!mapping.statut_source) {
  console.log("  [!] Aucune colonne de statut détectée → tout sera importé en « nouveau ».");
} else {
  for (const [raw, { cible, n }] of [...statutCounts].sort((a, b) => b[1].n - a[1].n)) {
    const flag = cible.includes("NON RECONNU") ? "  [!]" : "     ";
    console.log(`${flag} ${String(n).padStart(4)} × « ${raw} » → ${cible}`);
  }
}

console.log("");
console.log("Aperçu (3 premières lignes — nom réel vs campagne) :");
for (const d of drafts.slice(0, 3)) {
  console.log(
    `   nom=« ${d.nom} » · campagne=« ${d.source_campagne ?? "—"} » · ${
      d.adresse ?? "—"
    } ${d.code_postal ?? ""} ${d.ville ?? ""}`.trimEnd(),
  );
}

if (!commit) {
  console.log("");
  console.log("DRY-RUN — aucune écriture. Ajouter --commit pour importer.");
  process.exit(0);
}

// ── Import réel ─────────────────────────────────────────────────────────────
const env = (() => {
  try {
    return readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();
const pick = (k: string) =>
  process.env[k] ?? new RegExp(`^${k}=(.+)$`, "m").exec(env)?.[1]?.trim();
const url = pick("NEXT_PUBLIC_SUPABASE_URL");
const key = pick("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("\n--commit requiert NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const res = await fetch(`${url}/rest/v1/leads?select=id`, { headers: h });
if (!res.ok) {
  console.error("Lecture des ids existants échouée :", res.status, await res.text());
  process.exit(1);
}
const ids: string[] = ((await res.json()) as { id: string }[]).map((r) => r.id);
const used = new Set(ids);
const now = new Date().toISOString();

const toInsert = valid.map((d) => {
  const canon = canonicalRef(d.ref);
  const id = canon && !used.has(canon) ? canon : nextRef([...used]);
  used.add(id);

  const mapped = parseStatutSource(d.statut_source);
  const notes = [d.notes, !mapped && d.statut_source ? noteStatutInconnu(d.statut_source) : ""]
    .filter(Boolean)
    .join("\n");

  return {
    id,
    entite: "FR" as const,
    canal: "import" as const,
    date_reception: d.date_reception ?? now,
    source_campagne: d.source_campagne ?? null,
    nom: d.nom,
    telephone: d.telephone,
    email: d.email ?? null,
    code_postal: d.code_postal ?? null,
    ville: d.ville ?? null,
    type_logement: d.type_logement ?? null,
    type_vehicule: d.type_vehicule ?? null,
    puissance_souhaitee: d.puissance_souhaitee ?? null,
    distance_tableau: d.distance_tableau ?? null,
    eligible_advenir: d.eligible_advenir ?? null,
    montant_estime: d.montant_estime ?? null,
    temperature: scoreTemperature(d),
    statut: mapped ?? ("nouveau" as const),
    notes: notes || null,
    created_at: now,
    updated_at: now,
    statut_change_at: now,
  };
});

const ins = await fetch(`${url}/rest/v1/leads`, {
  method: "POST",
  headers: h,
  body: JSON.stringify(toInsert),
});
if (!ins.ok) {
  console.error("Import échoué :", ins.status, (await ins.text()).slice(0, 300));
  process.exit(1);
}
console.log(`\nOK — ${toInsert.length} leads importés dans Supabase.`);
process.exit(0);
