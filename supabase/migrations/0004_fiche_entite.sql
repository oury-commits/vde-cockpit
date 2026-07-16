-- VDE Cockpit — 0004 : champs de la fiche lead (qualification IRVE + solaire).
-- NON appliquée tant que ce n'est pas validé. À jouer dans le SQL Editor après
-- 0001. Ne casse ni l'import ni le pipeline (colonnes additives, nullables).
--
-- Note devis : le devis est stocké en JSONB (colonne leads.devis). Les nouveaux
-- champs entite / devise / taux_tva / mode_tva sont de simples clés du JSON —
-- aucun changement de schéma requis pour eux.

-- ── Enums de qualification ───────────────────────────────────────────────────
create type reseau as enum ('mono', 'tri');
create type occupation as enum ('proprietaire', 'locataire');
create type emplacement as enum ('interieur', 'exterieur');
create type fixation as enum ('murale', 'pied');
create type pv_projet as enum ('aucun', '3kwc', '6kwc', '9kwc', 'autre');

-- ── Colonnes fiche sur leads ─────────────────────────────────────────────────
alter table leads
  add column reseau                 reseau,
  add column puissance_compteur_kva numeric,
  add column occupation            occupation,
  add column emplacement           emplacement,
  add column fixation              fixation,
  add column obstacles             text,
  add column budget                text,       -- réponse brute du formulaire
  add column pv_projet             pv_projet,   -- panneaux solaires (cross-sell)
  add column pv_autre              text;        -- précision si pv_projet = 'autre'

-- ── RLS par entité (PRÉPARÉE — à activer avec les rôles, Jalon 2) ────────────
--
-- Objectif : « un user ne voit que son entité, sauf admin ». Cela nécessite une
-- table `profiles` (role + entite par utilisateur) qui n'existe pas encore
-- (migration 0003_roles_rls.sql à venir). Tant qu'elle n'existe pas, on
-- CONSERVE la RLS de 0001 (authenticated = CRUD complet) et le cloisonnement
-- par entité est assuré côté application (filtre + estampillage).
--
-- À activer une fois `profiles` en place — remplacera les policies de 0001 :
--
--   drop policy "leads_authenticated_all" on leads;
--   create policy "leads_entite" on leads for all to authenticated
--     using (
--       exists (select 1 from profiles p
--               where p.id = auth.uid()
--                 and (p.role = 'admin' or p.entite = leads.entite))
--     )
--     with check (
--       exists (select 1 from profiles p
--               where p.id = auth.uid()
--                 and (p.role = 'admin' or p.entite = leads.entite))
--     );
--   -- idem pour activites (via le lead parent).
