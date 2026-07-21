-- ============================================================================
--  0017 — reglements : registre des encaissements (source de verite payé/reste).
-- ============================================================================
--
--  Cote application, les reglements vivent aujourd'hui sur le lead (JSONB),
--  comme devis / facture / echeancier. Cette table est leur forme relationnelle
--  pour le backend Supabase, avec la MEME RLS que les donnees financieres :
--  cloisonnee par entite ET reservee aux roles qui voient les montants.
--
--  Les factures d'acompte / de solde et l'option Alma n'ont PAS de colonne :
--  elles sont portees par le JSONB leads.factures_acompte / leads.facture /
--  leads.devis (type, acomptes_deduits, alma_propose).
--
--  Idempotent.
-- ============================================================================

create table if not exists reglements (
  id                   text primary key,
  lead_id              text not null references leads(id) on delete cascade,
  entite               text not null,
  montant              numeric not null check (montant > 0),
  -- Moyen d'encaissement. `alma` solde le dossier (Alma paie VDE en une fois).
  mode                 text not null,
  -- Facture d'acompte emise pour ce versement (null pour un solde / Alma).
  facture_acompte_ref  text,
  encaisse_le          timestamptz not null default now(),
  auteur               text,
  created_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reglements_entite_valide') then
    alter table reglements add constraint reglements_entite_valide
      check (entite in ('FR', 'MA'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reglements_mode_valide') then
    alter table reglements add constraint reglements_mode_valide
      check (mode in ('virement', 'cheque', 'cb', 'especes', 'alma'));
  end if;
end $$;

-- Index de support : lecture par dossier (registre de la fiche) et filtre RLS.
create index if not exists reglements_lead_idx   on reglements (lead_id);
create index if not exists reglements_entite_idx on reglements (entite);

-- ---------------------------------------------------------------------------
-- RLS : donnee financiere. Cloisonnee par entite, reservee aux roles qui
-- voient les montants (les helpers de 0015 font foi). Un conducteur de travaux
-- ou un technicien n'a rien a faire dans le registre des encaissements.
-- ---------------------------------------------------------------------------
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

-- Un encaissement enregistre est une piece comptable : on le corrige (statut,
-- rattachement) mais on ne le deplace pas hors de son entite (WITH CHECK).
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

-- Suppression : admin seul (annuler un encaissement engage la compta).
drop policy if exists reglements_delete on reglements;
create policy reglements_delete on reglements
  for delete to authenticated
  using (
    (select public.app_voit_entite(entite))
    and (select public.app_role()) = 'admin'
  );

-- ---------------------------------------------------------------------------
--  Controle : doit ne lister que des policies reglements_* en {authenticated}.
--    select policyname, cmd, roles from pg_policies
--     where schemaname = 'public' and tablename = 'reglements' order by cmd;
-- ---------------------------------------------------------------------------
