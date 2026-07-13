@AGENTS.md

# VDE Cockpit — Design system (source de vérité)

Ce document fait autorité sur l'identité visuelle du projet. Toute évolution
de palette, typographie ou règle ci-dessous doit être répercutée ici **et**
dans le code (`app/globals.css` pour les tokens, `app/layout.tsx` pour les
polices). Pas de dérive silencieuse.

Référence visuelle (mise en page / densité, **pas** le code) :
`design-ref/VDE Cockpit - autonome.html`.

## Couleurs (6 tokens de base)

Déclarées comme design tokens Tailwind v4 dans `app/globals.css` (`@theme`).

| Token          | Hex       | Usage                                   |
| -------------- | --------- | --------------------------------------- |
| `brand`        | `#0F3D2E` | Vert profond — sidebar, actions primaires |
| `gold`         | `#C8A15A` | Or — logo, accents, mises en avant      |
| `cream`        | `#F7F5EF` | Crème — fond applicatif (canvas)        |
| `ink`          | `#1A1A1A` | Encre — texte principal                 |
| `muted`        | `#5C6B63` | Vert-gris — texte secondaire, bordures  |
| `alert`        | `#D4583F` | Terracotta — alertes, destructif        |

Couleurs de support (états, badges, surfaces), également tokenisées :
`brand-hover #155940` · `gold-ink #8A6A2E` · `success #2E7D5B` ·
`surface #FFFFFF` · `line #E7E2D7`.

## Typographies (3)

Chargées via `next/font/google` dans `app/layout.tsx`, exposées en variables
CSS et mappées sur `--font-*` dans `@theme`.

| Rôle            | Police             | Utilitaire   | Notes                                  |
| --------------- | ------------------ | ------------ | -------------------------------------- |
| UI / texte      | **Inter Tight**    | `font-sans`  | Police UI du brand kit VDE             |
| Titres / display| **Instrument Serif** italic | `font-serif` | Ex. `PageTitle`                        |
| Chiffres        | **JetBrains Mono** | `font-mono`  | Obligatoire pour toute valeur numérique |

> **Note brand kit** — la police UI est **Inter Tight**, conforme au brand kit
> VDE et au prototype de référence. (Un premier jet utilisait « Inter » par
> erreur ; corrigé.) Ce n'est **pas** une exception : aucune substitution de la
> police du brand kit n'est autorisée sans validation explicite documentée ici.

## Règles non négociables

- **Zéro emoji.** Jamais, nulle part (UI, contenu, commits inclus).
- **Icônes : Lucide (`lucide-react`) uniquement.** Aucune autre source d'icône.
- **Tous les chiffres en JetBrains Mono** (`font-mono`) : montants, compteurs,
  échéances, statistiques, badges numériques…
- **Aucune donnée client réelle** dans le code / les maquettes.
- **Rien d'inventé ne survit au MVP.** Toute donnée statique de démonstration
  (valeurs, compteurs, badges) doit porter un commentaire
  `// TODO: brancher données réelles` (ou `{/* TODO: … */}` en JSX) et être
  branchée sur une source réelle avant livraison MVP.
