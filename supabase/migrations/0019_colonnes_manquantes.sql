-- ============================================================================
--  0019 — Colonnes manquantes : alignement schéma Supabase ↔ code applicatif.
-- ============================================================================
--
--  Le code a tourné en localStorage (objets JSON complets). Les repositories
--  Supabase persistent l'OBJET ENTIER (`.upsert(state.leads)`,
--  `.upsert(profiles)`, `.upsert(articles)`) : toute propriété présente devient
--  une colonne. Une propriété lue/écrite par le code mais jamais créée par une
--  migration = perte SILENCIEUSE en Supabase (erreur « column does not exist »
--  sur l'upsert, ou donnée qui n'atterrit nulle part).
--
--  BALAYAGE COMPLET (types applicatifs ✕ colonnes créées par 0001→0018) :
--    · leads (Lead)              → 3 colonnes manquantes ci-dessous ;
--    · profiles (Profile)        → 3 colonnes manquantes ci-dessous ;
--    · catalogue (CatalogueArticle) → RAS (cout_ma/url_produit/afficher_qr/
--      version/modifie_par créés par 0007/0010/0013) ;
--    · activites (Activite)      → RAS (jalon/annule/visibilite créés par 0012) ;
--    · reglements / calendar_tokens / interventions → RAS.
--  Les champs remise/alma_propose/ventilation_tva/montant_ht_brut/envoye_le…
--  vivent DANS le JSONB `leads.devis` / `leads.facture` : aucune colonne dédiée.
--
--  Idempotent. À jouer après 0018.
-- ============================================================================

-- ── leads : documents & RDV portés en JSONB sur la ligne ────────────────────
-- factures_acompte : factures d'acompte émises à chaque versement (Art. 289
--   CGI) — pièces LÉGALEMENT obligatoires. Absentes de toute migration → 🔴
--   perte garantie en Supabase.
-- reglements : registre des encaissements (source de vérité payé/reste).
--   NB : une table `reglements` existe (0017), mais le repository persiste le
--   registre EN JSONB sur le lead (`.upsert(state.leads)`), pas dans la table.
--   La colonne est donc nécessaire au fonctionnement actuel ; la table reste
--   disponible pour une future forme relationnelle (à réconcilier plus tard).
-- rdv : RDV d'installation confirmé (Planning / Bloc B) — champ tout neuf.
alter table leads
  add column if not exists factures_acompte jsonb,
  add column if not exists reglements       jsonb,
  add column if not exists rdv              jsonb;

-- ── profiles : champs ajoutés par l'écran « Équipe & Accès » ────────────────
-- telephone / invite_le / derniere_connexion : présents sur le type Profile et
--   upsertés (`.upsert(profiles)`), jamais créés par 0014.
alter table profiles
  add column if not exists telephone          text,
  add column if not exists invite_le          timestamptz,
  add column if not exists derniere_connexion timestamptz;

-- ---------------------------------------------------------------------------
--  Sécurité : ces colonnes tombent sous les policies EXISTANTES de leurs tables.
--  leads.{factures_acompte,reglements} sont financières → déjà couvertes par
--  leads_select/… (qui exigent app_voit_montants()) et la vue `chantiers`
--  (montant-blind) ne les sélectionne pas. Aucune policy à ajouter.
-- ---------------------------------------------------------------------------
