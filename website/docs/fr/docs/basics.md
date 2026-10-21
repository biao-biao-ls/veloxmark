---
title: Bases
description: La fenêtre VeloxMark en un coup d'œil — barre de titre, barre latérale (fichiers, sommaire, recherche), onglets, modes de l'éditeur, ouverture et enregistrement de fichiers.
keywords: [bases VeloxMark, interface éditeur Markdown, panneau sommaire, onglets, mode focus, mode machine à écrire, mode source]
---

# Bases

VeloxMark s'ouvre sur un document de bienvenue qui sert aussi de visite guidée. Cette
page parcourt la fenêtre, la barre latérale, les onglets et les modes de l'éditeur.

## La fenêtre

<div class="vm-shot">

![Fenêtre VeloxMark](/img/hero-light.png)

</div>

- **Barre de titre** — barre personnalisée sans cadre avec le menu de l'application
  (Fichier / Édition / Affichage / Insertion / Aide) et les contrôles de fenêtre. Suit le
  thème clair/sombre.
- **Barre latérale** — trois panneaux : **Fichiers** (espace de travail de dossier),
  **Sommaire** (arborescence des titres du document actif) et **Recherche** (recherche
  dans le dossier).
- **Barre d'onglets** — un onglet par document ouvert, avec marquage des modifications non
  enregistrées.
- **Éditeur** — la surface d'écriture avec aperçu en direct.
- **Barre d'état** — position du curseur, compteurs de mots / caractères / lignes, et
  indicateurs des modes focus quand ils sont actifs.

## Barre latérale

- **Fichiers** — ouvrez un dossier et parcourez ses fichiers Markdown ; cliquez pour
  ouvrir dans un onglet.
- **Sommaire** — arborescence des titres du document actif avec saut par clic et
  surlignage de la position courante.
- **Recherche** — recherche plein texte dans le dossier ouvert, avec remplacement.

## Onglets

- Ouvrez plusieurs fichiers à la fois ; chacun obtient un onglet.
- Les modifications non enregistrées sont marquées sur l'onglet.
- Fermez et rouvrez des onglets ; un onglet fermé peut être restauré.
- Faites glisser les onglets pour les réordonner.

## Modes de l'éditeur

| Mode | Ce qu'il fait |
| --- | --- |
| **Aperçu en direct** (par défaut) | Le Markdown se rend sur place ; la ligne du curseur reste en forme source |
| **Mode source** | Markdown brut en permanence, pour un contrôle total |
| **Mode focus** | Tout s'atténue sauf la ligne courante |
| **Mode machine à écrire** | La ligne courante reste verrouillée sur le centre vertical |

Changez de thème depuis le menu Affichage. Liste complète des commandes :
[Raccourcis clavier](./key-bindings).

## Ouverture et enregistrement

- **Ouvrez** un fichier `.md` (`Ctrl+O` / `Cmd+O`) ou ouvrez un dossier depuis le menu
  Fichier.
- **Enregistrer** (`Ctrl+S` / `Cmd+S`) réécrit la source brute — zéro perte aller-retour.
- **Enregistrer sous** écrit une copie sous un nouveau nom.
- Le travail non enregistré est conservé comme brouillon et peut être récupéré.

## Étapes suivantes

- [Édition en profondeur](./editing) — comment se comporte l'aperçu en direct pendant que
  vous tapez.
- [Syntaxe Markdown](./markdown-syntax) — tout ce qui se rend spécialement.
- [Préférences](./preferences) — réglez l'éditeur selon vos goûts.
