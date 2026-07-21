-- ============================================================================
--  0016 — Storage : cloisonner les fichiers comme on a cloisonné les lignes.
-- ============================================================================
--
--  Les policies de 0011 ouvraient le bucket `documents` à TOUT compte
--  authentifié (`using (bucket_id = 'documents')`). C'est la même classe de
--  fuite qu'on vient de fermer sur les enregistrements, transposée aux
--  fichiers : un utilisateur MA pouvait télécharger un devis ou une photo FR.
--
--  Le chemin des objets porte déjà l'entité en premier segment
--  (`FR/VDE-2026-008.pdf`, cf. lib/documents/storage.ts). On s'en sert comme
--  clé de cloisonnement : `split_part(name, '/', 1)` = 'FR' | 'MA'.
--
--  Volontairement PAS `storage.foldername()` (helper Supabase) : `split_part`
--  est du SQL standard, donc la même règle est testable hors de Supabase
--  (npm run test:rls) — une policy qu'on ne peut pas rejouer est une policy
--  qu'on croit sur parole.
--
--  Un chemin sans préfixe connu (`split_part` renvoie autre chose que FR/MA)
--  échoue à app_voit_entite → refusé. Deny by default sans cas particulier.
--
--  Idempotent.
-- ============================================================================

-- Le bucket reste privé (rappel : les liens clients sont signés et expirants).
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- Purge des policies plates de 0011 : elles rendraient tout ce qui suit
-- décoratif, exactement comme les `..._authenticated_all` sur les tables.
drop policy if exists "documents_authenticated_read"   on storage.objects;
drop policy if exists "documents_authenticated_write"  on storage.objects;
drop policy if exists "documents_authenticated_update" on storage.objects;
drop policy if exists "documents_select" on storage.objects;
drop policy if exists "documents_insert" on storage.objects;
drop policy if exists "documents_update" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

-- Lecture : dans son entité, et seulement pour les rôles qui manipulent des
-- documents commerciaux (devis / factures). Un technicien ou un conducteur de
-- travaux, aveugles aux montants, n'ont pas à atteindre un PDF de devis.
create policy "documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  );

-- Dépôt : le préfixe du chemin DOIT être dans le périmètre. C'est ce qui
-- empêche un compte FR d'écrire un objet sous `MA/…` pour le faire lire par un
-- collègue marocain — l'exfiltration par écriture, côté fichiers.
create policy "documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  );

-- Remplacement (upsert de re-génération d'un PDF) : mêmes bornes avant ET
-- après, pour qu'on ne puisse pas déplacer un objet vers l'autre entité.
create policy "documents_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  )
  with check (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  );

-- Suppression : réservée à l'admin. Un devis émis est une pièce de traçabilité ;
-- l'effacer n'est pas un geste courant de commercial.
create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  );

-- ---------------------------------------------------------------------------
--  Contrôle après application (doit ne renvoyer que des policies documents_*
--  en {authenticated}) :
--    select policyname, cmd, roles from pg_policies
--     where schemaname = 'storage' and tablename = 'objects'
--     order by cmd;
-- ---------------------------------------------------------------------------
