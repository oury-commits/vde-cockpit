# Récap de session — VDE Dashboard IRVE 2026
**Date :** 2026-07-23 · **Entité :** VDE France · **Périmètre :** dashboard React/TS + Supabase

> Handoff pour reprise. Tout ce qui a été fait, ce qui reste, et l'ordre à suivre.
> À committer dans le repo (ex. `docs/handoff/`) pour que la prochaine session reprenne sans perte.

---

## 1. Bug RLS `activites` — RÉSOLU ✅

**Symptôme (prod, auth active) :** toute écriture timeline échoue —
`new row violates row-level security policy (USING expression) for table "activites"`.

**Cause racine (confirmée par repro) :** chemin **upsert**.
- L'app persiste la timeline via `sb.from("activites").upsert(tableauComplet)` — `lib/leads/repository.ts:162`.
- Sur une activité déjà en base → `INSERT … ON CONFLICT (id) DO UPDATE`.
- La branche UPDATE exige une **policy UPDATE** → il n'y en avait aucune (0015 : SELECT + INSERT seulement, choix « trace immuable »).
- Deny-by-default → la ligne en conflit est rejetée sur l'expression USING (absente ⇒ false) → l'erreur.

**Repro qui l'a prouvé :**
- `UPDATE` nu (sans WHERE) → count=0, aucune erreur → **faux vert** de l'ancien test.
- `INSERT … ON CONFLICT DO UPDATE` sur id existant → **erreur exacte de prod**. ✔

**Correctif — `0025_activites_update_policy.sql` :**
```sql
create policy activites_update on public.activites
  for update to authenticated
  using (public.app_voit_lead(lead_id))
  with check (public.app_voit_lead(lead_id));
```
Aligné sur `leads` : admin/ALL écrit toute entité · rôle scopé uniquement la sienne · cross-entité bloqué par le WITH CHECK. Pas de DELETE. Cloisonnement FR/MA préservé. Idempotent, folded dans `bootstrap_prod.sql`.

**Tests — angle mort comblé (test:rls) :** ancien test « bare UPDATE → 0 ligne » remplacé par 5 checks du vrai chemin :
admin upsert timeline ✔ · CA FR upsert sur son entité ✔ · insert cross-entité refusé ✔ · upsert cross-entité refusé ✔ · update scopé ne déborde pas sur trace MA ✔.

**Gates :** `tsc --noEmit` 0 · `next build` OK · `test:rls` **101/101** (96 → +5) · bootstrap rejouable 2× OK.

**Branche :** `fix-rls-activites-upsert` (commit `13cb6d1`) — poussée.

---

## 2. ACTION PROD RESTANTE ⚠️ (le seul truc qui compte)

Tant que la migration n'est pas appliquée sur Supabase **prod**, la timeline reste bloquée en écriture.

- [ ] **Supabase prod → SQL Editor → exécuter `0025_activites_update_policy.sql`** (ou re-coller `bootstrap_prod.sql`).
- Rappel : `0023` (modèles d'emails) et `0024` (catalogue solaire) sont sur **leurs propres branches**, pas dans ce deploy.

---

## 3. Décision en attente — Refactor dette « 2B »

**Tension :** le 0025 ouvre l'UPDATE non pour un besoin métier, mais pour absorber le **bulk upsert du tableau complet** (`repository.ts:153` porte déjà le `TODO 2B: upsert par enregistrement`). Le vrai fix = insérer seulement la ligne neuve.

**Question qui tranche — `activites` est-elle jamais éditée dans l'app ?**

| Cas | Réponse | Action |
|---|---|---|
| **A** (pari le + probable) | Non, append-only | Refactor 2B → insert de la seule ligne neuve → puis **`0026_drop_activites_update.sql`** (DROP policy UPDATE). Immutabilité restaurée, écritures allégées, surface RLS réduite. |
| **B** | Oui, activités éditables | Garder 0025 tel quel, abandonner le terme « immuable ». Terminé. |

**Séquence recommandée (blast radius isolé) :**
1. Déployer `0025` en prod, **seul**.
2. Deploy **séparé** : refactor 2B + `0026` (si cas A).
3. Puis seulement : prix solaires.

---

## 4. Catalogue solaire — LIVRÉ (branche à part)

Branche `feat-catalogue-solaire` (commit `470493f`, poussée). 17 articles PV seedés, prix **indicatifs « à confirmer »**. IRVE existant intact. TVA 5,5 % encadrée (≤ 9 kWc + EMS + modules conformes, sinon 20 %). PDF client conforme. Gates verts.

- [ ] **Migration `0024_catalogue_solaire.sql`** à passer sur prod (2 transactions — `ALTER TYPE ADD VALUE` isolé).
- [ ] **Ajuster les prix PV** dans le catalogue **avant** tout devis client réel.
- [ ] Recette preview : lead → « Créer le devis » → Solaire → ~6 kWc → toggle 5,5 %↔20 % → émettre → vérifier PDF + n° `VDE-2026-xxx`.

---

## 5. Reste en file (non démarré)
- **Tour de contrôle** (supervision) — non prioritaire.

---

## Ordre de reprise (quand d'attaque)
1. Appliquer `0025` sur prod (§2) — **prioritaire**.
2. Répondre **A / B** (§3) → si A, refactor 2B + `0026`.
3. Appliquer `0024` + caler les prix PV (§4).
4. Tour de contrôle (§5).
