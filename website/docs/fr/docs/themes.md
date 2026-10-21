---
title: Thèmes
description: Les thèmes clair et sombre de VeloxMark — bascule en un clic, persistance d'une session à l'autre, et comment les thèmes s'appliquent aux composants de code, de formules et de diagrammes.
keywords: [mode sombre éditeur Markdown, thème clair, thème sombre, thèmes éditeur, bascule de thème]
---

# Thèmes

VeloxMark fournit deux thèmes de premier rang — clair et sombre — réglés pour les
longues sessions d'écriture. Les deux couvrent l'habillage de l'éditeur, les couleurs
syntaxiques et les composants de bloc rendus (formules, diagrammes, code, tableaux).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">clair</span>
      </div>
      <img src="/img/hero-light.png" alt="Thème clair VeloxMark" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">sombre</span>
      </div>
      <img src="/img/hero-dark.png" alt="Thème sombre VeloxMark" />
    </div>
  </div>
</div>

## Changer de thème

- Menu : **Affichage → Basculer le thème** (aussi disponible comme commande « Basculer
  le thème »).
- Ou choisissez `clair` / `sombre` / `système` explicitement dans les Préférences (mode
  de thème).
- Le choix est mémorisé d'une session à l'autre.

La barre de titre personnalisée sans cadre et les menus de l'application
(Fichier / Édition / Affichage / Insertion / Aide) suivent le thème actif.

## Exemple de code en thème sombre

<div class="vm-shot">

![Bloc de code en thème sombre](/img/code-dark.png)

</div>

## Comment les thèmes s'appliquent

L'éditeur est [CodeMirror 6](https://codemirror.net) ; chaque thème est un thème CM6 plus
des variables CSS couvrant l'enveloppe de l'application. Les composants rendus (KaTeX,
Mermaid, highlight.js) reprennent la même palette : un bloc de code ou un diagramme ne
semble jamais déplacé.
