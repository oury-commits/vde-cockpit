-- ============================================================================
--  0024 — Catalogue solaire (photovoltaïque résidentiel).
--  Étend le catalogue EXISTANT avec un domaine « solaire » (entité FR).
--  Additif et idempotent : aucune ligne IRVE existante n'est modifiée
--  (domaine par défaut = 'irve'). Le seed des articles solaires est fait côté
--  application (buildCatalogueSeed) comme pour l'IRVE — ici on ne pose que le
--  schéma (colonnes + valeurs d'enum). Aucun article MA.
--
--  ATTENTION Postgres : « alter type ... add value » ne peut PAS être suivi
--  d'un usage de la NOUVELLE valeur dans la MÊME transaction. On ajoute donc
--  les valeurs d'enum, on COMMITe, puis on ajoute la colonne domaine dans une
--  seconde transaction. À exécuter ce fichier tel quel (2 transactions).
-- ============================================================================

begin;

-- Domaine de l'article : sépare l'IRVE (existant) du solaire (nouveau). Un
-- ENUM dédié plutôt qu'un texte libre — cloisonnement fort, valeurs fermées.
do $$ begin create type domaine_article as enum ('irve','solaire');
exception when duplicate_object then null; end $$;

-- Nouvelles catégories solaires (la « pose » est partagée avec l'IRVE :
-- distinguée par le domaine). L'EMS a sa propre catégorie car il conditionne
-- l'éligibilité TVA 5,5 % (obligatoire ≤ 9 kWc).
alter type categorie_article add value if not exists 'panneau';
alter type categorie_article add value if not exists 'onduleur';
alter type categorie_article add value if not exists 'ems';
alter type categorie_article add value if not exists 'structure_pv';
alter type categorie_article add value if not exists 'protection_pv';
alter type categorie_article add value if not exists 'etude';
alter type categorie_article add value if not exists 'administratif';
alter type categorie_article add value if not exists 'batterie';
alter type categorie_article add value if not exists 'maintenance';

commit;

-- Seconde transaction : on peut désormais utiliser 'irve' comme défaut.
begin;

alter table catalogue
  add column if not exists domaine      domaine_article not null default 'irve',
  -- Puissance unitaire en watt-crête (panneaux uniquement). Sert à sommer les
  -- kWc du devis → garde-fou TVA 5,5 % (≤ 9 kWc). NULL pour tout le reste.
  add column if not exists puissance_wc numeric;

create index if not exists catalogue_domaine_idx on catalogue (domaine);

commit;

-- ── Contrôle ────────────────────────────────────────────────────────────────
--  select unnest(enum_range(null::categorie_article));      -- doit lister panneau…maintenance
--  select column_name from information_schema.columns
--    where table_name='catalogue' and column_name in ('domaine','puissance_wc');
--  select domaine, count(*) from catalogue group by domaine; -- irve = existant, solaire = seed app
