# supabase/dev-only — NE PAS APPLIQUER AUTOMATIQUEMENT

Ce dossier contient du SQL **de développement local uniquement**. Il est
volontairement **hors de `supabase/migrations/`** pour qu'aucun outil
(`supabase db push`, CI, script de déploiement) ne l'applique par mégarde.

| Fichier | Rôle | État attendu |
| --- | --- | --- |
| `0002_dev_open_access.sql` | Ouvre `leads` / `activites` au rôle `anon` (lecture + écriture) pour travailler sans login | **NON appliqué** |

## Règles

- À n'appliquer **à la main** (SQL Editor) que si la base ne contient **aucune
  donnée client réelle**. Ouvrir `anon` rend la base accessible à toute personne
  connaissant l'URL du projet : la clé publiable est publique par design, c'est
  la RLS qui protège les données — pas le fait que l'app tourne « en local ».
- Toujours accompagné de `NEXT_PUBLIC_AUTH_DISABLED=true` dans `.env.local`.
- **Rollback obligatoire** avant tout import de données réelles et avant toute
  mise en ligne — le SQL de rollback est en bas du fichier, et la procédure
  complète dans le bloc « AVANT MISE EN LIGNE » du README racine.

État de référence (sûr) : seule `supabase/migrations/0001_init_leads.sql` est
appliquée → RLS stricte, `authenticated` = CRUD, `anon` = bloqué.
