/**
 * Import AppSheet → Supabase (leads).
 *
 * DRY-RUN par défaut : lit le CSV, mappe les colonnes, détecte doublons et
 * anomalies, et affiche un rapport SANS rien écrire.
 *
 *   node --experimental-strip-types scripts/import-appsheet.ts <export.csv>
 *
 * Import réel (après validation d'Oury) :
 *
 *   node --experimental-strip-types scripts/import-appsheet.ts <export.csv> --commit
 *
 * Requiert alors NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 * La ref FB-XXX d'origine est conservée si présente ; sinon attribuée à la suite.
 */
import { readFileSync } from "node:fs";
import { parseCsv, guessMapping, rowsToDrafts } from "../lib/leads/csv.ts";
import { scoreTemperature } from "../lib/leads/scoring.ts";
import { nextRef } from "../lib/leads/ref.ts";

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

const text = readFileSync(file, "utf8");
const { headers, rows } = parseCsv(text);
const mapping = guessMapping(headers);
const drafts = rowsToDrafts(headers, rows, mapping);

const seen: typeof drafts = [];
const valid: typeof drafts = [];
const duplicates: typeof drafts = [];
const invalid: typeof drafts = [];

for (const d of drafts) {
  if (!d.telephone?.trim()) {
    invalid.push(d);
  } else if (seen.some((s) => sameContact(s, d))) {
    duplicates.push(d);
  } else {
    seen.push(d);
    valid.push(d);
  }
}

console.log("── Import AppSheet — rapport ──");
console.log("Fichier          :", file);
console.log("Colonnes         :", headers.length, `[${headers.join(", ")}]`);
console.log("Mapping détecté  :");
for (const [field, col] of Object.entries(mapping)) {
  console.log(`   ${field.padEnd(20)} ← ${col}`);
}
console.log("Lignes lues      :", drafts.length);
console.log("Valides          :", valid.length);
console.log("Doublons (fichier):", duplicates.length);
console.log("Sans téléphone   :", invalid.length);

if (!commit) {
  console.log("\nDRY-RUN — aucune écriture. Ajoute --commit pour importer.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "\n--commit requiert NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).",
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(url, key);

const { data: existing, error: readErr } = await sb.from("leads").select("id");
if (readErr) {
  console.error("Lecture des ids existants échouée :", readErr.message);
  process.exit(1);
}
const ids = (existing ?? []).map((r: { id: string }) => r.id);
const now = new Date().toISOString();

const toInsert = valid.map((d) => {
  const id = nextRef(ids);
  ids.push(id);
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
    statut: "nouveau" as const,
    notes: d.notes ?? null,
    created_at: now,
    updated_at: now,
    statut_change_at: now,
  };
});

const { error: insErr } = await sb.from("leads").insert(toInsert);
if (insErr) {
  console.error("Import échoué :", insErr.message);
  process.exit(1);
}
console.log(`\nOK — ${toInsert.length} leads importés dans Supabase.`);
process.exit(0);
