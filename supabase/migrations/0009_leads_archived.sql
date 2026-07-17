-- VDE Cockpit — 0009 : archivage des leads (garde-fou suppression).
-- Un lead portant un devis signé ou une facture émise ne se supprime pas :
-- il s'archive (sorti des listes actives, pièce comptable conservée).
-- À jouer après 0008.

alter table leads
  add column if not exists archived boolean not null default false;

create index if not exists leads_archived_idx on leads (archived);
