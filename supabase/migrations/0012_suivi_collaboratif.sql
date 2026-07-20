-- VDE Cockpit — 0012 : suivi collaboratif du dossier.
-- Jalons de suivi et notes typées vivent dans la timeline (table activites) :
-- une seule trace unifiée, jamais d'effacement silencieux (décocher écrit une
-- entrée « annulé »). À jouer après 0011.

alter table activites
  add column if not exists jalon      text,      -- appel | email | visite | relance
  add column if not exists annule     boolean not null default false,
  add column if not exists visibilite text;      -- interne | client (notes)

-- Retrouver rapidement le dernier état d'un jalon pour un lead.
create index if not exists activites_lead_jalon_idx
  on activites (lead_id, jalon, created_at desc);

-- `auteur` existe déjà : il porte l'utilisateur connecté (rien d'anonyme).
