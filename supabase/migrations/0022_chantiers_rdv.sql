-- ============================================================================
--  0022 — chantiers : projeter le RDV (lead.rdv) sur la vue SANS montants.
-- ============================================================================
--
--  La tournée mobile du TECHNICIEN doit lire ses RDV, mais un technicien est
--  aveugle aux montants → il ne peut PAS lire la table `leads` (RLS). La vue
--  `chantiers` est justement le canal terrain sans un seul champ financier.
--  On y ajoute les infos du RDV, extraites du JSONB `lead.rdv` (source unique).
--
--  Cloisonnement conservé : entité (app_voit_entite) + le technicien ne voit que
--  SES chantiers — désormais aussi ceux dont le RDV lui est assigné
--  (rdv.technicien_id = auth.uid()). Toujours ZÉRO montant exposé.
--
--  Idempotent (create or replace). À jouer après 0021.
-- ============================================================================

create or replace view public.chantiers
with (security_invoker = off) as
  select
    l.id, l.entite, l.nom, l.telephone, l.email,
    l.adresse, l.code_postal, l.ville,
    l.type_logement, l.puissance_souhaitee, l.reseau,
    l.emplacement, l.fixation, l.obstacles, l.distance_tableau,
    l.statut, l.date_reception, l.assigne_a, l.archived,
    -- RDV projeté depuis lead.rdv (JSONB) — dates/type/tech, jamais de montant.
    (l.rdv ->> 'debut')::timestamptz as rdv_debut,
    (l.rdv ->> 'fin')::timestamptz   as rdv_fin,
    (l.rdv ->> 'type')               as rdv_type,
    (l.rdv ->> 'technicien_id')      as rdv_technicien_id
  from public.leads l
  where (select public.app_voit_entite(l.entite::text))
    and (select public.app_peut('clients'))
    -- Le technicien a un accès « partiel » : uniquement ses chantiers (une
    -- intervention OU un RDV qui lui est assigné). Les autres rôles voient tout
    -- leur périmètre client.
    and (
      (select public.app_role()) is distinct from 'technicien'
      or exists (
        select 1 from public.interventions i
         where i.lead_id = l.id and i.technicien_id = auth.uid()
      )
      or (l.rdv ->> 'technicien_id') = auth.uid()::text
    );

revoke all on public.chantiers from public, anon;
grant select on public.chantiers to authenticated;

-- ---------------------------------------------------------------------------
--  Contrôle : la vue ne doit exposer AUCUN champ financier.
--    select column_name from information_schema.columns
--     where table_schema='public' and table_name='chantiers'
--       and column_name ~* 'montant|devis|facture|reglement|marge|cout|prix';
--  Doit renvoyer 0 ligne.
-- ---------------------------------------------------------------------------
