-- ============================================================================
--  0002_dev_open_access.sql — TEMPORAIRE · DÉVELOPPEMENT LOCAL UNIQUEMENT
-- ============================================================================
--
--  ⚠️  CETTE MIGRATION OUVRE LA BASE AU RÔLE `anon`.
--
--  Elle autorise la lecture ET l'écriture sur `leads` et `activites` SANS
--  authentification. La clé publiable étant publique par design (elle est
--  livrée dans le bundle navigateur), cela rend la base accessible à toute
--  personne connaissant l'URL du projet. Le fait que l'app tourne « en local »
--  NE protège PAS la base : le projet Supabase, lui, est sur Internet.
--
--  À N'APPLIQUER QUE tant que la base ne contient AUCUNE donnée client réelle.
--  À RETIRER impérativement avant :
--    · tout import de données réelles (CSV AppSheet = PII clients),
--    · toute mise en ligne / ouverture aux salariés.
--
--  Pendant sa durée de vie, le flag NEXT_PUBLIC_AUTH_DISABLED=true doit rester
--  cantonné au .env.local. Voir « AVANT MISE EN LIGNE » dans le README.
--
--  Contrepartie : la migration 0001 reste intacte (RLS stricte `authenticated`).
--  Ce fichier ne fait qu'AJOUTER des policies, et le rollback ci-dessous les
--  retire proprement pour revenir exactement à l'état de 0001.
-- ============================================================================

create policy "dev_open_access_leads_anon" on leads
  for all to anon using (true) with check (true);

create policy "dev_open_access_activites_anon" on activites
  for all to anon using (true) with check (true);

-- ============================================================================
--  ROLLBACK — à exécuter dans le SQL Editor AVANT toute mise en ligne
--  (et avant l'import de vraies données clients).
--  Après exécution, la RLS stricte de 0001 (accès `authenticated` seul) est
--  intégralement restaurée : aucune autre policy n'est touchée.
-- ============================================================================
--
--  drop policy if exists "dev_open_access_leads_anon" on leads;
--  drop policy if exists "dev_open_access_activites_anon" on activites;
--
--  -- Vérification : ne doit plus lister que les policies "..._authenticated_all"
--  select tablename, policyname, roles
--    from pg_policies
--   where tablename in ('leads', 'activites')
--   order by tablename, policyname;
-- ============================================================================
