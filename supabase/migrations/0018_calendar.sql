-- ============================================================================
--  0018 — Planning : jetons Google Calendar + géocodage / créneaux RDV.
-- ============================================================================
--
--  Google Calendar = agenda maître. Le CRM pilote, mais les jetons OAuth ne
--  vivent QUE côté serveur, chiffrés (AES-256-GCM, clé CALENDAR_TOKEN_KEY), et
--  ne sont JAMAIS lisibles par le navigateur.
--
--  Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. calendar_tokens — un jeu de jetons par utilisateur.
--    Les colonnes *_enc sont chiffrées côté serveur : la base ne stocke jamais
--    un jeton en clair.
-- ---------------------------------------------------------------------------
create table if not exists calendar_tokens (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null default 'google',
  access_token_enc   text,
  refresh_token_enc  text,
  expiry             timestamptz,
  scopes             text,
  -- Agendas de l'utilisateur + ceux cochés pour la synchro (jamais un jeton).
  calendars          jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- RLS STRICTE : aucune policy pour `authenticated` → le navigateur ne lit ni
-- n'écrit JAMAIS cette table. Seul le serveur y accède (service_role, qui
-- contourne la RLS) et scope toujours par user_id = auth.uid(). L'état
-- « connecté ? » est exposé à l'UI par une route serveur (booléen + noms
-- d'agendas), pas par un accès direct à la table.
alter table calendar_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Géocodage + créneaux RDV sur interventions (le RDV terrain).
--    lat/lng = géocodage de l'adresse ; rdv_debut/fin = créneau réel ;
--    google_event_id = lien vers l'événement Google (idempotence de la synchro).
-- ---------------------------------------------------------------------------
alter table interventions
  add column if not exists lat             numeric,
  add column if not exists lng             numeric,
  add column if not exists rdv_debut       timestamptz,
  add column if not exists rdv_fin         timestamptz,
  add column if not exists zone            text,
  add column if not exists google_event_id text;

-- Géocodage aussi sur le lead (adresse client — source du RDV).
alter table leads
  add column if not exists lat numeric,
  add column if not exists lng numeric;

create index if not exists interventions_rdv_debut_idx
  on interventions (technicien_id, rdv_debut);

-- ---------------------------------------------------------------------------
--  Contrôle : calendar_tokens ne doit avoir AUCUNE policy (server-only).
--    select policyname from pg_policies
--     where schemaname = 'public' and tablename = 'calendar_tokens';
--  Doit renvoyer 0 ligne. Et la table doit avoir la RLS active :
--    select relrowsecurity from pg_class where relname = 'calendar_tokens';
-- ---------------------------------------------------------------------------
