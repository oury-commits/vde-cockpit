-- VDE Cockpit — 0010 : fiche produit + QR sur le devis.
-- `url_produit` = page produit du site VDE ; `afficher_qr` = affiche le QR sur
-- le devis. Le QR n'est rendu que pour la catégorie `borne` (règle applicative).
-- À jouer après 0009.

alter table catalogue
  add column if not exists url_produit text,
  add column if not exists afficher_qr boolean not null default false;
