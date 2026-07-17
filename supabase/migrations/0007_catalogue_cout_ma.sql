-- VDE Cockpit — 0007 : prix Maroc surchargeable sur le catalogue.
-- Le prix MA est dérivé (cout_ht × taux EUR→MAD) tant que cout_ma est NULL ;
-- renseigner cout_ma fige le prix pour l'entité MA. À jouer après 0006.

alter table catalogue
  add column if not exists cout_ma numeric;
