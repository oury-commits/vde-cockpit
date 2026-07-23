-- ============================================================================
--  0021 — activite_type : ajouter la valeur d'enum manquante 'rdv'.
-- ============================================================================
--
--  🔴 Correctif d'intégrité. Le type TS `ActiviteType` (lib/types.ts) porte
--  'rdv' (timeline du RDV, Bloc B) et le store émet pushActivite(…, 'rdv', …)
--  à la confirmation/annulation d'un RDV. Mais l'enum SQL `activite_type`
--  (0001) ne contenait PAS 'rdv'. Comme la persistance upserte tout le tableau
--  d'activités d'un coup (repository.persistAll), la 1re activité 'rdv' faisait
--  échouer TOUT l'upsert activites (« invalid input value for enum ») en
--  SILENCE → la timeline gelait en base après le 1er RDV.
--
--  ADD VALUE IF NOT EXISTS est idempotent (Postgres 12+). Rejouable.
--  À jouer après 0020, en dehors d'une transaction (le SQL Editor Supabase
--  auto-commit chaque instruction — rien à faire de spécial).
-- ============================================================================

alter type activite_type add value if not exists 'rdv';

-- ---------------------------------------------------------------------------
--  Contrôle : 'rdv' doit figurer dans les valeurs de l'enum.
--    select enumlabel from pg_enum
--      join pg_type on pg_type.oid = pg_enum.enumtypid
--     where pg_type.typname = 'activite_type' order by enumsortorder;
-- ---------------------------------------------------------------------------
