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

### 3. Aides Grand Est réelles

`lib/devis/builder.ts` : montant Advenir + « Aide Locale Grand Est » (−1 000 € en
démo) à confirmer / brancher sur le vrai barème.

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

Vérifié en P1 : le technicien n'a accès qu'à Clients / Planning & tournées / SAV,
`/dashboard` le renvoie sur `/planning`, et il ne voit **aucun montant**. Mais
Planning / SAV / Clients sont encore des placeholders (0 enregistrement) : le
cloisonnement *par technicien* (`technicien_id = utilisateur courant`) ne peut
pas être prouvé sur des données aujourd'hui. À câbler **avec** la vue mobile P2
et à verrouiller par RLS en P3 — ne pas considérer ce point comme acquis.

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
