# QA-TODO — reprise & backlog priorisé

> Note de session du **ven. 17 juil. 2026** · reprise **lun. 20 juil. 2026**.
> Rapport d'audit QA + ordre de correction, pour repartir direct.

## État des branches (toutes poussées sur origin)

| Branche            | Dernier commit | État |
| ------------------ | -------------- | ---- |
| `main`             | `eb4083e` Merge feat-devis-builder | Trunk. Module devis builder mergé (catalogue + wizard + Maroc). |
| `feat-devis-builder` | `21829fe` | Déjà mergée dans main. Conservée pour historique. |
| `fix-qa-bloquants` | `ba5727f` | **Les 3 fixes 🔴/🟠 codés + prouvés, PAS encore mergés.** À relire + merger. |

Arbre propre, aucune branche avec des commits locaux non poussés.

---

## À FAIRE LUNDI, dans l'ordre

### 1. Relire + merger `fix-qa-bloquants` → `main` (les 3 fixes sont déjà codés)

Contrairement à ce qu'on avait dit, les 3 correctifs ont été **implémentés et
vérifiés** vendredi (commit `ba5727f`). Ils attendent seulement **relecture +
merge**, pas ré-implémentation.

- **🔴 Fix 1 — Numérotation persistante & atomique** (`lib/leads/sequences.ts`) :
  compteur par entité + type, jamais recalculé depuis les enregistrements.
  Supabase = RPC `next_sequence` (verrou de ligne, pas de collision) ;
  local = compteur monotone. Brouillon ne consomme pas de numéro.
  *Preuve : `qa-numbering` → 008 puis **009** après suppression (0 doublon).*
- **🔴 Fix 2 — Pas de devis fantôme** (`components/devis/DevisWizard.tsx`) :
  « Valider » exige nom client + lignes + conformité ; sans lead, client créé à
  la volée ; numéro réservé → persistance → PDF. Plus de PDF « Client à renseigner ».
- **🟠 Fix 3 — Garde-fou suppression** : lead avec devis signé / facture émise →
  modale **Archivage** (champ `archived`) au lieu de destruction.

**Avant de merger : appliquer les migrations Supabase 0008 + 0009** (voir plus bas),
sinon la numérotation atomique et l'archivage n'ont pas leur schéma en base.

### 2. Barème conformité (#4 de l'audit) — EN ATTENTE DE TES DONNÉES

Le contrôle technique /6 affiche aujourd'hui des valeurs **calculées par défaut**
(barème de démo, `lib/devis/conformite.ts`) et ne détecte pas automatiquement un
vrai sous-dimensionnement (le blocage est manuel). → brancher tes **vraies règles**
(calibre / section de câble / différentiel selon réseau + puissance) et une
comparaison « déclaré vs requis » qui met OK/ERREUR automatiquement.

### 3. Aides / subventions — ABANDONNÉ (note historique)

Décision produit : **aucune aide n'est calculée ni affichée** (Advenir supprimé, prime
autoconso supprimée en 2026). `lib/devis/builder.ts` n'ajoute aucune subvention ; les
PDF devis/facture n'affichent aucune aide. Rien à brancher. (Ancienne note « montant
Advenir + Aide Grand Est » : caduque.)

### 4. Placeholders sidebar (#6/#7 de l'audit)

8 destinations sont des `ComingSoon` (« arrive prochainement ») : Prospects B2B,
**Clients**, File de validation IA, Boîte de réception, Planning, SAV, Équipe,
Rapports. Le badge « 3 » (File de validation IA) et les KPIs du Tableau de bord
sont **statiques** (TODO). À brancher ou masquer selon priorité.

### 5. Migrations Supabase à appliquer (catalogue + numérotation + archivage)

SQL idempotent, à jouer dans Supabase SQL editor (déjà fourni en chat) :
- **0006** catalogue + **0007** `catalogue.cout_ma` (prix Maroc).
- **0008** `sequences` + fonction `next_sequence` (numérotation atomique).
- **0009** `leads.archived` (garde-fou suppression).

Une fois joué, l'app bascule seule sur Supabase (repository) : catalogue seedé au
1er chargement, numéros tirés de la séquence en base. Pense à initialiser
`sequences.next_val` **au-dessus des derniers numéros déjà émis** pour ne pas
réattribuer un ancien numéro.

### 6. Taux EUR→MAD réel + persistance partagée

Aujourd'hui le taux (Paramètres) vit en **localStorage** (par navigateur, défaut
10,8). À mettre à la vraie valeur et, idéalement, à déplacer dans une table
`settings` Supabase partagée équipe.

### 7. Tour de contrôle admin — supervision par exception (P2/P3, PAS en P1)

L'admin ne doit pas *surveiller* les équipes en continu : il doit être **alerté
par exception**, quand un dossier sort des rails. Écran unique alimenté par des
règles, pas un mur de tableaux.

Signaux à remonter (liste de départ, à compléter avec le terrain) :
- devis **signé sans acompte reçu** (le cash n'est pas parti) ;
- lead **chaud sans relance depuis J+2** ;
- intervention **clôturée sans photos** (litige SAV à venir) ;
- dossier **bloqué depuis > N jours** dans le même statut (N paramétrable).

Contraintes : l'exception traverse les entités (l'admin est le seul rôle `ALL`),
elle affiche le **dossier + le responsable + l'action attendue**, et elle
disparaît d'elle-même quand la condition se lève. À implémenter quand P2 (écran
Équipe) et P3 (RLS) seront posés — les règles s'appuieront sur les mêmes filtres
serveur, pas sur un calcul client.

### 8. Technicien : « uniquement sa propre tournée » — à re-tester quand le module existera

Levé en P2. `/mobile` filtre sur `technicien_id = profil courant` et la recette
le prouve sur données : Julien voit ses 3 interventions, Damien ses 2, Karim
ses 2 — aucun ne voit celles d'un autre, et aucun montant n'apparaît. Le modèle
`interventions` ne porte d'ailleurs aucun prix, donc il n'y a rien à masquer.

Reste dû : ce filtre est appliqué côté client. Il doit être redoublé en RLS
(P3), sans quoi une requête directe contournerait l'écran.

### 9. P3 — RLS : écrite et prouvée (migration `0015_roles_rls.sql`)

Le cloisonnement est désormais dans la base, là où le navigateur ne peut pas le
contourner. Policies par opération, `to authenticated` uniquement, helpers
`SECURITY DEFINER` avec `search_path = ''`, vue `chantiers` pour les rôles
aveugles aux montants, `technicien_id = auth.uid()` sur `interventions`.

**Preuve** : `npm run test:rls` — 61 assertions sur un vrai Postgres 18 (PGlite,
WASM), qui applique les migrations du repo et rejoue chaque rôle via le claim
`request.jwt.claims` comme le fait Supabase. Le harnais a été validé par
mutation : retirer le filtre entité d'une policy fait tomber 5 assertions.

Ce que le test couvre en particulier : le **refus silencieux**. Un `UPDATE`
hors périmètre ne lève pas d'erreur, il touche 0 ligne — mode de panne le plus
traître, car l'application croit avoir enregistré.

#### ⚠ Checklist d'activation — 0015 ne suffit PAS à lui seul

Appliquer 0015 sans les étapes ci-dessous rend l'application **vide** pour tout
le monde : la base répondra 0 ligne à un utilisateur que l'écran croit admin.

1. Créer les comptes dans `auth.users` (invitations Supabase).
2. Créer une ligne `profiles` pour CHAQUE compte, avec le même `id` (uuid) —
   sans profil, `app_role()` est null et tout est refusé.
3. Brancher l'identité applicative sur `auth.uid()` au lieu du sélecteur de
   construction, et retirer `DevIdentityBar` / `NEXT_PUBLIC_AUTH_DISABLED`.
4. Faire lire aux repositories `profiles` et `interventions` la base plutôt que
   le jeu local, et faire passer les rôles aveugles aux montants par la vue
   `chantiers` au lieu de `leads` (voir règle ci-dessous).
5. Vérifier les requêtes de contrôle en fin de 0015 **et** de 0016 (aucune
   policy `anon`/`public` — ni public ni storage, aucune table sans RLS).

Tant que 1 à 4 ne sont pas faits : **aucun compte salarié avec de vraies
données.**

#### RÈGLE — accès terrain sans les montants (à ne jamais enfreindre)

La RLS filtre des **lignes**, pas des **colonnes**. Un rôle aveugle aux montants
(conducteur de travaux, technicien) n'a **aucun** accès à `leads` : il lit le
terrain par la vue **`chantiers`**, et uniquement par elle.

Deux invariants qui vont ensemble :
- ces rôles lisent **toujours** par `chantiers`, **jamais** par `leads` ;
- **aucun champ financier n'entre jamais dans `chantiers`** (ni `montant_estime`,
  ni `devis`, ni `facture`, ni `echeancier`, ni un futur champ prix). Le jour où
  on ajoute une colonne à cette vue, la question à se poser est : « est-ce que ça
  parle d'argent ? » Si oui, elle n'y va pas.

C'est pour ça que `chantiers` a `security_invoker = off` et porte sa propre
clause de cloisonnement : elle s'exécute au-dessus de la RLS de `leads`, donc
c'est elle qui doit être irréprochable.

#### Storage — cloisonné (migration 0016)

Fait. Les policies plates de 0011 (`authenticated` sans distinction) sont
remplacées : lecture/écriture bornées à l'entité via le préfixe du chemin
(`FR/…`, `MA/…`), réservées aux rôles qui manipulent des devis, suppression
admin seule. Prouvé par `npm run test:rls` (section Storage) et validé par
mutation. Un compte FR ne lit ni ne dépose sous `MA/`, et inversement.

#### Restes connus

- **Dernier admin** : l'invariant « il reste toujours un administrateur actif »
  n'existe que dans l'écran Équipe. À passer en **contrainte / trigger base**
  pour le rendre infalsifiable (une écriture directe peut aujourd'hui retirer
  le dernier admin).
- **Double matrice** : `app_peut()` (SQL, **fait foi**) duplique
  `lib/roles/permissions.ts` (UI, confort d'affichage). Toute évolution se fait
  des deux côtés, sinon l'écran promet un accès que la base refuse. Un test qui
  compare les deux matrices colonne par colonne éviterait la dérive.
- **Journal des accès côté serveur** : aujourd'hui le journal de l'écran Équipe
  vit en `localStorage` (`vde.roles.journal.v1`). Suffisant pour une équipe de
  2-4 (décision produit). Pour le rendre **inviolable**, le passer sur une table
  dédiée (`access_log`) avec RLS lecture admin + écriture par trigger/route
  serveur. Non bloquant.

---

## Rapport d'audit (synthèse) — campagne Playwright du 17 juil.

Classé par risque cash / légal. Détail complet des repro dans l'historique de chat.

**🔴 Bloquant (corrigés sur `fix-qa-bloquants`)**
1. Numéros de devis **et factures** réutilisés (max()+1 recalculé) → doublons.
   Repro live : supprimer le lead au n° max → le suivant reprend le même numéro.
2. Devis « sans lead » → PDF numéroté émis sans persistance ni client (« Client à
   renseigner »), numéro non réservé → réutilisé.

**🟠 Majeur**
3. Supprimer un lead facturé/signé détruisait la pièce comptable (→ archivage). *Corrigé.*
4. Contrôle conformité = checklist manuelle, pas de détection auto (barème TODO). *À faire (#2 ci-dessus).*
5. Devis validable sans nom client. *Corrigé (Fix 2).*

**🟡 Mineur**
6. 8 placeholders sidebar atteints depuis la nav réelle. *À faire (#4).*
7. Badge « 3 » + KPIs dashboard statiques. *À faire (#4).*

**✅ PASS (vérifiés sans anomalie)** : smoke lead→devis→facture ; maths (marge 35 %
sur PV, TVA FR 5,5/10/20 + autoliq, TVA MA 20 %, échéancier = 100 % du TTC,
conversion DH) ; double-clic Valider = 1 devis ; switch entité en plein devis
(devise/TVA figées, aucun mélange FR/MA) ; snapshot devis ; suppressions bornées à
l'entité active + « Vider » désactivé en « Tous » ; garde d'auth ; responsive
390/768/1280 sans débordement ; 0 erreur console / 0 valeur cassée sur 16 routes.

---

## Comment rejouer la QA

Scripts Playwright (pilotent le Chrome système, `channel: "chrome"`) écrits en
session dans le scratchpad (hors repo, éphémère). Méthode :
1. `NODE_OPTIONS="--use-system-ca" NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_AUTH_DISABLED=true npx next build && npx next start -p 3123`
   (mode démo local : données seedées, auth désactivée, déterministe).
2. `npm i playwright` (lib seule, sans download navigateur) puis scripts avec
   `chromium.launch({ channel: "chrome" })`.
3. Scénario clé : créer un devis (FB-001) → noter le n° ; supprimer FB-001 ;
   créer un devis (FB-002) → le n° ne doit **pas** être réutilisé.

---

## Backlog / dette technique

- **3 vulnérabilités « high » dans l'arbre dev de `tsx` / `esbuild`** (installé pour
  `npm run test:etats`). **DEV-ONLY** : jamais embarqué dans le build Next ni en prod.
  Ne PAS lancer `npm audit fix --force` (casse la toolchain de test). À réévaluer
  quand `tsx`/`esbuild` publient un correctif — simple bump de version le moment venu.
- **Note Google (★ + nb avis)** absente de « Mon entreprise » : seul `lien_avis` (URL)
  existe. Nécessitera un champ + migration (prévu au Lot 3 « rendu devis/facture »).
