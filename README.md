# VDE Cockpit

> Design system et règles du projet : voir `CLAUDE.md` (source de vérité).

---

## AVANT MISE EN LIGNE — checklist obligatoire

Le projet peut tourner en **mode ouvert (dev)** : authentification désactivée et
base ouverte au rôle `anon`. **Cet état est réservé au développement local.**

**Rappel important :** « l'app tourne en local » **ne protège pas la base**. Le
projet Supabase est sur Internet ; ce sont les policies RLS qui protègent les
données, pas l'endroit d'où tourne l'app. Tant que le mode ouvert est actif,
toute personne connaissant l'URL du projet peut lire/écrire la base — la clé
publiable étant publique par design. **Ne jamais laisser de données clients
réelles (PII) dans la base pendant le mode ouvert.**

### Comment savoir dans quel état on est
- Un bandeau rouge **« Mode ouvert (dev) — auth désactivée »** s'affiche en haut
  de l'app tant que le mode est actif. Pas de bandeau = auth active.

### Les 3 étapes pour revenir en état sûr

1. **Réactiver l'auth** — dans `.env.local` :
   ```
   NEXT_PUBLIC_AUTH_DISABLED=false
   ```
   (ou supprimer la ligne — le défaut est `false`). Puis rebuild : les variables
   `NEXT_PUBLIC_*` sont inlinées **au build**.
   ```bash
   rm -rf .next && npm run build
   ```

2. **Retirer les policies ouvertes** — SQL Editor → exécuter le rollback de
   `supabase/dev-only/0002_dev_open_access.sql` :
   ```sql
   drop policy if exists "dev_open_access_leads_anon" on leads;
   drop policy if exists "dev_open_access_activites_anon" on activites;
   ```

3. **Vérifier que la RLS stricte est restaurée** — ne doivent rester que les
   policies `authenticated` de `0001_init_leads.sql` :
   ```sql
   select tablename, policyname, roles
     from pg_policies
    where tablename in ('leads', 'activites')
    order by tablename, policyname;
   ```
   Contrôle final : `/leads` sans session doit **rediriger vers `/login`**.

> **Ordre impératif** : faire ces 3 étapes **AVANT** tout import de données
> clients réelles (CSV AppSheet), pas seulement avant le déploiement.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
