---
title: Édition en profondeur
description: Comment se comporte l'aperçu en direct de VeloxMark pendant que vous tapez — marqueurs de syntaxe, composants de bloc, édition native de tableaux, aides à la saisie et workflows multi-onglets.
keywords: [édition aperçu en direct, édition tableaux Markdown, composants de bloc, aides à la saisie, coller HTML en Markdown]
---

# Édition en profondeur

L'éditeur de VeloxMark est CodeMirror 6 avec un moteur de décorations qui reconstruit la
vue rendue à chaque changement de document et de sélection. Cette page explique comment
cela se comporte pendant que vous écrivez.

## Aperçu en direct

- Quand le curseur quitte une ligne, ses marqueurs de syntaxe (`#`, `**`, `` ` ``, `*`,
  `~~`, `==`) sont masqués avec des décorations de remplacement et la ligne montre sa
  forme finale stylée.
- La **ligne du curseur reste toujours en forme source** — vous voyez exactement ce que
  vous tapez.
- Un clic sur un marqueur masqué fait réapparaître la forme source pour cette plage.

<div class="vm-shot">

![Ligne du curseur en forme source](/img/caret-source-line.png)

</div>

## Composants de bloc

Les blocs de code, les formules `$$`, les diagrammes Mermaid et les images se rendent
sous forme de composants à la place de leur source. **Cliquez sur n'importe quel bloc
rendu pour éditer sa source** ; quittez le bloc et il se rend à nouveau.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="Formule KaTeX hors ligne" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="Diagramme Mermaid rendu sur place" style="display:block;width:100%" />
  </div>
</div>

## Tableaux

Les tableaux sont des citoyens de premier rang : chaque cellule est un éditeur CodeMirror
imbriqué.

- **Insérer / convertir** — utilisez la boîte de dialogue d'insertion de tableau pour
  créer un tableau avec un nombre de lignes et de colonnes choisi, ou convertissez le
  paragraphe courant en tableau.
- **Redimensionner une colonne** — faites glisser la bordure de la colonne.
- **Alignement** — définissez l'alignement par colonne (gauche / centre / droite) ; la
  ligne de séparation source (`:---`, `:--:`, `---:`) reste synchronisée.
- Toutes les modifications passent par des transactions vers la plage de source Markdown
  que le composant possède — le document n'est jamais modifié dans votre dos.

<div class="vm-shot">

![Édition de tableau](/img/table-widget-light.png)

</div>

## Modes focus et machine à écrire

- Le **mode focus** atténue tout sauf le paragraphe en cours d'écriture.
- Le **mode machine à écrire** garde la ligne du curseur verrouillée sur le centre vertical.
- Les deux peuvent être combinés ; la barre d'état affiche les pastilles `FOCUS` /
  `TYPEWRITER` pendant qu'ils sont actifs.

<div class="vm-shot">

![Mode focus](/img/focus-mode.png)

</div>

## Aides à la saisie

- **Coller HTML → Markdown** — le texte enrichi collé depuis le presse-papiers est
  converti en Markdown propre.
- **URL nues** — une URL nue collée est automatiquement enveloppée dans un lien.
- **Listes de tâches** — `- [ ]` se rend comme une case à cocher cliquable ; cliquez pour
  basculer.
- **Annuler/rétablir** — historique complet des transactions (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Édition multi-onglets

Ouvrez plusieurs fichiers à la fois. Les onglets peuvent être fermés et rouverts, les
modifications non enregistrées sont marquées, et la bande d'onglets peut être réordonnée
par glisser-déposer.

## Blocs de code

- Coloration syntaxique via highlight.js pour des centaines de langages.
- Numéros de ligne optionnels, retour à la ligne doux et pliage des blocs longs — voir
  [Préférences](./preferences).

## Export

Exportez en PDF ou HTML depuis le menu Fichier, y compris l'export HTML de la seule
sélection. Voir [Exporter un document](./export).
