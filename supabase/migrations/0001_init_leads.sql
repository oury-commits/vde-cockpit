-- VDE Cockpit — Module CRM Leads (VDE France)
-- Schéma initial : leads + activites. Aligné sur lib/types.ts.
-- NON appliqué en Phase 2A (UI + données locales). Sera exécuté en 2B, une
-- fois le projet Supabase fourni par Oury. Accès réservé aux authentifiés.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type canal as enum ('fb_ads', 'import', 'manuel');

create type statut_lead as enum (
  'nouveau', 'a_qualifier', 'qualifie', 'devis_envoye',
  'signe', 'planifie', 'installe', 'sav', 'perdu'
);

create type temperature as enum ('chaud', 'tiede', 'froid');

create type type_logement as enum ('maison', 'appartement');

create type puissance_kw as enum ('3.7', '7.4', '11', '22');

create type motif_perte as enum ('prix', 'delai', 'injoignable', 'concurrent', 'autre');

create type activite_type as enum (
  'import', 'creation', 'appel', 'whatsapp', 'email', 'visite',
  'note', 'devis', 'relance', 'statut', 'signature', 'paiement'
);

-- ── Table leads ──────────────────────────────────────────────────────────────
create table leads (
  id                  text primary key,               -- FB-XXX
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

  -- Devis (VDE-2026-XXX, TVA 5,5 %) et échéancier 40/40/20 stockés en JSONB
  -- pour coller au modèle applicatif ; extractibles en tables si besoin.
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

create index leads_date_reception_idx on leads (date_reception desc);
create index leads_statut_idx on leads (statut);
create index leads_temperature_idx on leads (temperature);
create index leads_date_relance_idx on leads (date_relance);

-- Anti-doublon applicatif sur téléphone / email (unicité souple : on autorise
-- les NULL, la logique métier gère la fusion).
create unique index leads_telephone_key on leads (telephone) where telephone is not null;
create unique index leads_email_key on leads (lower(email)) where email is not null;

-- ── Table activites (timeline) ───────────────────────────────────────────────
create table activites (
  id          uuid primary key default gen_random_uuid(),
  lead_id     text not null references leads (id) on delete cascade,
  type        activite_type not null,
  contenu     text not null,
  auteur      text not null default 'Système',
  created_at  timestamptz not null default now()
);

create index activites_lead_id_idx on activites (lead_id, created_at desc);

-- ── updated_at automatique ───────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- ── Row Level Security : accès réservé aux utilisateurs authentifiés ─────────
alter table leads enable row level security;
alter table activites enable row level security;

create policy "leads_authenticated_all" on leads
  for all to authenticated using (true) with check (true);

create policy "activites_authenticated_all" on activites
  for all to authenticated using (true) with check (true);
