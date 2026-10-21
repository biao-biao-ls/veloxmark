---
title: Raccourcis clavier
description: Référence complète des raccourcis clavier VeloxMark — fichier, édition, format, onglets, modes d'affichage, édition de tableaux et raccourcis au niveau de l'éditeur pour chaque plateforme.
keywords: [raccourcis VeloxMark, raccourcis clavier éditeur Markdown, raccourcis clavier, raccourcis édition de tableau, raccourci mode focus]
---

# Raccourcis clavier

VeloxMark est conçu pour le clavier. Sur Windows et Linux les raccourcis utilisent
`Ctrl` ; sur macOS les mêmes liaisons utilisent `Cmd` (affiché dans les menus avec le
glyphe ⌘), et les éléments préfixés `Ctrl` ci-dessous se lisent donc `Cmd`. Les raccourcis
sont aussi affichés à côté de chaque commande dans les menus de l'application.

## Fichier

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Nouveau | `Ctrl+N` | Nouvel onglet sans titre |
| Ouvrir… | `Ctrl+O` | Ouvrir un fichier `.md` |
| Ouvrir un dossier… | `Ctrl+Shift+O` | Charger un espace de travail dans la barre latérale |
| Ouverture rapide… | `Ctrl+P` | Sélecteur de fichiers flou dans l'espace de travail |
| Enregistrer | `Ctrl+S` | |
| Enregistrer sous… | `Ctrl+Shift+S` | |
| Préférences… | `Ctrl+,` | |
| Exporter en PDF… | menu | [Exporter](./export) |
| Exporter en HTML… | menu | [Exporter](./export) |

## Édition

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Annuler | `Ctrl+Z` | |
| Rétablir | `Ctrl+Y` | |
| Couper / Copier / Coller | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | |
| Copier comme texte enrichi | `Ctrl+Shift+C` | Texte enrichi dans le presse-papiers |
| Copier comme HTML / Markdown / texte brut | menu | Menu contextuel → Copier comme |
| Tout sélectionner | `Ctrl+A` | |
| Rechercher | `Ctrl+F` | Recherche dans le document |
| Exporter la sélection en HTML… | menu | Export HTML de la seule sélection |
| Formater le document | `Shift+Alt+F` | Normaliser la source Markdown |

## Format

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Gras | `Ctrl+B` | |
| Italique | `Ctrl+I` | |
| Code en ligne | `Ctrl+E` | |
| Bloc de code / Barré / Surligné | menu | |
| Effacer la mise en forme | menu | |
| Titres 1–6, paragraphe, citation | menu | |
| Liste à puces / numérotée / de tâches | menu | |
| Promouvoir / Quitter la liste | menu | |
| Ouvrir le lien | `Ctrl+Shift+L` | Ouvre le lien sous le curseur |
| Insérer un lien… | menu | |

## Onglets

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Onglet suivant | `Ctrl+Tab` | |
| Fermer l'onglet | `Ctrl+W` | Demande d'enregistrer les modifications non enregistrées |
| Rouvrir l'onglet fermé | `Ctrl+Shift+T` | |

## Affichage et modes

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Basculer la barre latérale | `Ctrl+Shift+B` | |
| Rechercher dans le dossier… | `Ctrl+Shift+F` | |
| Replier / déplier la section | `Ctrl+Alt+[` / `Ctrl+Alt+]` | |
| Tout replier / tout déplier | menu | |
| Mode focus | `F8` | Atténuer tout sauf la région courante |
| Mode machine à écrire | `F9` | Verrouiller la ligne du curseur sur le centre |
| Mode source | `Ctrl+/` | Markdown brut |
| Basculer le thème | menu | Clair / sombre |
| Zoom avant / arrière / réinitialiser | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | |
| Basculer les outils de développement | `F12` | |

## Insertion

| Commande | Raccourci | Remarques |
| --- | --- | --- |
| Insérer un tableau… / Convertir la sélection en tableau… | menu | |
| Diagramme Mermaid… | menu | Insérer depuis un modèle |
| Insérer un encadré… | menu | |

## Raccourcis au niveau de l'éditeur

Ces raccourcis fonctionnent pendant la frappe dans l'éditeur :

| Raccourci | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Indenter / désindenter (éléments de liste) |
| `Enter` sur un élément de liste vide | Quitter la liste |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+E` | Basculer gras / italique / code en ligne |
| `Ctrl` + clic sur un lien | Ouvrir le lien |
| Clic sur un bloc rendu | Éditer sa source |
| Clic sur une case à cocher | Basculer `[ ]` / `[x]` |

## Édition de tableaux

Pendant l'édition d'une cellule de tableau :

| Raccourci | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Cellule suivante / précédente |
| `Enter` / `Shift+Enter` | Cellule en dessous / au-dessus |
| `Ctrl+Enter` / `Ctrl+Shift+Enter` | Insérer une ligne en dessous / au-dessus |
| `Ctrl+Shift+←` / `→` | Insérer une colonne à gauche / à droite |
| `Alt+↑↓←→` | Déplacer la ligne / la colonne |
| `Escape` | Quitter l'édition de tableau |
