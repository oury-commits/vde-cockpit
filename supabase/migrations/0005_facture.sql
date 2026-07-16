-- VDE Cockpit — 0005 : facture (issue d'un devis signé).
-- NON appliquée tant que ce n'est pas validé. À jouer après 0004.
-- La facture est stockée en JSONB (comme le devis) sur le lead : ref
-- (FAC-2026-XXX / FAC-MA-2026-XXX, numérotation continue), montants, TVA,
-- devise, réf. du devis d'origine.

alter table leads add column if not exists facture jsonb;
