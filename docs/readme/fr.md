# VeloxMark

Écrivez en Markdown — tout le reste n'est que décoration.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · [한국어](ko.md) · [Español](es.md) · [Português](pt.md) · **Français** · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark est un lecteur et éditeur Markdown de bureau, gratuit et open source, avec aperçu en direct. Il vise la sensation d'écriture sans friction popularisée par [Typora](https://typora.io), tout en gardant les fichiers `.md` en texte brut parfaitement portables — construit sur Electron et CodeMirror 6, pour macOS, Windows et Linux.

![VeloxMark thème clair](../../website/docs/public/img/hero-light.png)

- Site web et documentation : https://veloxmark.knzn.net
- Téléchargements : https://github.com/biao-biao-ls/veloxmark/releases

## Fonctionnalités

- **Aperçu en direct (style Typora)** : le texte source Markdown est l'unique source de données. Quand le curseur quitte une ligne, les marqueurs de syntaxe comme `#`, `**` et `` ` `` disparaissent et la ligne s'affiche dans son style final ; la ligne du curseur reste en forme source
- **Rendu des blocs** : blocs de code (coloration syntaxique), formules `$$` (KaTeX) et diagrammes ```` ```mermaid ```` — cliquez sur un bloc pour en éditer la source
- **Tableaux** : édition de tableaux native avec éditeurs de cellules imbriqués, dialogues d'insertion/conversion en tableau, redimensionnement des colonnes et alignement
- **Navigation par plan** : arborescence des titres dans la barre latérale, saut par clic et mise en évidence de la position actuelle
- **Édition multi-onglets** : ouvrez plusieurs fichiers à la fois, fermez/rouvrez des onglets ; les modifications non enregistrées sont marquées par `•`
- **Modes de concentration** : mode focus, mode machine à écrire et mode source
- **Thème clair/sombre** : bascule via le menu **Affichage → Changer de thème**, mémisé entre les sessions ; la barre de titre sans cadre et les menus de l'application (Fichier/Édition/Affichage/Aide) suivent le thème
- **Opérations sur les fichiers** : ouvrir / enregistrer / enregistrer sous ; commandes de fenêtre personnalisées (réduire/agrandir/fermer)
- **Export** : PDF et HTML, y compris l'export de la seule sélection en HTML
- **Aides à la saisie** : les URL collées deviennent des liens, le HTML collé est converti en Markdown
- **Listes de tâches** : `- [ ]` s'affiche comme une case à cocher cliquable
- **Images** : chemins absolus, chemins relatifs (par rapport au fichier `.md` courant) et images distantes
- **Mise à jour automatique** : les installateurs vérifient GitHub Releases et se mettent à jour sur place (Windows NSIS et Linux AppImage)
- **Localisation** : interface en français, English, 简体中文, 日本語, 한국어, Español, Português, Deutsch et Русский (menus natifs et documents d'exemple inclus)

## Installation

Téléchargez la version de votre plateforme depuis la [page des releases](https://github.com/biao-biao-ls/veloxmark/releases/latest) :

- **Windows** — installateur NSIS (avec mise à jour automatique) ou zip portable
- **macOS** — dmg et zip (versions non signées). Au premier lancement, faites clic droit → **Ouvrir**, ou retirez la mise en quarantaine : `xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage (avec mise à jour automatique), deb, rpm, tar.gz ou snap

## Développement

```bash
npm install
npm run dev      # mode développement (rechargement à chaud)
npm run build    # construire dans out/
npm run typecheck
```

> Si le téléchargement des binaires d'Electron échoue sur les réseaux restreints :
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Stack technique

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — cœur de l'éditeur ; aperçu en direct via des décorations StateField
- [KaTeX](https://katex.org) — formules mathématiques
- [mermaid](https://mermaid.js.org) — diagrammes
- [highlight.js](https://highlightjs.org) — coloration syntaxique

## Architecture

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview/   live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh/ja/ko/es/pt/fr/de/ru)
```

Conception clé : le texte Markdown est toujours l'unique source de données (l'enregistrement écrit un `.md` brut, sans perte aller-retour). Le moteur de décorations reconstruit les Decorations à chaque changement de document/sélection : les marqueurs de syntaxe sont masqués par des décorations replace, et les blocs de code/maths/diagrammes sont remplacés par des widgets. Quand le curseur entre dans une plage, les décorations de cette plage sont ignorées et la forme source réapparaît.

## Documentation

La documentation utilisateur complète est sur le [site web](https://veloxmark.knzn.net/fr/docs/). Le manuel de release (processus, artefacts, état de signature, dépannage) se trouve dans [CLAUDE.md](../../CLAUDE.md), section « Release process ».

## Contribuer

- **Les messages de commit et les commentaires de code doivent être rédigés en anglais.**
- **Les traductions n'appartiennent qu'aux packs de localisation** — un pack (fichier ou répertoire) par langue :
  - `src/renderer/src/i18n/<lang>.ts` — dictionnaire de l'interface et noms natifs des langues
  - `electron/shared/menuStrings/<lang>.ts` — textes des menus natifs
  - `src/renderer/src/content/<lang>.ts` — documents d'accueil/aide
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — corps des modèles Mermaid
  - `docs/readme/<lang>.md` — traductions de ce README
  - `website/docs/<lang>/` et `website/docs/.vitepress/locales/<lang>.ts` — pages et textes d'interface du site

  Tout le reste du dépôt reste en anglais uniquement.

## Licence

[MIT](../../LICENSE)
