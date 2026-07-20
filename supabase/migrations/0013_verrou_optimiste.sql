-- VDE Cockpit — 0013 : verrou optimiste multi-utilisateur.
-- Empêche qu'un « Enregistrer » écrase en silence le travail d'un collègue.
-- L'écriture se fait en `update … where id = :id and version = :versionLue`
-- puis `version = version + 1` : 0 ligne mise à jour = conflit, on recharge.
--
-- Devis et facture vivent en JSONB sur la ligne `leads` : `leads.version`
-- couvre donc le lead ET ses documents. Deux personnes éditant l'une la fiche
-- contact et l'autre le devis entrent en collision — c'est VOULU (mieux
-- sur-verrouiller que perdre une donnée), d'où le message générique « dossier ».
--
-- `interventions` recevra la même colonne quand la table existera.
-- Rollback : alter table leads drop column version; (idem catalogue)

alter table leads
  add column if not exists version int not null default 0,
  add column if not exists modifie_par text;

alter table catalogue
  add column if not exists version int not null default 0,
  add column if not exists modifie_par text;
