-- ============================================================================
--  0020 — parametres_entreprise : identité société PAR ENTITÉ (source unique
--  des en-têtes / pieds de devis & factures). UNE LIGNE PAR ENTITÉ.
-- ============================================================================
--
--  Règle absolue ZÉRO CONFUSION FR/MA : un document lit UNIQUEMENT la ligne de
--  SA propre entité. Le cloisonnement est posé ici en base (RLS) ET côté code
--  (le générateur ne reçoit qu'une seule fiche, celle de doc.entite).
--
--  Extensible : ajouter une société = INSÉRER une ligne (entite en `text`, pas
--  contrainte à l'enum, pour ne pas imposer de refonte du type partagé).
--  Écriture = admin uniquement. Lecture = selon l'entité (admin = ALL).
--
--  Idempotent. À jouer après 0019.
-- ============================================================================

create table if not exists parametres_entreprise (
  entite                        text primary key,
  -- 2. Informations société
  raison_sociale                text,
  forme_juridique               text,
  capital_social                text,
  adresse_siege                 text,
  telephone                     text,
  email                         text,
  site_web                      text,
  -- 1. Identité visuelle
  couleur_marque                text not null default '#0F3D2E',
  logo_complet_url              text,
  logo_symbole_url              text,
  -- 3. Identifiants légaux FR
  siret                         text,
  tva_intra                     text,
  rcs                           text,
  code_ape                      text,
  -- 3. Identifiants légaux MA
  ice                           text,
  rc                            text,
  if_fiscal                     text,
  patente                       text,
  cnss                          text,
  -- 4. Fiscalité (devise/taux gérés ailleurs — ici seulement la mention régime)
  mention_regime                text,
  -- 5. Coordonnées bancaires (FR : iban+bic ; MA : rib) — jamais partagées
  iban                          text,
  bic                           text,
  rib                           text,
  banque                        text,
  -- 6. Mentions & conformité
  mentions_legales              text,
  certifications                jsonb not null default '[]'::jsonb,
  assurance_decennale_compagnie text,
  assurance_decennale_police    text,
  -- Méta
  updated_at                    timestamptz not null default now(),
  modifie_par                   text
);

-- ── RLS : lecture par entité (admin = ALL), écriture admin uniquement ────────
alter table parametres_entreprise enable row level security;

drop policy if exists parametres_entreprise_select on parametres_entreprise;
create policy parametres_entreprise_select on parametres_entreprise
  for select to authenticated
  using ((select public.app_voit_entite(entite)));

drop policy if exists parametres_entreprise_insert on parametres_entreprise;
create policy parametres_entreprise_insert on parametres_entreprise
  for insert to authenticated
  with check ((select public.app_role()) = 'admin');

drop policy if exists parametres_entreprise_update on parametres_entreprise;
create policy parametres_entreprise_update on parametres_entreprise
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

drop policy if exists parametres_entreprise_delete on parametres_entreprise;
create policy parametres_entreprise_delete on parametres_entreprise
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- ── Seed FR + MA (données société ACTUELLES, reprises de lib/entite/config.ts
--    pour ne rien perdre). `on conflict do nothing` → n'écrase jamais une fiche
--    déjà éditée dans l'UI au rejeu. ────────────────────────────────────────
insert into parametres_entreprise
  (entite, raison_sociale, adresse_siege, siret, tva_intra)
values
  ('FR', 'Vision Digital Energies', '870 rue Denis Papin, 54710 Ludres',
   '91742112500019', 'FR84 917 421 125')
on conflict (entite) do nothing;

insert into parametres_entreprise
  (entite, raison_sociale, forme_juridique, capital_social, adresse_siege, ice, rc, if_fiscal)
values
  ('MA', 'Vision Digitale Energies Maroc SARL', 'SARL', '10 000 MAD',
   'IMM 16 Rue Otawa, Océan — Rabat', '003910477000069', 'Rabat 198269', '72081360')
on conflict (entite) do nothing;

-- ── Storage : bucket `logos`. PUBLIC en lecture (un logo imprimé sur un devis
--    envoyé au client est un visuel public — évite le signed-url dans le PDF).
--    Écriture réservée à l'admin, préfixe entité (FR/…, MA/…). ───────────────
insert into storage.buckets (id, name, public)
  values ('logos', 'logos', true)
  on conflict (id) do nothing;

drop policy if exists "logos_select"  on storage.objects;
drop policy if exists "logos_insert"  on storage.objects;
drop policy if exists "logos_update"  on storage.objects;
drop policy if exists "logos_delete"  on storage.objects;

-- Lecture authentifiée (l'URL publique du bucket sert l'affichage sur le PDF).
create policy "logos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'logos');

create policy "logos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  );

create policy "logos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  )
  with check (
    bucket_id = 'logos'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  );

create policy "logos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (select public.app_voit_entite(split_part(name, '/', 1)))
    and (select public.app_role()) = 'admin'
  );

-- ---------------------------------------------------------------------------
--  Contrôle : 2 lignes seed (FR, MA), RLS active, 0 policy anon.
--    select entite, raison_sociale from parametres_entreprise order by entite;
--    select relrowsecurity from pg_class where relname = 'parametres_entreprise';
-- ---------------------------------------------------------------------------
