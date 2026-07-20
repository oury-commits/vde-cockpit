-- 0014 — Équipe (profils, rôles, dérogations) + interventions terrain.
-- Idempotent : rejouable sans effet de bord.

-- ---------------------------------------------------------------------------
-- profiles : qui est qui, et jusqu'où il va.
-- `id` correspondra à auth.users.id à l'activation de l'auth (P3).
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            text primary key,
  email         text not null unique,
  nom           text not null,
  -- null = compte non assigné → aucun accès (deny by default).
  role          text,
  entite        text,
  actif         boolean not null default true,
  -- Dérogations nominatives, par-dessus la matrice du rôle.
  overrides     jsonb not null default '{}'::jsonb,
  -- Compte de démonstration : jamais un salarié réel.
  demo          boolean not null default false,
  -- Traçabilité des droits : qui a modifié quoi, et quand.
  modifie_par   text,
  modifie_le    timestamptz,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_valide') then
    alter table profiles add constraint profiles_role_valide
      check (role is null or role in (
        'admin', 'charge_affaires', 'conducteur_travaux', 'technicien', 'assistante'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_entite_valide') then
    alter table profiles add constraint profiles_entite_valide
      check (entite is null or entite in ('FR', 'MA', 'ALL'));
  end if;

  -- « Tous pays » est réservé à l'admin. La règle est dans l'UI ; on la pose
  -- AUSSI en base, pour qu'un accès élargi ne puisse pas entrer par une
  -- écriture directe qui contournerait l'écran Équipe.
  if not exists (select 1 from pg_constraint where conname = 'profiles_all_admin_seulement') then
    alter table profiles add constraint profiles_all_admin_seulement
      check (entite <> 'ALL' or role = 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- interventions : la tournée terrain.
-- AUCUN montant dans cette table, volontairement : le technicien et le
-- conducteur de travaux ne voient jamais un prix. Rien à masquer ici, donc
-- rien à fuiter.
-- ---------------------------------------------------------------------------
create table if not exists interventions (
  id             text primary key,
  entite         text not null,
  lead_id        text references leads(id) on delete set null,
  -- Base du cloisonnement « sa tournée à lui » (filtre P3 : = auth.uid()).
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
      check (entite in ('FR', 'MA'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'interventions_type_valide') then
    alter table interventions add constraint interventions_type_valide
      check (type in ('pose', 'sav', 'visite_technique'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'interventions_statut_valide') then
    alter table interventions add constraint interventions_statut_valide
      check (statut in ('planifiee', 'en_cours', 'terminee'));
  end if;
end $$;

create index if not exists interventions_technicien_date_idx
  on interventions (technicien_id, date);

-- ---------------------------------------------------------------------------
-- RLS : activée SANS policy — donc tout est refusé.
-- Ces deux tables portent les droits et les coordonnées terrain : les laisser
-- ouvertes le temps de « faire tourner » serait exactement l'inverse de ce
-- qu'elles servent à garantir. Les policies arrivent en P3, avec l'auth.
-- Conséquence assumée : tant que P3 n'est pas posée, l'application lit ces
-- données depuis son jeu local, pas depuis Supabase.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table interventions enable row level security;
