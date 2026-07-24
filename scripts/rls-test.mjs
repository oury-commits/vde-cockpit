/**
 * Banc d'essai RLS — Postgres 18 réel (PGlite, WASM).
 *
 * On applique les VRAIES migrations du repo, puis on se met successivement
 * dans la peau de chaque rôle via `set role authenticated` + le claim JWT que
 * Supabase pose (`request.jwt.claims`), exactement comme en production.
 *
 * Ce qui rend ce test utile plutôt que rassurant :
 *  · on accorde à `authenticated` les mêmes privilèges de table que Supabase,
 *    sinon on mesurerait des « permission denied » et on croirait la RLS active ;
 *  · on distingue REFUS SILENCIEUX (0 ligne) et REFUS BRUYANT (exception) —
 *    un UPDATE qui n'écrit rien ressemble à un succès ;
 *  · on vérifie systématiquement qu'un autre rôle, lui, voit bien la donnée :
 *    « 0 ligne » ne prouve rien si la table est vide.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIG = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
const db = await PGlite.create();

let pass = 0, fail = 0;
const echecs = [];
function verifie(nom, condition, detail = "") {
  if (condition) { pass++; console.log(`  OK   ${nom}`); }
  else { fail++; echecs.push(nom); console.log(`  FAIL ${nom}${detail ? ` — ${detail}` : ""}`); }
}

// --- Socle Supabase simulé ---------------------------------------------------
await db.exec(`
  create role anon;
  create role authenticated;
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
  $$;
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean default false);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
`);

// --- Migrations réelles ------------------------------------------------------
const fichiers = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
for (const f of fichiers) {
  try {
    await db.exec(readFileSync(`${MIG}/${f}`, "utf8"));
  } catch (e) {
    console.log(`!! ${f} : ${e.message}`);
    process.exit(1);
  }
}
console.log(`Migrations appliquées : ${fichiers.join(", ")}\n`);

// Supabase accorde les privilèges de table à authenticated : la RLS est alors
// le SEUL filtre. On reproduit ça, sinon le test mesurerait autre chose.
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
  grant usage on schema storage to anon, authenticated;
  grant all on all tables in schema storage to anon, authenticated;
`);

// --- Jeu d'essai (posé en superuser, donc au-dessus de la RLS) ---------------
const U = {
  admin:    "00000000-0000-0000-0000-000000000001",
  caFr:     "00000000-0000-0000-0000-000000000002",
  caMa:     "00000000-0000-0000-0000-000000000003",
  assistFr: "00000000-0000-0000-0000-000000000004",
  condFr:   "00000000-0000-0000-0000-000000000005",
  techFr:   "00000000-0000-0000-0000-000000000006",
  techFr2:  "00000000-0000-0000-0000-000000000007",
  techMa:   "00000000-0000-0000-0000-000000000008",
  inactif:  "00000000-0000-0000-0000-000000000009",
  nonAss:   "00000000-0000-0000-0000-00000000000a",
  derogTech:"00000000-0000-0000-0000-00000000000b",
};
await db.exec(`
  insert into auth.users (id, email) values
    ${Object.entries(U).map(([k, v]) => `('${v}','${k}@test.local')`).join(",")};

  insert into profiles (id, email, nom, role, entite, actif, overrides, demo) values
    ('${U.admin}',    'admin@test.local',  'Admin',    'admin',              'ALL', true, '{}', true),
    ('${U.caFr}',     'cafr@test.local',   'CA FR',    'charge_affaires',    'FR',  true, '{}', true),
    ('${U.caMa}',     'cama@test.local',   'CA MA',    'charge_affaires',    'MA',  true, '{}', true),
    ('${U.assistFr}', 'assist@test.local', 'Assist FR','assistante',         'FR',  true, '{}', true),
    ('${U.condFr}',   'cond@test.local',   'Cond FR',  'conducteur_travaux', 'FR',  true, '{}', true),
    ('${U.techFr}',   'tech1@test.local',  'Tech FR 1','technicien',         'FR',  true, '{}', true),
    ('${U.techFr2}',  'tech2@test.local',  'Tech FR 2','technicien',         'FR',  true, '{}', true),
    ('${U.techMa}',   'techma@test.local', 'Tech MA',  'technicien',         'MA',  true, '{}', true),
    ('${U.inactif}',  'inactif@test.local','Inactif',  'charge_affaires',    'FR',  false,'{}', true),
    ('${U.nonAss}',   'nonass@test.local', 'Non assigné', null,              null,  true, '{}', true),
    ('${U.derogTech}','derog@test.local',  'Tech dérogé','technicien',       'FR',  true,
       '{"montants":"full","leads":"full"}', true);

  insert into leads (id, entite, nom, telephone, montant_estime) values
    ('FR-1','FR','Client FR 1','0600000001', 2500),
    ('FR-2','FR','Client FR 2','0600000002', 3100),
    ('MA-1','MA','Client MA 1','0600000011', 27000);

  -- Facture de solde portee en JSONB sur le lead (Bloc C) : elle doit heriter
  -- du cloisonnement financier de leads (entite ∩ montants).
  update leads set facture = '{"ref":"FAC-2026-010","type":"solde","montant_ttc":950.40}'::jsonb
    where id = 'FR-1';

  insert into activites (lead_id, type, contenu, auteur) values
    ('FR-1','note','note FR 1','Admin'),
    ('FR-2','note','note FR 2','Admin'),
    ('MA-1','note','note MA 1','Admin');

  insert into catalogue (id, designation, categorie, cout_ht, entite) values
    ('CAT-FR-1','Borne 7,4 kW','borne', 480, 'FR'),
    ('CAT-MA-1','Borne 7,4 kW MA','borne', 4600, 'MA');

  insert into interventions (id, entite, lead_id, technicien_id, date, creneau, type, client_nom) values
    ('I-1','FR','FR-1','${U.techFr}',  now(), '08:30 – 10:30','pose','Client FR 1'),
    ('I-2','FR','FR-2','${U.techFr}',  now(), '11:00 – 12:00','sav','Client FR 2'),
    ('I-3','FR','FR-2','${U.techFr2}', now(), '14:00 – 16:00','pose','Client FR 2'),
    ('I-4','MA','MA-1','${U.techMa}',  now(), '09:30 – 11:30','pose','Client MA 1');

  insert into storage.objects (bucket_id, name) values
    ('documents','FR/VDE-2026-001.pdf'),
    ('documents','FR/VDE-2026-002.pdf'),
    ('documents','MA/VDE-2026-001.pdf');

  insert into reglements (id, lead_id, entite, montant, mode) values
    ('R-1','FR-1','FR', 1250, 'virement'),
    ('R-2','FR-2','FR', 1550, 'cheque'),
    ('R-3','MA-1','MA', 13500, 'virement');

  insert into calendar_tokens (user_id, access_token_enc) values
    ('${U.admin}', 'chiffre-jamais-en-clair');
`);

// --- Exécution dans la peau d'un utilisateur --------------------------------
async function commeUtilisateur(uid, sql, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    await db.exec(`set local role authenticated`);
    const r = await db.query(sql, params);
    await db.exec("rollback");
    return { ok: true, rows: r.rows, count: r.affectedRows ?? r.rows.length };
  } catch (e) {
    await db.exec("rollback");
    return { ok: false, erreur: e.message };
  }
}
async function commeAnon(sql) {
  await db.exec("begin");
  try {
    await db.exec(`set local role anon`);
    const r = await db.query(sql);
    await db.exec("rollback");
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec("rollback");
    return { ok: false, erreur: e.message };
  }
}
const nb = async (uid, sql) => {
  const r = await commeUtilisateur(uid, sql);
  return r.ok ? r.rows.length : `ERREUR(${r.erreur.slice(0, 40)})`;
};

// ===========================================================================
console.log("=== 1. LECTURE DES LEADS — entité ∩ rôle ∩ montants ===");
verifie("admin (ALL) voit les 3 dossiers",           (await nb(U.admin, "select * from leads")) === 3);
verifie("chargé d'affaires FR voit ses 2 dossiers",  (await nb(U.caFr, "select * from leads")) === 2);
verifie("chargé d'affaires MA voit son 1 dossier",   (await nb(U.caMa, "select * from leads")) === 1);
verifie("assistante FR voit ses 2 dossiers",         (await nb(U.assistFr, "select * from leads")) === 2);
verifie("conducteur de travaux : 0 (aveugle aux montants)", (await nb(U.condFr, "select * from leads")) === 0);
verifie("technicien : 0",                            (await nb(U.techFr, "select * from leads")) === 0);
verifie("compte désactivé : 0",                      (await nb(U.inactif, "select * from leads")) === 0);
verifie("compte non assigné : 0",                    (await nb(U.nonAss, "select * from leads")) === 0);
verifie("anon : 0",                                  (await commeAnon("select * from leads")).rows?.length === 0);
verifie("technicien dérogé (montants+leads) voit les 2 FR",
  (await nb(U.derogTech, "select * from leads")) === 2);

console.log("\n=== 2. LE PIÈGE DU RÉSULTAT VIDE ===");
{
  // « 0 ligne » ne veut rien dire tant qu'on n'a pas montré que la donnée existe.
  const vuParAdmin = await nb(U.admin, "select * from leads where entite = 'FR'");
  const vuParMa = await nb(U.caMa, "select * from leads where entite = 'FR'");
  verifie("les dossiers FR existent bien (vus par l'admin)", vuParAdmin === 2);
  verifie("le chargé d'affaires MA en voit 0 : c'est un REFUS, pas une table vide",
    vuParMa === 0 && vuParAdmin === 2);

  // Un UPDATE refusé n'échoue pas : il n'écrit rien. C'est le mode de panne
  // silencieux le plus dangereux — l'application croit avoir enregistré.
  const upd = await commeUtilisateur(U.caMa, "update leads set nom = 'PIRATÉ' where id = 'FR-1'");
  const apres = await db.query("select nom from leads where id = 'FR-1'");
  verifie("UPDATE hors périmètre : 0 ligne touchée, aucune exception",
    upd.ok === true && upd.count === 0);
  verifie("la donnée est intacte après ce refus silencieux",
    apres.rows[0].nom === "Client FR 1", apres.rows[0].nom);

  // À l'inverse, une écriture qui violerait le périmètre APRÈS coup est refusée
  // bruyamment par WITH CHECK.
  const move = await commeUtilisateur(U.caFr, "update leads set entite = 'MA' where id = 'FR-1'");
  verifie("déplacer un dossier vers l'autre entité : exception (WITH CHECK)",
    move.ok === false && /row-level security|violates/i.test(move.erreur), move.erreur?.slice(0, 60));
}

console.log("\n=== 3. ÉCRITURE DES LEADS ===");
{
  const a = await commeUtilisateur(U.caFr, "insert into leads (id, entite, nom, telephone) values ('X1','FR','Nouveau','06')");
  verifie("chargé d'affaires FR crée un dossier FR", a.ok === true, a.erreur);
  const b = await commeUtilisateur(U.caFr, "insert into leads (id, entite, nom, telephone) values ('X2','MA','Nouveau','06')");
  verifie("chargé d'affaires FR ne peut PAS créer un dossier MA", b.ok === false, b.erreur?.slice(0, 60));
  const c = await commeUtilisateur(U.condFr, "insert into leads (id, entite, nom, telephone) values ('X3','FR','Nouveau','06')");
  verifie("conducteur de travaux ne crée aucun dossier", c.ok === false);
  const d = await commeUtilisateur(U.caMa, "delete from leads where id = 'FR-1'");
  verifie("suppression hors entité : 0 ligne", d.ok === true && d.count === 0);
  const e = await commeUtilisateur(U.admin, "delete from leads where id = 'FR-1'");
  verifie("l'admin supprime bien", e.ok === true && e.count === 1);
}

console.log("\n=== 4. ACTIVITÉS (cloisonnées par jointure) ===");
verifie("admin voit les 3 traces",            (await nb(U.admin, "select * from activites")) === 3);
verifie("chargé d'affaires FR voit 2 traces", (await nb(U.caFr, "select * from activites")) === 2);
verifie("chargé d'affaires MA voit 1 trace",  (await nb(U.caMa, "select * from activites")) === 1);
verifie("conducteur de travaux voit 0 trace", (await nb(U.condFr, "select * from activites")) === 0);
{
  // Insert d'une trace sur SON entité (chemin nominal).
  const iAdmin = await commeUtilisateur(U.admin, "insert into activites (lead_id, type, contenu) values ('FR-1','note','ajout admin')");
  verifie("admin : insert d'une trace", iAdmin.ok === true && iAdmin.count === 1);
  const iCaFr = await commeUtilisateur(U.caFr, "insert into activites (lead_id, type, contenu) values ('FR-1','note','relance CA FR')");
  verifie("chargé d'affaires FR : insert d'une trace sur son entité", iCaFr.ok === true && iCaFr.count === 1);

  // Le CHEMIN RÉEL de l'app : upsert du tableau complet
  // (INSERT ... ON CONFLICT (id) DO UPDATE). Avant 0025, la branche UPDATE de
  // l'upsert était refusée (« USING expression ») faute de policy UPDATE :
  // c'était l'angle mort (un UPDATE nu filtrait 0 ligne sans erreur → faux vert).
  const idFr = (await db.query("select id from activites where lead_id='FR-1' limit 1")).rows[0].id;
  const upAdmin = await commeUtilisateur(U.admin,
    `insert into activites (id, lead_id, type, contenu, auteur)
     values ('${idFr}','FR-1','note','maj','Admin')
     on conflict (id) do update set contenu = excluded.contenu`);
  verifie("admin : upsert de la timeline (ON CONFLICT DO UPDATE) passe",
    upAdmin.ok === true, upAdmin.erreur?.slice(0, 50));
  const upCaFr = await commeUtilisateur(U.caFr,
    `insert into activites (id, lead_id, type, contenu, auteur)
     values ('${idFr}','FR-1','note','maj CA FR','F')
     on conflict (id) do update set contenu = excluded.contenu`);
  verifie("chargé d'affaires FR : upsert sur son entité passe",
    upCaFr.ok === true, upCaFr.erreur?.slice(0, 50));

  // Cloisonnement d'écriture préservé : insert cross-entité refusé bruyamment.
  const iCross = await commeUtilisateur(U.caMa, "insert into activites (lead_id, type, contenu) values ('FR-2','note','intrusion')");
  verifie("insert d'une trace sur un dossier hors périmètre : refus", iCross.ok === false);
  // …et par upsert aussi (CA MA tente d'éditer une trace d'un dossier FR).
  const upCross = await commeUtilisateur(U.caMa,
    `insert into activites (id, lead_id, type, contenu, auteur)
     values ('${idFr}','FR-1','note','intrusion','M')
     on conflict (id) do update set contenu = excluded.contenu`);
  verifie("upsert cross-entité (CA MA → dossier FR) : refus", upCross.ok === false);
  // Un UPDATE scopé ne déborde jamais : le CA FR ne touche pas une trace MA.
  const upScope = await commeUtilisateur(U.caFr, "update activites set contenu = 'corrigé' where lead_id = 'MA-1'");
  verifie("update scopé : le CA FR ne touche aucune trace MA (0 ligne)",
    upScope.ok === true && upScope.count === 0);
}

console.log("\n=== 5. CATALOGUE (coûts d'achat) ===");
verifie("chargé d'affaires FR voit le catalogue FR",   (await nb(U.caFr, "select * from catalogue")) === 1);
verifie("conducteur de travaux : 0 (coûts)",           (await nb(U.condFr, "select * from catalogue")) === 0);
verifie("technicien : 0",                              (await nb(U.techFr, "select * from catalogue")) === 0);
{
  const a = await commeUtilisateur(U.assistFr, "update catalogue set cout_ht = 1 where id = 'CAT-FR-1'");
  verifie("assistante : lecture seule sur le catalogue", a.ok === true && a.count === 0);
  const b = await commeUtilisateur(U.caFr, "update catalogue set cout_ht = 500 where id = 'CAT-FR-1'");
  verifie("chargé d'affaires : peut corriger un prix", b.ok === true && b.count === 1);
  // Chemin réel de l'app : le store catalogue upsert le tableau (ON CONFLICT DO
  // UPDATE). Un rédacteur (CA) passe ; un lecteur seul (assistante) est refusé —
  // d'où le garde-fou côté app « ne persister que sur mutation ».
  const cUp = await commeUtilisateur(U.caFr,
    `insert into catalogue (id, designation, categorie, cout_ht, entite) values ('CAT-FR-1','Borne 7,4 kW','borne',480,'FR') on conflict (id) do update set cout_ht = excluded.cout_ht`);
  verifie("chargé d'affaires : upsert catalogue (ON CONFLICT DO UPDATE) passe", cUp.ok === true, cUp.erreur?.slice(0, 50));
  const cUpAssist = await commeUtilisateur(U.assistFr,
    `insert into catalogue (id, designation, categorie, cout_ht, entite) values ('CAT-FR-1','Borne 7,4 kW','borne',480,'FR') on conflict (id) do update set cout_ht = excluded.cout_ht`);
  verifie("assistante : upsert catalogue refusé (lecture seule)", cUpAssist.ok === false);
}

console.log("\n=== 6. INTERVENTIONS — sa tournée, pas celle du voisin ===");
verifie("technicien FR 1 voit ses 2 interventions",  (await nb(U.techFr, "select * from interventions")) === 2);
verifie("technicien FR 2 voit son 1 intervention",   (await nb(U.techFr2, "select * from interventions")) === 1);
verifie("technicien MA voit son 1 intervention",     (await nb(U.techMa, "select * from interventions")) === 1);
verifie("conducteur de travaux voit les 3 FR",       (await nb(U.condFr, "select * from interventions")) === 3);
verifie("admin voit les 4",                          (await nb(U.admin, "select * from interventions")) === 4);
{
  const a = await commeUtilisateur(U.techFr, "update interventions set statut = 'terminee' where id = 'I-3'");
  verifie("un technicien ne clôture pas l'intervention d'un collègue", a.ok === true && a.count === 0);
  const b = await commeUtilisateur(U.techFr, "update interventions set statut = 'terminee' where id = 'I-1'");
  verifie("un technicien clôture la sienne", b.ok === true && b.count === 1);
  const c = await commeUtilisateur(U.techFr, `update interventions set technicien_id = '${U.techFr2}' where id = 'I-1'`);
  verifie("un technicien ne se réattribue pas une intervention (WITH CHECK)", c.ok === false);
  const d = await commeUtilisateur(U.techFr, "insert into interventions (id, entite, date, creneau, type, client_nom) values ('I-9','FR',now(),'x','pose','y')");
  verifie("un technicien ne planifie pas", d.ok === false);
  const e = await commeUtilisateur(U.condFr, "insert into interventions (id, entite, date, creneau, type, client_nom) values ('I-9','FR',now(),'08:00','pose','Client')");
  verifie("le conducteur de travaux planifie", e.ok === true);
}

console.log("\n=== 7. PROFILS — la table des droits ===");
verifie("chargé d'affaires ne voit que sa propre ligne", (await nb(U.caFr, "select * from profiles")) === 1);
verifie("admin voit toute l'équipe",                     (await nb(U.admin, "select * from profiles")) === 11);
verifie("technicien ne voit pas les dérogations d'un collègue",
  (await nb(U.techFr, "select * from profiles")) === 1);
{
  const a = await commeUtilisateur(U.caFr, `update profiles set role = 'admin' where id = '${U.caFr}'`);
  verifie("auto-élévation en admin : 0 ligne", a.ok === true && a.count === 0);
  const b = await commeUtilisateur(U.caFr, `update profiles set overrides = '{"montants":"full"}' where id = '${U.condFr}'`);
  verifie("s'octroyer une dérogation : 0 ligne", b.ok === true && b.count === 0);
  const c = await commeUtilisateur(U.admin, `update profiles set entite = 'MA' where id = '${U.caFr}'`);
  verifie("l'admin réaffecte une entité", c.ok === true && c.count === 1);
  const d = await commeUtilisateur(U.admin, `update profiles set entite = 'ALL' where id = '${U.caFr}'`);
  verifie("« Tous pays » reste réservé à l'admin (contrainte base)", d.ok === false, d.erreur?.slice(0, 60));
  // Chemin réel de l'app : ProfilesProvider upsert le tableau au chargement.
  // L'écriture profiles est ADMIN-only (anti auto-élévation) : un admin upsert
  // passe, un non-admin qui ré-upsert SA PROPRE ligne est refusé — d'où le
  // garde-fou côté app « ne persister que sur mutation » (jamais au chargement).
  const pUpAdmin = await commeUtilisateur(U.admin,
    `insert into profiles (id, email, nom, role, entite, actif, overrides, demo) values ('${U.caFr}','cafr@test.local','CA FR','charge_affaires','FR',true,'{}',true) on conflict (id) do update set nom = excluded.nom`);
  verifie("admin : upsert profil (ON CONFLICT DO UPDATE) passe", pUpAdmin.ok === true, pUpAdmin.erreur?.slice(0, 50));
  const pUpSelf = await commeUtilisateur(U.caFr,
    `insert into profiles (id, email, nom, role, entite, actif, overrides, demo) values ('${U.caFr}','cafr@test.local','CA FR','charge_affaires','FR',true,'{}',true) on conflict (id) do update set nom = excluded.nom`);
  verifie("non-admin : ré-upsert de sa propre ligne refusé (l'app ne persiste plus au chargement)", pUpSelf.ok === false);
}

console.log("\n=== 8. VUES membres / chantiers ===");
{
  const m = await commeUtilisateur(U.caFr, "select * from membres");
  verifie("membres : le chargé d'affaires FR voit son équipe FR", m.ok && m.rows.length === 7, `${m.rows?.length}`);
  verifie("membres n'expose aucune dérogation",
    m.ok && !Object.keys(m.rows[0] ?? {}).includes("overrides"));

  const c = await commeUtilisateur(U.condFr, "select * from chantiers");
  verifie("chantiers : le conducteur voit ses 2 chantiers FR", c.ok && c.rows.length === 2, `${c.rows?.length}`);
  const colonnes = Object.keys(c.rows?.[0] ?? {});
  verifie("chantiers ne contient AUCUNE colonne financière",
    !colonnes.some((k) => /montant|devis|facture|echeancier/.test(k)), colonnes.join(","));

  const t = await commeUtilisateur(U.techFr, "select * from chantiers");
  verifie("chantiers : le technicien ne voit que ses chantiers à lui", t.ok && t.rows.length === 2, `${t.rows?.length}`);
  const t2 = await commeUtilisateur(U.techFr2, "select * from chantiers");
  verifie("chantiers : l'autre technicien n'en voit qu'un", t2.ok && t2.rows.length === 1, `${t2.rows?.length}`);
}

console.log("\n=== 9. NUMÉROTATION (next_sequence) ===");
{
  const a = await commeUtilisateur(U.caFr, "select next_sequence('FR','devis') as n");
  verifie("chargé d'affaires FR réserve un numéro FR", a.ok && Number(a.rows[0]?.n) === 1, a.erreur);
  const b = await commeUtilisateur(U.caFr, "select next_sequence('MA','devis') as n");
  verifie("il ne peut pas puiser dans la série MA", b.ok === false, b.erreur?.slice(0, 60));
  const c = await commeUtilisateur(U.techFr, "select next_sequence('FR','devis') as n");
  verifie("un technicien ne consomme pas la série (pas de trou dans la numérotation)", c.ok === false);
  const d = await commeUtilisateur(U.condFr, "select next_sequence('FR','facture') as n");
  verifie("un conducteur de travaux non plus", d.ok === false);
}

console.log("\n=== 10. STORAGE — les fichiers cloisonnés comme les lignes ===");
{
  const q = "select * from storage.objects where bucket_id = 'documents'";
  verifie("admin voit les 3 documents",            (await nb(U.admin, q)) === 3);
  verifie("chargé d'affaires FR voit ses 2 PDF FR", (await nb(U.caFr, q)) === 2);
  verifie("chargé d'affaires MA voit son 1 PDF MA", (await nb(U.caMa, q)) === 1);
  verifie("assistante FR voit les 2 PDF FR",       (await nb(U.assistFr, q)) === 2);
  verifie("conducteur de travaux : 0 (aveugle aux montants → aux devis)",
    (await nb(U.condFr, q)) === 0);
  verifie("technicien : 0 PDF (ne lit pas un devis client)", (await nb(U.techFr, q)) === 0);
  verifie("anon : 0", (await commeAnon(q)).rows?.length === 0);

  // Le piège du vide, encore : le PDF MA existe (l'admin le voit), le FR ne le voit pas.
  const vuAdmin = await nb(U.admin, "select * from storage.objects where name = 'MA/VDE-2026-001.pdf'");
  const vuFr = await nb(U.caFr, "select * from storage.objects where name = 'MA/VDE-2026-001.pdf'");
  verifie("PDF MA : REFUS pour le FR, pas un bucket vide", vuAdmin === 1 && vuFr === 0);

  // Écriture : on ne dépose pas hors de son entité (exfiltration par upload).
  const w1 = await commeUtilisateur(U.caFr, "insert into storage.objects (bucket_id, name) values ('documents','FR/VDE-2026-050.pdf')");
  verifie("chargé d'affaires FR dépose un PDF FR", w1.ok === true, w1.erreur?.slice(0, 60));
  const w2 = await commeUtilisateur(U.caFr, "insert into storage.objects (bucket_id, name) values ('documents','MA/VDE-2026-050.pdf')");
  verifie("chargé d'affaires FR ne peut PAS déposer sous MA/", w2.ok === false, w2.erreur?.slice(0, 60));
  const w3 = await commeUtilisateur(U.techFr, "insert into storage.objects (bucket_id, name) values ('documents','FR/photo.pdf')");
  verifie("un technicien ne dépose pas dans documents", w3.ok === false);

  // Chemin sans préfixe entité connu → refusé (deny by default).
  const w4 = await commeUtilisateur(U.caFr, "insert into storage.objects (bucket_id, name) values ('documents','sans-prefixe.pdf')");
  verifie("chemin sans préfixe FR/ ou MA/ : refusé", w4.ok === false);

  // Suppression : admin seul.
  const d1 = await commeUtilisateur(U.caFr, "delete from storage.objects where name = 'FR/VDE-2026-001.pdf'");
  verifie("chargé d'affaires ne supprime pas un document émis", d1.ok === true && d1.count === 0);
  const d2 = await commeUtilisateur(U.admin, "delete from storage.objects where name = 'FR/VDE-2026-001.pdf'");
  verifie("l'admin supprime un document", d2.ok === true && d2.count === 1);
}

console.log("\n=== 11. REGLEMENTS — registre financier cloisonne ===");
{
  const q = "select * from reglements";
  verifie("admin voit les 3 encaissements",          (await nb(U.admin, q)) === 3);
  verifie("chargé d'affaires FR voit ses 2",         (await nb(U.caFr, q)) === 2);
  verifie("chargé d'affaires MA voit son 1",         (await nb(U.caMa, q)) === 1);
  verifie("assistante FR voit les 2 FR",             (await nb(U.assistFr, q)) === 2);
  verifie("conducteur de travaux : 0 (aveugle aux montants)", (await nb(U.condFr, q)) === 0);
  verifie("technicien : 0",                          (await nb(U.techFr, q)) === 0);
  const vuAdmin = await nb(U.admin, "select * from reglements where entite = 'MA'");
  const vuFr = await nb(U.caFr, "select * from reglements where entite = 'MA'");
  verifie("encaissement MA : REFUS pour le FR, pas un registre vide", vuAdmin === 1 && vuFr === 0);
  const w = await commeUtilisateur(U.caFr, "insert into reglements (id, lead_id, entite, montant, mode) values ('R-9','FR-1','MA', 100, 'virement')");
  verifie("chargé d'affaires FR ne peut PAS écrire un encaissement MA", w.ok === false, w.erreur?.slice(0, 50));
  const d1 = await commeUtilisateur(U.caFr, "delete from reglements where id = 'R-1'");
  verifie("un encaissement ne se supprime pas hors admin", d1.ok === true && d1.count === 0);
  const d2 = await commeUtilisateur(U.admin, "delete from reglements where id = 'R-1'");
  verifie("l'admin peut annuler un encaissement", d2.ok === true && d2.count === 1);
}

console.log("\n=== 12. FACTURE DE SOLDE (JSONB sur le lead) — cloisonnement financier ===");
{
  const q = "select facture from leads where id = 'FR-1' and facture is not null";
  verifie("admin lit la facture de solde de FR-1",         (await nb(U.admin, q)) === 1);
  verifie("chargé d'affaires FR la lit",                   (await nb(U.caFr, q)) === 1);
  verifie("chargé d'affaires MA ne la voit pas (autre entité)", (await nb(U.caMa, q)) === 0);
  verifie("conducteur de travaux ne la voit pas (aveugle aux montants)", (await nb(U.condFr, q)) === 0);
  verifie("technicien ne la voit pas",                     (await nb(U.techFr, q)) === 0);
}

console.log("\n=== 13. calendar_tokens — jetons Google SERVER-ONLY ===");
{
  const q = "select * from calendar_tokens";
  verifie("admin (authenticated) ne lit AUCUN jeton", (await nb(U.admin, q)) === 0);
  verifie("chargé d'affaires ne lit aucun jeton", (await nb(U.caFr, q)) === 0);
  verifie("technicien ne lit aucun jeton", (await nb(U.techFr, q)) === 0);
  const w = await commeUtilisateur(U.admin, `insert into calendar_tokens (user_id, access_token_enc) values ('${U.caFr}', 'y')`);
  verifie("aucun utilisateur ne peut ÉCRIRE un jeton (server-only)", w.ok === false, w.erreur?.slice(0, 50));
  const pol = await db.query("select count(*)::int n from pg_policies where schemaname='public' and tablename='calendar_tokens'");
  verifie("calendar_tokens : 0 policy (accès service_role uniquement)", pol.rows[0].n === 0);
  const rls = await db.query("select relrowsecurity r from pg_class where relname='calendar_tokens'");
  verifie("calendar_tokens : RLS active", rls.rows[0].r === true);
}

console.log("\n=== 14. AUCUNE PORTE OUVERTE ===");
{
  const ouvertes = await db.query(`
    select tablename, policyname from pg_policies
     where schemaname in ('public', 'storage')
       and ('anon' = any(roles) or 'public' = any(roles))`);
  verifie("aucune policy (public ou storage) accordée à anon ou public",
    ouvertes.rows.length === 0, JSON.stringify(ouvertes.rows));

  const sansRls = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  verifie("aucune table publique sans RLS", sansRls.rows.length === 0,
    sansRls.rows.map((r) => r.relname).join(","));

  const definerSansPath = await db.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                        where c like 'search_path=%')`);
  verifie("aucune fonction SECURITY DEFINER sans search_path épinglé",
    definerSansPath.rows.length === 0, definerSansPath.rows.map((r) => r.proname).join(","));
}

console.log(`\n${"=".repeat(60)}`);
console.log(`RÉSULTAT : ${pass} OK, ${fail} FAIL`);
if (fail) console.log(`Échecs : ${echecs.join(" | ")}`);
process.exit(fail ? 1 : 0);
