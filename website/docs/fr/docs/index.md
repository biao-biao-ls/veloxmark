---
title: Introduction
description: Bienvenue dans la documentation utilisateur de VeloxMark — un éditeur Markdown gratuit et open source avec aperçu en direct, construit sur Electron et CodeMirror 6.
keywords: [documentation VeloxMark, guide éditeur Markdown, éditeur aperçu en direct, introduction]
---

# Introduction

Bienvenue dans la documentation utilisateur de VeloxMark — un éditeur Markdown gratuit et
open source avec aperçu en direct pour macOS, Windows et Linux, inspiré par Typora et
construit sur Electron + CodeMirror 6.

<div class="vm-shot">

![Interface VeloxMark](/img/hero-light.png)

</div>

## Ce qui rend VeloxMark différent

**La source Markdown est l'unique source de données.** Tout ce qui est riche — titres
rendus, formules, diagrammes, tableaux — est une décoration éphémère posée sur votre
fichier texte brut. L'enregistrement écrit du `.md` propre sans perte aller-retour. Il
n'y a pas de format de document propriétaire ni d'état caché.

Le moteur d'aperçu en direct reconstruit ses décorations à chaque changement de document
et de sélection : les marqueurs de syntaxe sont masqués avec des décorations de
remplacement, et les blocs de code / maths / mermaid / image sont remplacés par des
composants rendus. Quand le curseur entre dans une plage, la décoration de cette plage est
ignorée et la forme source réapparaît. La ligne du curseur reste toujours en forme source :
vous savez exactement ce que vous éditez.

## Où aller ensuite

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">Installation</a></h3>
    <p>Installateurs pour macOS, Windows et Linux, vérification des sommes de contrôle et notes par plateforme.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">Bases</a></h3>
    <p>La fenêtre, la barre latérale, les onglets et les trois modes de l'éditeur — tout ce que vous voyez au premier lancement.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">Édition en profondeur</a></h3>
    <p>Comment se comporte l'aperçu en direct pendant que vous tapez : composants de bloc, tableaux, modes focus et aides à la saisie.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Syntaxe Markdown</a></h3>
    <p>Chaque construction de syntaxe que VeloxMark rend spécialement, avec des exemples de source.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">Raccourcis clavier</a></h3>
    <p>La liste complète des commandes avec les accélérateurs pour chaque plateforme.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">FAQ</a></h3>
    <p>Plateformes prises en charge, dépannage et comment signaler un bug.</p>
  </div>
</div>

## Licence

VeloxMark est publié sous la
[licence MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Les sources sont sur [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark).
