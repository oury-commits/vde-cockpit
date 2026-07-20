-- ============================================================================
--  0015 — RLS : le verrou dur.
-- ============================================================================
--
--  P1 et P2 appliquent le cloisonnement dans l'interface. C'est un modèle
--  fonctionnel, pas une sécurité : une requête directe avec la clé publiable
--  contourne l'écran. Ce fichier déplace la règle là où on ne peut pas la
--  contourner — dans la base.
--
--  Principes tenus ici :
--    · deny by default — aucune table sans policy explicite ;
--    · une policy PAR OPÉRATION (select / insert / update / delete) : `for all`
--      masque la différence entre lire et écrire, qui est justement la
--      différence entre un chargé d'affaires et une assistante ;
--    · `to authenticated` partout — jamais `anon`, jamais `public` ;
--    · helpers SECURITY DEFINER avec `search_path = ''` : sans ce pinning, une
--      fonction definer est un vecteur d'élévation de privilèges ;
--    · les helpers sont appelés en `(select …)` : Postgres l'évalue une fois
--      par requête (InitPlan) au lieu d'une fois par ligne.
--
--  Idempotent : rejouable sans effet de bord.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.id doit être l'identifiant d'authentification.
--    Sans ce lien, `auth.uid()` ne désigne rien de vérifiable et toute la RLS
--    repose sur du vide. On convertit `text` → `uuid` référençant auth.users.
--    Garde-fou : on ne convertit QUE si la table est vide. Sinon on échoue
--    bruyamment plutôt que de détruire des lignes en silence.
-- ---------------------------------------------------------------------------
do $$
declare
  type_actuel text;
  nb bigint;
begin
  select data_type into type_actuel
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'id';

  if type_actuel is null then
    raise exception '0015 : table profiles absente — jouer 0014 d''abord.';
  end if;

  if type_actuel <> 'uuid' then
    select count(*) into nb from public.profiles;
    if nb > 0 then
      raise exception
        '0015 : profiles contient % ligne(s) en id texte. Vider la table (elle ne doit contenir que des comptes de test) puis rejouer.', nb;
    end if;

    alter table public.interventions
      drop constraint if exists interventions_technicien_id_fkey;

    alter table public.profiles
      alter column id type uuid using id::uuid;

    alter table public.interventions
      alter column technicien_id type uuid using technicien_id::uuid;

    alter table public.interventions
      add constraint interventions_technicien_id_fkey
      foreign key (technicien_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- Le profil n'existe que pour un compte réel : supprimer l'utilisateur retire
-- ses droits, sans profil orphelin qui traînerait avec un accès actif.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_auth_users_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers. Un seul endroit décide « qui est le demandeur et jusqu'où il va ».
--    SECURITY DEFINER : ils doivent lire `profiles` alors même que la RLS de
--    `profiles` restreint le demandeur à sa propre ligne.
-- ---------------------------------------------------------------------------

create or replace function public.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.actif;
$$;

create or replace function public.app_entite()
returns text language sql stable security definer set search_path = '' as $$
  select p.entite from public.profiles p where p.id = auth.uid() and p.actif;
$$;

-- Dérogation nominative pour une clé donnée ('montants', 'leads', …).
-- Renvoie null si aucune dérogation : l'appelant retombe alors sur le rôle.
create or replace function public.app_derogation(cle text)
returns text language sql stable security definer set search_path = '' as $$
  select p.overrides ->> cle
    from public.profiles p
   where p.id = auth.uid() and p.actif;
$$;

/**
 * Cloisonnement pays. `ALL` est réservé à l'admin (contrainte de 0014).
 * Un compte inactif ou non assigné ne voit rien : app_entite() est alors null
 * et la comparaison échoue — deny by default sans condition supplémentaire.
 */
create or replace function public.app_voit_entite(e text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.entite = 'ALL' or p.entite = e
       from public.profiles p
      where p.id = auth.uid() and p.actif),
    false);
$$;

/**
 * Le conducteur de travaux et le technicien ne voient jamais un montant.
 * Dérogation nominative possible ('montants'), assumée par l'admin dans
 * l'écran Équipe — miroir exact de peutVoirMontants() côté application.
 */
create or replace function public.app_voit_montants()
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when (select public.app_derogation('montants')) is not null
      then (select public.app_derogation('montants')) <> 'none'
    else coalesce(
      (select p.role not in ('conducteur_travaux', 'technicien')
         from public.profiles p
        where p.id = auth.uid() and p.actif),
      false)
  end;
$$;

/**
 * Accès à un module, dérogation comprise.
 *
 * ATTENTION — cette matrice DOUBLE celle de `lib/roles/permissions.ts`.
 * Celle-ci fait foi (c'est la seule que le client ne peut pas contourner) ;
 * l'autre n'est qu'un confort d'affichage. Toute modification doit être faite
 * des DEUX côtés, sinon l'écran promet un accès que la base refuse.
 */
create or replace function public.app_peut(module text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  r text;
  d text;
begin
  select p.role into r from public.profiles p where p.id = auth.uid() and p.actif;
  if r is null then
    return false; -- compte inactif, non assigné, ou inexistant
  end if;

  -- Une dérogation ne ressuscite jamais un compte fermé : elle n'est consultée
  -- qu'après le contrôle ci-dessus.
  select p.overrides ->> module into d
    from public.profiles p where p.id = auth.uid();
  if d is not null then
    return d <> 'none';
  end if;

  return case r
    when 'admin' then true
    when 'charge_affaires' then module in (
      'dashboard','leads','prospects','clients','devis','catalogue',
      'validation','inbox','planning','sav','rapports')
    when 'assistante' then module in (
      'dashboard','leads','prospects','clients','devis','catalogue',
      'validation','inbox','planning','sav')
    when 'conducteur_travaux' then module in (
      'dashboard','clients','planning','sav','techniciens','rapports')
    when 'technicien' then module in ('clients','planning','mobile','sav')
    else false
  end;
end $$;

/**
 * Un lead est-il dans le périmètre du demandeur ?
 * SECURITY DEFINER volontaire : appelée depuis les policies de `activites`,
 * elle ne doit pas re-déclencher la RLS de `leads` (récursion + coût par ligne).
 */
create or replace function public.app_voit_lead(p_lead_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leads l
     where l.id = p_lead_id
       and (select public.app_voit_entite(l.entite::text))
       and (select public.app_peut('leads'))
  );
$$;

revoke execute on function
  public.app_role(), public.app_entite(), public.app_derogation(text),
  public.app_voit_entite(text), public.app_voit_montants(),
  public.app_peut(text), public.app_voit_lead(text)
  from public;

grant execute on function
  public.app_role(), public.app_entite(), public.app_derogation(text),
  public.app_voit_entite(text), public.app_voit_montants(),
  public.app_peut(text), public.app_voit_lead(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Purge des policies permissives héritées.
--    Elles rendraient tout le reste décoratif : `using (true)` sur `leads`
--    annule le cloisonnement pays qu'on vient d'écrire.
-- ---------------------------------------------------------------------------
drop policy if exists "dev_open_access_leads_anon"     on public.leads;
drop policy if exists "dev_open_access_activites_anon" on public.activites;
drop policy if exists "leads_authenticated_all"        on public.leads;
drop policy if exists "activites_authenticated_all"    on public.activites;
drop policy if exists "catalogue_authenticated_all"    on public.catalogue;
drop policy if exists "sequences_authenticated_read"   on public.sequences;

-- ---------------------------------------------------------------------------
-- 4. leads — socle entité ∩ rôle.
--    Les colonnes financières (montant_estime, devis, facture, echeancier)
--    vivent ici : les rôles aveugles aux montants n'accèdent pas à la table.
--    Ils passent par la vue `chantiers` (section 8).
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('leads'))
    and (select public.app_voit_montants())
  );

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('leads'))
    and (select public.app_voit_montants())
  );

-- USING borne les lignes modifiables, WITH CHECK borne le résultat : sans le
-- second, on pourrait déplacer un dossier vers l'autre entité et le perdre de
-- vue — une exfiltration par mise à jour.
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('leads'))
    and (select public.app_voit_montants())
  )
  with check (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('leads'))
  );

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('leads'))
    and (select public.app_voit_montants())
  );

-- ---------------------------------------------------------------------------
-- 5. activites — cloisonnées par jointure sur le lead, pas par une colonne
--    `entite` dupliquée qui pourrait diverger de celle du dossier.
-- ---------------------------------------------------------------------------
alter table public.activites enable row level security;

drop policy if exists activites_select on public.activites;
create policy activites_select on public.activites
  for select to authenticated
  using (public.app_voit_lead(lead_id));

drop policy if exists activites_insert on public.activites;
create policy activites_insert on public.activites
  for insert to authenticated
  with check (public.app_voit_lead(lead_id));

-- Pas d'update ni de delete : une trace qu'on peut réécrire n'est pas une
-- trace. L'annulation d'un jalon ajoute une ligne « annulé » (colonne annule).

-- ---------------------------------------------------------------------------
-- 6. catalogue — contient les coûts d'achat (cout_ht, cout_ma).
-- ---------------------------------------------------------------------------
alter table public.catalogue enable row level security;

drop policy if exists catalogue_select on public.catalogue;
create policy catalogue_select on public.catalogue
  for select to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_peut('catalogue'))
    and (select public.app_voit_montants())
  );

drop policy if exists catalogue_ecriture on public.catalogue;
create policy catalogue_ecriture on public.catalogue
  for insert to authenticated
  with check (
    (select public.app_voit_entite(entite::text))
    and (select public.app_role()) in ('admin', 'charge_affaires')
  );

drop policy if exists catalogue_update on public.catalogue;
create policy catalogue_update on public.catalogue
  for update to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_role()) in ('admin', 'charge_affaires')
  )
  with check ((select public.app_voit_entite(entite::text)));

drop policy if exists catalogue_delete on public.catalogue;
create policy catalogue_delete on public.catalogue
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- 7. sequences — compteurs de numérotation.
--    Lecture bornée à son entité ; écriture réservée à la RPC next_sequence,
--    seule à pouvoir incrémenter (aucune policy insert/update ici).
-- ---------------------------------------------------------------------------
alter table public.sequences enable row level security;

drop policy if exists sequences_select on public.sequences;
create policy sequences_select on public.sequences
  for select to authenticated
  using ((select public.app_voit_entite(entite::text)));

-- next_sequence est SECURITY DEFINER depuis 0008, mais sans search_path épinglé.
-- On corrige : une fonction definer dont le search_path est modifiable par
-- l'appelant peut être détournée pour exécuter du code avec les droits du
-- définisseur. On y ajoute le contrôle d'entité, que la RLS ne peut pas faire
-- puisque la fonction s'exécute justement au-dessus d'elle.
create or replace function public.next_sequence(p_entite entite, p_type text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  if p_type not in ('devis','facture') then
    raise exception 'type de séquence invalide : %', p_type;
  end if;
  if not (select public.app_voit_entite(p_entite::text)) then
    raise exception 'numérotation refusée : entité % hors périmètre', p_entite;
  end if;
  -- Un numéro de devis engage l'entreprise : le réserver n'est pas un droit de
  -- lecture. Sans ce contrôle, tout compte authentifié pourrait consommer la
  -- série et y créer des trous.
  if not (select public.app_peut('devis')) then
    raise exception 'numérotation refusée : ce rôle n''établit pas de devis';
  end if;
  insert into public.sequences (entite, type, next_val)
    values (p_entite, p_type, 0)
    on conflict (entite, type) do nothing;
  update public.sequences
    set next_val = next_val + 1
    where entite = p_entite and type = p_type
    returning next_val into v;
  return v;
end;
$$;

revoke execute on function public.next_sequence(entite, text) from public;
grant execute on function public.next_sequence(entite, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. profiles — la table des droits. La plus sensible du schéma.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Chacun lit sa propre ligne ; l'admin lit tout le monde. Personne d'autre ne
-- voit les dérogations d'un collègue.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or (select public.app_role()) = 'admin');

-- Écriture réservée à l'admin. Un utilisateur ne modifie pas sa propre ligne :
-- ce serait l'auto-attribution de droits, exactement ce que la table empêche.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.app_role()) = 'admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- L'application a besoin des noms des collègues (assignation, « passer le
-- relais », auteur d'une note) sans exposer leurs droits. Vue restreinte aux
-- membres de la même entité, colonnes non sensibles uniquement.
create or replace view public.membres
with (security_invoker = off) as
  select p.id, p.nom, p.role, p.entite, p.actif
    from public.profiles p
   where (select public.app_voit_entite(p.entite))
      or (select public.app_role()) = 'admin';

revoke all on public.membres from public, anon;
grant select on public.membres to authenticated;

-- ---------------------------------------------------------------------------
-- 9. interventions — la tournée terrain.
--    Le technicien ne voit QUE la sienne. Le conducteur de travaux voit toute
--    son entité (c'est lui qui planifie).
-- ---------------------------------------------------------------------------
alter table public.interventions enable row level security;

drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions
  for select to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (
      case (select public.app_role())
        when 'technicien' then technicien_id = auth.uid()
        else (select public.app_peut('planning'))
      end
    )
  );

drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions
  for insert to authenticated
  with check (
    (select public.app_voit_entite(entite))
    and (select public.app_role()) in ('admin', 'conducteur_travaux')
  );

-- Le technicien met à jour SES interventions (statut, compte rendu) et ne peut
-- ni les déplacer hors de son entité, ni se les retirer, ni s'en attribuer une
-- autre : le WITH CHECK reconduit les deux conditions après écriture.
drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions
  for update to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (
      case (select public.app_role())
        when 'technicien' then technicien_id = auth.uid()
        else (select public.app_role()) in ('admin', 'conducteur_travaux')
      end
    )
  )
  with check (
    (select public.app_voit_entite(entite))
    and (
      case (select public.app_role())
        when 'technicien' then technicien_id = auth.uid()
        else (select public.app_role()) in ('admin', 'conducteur_travaux')
      end
    )
  );

drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions
  for delete to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_role()) in ('admin', 'conducteur_travaux')
  );

-- ---------------------------------------------------------------------------
-- 10. chantiers — ce que voient les rôles aveugles aux montants.
--     La RLS filtre des LIGNES, pas des COLONNES : interdire `leads` à un
--     conducteur de travaux le priverait du nom et de l'adresse du chantier.
--     Cette vue expose le terrain sans un seul champ financier.
--     `security_invoker = off` est délibéré : la vue s'exécute avec les droits
--     de son propriétaire, donc au-dessus de la RLS de `leads`. Elle porte donc
--     SA PROPRE clause de cloisonnement — celle qui suit n'est pas décorative.
-- ---------------------------------------------------------------------------
create or replace view public.chantiers
with (security_invoker = off) as
  select
    l.id, l.entite, l.nom, l.telephone, l.email,
    l.adresse, l.code_postal, l.ville,
    l.type_logement, l.puissance_souhaitee, l.reseau,
    l.emplacement, l.fixation, l.obstacles, l.distance_tableau,
    l.statut, l.date_reception, l.assigne_a, l.archived
  from public.leads l
  where (select public.app_voit_entite(l.entite::text))
    and (select public.app_peut('clients'))
    -- Le technicien a un accès « partiel » aux clients : ceux chez qui il
    -- intervient, pas le fichier client de l'entité. Un installateur n'a pas
    -- besoin de la liste des prospects pour poser une borne.
    and (
      (select public.app_role()) is distinct from 'technicien'
      or exists (
        select 1 from public.interventions i
         where i.lead_id = l.id and i.technicien_id = auth.uid()
      )
    );

revoke all on public.chantiers from public, anon;
grant select on public.chantiers to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Index de support des policies.
--     Une policy est évaluée à chaque ligne candidate : sans index sur les
--     colonnes qu'elle filtre, le cloisonnement se paie en séquentiel.
-- ---------------------------------------------------------------------------
create index if not exists profiles_role_idx        on public.profiles (role);
create index if not exists profiles_entite_idx      on public.profiles (entite);
create index if not exists profiles_actif_idx       on public.profiles (actif);
create index if not exists interventions_entite_idx on public.interventions (entite);
-- leads (entite) et interventions (technicien_id, date) existent déjà (0001, 0014).

-- ---------------------------------------------------------------------------
-- 12. Contrôle après application — à lire, pas à survoler.
--     Doit renvoyer 0 ligne. Toute ligne retournée est une porte ouverte.
-- ---------------------------------------------------------------------------
-- select tablename, policyname, roles, cmd
--   from pg_policies
--  where schemaname = 'public'
--    and ('anon' = any (roles) or 'public' = any (roles));
--
-- Doit lister UNIQUEMENT des policies `{authenticated}` :
-- select tablename, policyname, cmd, roles
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
--
-- Toute table publique sans RLS est une fuite :
-- select c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
