-- VDE Cockpit — 0011 : envoi des documents au client (traçabilité + stockage).
-- Note : devis et facture sont stockés en JSONB (leads.devis / leads.facture).
-- `envoye_le` et `envoye_a` sont donc de simples clés du JSON — aucune colonne
-- à ajouter. On indexe en revanche `envoye_le` : c'est la base des relances
-- (« devis envoyé, pas de réponse à J+2 »). À jouer après 0010.

create index if not exists leads_devis_envoye_le_idx
  on leads (((devis ->> 'envoye_le')));

create index if not exists leads_facture_envoye_le_idx
  on leads (((facture ->> 'envoye_le')));

-- ── Stockage des PDF émis ────────────────────────────────────────────────
-- Bucket PRIVÉ : les liens transmis aux clients sont signés et expirants
-- (7 jours), jamais un bucket public ouvert.
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- Accès réservé aux utilisateurs authentifiés (dépôt + lecture + remplacement).
drop policy if exists "documents_authenticated_read" on storage.objects;
create policy "documents_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists "documents_authenticated_write" on storage.objects;
create policy "documents_authenticated_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "documents_authenticated_update" on storage.objects;
create policy "documents_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'documents');
