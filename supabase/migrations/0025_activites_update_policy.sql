-- ============================================================================
--  0025 — Fix RLS activites : policy UPDATE manquante (upsert de la timeline).
--
--  Symptôme (prod, auth active) : toute écriture de timeline échoue avec
--    « new row violates row-level security policy (USING expression)
--      for table "activites" ».
--
--  Cause EXACTE (reproduite en Postgres) : l'app persiste la timeline via
--    sb.from("activites").upsert(tableauComplet)  (lib/leads/repository.ts).
--  Pour une activité DÉJÀ en base, cet upsert devient
--    INSERT ... ON CONFLICT (id) DO UPDATE : la branche UPDATE exige une policy
--  UPDATE. Or 0015 n'a posé que SELECT + INSERT sur activites (par choix
--  « trace immuable »). Deny-by-default sur l'UPDATE → la ligne ciblée par le
--  conflit est rejetée sur l'expression USING (absente ⇒ false), d'où le message.
--  (Un UPDATE « nu » sans WHERE ne lèverait pas d'erreur : il filtrerait 0 ligne
--   silencieusement — c'était l'angle mort du test:rls.)
--
--  Correctif : policy UPDATE ALIGNÉE SUR leads — écriture cloisonnée par le lead
--  parent via app_voit_lead(lead_id). admin/ALL écrit toute entité ; un rôle
--  scopé n'écrit que dans SON entité ; une écriture cross-entité est refusée par
--  le WITH CHECK. Pas de DELETE : une trace ne s'efface pas (l'upsert n'en a pas
--  besoin — il n'efface jamais). Idempotent (drop-if-exists avant create).
-- ============================================================================

alter table public.activites enable row level security;

-- USING borne la ligne existante modifiable (branche UPDATE de l'upsert) ;
-- WITH CHECK borne le résultat → on ne peut pas réaffecter une trace à un
-- dossier hors périmètre. Miroir exact de la policy d'écriture de leads.
drop policy if exists activites_update on public.activites;
create policy activites_update on public.activites
  for update to authenticated
  using (public.app_voit_lead(lead_id))
  with check (public.app_voit_lead(lead_id));

-- ── Contrôle ────────────────────────────────────────────────────────────────
--  select polname, polcmd,
--         pg_get_expr(polqual, polrelid)      as using_expr,
--         pg_get_expr(polwithcheck, polrelid) as with_check_expr
--  from pg_policy where polrelid = 'public.activites'::regclass order by polcmd;
--  → doit lister SELECT / INSERT / UPDATE (tous scopés app_voit_lead), pas de DELETE.
