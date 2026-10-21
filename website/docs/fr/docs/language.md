---
title: Langue et localisation
description: VeloxMark est disponible en neuf langues d'interface, avec menus natifs et documents d'exemple. Fonctionnement du choix de la langue et comment contribuer aux traductions.
keywords: [langues VeloxMark, localisation éditeur Markdown, langue d'interface, traduction]
---

# Langue et localisation

L'interface de VeloxMark est disponible en neuf langues :

| Langue | Code |
| --- | --- |
| Anglais | `en` |
| Chinois | `zh` |
| Japonais | `ja` |
| Coréen | `ko` |
| Espagnol | `es` |
| Portugais | `pt` |
| Français | `fr` |
| Allemand | `de` |
| Russe | `ru` |

(Dans le sélecteur de langue de l'application, chaque langue est listée sous son propre
nom natif.)

La localisation couvre toute l'interface : les menus (natives sur macOS), les boîtes de
dialogue, la barre d'état — et même les documents d'exemple de bienvenue / d'aide et les
corps de modèles Mermaid, qui sont choisis par langue.

## Choisir une langue

- **Suivre le système** par défaut — l'application choisit la langue d'interface d'après
  la langue de votre système quand un paquet existe pour celle-ci, avec repli sur
  l'anglais.
- **La définir explicitement** depuis les préférences / le menu Affichage ; le choix est
  mémorisé d'une session à l'autre.

## Traduire

Les traductions vivent dans un fichier de paquet par langue (dictionnaire d'interface,
chaînes de menus natifs, documents de bienvenue/d'aide et modèles Mermaid). La parité des
clés de dictionnaire est imposée par le système de types — une nouvelle langue doit
fournir les quatre paquets pour passer `npm run typecheck`. Contributions bienvenues sur
[GitHub](https://github.com/biao-biao-ls/veloxmark).
