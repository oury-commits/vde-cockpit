-- ============================================================================
--  VDE Cockpit — Bootstrap Supabase PROD (schéma complet, idempotent).
--  Consolide les migrations 0001 + 0004 → 0019, dans l'ordre.
--
--  EXCLUS volontairement :
--    · supabase/dev-only/0002_dev_open_access.sql (accès anon de dev) ;
--    · toute policy transitoire « ouverte » (using(true)) : elle est remplacée
--      par la RLS cloisonnée de 0015/0016 — on va donc directement à l'état final
--      sécurisé (deny by default, jamais anon/public).
--
--  Rejouable sans effet de bord : IF NOT EXISTS / DO-exception duplicate_object /
--  drop-policy-if-exists partout. À coller tel quel dans le SQL Editor de
--  Supabase (prod), en une fois. Nécessite les schémas Supabase `auth` et
--  `storage` (présents par défaut). Se termine par des requêtes de CONTRÔLE.
-- ============================================================================

begin;

-- ============================================================================
--  0001 — Enums, leads, activites, updated_at.
-- ============================================================================

do $$ begin create type entite as enum ('FR','MA');
exception when duplicate_object then null; end $$;

do $$ begin create type canal as enum ('fb_ads','import','manuel');
exception when duplicate_object then null; end $$;

do $$ begin create type statut_lead as enum (
  'nouveau','a_qualifier','qualifie','devis_envoye',
  'signe','planifie','installe','sav','perdu');
exception when duplicate_object then null; end $$;

do $$ begin create type temperature as enum ('chaud','tiede','froid');
exception when duplicate_object then null; end $$;

do $$ begin create type type_logement as enum ('maison','appartement');
exception when duplicate_object then null; end $$;

do $$ begin create type puissance_kw as enum ('3.7','7.4','11','22');
exception when duplicate_object then null; end $$;

do $$ begin create type motif_perte as enum ('prix','delai','injoignable','concurrent','autre');
exception when duplicate_object then null; end $$;

do $$ begin create type activite_type as enum (
  'import','creation','appel','whatsapp','email','visite',
  'note','devis','relance','statut','signature','paiement');
exception when duplicate_object then null; end $$;

create table if not exists leads (
  id                  text primary key,
  entite              entite not null default 'FR',
  date_reception      timestamptz not null default now(),
  canal               canal not null default 'import',
  source_campagne     text,
  nom                 text not null,
  telephone           text not null,
  email               text,
  code_postal         text,
  ville               text,
  type_logement       type_logement,
  type_vehicule       text,
  puissance_souhaitee puissance_kw,
  distance_tableau    numeric,
  eligible_advenir    boolean,
  temperature         temperature not null default 'froid',
  statut              statut_lead not null default 'nouveau',
  montant_estime      numeric,
  devis               jsonb,
  echeancier          jsonb,
  prochaine_action    text,
  date_relance        timestamptz,
  motif_perte         motif_perte,
  assigne_a           text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  statut_change_at    timestamptz not null default now()
);

create index if not exists leads_entite_idx          on leads (entite);
create index if not exists leads_date_reception_idx  on leads (date_reception desc);
create index if not exists leads_statut_idx          on leads (statut);
create index if not exists leads_temperature_idx     on leads (temperature);
create index if not exists leads_date_relance_idx    on leads (date_relance);
create unique index if not exists leads_telephone_key on leads (telephone) where telephone is not null;
create unique index if not exists leads_email_key     on leads (lower(email)) where email is not null;

create table if not exists activites (
  id          uuid primary key default gen_random_uuid(),
  lead_id     text not null references leads (id) on delete cascade,
  type        activite_type not null,
  contenu     text not null,
  auteur      text not null default 'Système',
  created_at  timestamptz not null default now()
);
create index if not exists activites_lead_id_idx on activites (lead_id, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

alter table leads     enable row level security;
alter table activites enable row level security;
-- Policies permissives de 0001 (leads_authenticated_all / activites_authenticated_all)
-- OMISES : remplacées par la RLS cloisonnée de 0015 (section plus bas).

-- ============================================================================
--  0004 — Qualification IRVE + solaire (colonnes additives, nullables).
-- ============================================================================

do $$ begin create type reseau as enum ('mono','tri');
exception when duplicate_object then null; end $$;
do $$ begin create type occupation as enum ('proprietaire','locataire');
exception when duplicate_object then null; end $$;
do $$ begin create type emplacement as enum ('interieur','exterieur');
exception when duplicate_object then null; end $$;
do $$ begin create type fixation as enum ('murale','pied');
exception when duplicate_object then null; end $$;
do $$ begin create type pv_projet as enum ('aucun','3kwc','6kwc','9kwc','autre');
exception when duplicate_object then null; end $$;

alter table leads
  add column if not exists adresse                text,
  add column if not exists reseau                 reseau,
  add column if not exists puissance_compteur_kva numeric,
  add column if not exists occupation             occupation,
  add column if not exists emplacement            emplacement,
  add column if not exists fixation               fixation,
  add column if not exists obstacles              text,
  add column if not exists budget                 text,
  add column if not exists delai                  text,
  add column if not exists pv_projet              pv_projet,
  add column if not exists pv_autre               text;

-- ============================================================================
--  0005 — Facture (JSONB sur le lead).
-- ============================================================================
alter table leads add column if not exists facture jsonb;

-- ============================================================================
--  0006 — Catalogue de prix.
-- ============================================================================
do $$ begin create type categorie_article as enum
  ('borne','pose','tableau','terre','option','consommable','deplacement');
exception when duplicate_object then null; end $$;
do $$ begin create type unite_article as enum ('u','forfait','m');
exception when duplicate_object then null; end $$;

create table if not exists catalogue (
  id             text primary key,
  designation    text not null,
  categorie      categorie_article not null,
  unite          unite_article not null default 'u',
  cout_ht        numeric not null default 0,
  entite         entite not null default 'FR',
  actif          boolean not null default true,
  a_confirmer    boolean not null default false,
  inclus_defaut  boolean not null default false,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists catalogue_entite_idx    on catalogue (entite);
create index if not exists catalogue_categorie_idx on catalogue (categorie);

drop trigger if exists catalogue_set_updated_at on catalogue;
create trigger catalogue_set_updated_at
  before update on catalogue
  for each row execute function set_updated_at();

alter table catalogue enable row level security;
-- Policy permissive de 0006 (catalogue_authenticated_all) OMISE : RLS finale en 0015.

-- ============================================================================
--  0007 — Prix Maroc surchargeable.
-- ============================================================================
alter table catalogue add column if not exists cout_ma numeric;

-- ============================================================================
--  0008 — Séquences (numérotation atomique). La fonction next_sequence et sa
--  policy sont posées en FORME FINALE dans la section 0015 (contrôle d'entité).
-- ============================================================================
create table if not exists sequences (
  entite   entite not null,
  type     text not null check (type in ('devis','facture')),
  next_val bigint not null default 0,
  primary key (entite, type)
);
alter table sequences enable row level security;

-- ============================================================================
--  0009 — Archivage des leads.
-- ============================================================================
alter table leads add column if not exists archived boolean not null default false;
create index if not exists leads_archived_idx on leads (archived);

-- ============================================================================
--  0010 — Fiche produit + QR sur le catalogue.
-- ============================================================================
alter table catalogue
  add column if not exists url_produit text,
  add column if not exists afficher_qr boolean not null default false;

-- ============================================================================
--  0011 — Envoi des documents : index de relance + bucket privé.
-- ============================================================================
create index if not exists leads_devis_envoye_le_idx   on leads (((devis   ->> 'envoye_le')));
create index if not exists leads_facture_envoye_le_idx on leads (((facture ->> 'envoye_le')));

insert into storage.buckets (id, name, public)
  values ('documents','documents',false)
  on conflict (id) do nothing;
-- Policies storage permissives de 0011 OMISES : RLS finale cloisonnée en 0016.

-- ============================================================================
--  0012 — Suivi collaboratif (jalons + notes typées dans la timeline).
-- ============================================================================
alter table activites
  add column if not exists jalon      text,
  add column if not exists annule     boolean not null default false,
  add column if not exists visibilite text;
create index if not exists activites_lead_jalon_idx on activites (lead_id, jalon, created_at desc);

-- ============================================================================
--  0013 — Verrou optimiste.
-- ============================================================================
alter table leads
  add column if not exists version int not null default 0,
  add column if not exists modifie_par text;
alter table catalogue
  add column if not exists version int not null default 0,
  add column if not exists modifie_par text;

-- ============================================================================
--  0014 — Équipe (profiles) + interventions terrain.
-- ============================================================================
create table if not exists profiles (
  id            text primary key,
  email         text not null unique,
  nom           text not null,
  role          text,
  entite        text,
  actif         boolean not null default true,
  overrides     jsonb not null default '{}'::jsonb,
  demo          boolean not null default false,
  modifie_par   text,
  modifie_le    timestamptz,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_valide') then
    alter table profiles add constraint profiles_role_valide
      check (role is null or role in (
        'admin','charge_affaires','conducteur_travaux','technicien','assistante'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_entite_valide') then
    alter table profiles add constraint profiles_entite_valide
      check (entite is null or entite in ('FR','MA','ALL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_all_admin_seulement') then
    alter table profiles add constraint profiles_all_admin_seulement
      check (entite <> 'ALL' or role = 'admin');
  end if;
end $$;

create table if not exists interventions (
  id             text primary key,
  entite         text not null,
  lead_id        text references leads(id) on delete set null,
  technicien_id  text references profiles(id) on delete set null,
  date           timestamptz not null,
  creneau        text not null,
  type           text not null,
  statut         text not null default 'planifiee',
  client_nom     text not null,
  telephone      text,
  adresse        text,
  ville          text,
  consigne       text,
  created_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interventions_entite_valide') then
    alter table interventions add constraint interventions_entite_valide
      check (entite in ('FR','MA'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'interventions_type_valide') then
    alter table interventions add constraint interventions_type_valide
      check (type in ('pose','sav','visite_technique'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'interventions_statut_valide') then
    alter table interventions add constraint interventions_statut_valide
      check (statut in ('planifiee','en_cours','terminee'));
  end if;
end $$;

create index if not exists interventions_technicien_date_idx on interventions (technicien_id, date);

alter table profiles      enable row level security;
alter table interventions enable row level security;

-- ============================================================================
--  0015 — RLS : le verrou dur (deny by default, jamais anon).
-- ============================================================================

-- 1. profiles.id text → uuid (référence auth.users). Ne convertit QUE si la
--    table est vide ; sinon échoue bruyamment plutôt que détruire des lignes.
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
        '0015 : profiles contient % ligne(s) en id texte. Vider la table (comptes de test uniquement) puis rejouer.', nb;
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

-- profiles.id référence auth.users (supprimer l'utilisateur retire ses droits).
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

-- 2. Helpers SECURITY DEFINER (search_path = '' épinglé — anti-élévation).
create or replace function public.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.actif;
$$;

create or replace function public.app_entite()
returns text language sql stable security definer set search_path = '' as $$
  select p.entite from public.profiles p where p.id = auth.uid() and p.actif;
$$;

create or replace function public.app_derogation(cle text)
returns text language sql stable security definer set search_path = '' as $$
  select p.overrides ->> cle
    from public.profiles p
   where p.id = auth.uid() and p.actif;
$$;

create or replace function public.app_voit_entite(e text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.entite = 'ALL' or p.entite = e
       from public.profiles p
      where p.id = auth.uid() and p.actif),
    false);
$$;

create or replace function public.app_voit_montants()
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when (select public.app_derogation('montants')) is not null
      then (select public.app_derogation('montants')) <> 'none'
    else coalesce(
      (select p.role not in ('conducteur_travaux','technicien')
         from public.profiles p
        where p.id = auth.uid() and p.actif),
      false)
  end;
$$;

create or replace function public.app_peut(module text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  r text;
  d text;
begin
  select p.role into r from public.profiles p where p.id = auth.uid() and p.actif;
  if r is null then
    return false;
  end if;
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

-- 3. Purge des policies héritées (permissives + tout reste d'accès anon de dev).
drop policy if exists "dev_open_access_leads_anon"     on public.leads;
drop policy if exists "dev_open_access_activites_anon" on public.activites;
drop policy if exists "leads_authenticated_all"        on public.leads;
drop policy if exists "activites_authenticated_all"    on public.activites;
drop policy if exists "catalogue_authenticated_all"    on public.catalogue;
drop policy if exists "sequences_authenticated_read"   on public.sequences;

-- 4. leads — entité ∩ rôle ∩ voit-montants.
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

-- 5. activites — cloisonnées par jointure sur le lead.
alter table public.activites enable row level security;

drop policy if exists activites_select on public.activites;
create policy activites_select on public.activites
  for select to authenticated
  using (public.app_voit_lead(lead_id));

drop policy if exists activites_insert on public.activites;
create policy activites_insert on public.activites
  for insert to authenticated
  with check (public.app_voit_lead(lead_id));

-- 6. catalogue — contient les coûts d'achat.
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
    and (select public.app_role()) in ('admin','charge_affaires')
  );

drop policy if exists catalogue_update on public.catalogue;
create policy catalogue_update on public.catalogue
  for update to authenticated
  using (
    (select public.app_voit_entite(entite::text))
    and (select public.app_role()) in ('admin','charge_affaires')
  )
  with check ((select public.app_voit_entite(entite::text)));

drop policy if exists catalogue_delete on public.catalogue;
create policy catalogue_delete on public.catalogue
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- 7. sequences — next_sequence en forme finale (contrôle d'entité + search_path).
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

alter table public.sequences enable row level security;
drop policy if exists sequences_select on public.sequences;
create policy sequences_select on public.sequences
  for select to authenticated
  using ((select public.app_voit_entite(entite::text)));

-- 8. profiles — la table des droits.
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or (select public.app_role()) = 'admin');

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

create or replace view public.membres
with (security_invoker = off) as
  select p.id, p.nom, p.role, p.entite, p.actif
    from public.profiles p
   where (select public.app_voit_entite(p.entite))
      or (select public.app_role()) = 'admin';

revoke all on public.membres from public, anon;
grant select on public.membres to authenticated;

-- 9. interventions — la tournée terrain.
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
    and (select public.app_role()) in ('admin','conducteur_travaux')
  );

drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions
  for update to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (
      case (select public.app_role())
        when 'technicien' then technicien_id = auth.uid()
        else (select public.app_role()) in ('admin','conducteur_travaux')
      end
    )
  )
  with check (
    (select public.app_voit_entite(entite))
    and (
      case (select public.app_role())
        when 'technicien' then technicien_id = auth.uid()
        else (select public.app_role()) in ('admin','conducteur_travaux')
      end
    )
  );

drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions
  for delete to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_role()) in ('admin','conducteur_travaux')
  );

-- 10. chantiers — vue « terrain sans montants » (rôles aveugles aux prix).
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
    and (
      (select public.app_role()) is distinct from 'technicien'
      or exists (
        select 1 from public.interventions i
         where i.lead_id = l.id and i.technicien_id = auth.uid()
      )
    );

revoke all on public.chantiers from public, anon;
grant select on public.chantiers to authenticated;

-- 11. Index de support des policies.
create index if not exists profiles_role_idx        on public.profiles (role);
create index if not exists profiles_entite_idx      on public.profiles (entite);
create index if not exists profiles_actif_idx       on public.profiles (actif);
create index if not exists interventions_entite_idx on public.interventions (entite);

-- ============================================================================
--  0016 — Storage : cloisonner les fichiers (bucket privé `documents`).
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('documents','documents',false)
  on conflict (id) do nothing;

drop policy if exists "documents_authenticated_read"   on storage.objects;
drop policy if exists "documents_authenticated_write"  on storage.objects;
drop policy if exists "documents_authenticated_update" on storage.objects;
drop policy if exists "documents_select" on storage.objects;
drop policy if exists "documents_insert" on storage.objects;
drop policy if exists "documents_update" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

create policy "documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  );

create policy "documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_peut('devis'))
  );

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

create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  );

-- ============================================================================
--  0017 — reglements : registre des encaissements (donnée financière).
-- ============================================================================
create table if not exists reglements (
  id                   text primary key,
  lead_id              text not null references leads(id) on delete cascade,
  entite               text not null,
  montant              numeric not null check (montant > 0),
  mode                 text not null,
  facture_acompte_ref  text,
  encaisse_le          timestamptz not null default now(),
  auteur               text,
  created_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reglements_entite_valide') then
    alter table reglements add constraint reglements_entite_valide
      check (entite in ('FR','MA'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reglements_mode_valide') then
    alter table reglements add constraint reglements_mode_valide
      check (mode in ('virement','cheque','cb','especes','alma'));
  end if;
end $$;

create index if not exists reglements_lead_idx   on reglements (lead_id);
create index if not exists reglements_entite_idx on reglements (entite);

alter table reglements enable row level security;

drop policy if exists reglements_select on reglements;
create policy reglements_select on reglements
  for select to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_peut('devis'))
    and (select public.app_voit_montants())
  );

drop policy if exists reglements_insert on reglements;
create policy reglements_insert on reglements
  for insert to authenticated
  with check (
    (select public.app_voit_entite(entite))
    and (select public.app_peut('devis'))
    and (select public.app_voit_montants())
  );

drop policy if exists reglements_update on reglements;
create policy reglements_update on reglements
  for update to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_peut('devis'))
    and (select public.app_voit_montants())
  )
  with check (
    (select public.app_voit_entite(entite))
    and (select public.app_peut('devis'))
  );

drop policy if exists reglements_delete on reglements;
create policy reglements_delete on reglements
  for delete to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_role()) = 'admin'
  );

-- ============================================================================
--  0018 — Planning : jetons Google Calendar + géocodage / créneaux RDV.
-- ============================================================================
create table if not exists calendar_tokens (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null default 'google',
  access_token_enc   text,
  refresh_token_enc  text,
  expiry             timestamptz,
  scopes             text,
  calendars          jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- RLS STRICTE : AUCUNE policy pour authenticated → server-only (service_role).
alter table calendar_tokens enable row level security;

alter table interventions
  add column if not exists lat             numeric,
  add column if not exists lng             numeric,
  add column if not exists rdv_debut       timestamptz,
  add column if not exists rdv_fin         timestamptz,
  add column if not exists zone            text,
  add column if not exists google_event_id text;

alter table leads
  add column if not exists lat numeric,
  add column if not exists lng numeric;

create index if not exists interventions_rdv_debut_idx on interventions (technicien_id, rdv_debut);

-- ============================================================================
--  0019 — Colonnes manquantes (balayage schéma ↔ code : upsert d'objets entiers).
--  Toute propriété d'un type applicatif upserté devient une colonne ; celles-ci
--  étaient lues/écrites par le code sans jamais être créées par 0001→0018.
-- ============================================================================
-- leads : factures_acompte (Art. 289 CGI — obligatoire), reglements (registre
--   upserté en JSONB sur le lead), rdv (Planning / Bloc B).
alter table leads
  add column if not exists factures_acompte jsonb,
  add column if not exists reglements       jsonb,
  add column if not exists rdv              jsonb;
-- profiles : champs de l'écran Équipe & Accès (upsertés, jamais créés par 0014).
alter table profiles
  add column if not exists telephone          text,
  add column if not exists invite_le          timestamptz,
  add column if not exists derniere_connexion timestamptz;

commit;

-- ============================================================================
--  CONTRÔLES — à LIRE (pas à survoler). Exécutés après COMMIT.
-- ============================================================================

-- (A) La table profiles existe et son id est bien un uuid (lié à auth.users).
select
  to_regclass('public.profiles') is not null              as profiles_existe,
  (select data_type from information_schema.columns
     where table_schema='public' and table_name='profiles' and column_name='id') as profiles_id_type;

-- (B) RLS active sur toutes les tables sensibles (toutes doivent être true).
select c.relname as table, c.relrowsecurity as rls_active
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('leads','activites','catalogue','sequences',
                     'profiles','interventions','reglements','calendar_tokens')
 order by c.relname;

-- (C) AUCUNE policy anon/public (doit renvoyer 0 ligne).
select schemaname, tablename, policyname, roles
  from pg_policies
 where schemaname in ('public','storage')
   and ('anon' = any(roles) or 'public' = any(roles));

-- (D) calendar_tokens = server-only : AUCUNE policy (doit renvoyer 0 ligne).
select policyname
  from pg_policies
 where schemaname = 'public' and tablename = 'calendar_tokens';

-- (E) Toute table publique sans RLS = fuite (doit renvoyer 0 ligne).
select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- (F) Panorama : toutes les policies applicatives doivent être {authenticated}.
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname in ('public','storage')
 order by tablename, cmd, policyname;

-- (G) Colonnes rattrapées par 0019 (doit renvoyer les 6 lignes ci-dessous).
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'leads'    and column_name in ('factures_acompte','reglements','rdv'))
     or (table_name = 'profiles' and column_name in ('telephone','invite_le','derniere_connexion'))
   )
 order by table_name, column_name;
