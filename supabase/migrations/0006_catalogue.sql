-- VDE Cockpit — 0006 : catalogue de prix (articles consommés par le devis).
-- NON appliquée tant que ce n'est pas validé. À jouer après 0005.
-- Le catalogue est seedé automatiquement par l'app au premier chargement.

do $$ begin
  create type categorie_article as enum
    ('borne','pose','tableau','terre','option','consommable','deplacement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unite_article as enum ('u','forfait','m');
exception when duplicate_object then null; end $$;

create table if not exists catalogue (
  id             text primary key,
  designation    text not null,
  categorie      categorie_article not null,
  unite          unite_article not null default 'u',
  cout_ht        numeric not null default 0,   -- coût de revient HT
  entite         entite not null default 'FR',
  actif          boolean not null default true,
  a_confirmer    boolean not null default false,
  inclus_defaut  boolean not null default false,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists catalogue_entite_idx on catalogue (entite);
create index if not exists catalogue_categorie_idx on catalogue (categorie);

-- updated_at auto (réutilise la fonction de 0001)
drop trigger if exists catalogue_set_updated_at on catalogue;
create trigger catalogue_set_updated_at
  before update on catalogue
  for each row execute function set_updated_at();

-- RLS : accès réservé aux utilisateurs authentifiés.
alter table catalogue enable row level security;
drop policy if exists "catalogue_authenticated_all" on catalogue;
create policy "catalogue_authenticated_all" on catalogue
  for all to authenticated using (true) with check (true);
