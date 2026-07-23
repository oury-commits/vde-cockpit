-- ============================================================================
--  0023 — modeles_email : bibliothèque de relances / cycle de vie, ÉDITABLE.
-- ============================================================================
--
--  Les modèles validés par Oury deviennent des lignes MODIFIABLES (admin). La
--  fiche lead les insère pré-remplis (merge tags {{...}} depuis lead/devis/rdv/
--  profil/entreprise — source unique, jamais retapé). Journalisation = timeline
--  existante. Lecture = selon l'entité ; écriture = admin.
--
--  Seed FR uniquement (11 modèles). Aucun modèle MA (plus tard). Idempotent.
--  À jouer après 0022.
-- ============================================================================

create table if not exists modeles_email (
  id           text primary key,
  cle          text not null,
  entite       text not null default 'FR',
  declencheur  text,                         -- contexte dossier (suggestion)
  nom          text not null,
  objet        text not null,
  corps        text not null,
  canal        text not null default 'email',-- 'email' | 'sms'
  actif        boolean not null default true,
  ordre        int not null default 0,
  version      int not null default 0,
  modifie_par  text,
  updated_at   timestamptz not null default now()
);
create unique index if not exists modeles_email_entite_cle_idx on modeles_email (entite, cle);
create index if not exists modeles_email_entite_idx on modeles_email (entite);

-- Lien avis Google (constante « Mon entreprise ») pour le tag {{lien_avis}}.
alter table parametres_entreprise
  add column if not exists lien_avis text;

-- ── RLS : lecture par entité (tous rôles op), écriture admin ─────────────────
alter table modeles_email enable row level security;

drop policy if exists modeles_email_select on modeles_email;
create policy modeles_email_select on modeles_email
  for select to authenticated
  using (entite = 'ALL' or (select public.app_voit_entite(entite)));

drop policy if exists modeles_email_insert on modeles_email;
create policy modeles_email_insert on modeles_email
  for insert to authenticated
  with check ((select public.app_role()) = 'admin');

drop policy if exists modeles_email_update on modeles_email;
create policy modeles_email_update on modeles_email
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

drop policy if exists modeles_email_delete on modeles_email;
create policy modeles_email_delete on modeles_email
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- ── Seed FR (11 modèles). `on conflict do nothing` → n'écrase jamais une édition.
-- Les 6 premiers (qualif/devis) sont des BROUILLONS de ton chaleureux à
-- remplacer par la bibliothèque validée d'Oury ; les 5 du cycle de vie sont le
-- texte fourni.
insert into modeles_email (id, cle, entite, declencheur, nom, objet, corps, ordre) values
 ('MEL-FR-qualif_j2','qualif_j2','FR','a_qualifier','Qualif — relance J+2',
  $o$Votre projet de borne de recharge — quelques précisions$o$,
  $c$Bonjour {{nom}}, merci pour votre demande d'installation d'une borne de recharge. Pour vous préparer un devis au plus juste, j'aurais besoin de quelques précisions sur votre installation électrique. Auriez-vous 5 minutes pour en échanger ? Je m'occupe de tout le reste. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 10),
 ('MEL-FR-qualif_j5','qualif_j5','FR','a_qualifier','Qualif — relance J+5',
  $o$On s'occupe de tout — 5 minutes au téléphone ?$o$,
  $c$Bonjour {{nom}}, je reviens vers vous au sujet de votre projet de borne. Nos techniciens certifiés gèrent l'installation de A à Z, avec la TVA réduite à 5,5 %. Un court appel suffit pour lancer votre devis — quand seriez-vous disponible ? — {{expediteur_prenom}}, Vision Digital Énergies$c$, 20),
 ('MEL-FR-qualif_j10','qualif_j10','FR','a_qualifier','Qualif — clôture J+10',
  $o$Souhaitez-vous que l'on garde votre projet de côté ?$o$,
  $c$Bonjour {{nom}}, sans retour de votre part, je préfère ne pas vous importuner. Si votre projet de borne est simplement reporté, dites-le moi : je garde votre dossier de côté et reviens vers vous au bon moment. Belle journée. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 30),
 ('MEL-FR-devis_j2','devis_j2','FR','devis_envoye','Devis — relance J+2',
  $o$Votre devis {{numero_devis}} — bien reçu ?$o$,
  $c$Bonjour {{nom}}, je voulais m'assurer que vous avez bien reçu votre devis {{numero_devis}} pour l'installation de votre borne. Je reste à votre entière disposition pour toute question ou ajustement. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 40),
 ('MEL-FR-devis_j5','devis_j5','FR','devis_envoye','Devis — relance J+5',
  $o$Votre devis {{numero_devis}} — pour réserver votre créneau$o$,
  $c$Bonjour {{nom}}, votre devis {{numero_devis}} ({{montant}}) est prêt. Pour réserver un créneau d'installation avec notre technicien certifié, il suffit de le valider. Je peux aussi vous proposer un règlement en plusieurs fois. Une question ? Je suis là. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 50),
 ('MEL-FR-devis_j14','devis_j14','FR','devis_envoye','Devis — avant échéance J+14',
  $o$Votre devis {{numero_devis}} arrive à échéance$o$,
  $c$Bonjour {{nom}}, votre devis {{numero_devis}} arrive à échéance le {{date_echeance}}. Si vous souhaitez en profiter aux conditions actuelles, il est encore temps de le valider. Je reste disponible pour en discuter. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 60),
 ('MEL-FR-devis_valide','devis_valide','FR','signe','Cycle — devis validé',
  $o$Bienvenue chez VDE — prochaines étapes de votre installation$o$,
  $c$Bonjour {{civilite}} {{nom}}, un grand merci pour votre confiance. Votre devis {{numero_devis}} est validé. Voici les prochaines étapes : à réception de votre acompte, nous calons ensemble la date d'installation avec notre technicien certifié. Vous pouvez régler en toute sécurité via ce lien : {{lien_paiement}}. Je reste à votre disposition. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 70),
 ('MEL-FR-acompte_recu','acompte_recu','FR','acompte','Cycle — acompte reçu',
  $o$Acompte bien reçu — on cale votre date d'installation$o$,
  $c$Bonjour {{civilite}} {{nom}}, nous confirmons la réception de votre acompte. Votre projet passe en planification ! Quelle période vous arrangerait pour l'intervention ? Notre technicien prévoit {{duree_pose}} sur place. À très vite. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 80),
 ('MEL-FR-rdv_confirme','rdv_confirme','FR','planifie','Cycle — RDV confirmé',
  $o$Votre installation est planifiée le {{date_rdv}}$o$,
  $c$Bonjour {{civilite}} {{nom}}, c'est confirmé : votre borne sera installée le {{date_rdv}}. Notre technicien {{nom_technicien}} interviendra à l'adresse {{adresse_client}}. Prévoyez un accès au tableau électrique. En cas d'imprévu, prévenez-moi et nous décalons sans souci. À bientôt. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 90),
 ('MEL-FR-installe_solde','installe_solde','FR','installe','Cycle — installé, solde dû',
  $o$Votre installation est terminée — dernière étape$o$,
  $c$Bonjour {{civilite}} {{nom}}, votre borne est installée et opérationnelle, nous en sommes ravis. Pour clôturer le dossier, il reste le solde de {{montant_solde}}, réglable ici : {{lien_paiement}}. Le procès-verbal de réception vous a été remis à signer. Merci encore de votre confiance. — {{expediteur_prenom}}, Vision Digital Énergies$c$, 100),
 ('MEL-FR-avis_google','avis_google','FR','solde','Cycle — demande d''avis',
  $o$Merci pour votre confiance$o$,
  $c$Bonjour {{civilite}} {{nom}}, toute l'équipe VDE vous remercie. Si vous êtes satisfait de votre installation, un avis Google nous aiderait énormément : {{lien_avis}}. Cela ne prend qu'une minute et nous permet d'accompagner d'autres particuliers comme vous. Belle route électrique ! — {{expediteur_prenom}}, Vision Digital Énergies$c$, 110)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  Contrôle : 11 modèles FR, 0 modèle MA, RLS active.
--    select entite, count(*) from modeles_email group by entite;
--    select relrowsecurity from pg_class where relname = 'modeles_email';
-- ---------------------------------------------------------------------------
