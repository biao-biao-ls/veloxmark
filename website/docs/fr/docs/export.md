---
title: Exporter un document
description: Exportez les documents VeloxMark en PDF ou HTML — options de page, thèmes, incorporation d'images, polices KaTeX, export HTML de la seule sélection et copie comme texte enrichi.
keywords: [export Markdown en PDF, Markdown en HTML, options d'export PDF, export de sélection, copie texte enrichi]
---

# Exporter un document

VeloxMark exporte depuis la **source Markdown** — pas depuis le DOM de l'éditeur — aussi
la sortie correspond-elle exactement à votre document. Disponible depuis le menu
Fichier : **Exporter → PDF…** ou **Exporter → HTML…**. Les deux ouvrent une boîte de
dialogue d'export partagée.

## Options

| Groupe | Réglage | Valeurs |
| --- | --- | --- |
| Page (PDF) | Format de papier | A4, Letter |
| Page (PDF) | Marges | Normal, Étroit |
| Page (PDF) | En-tête et pied de page | Activé / désactivé — l'en-tête montre le titre du document / le nom de fichier, le pied de page montre `page / total` |
| Style | Thème | Suivre le thème courant, ou forcer le clair |
| Images | Incorporer en base64 / garder les chemins relatifs | Le PDF incorpore toujours |
| Maths | Polices KaTeX | Incorporer (prêt pour le hors ligne) ou repli CDN (fichier plus petit) |

## Ce qui est rendu

Le pipeline complet reproduit tout ce que montre l'aperçu en direct :

- Titres, listes, listes de tâches (comme cases cochées), tableaux avec alignement
- Code avec les couleurs syntaxiques de highlight.js
- **Formules KaTeX** comme vraies formules composées
- **Diagrammes Mermaid** comme SVG en ligne
- Encadrés, notes de bas de page (numérotées avec renvois), `==surlignages==`, exposant,
  indice, abréviations et listes de définitions
- Images avec attributs de taille / alignement / retournement, résolues par rapport au
  document et intégrées là où l'option le demande
- Le `title` du front matter devient le H1 du document

La génération PDF rend le HTML dans une fenêtre masquée et isolée, attend les polices et
les images, puis imprime en PDF avec les arrière-plans.

## Export de la seule sélection

**Édition → Exporter la sélection en HTML…** exporte uniquement la plage sélectionnée
comme fichier HTML autonome (sans sélection, le document entier est utilisé). La même
portée sélection-ou-document s'applique à **Copier comme texte enrichi** et **Copier
comme HTML**.

## Garantie aller-retour

L'export ne modifie jamais votre fichier. Le `.md` sur disque reste l'unique source de
vérité ; le PDF/HTML exporté n'en est qu'un rendu.
