---
title: FAQ
description: FAQ VeloxMark — plateformes prises en charge, licence, fonctionnement de l'aperçu en direct, aller-retour des fichiers, emplacements des données, macOS Gatekeeper et comportement de mise à jour.
keywords: [FAQ VeloxMark, FAQ éditeur Markdown, questions aperçu en direct, dépannage VeloxMark]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Quelles plateformes sont prises en charge ?","acceptedAnswer":{"@type":"Answer","text":"macOS (Apple Silicon et Intel), Windows 10/11 (x64 et ARM64) et Linux (x64 et arm64 — AppImage, deb, rpm, tar.gz ; snap en x64 uniquement)."}},{"@type":"Question","name":"VeloxMark est-il gratuit ?","acceptedAnswer":{"@type":"Answer","text":"Oui. VeloxMark est open source sous licence MIT. Aucun compte, aucun abonnement, aucune télémétrie."}},{"@type":"Question","name":"Qu''est-ce que l''aperçu en direct et en quoi diffère-t-il d''une vue scindée ?","acceptedAnswer":{"@type":"Answer","text":"Il n''y a pas de volet d''aperçu. L''éditeur rend le Markdown sur place : quand le curseur quitte une ligne, les marqueurs de syntaxe disparaissent et la ligne prend sa forme finale. La ligne du curseur reste toujours en forme source, et un clic sur un bloc rendu fait réapparaître son Markdown brut pour l''édition. La source Markdown est l''unique source de données — l''enregistrement écrit du .md pur sans perte."}},{"@type":"Question","name":"VeloxMark modifie-t-il mes fichiers Markdown lors de l''enregistrement ?","acceptedAnswer":{"@type":"Answer","text":"Non. L''enregistrement réécrit le texte source sans modification. Tout rendu est décoratif."}},{"@type":"Question","name":"Quelle syntaxe Markdown est prise en charge ?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM (tableaux, listes de tâches, barré), plus les formules KaTeX, les diagrammes Mermaid, les encadrés, les notes de bas de page et le texte surligné."}},{"@type":"Question","name":"Puis-je utiliser VeloxMark pour gérer mes notes ?","acceptedAnswer":{"@type":"Answer","text":"VeloxMark est un lecteur/éditeur Markdown concentré — ouvrez des dossiers et des fichiers, utilisez le sommaire et la recherche, mais il n''y a pas de couche de gestion des connaissances. Vos fichiers restent du .md pur sur disque, n''importe quel autre outil peut les reprendre."}},{"@type":"Question","name":"Comment signaler un bug ?","acceptedAnswer":{"@type":"Answer","text":"Ouvrez une issue sur GitHub avec la version de l''application (menu Aide), votre système d''exploitation, les étapes de reproduction et le Markdown fautif."}},{"@type":"Question","name":"Où sont stockés mes brouillons et mes paramètres ?","acceptedAnswer":{"@type":"Answer","text":"Préférences, brouillons et état de session vivent dans le répertoire standard de données d''application par utilisateur (userData d''Electron) : Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. Les documents eux-mêmes ne sont jamais déplacés ni copiés."}},{"@type":"Question","name":"Pourquoi macOS indique-t-il que l''application provient d''un développeur non identifié ?","acceptedAnswer":{"@type":"Answer","text":"Les builds de publication ne sont actuellement pas signés. Exécutez xattr -d com.apple.quarantine /Applications/VeloxMark.app une fois après l''installation."}},{"@type":"Question","name":"L''application ne se met pas à jour automatiquement sur ma plateforme — est-ce normal ?","acceptedAnswer":{"@type":"Answer","text":"Oui. La mise à jour automatique complète est activée pour les installations NSIS sous Windows et les AppImage Linux ; les autres formes d''installation se limitent à une notification, et macOS ouvre actuellement la page des versions car les builds ne sont pas signés."}}]}'
---

# Foire aux questions (FAQ)

### Quelles plateformes sont prises en charge ?

macOS (Apple Silicon et Intel), Windows 10/11 (x64 et ARM64) et Linux
(x64 et arm64 — AppImage, deb, rpm, tar.gz ; snap en x64 uniquement).
Voir [Installation](./installation).

### VeloxMark est-il gratuit ?

Oui. VeloxMark est open source sous la
[licence MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Aucun compte, aucun abonnement, aucune télémétrie.

### Qu'est-ce que l'aperçu en direct et en quoi diffère-t-il d'une vue scindée ?

Il n'y a pas de volet d'aperçu. L'éditeur rend votre Markdown **sur place** : quand le
curseur quitte une ligne, les marqueurs de syntaxe comme `#`, `**` et `` ` `` disparaissent
et la ligne prend sa forme finale. La ligne du curseur reste toujours en forme source, et
un clic sur n'importe quel bloc rendu (code, formule, diagramme, tableau, image) fait
réapparaître son Markdown brut pour l'édition. La source Markdown est l'unique source de
données — l'enregistrement écrit du `.md` pur sans perte aller-retour.

### VeloxMark modifie-t-il mes fichiers Markdown lors de l'enregistrement ?

Non. L'enregistrement réécrit le texte source sans modification. Tout rendu est décoratif.

### Quelle syntaxe Markdown est prise en charge ?

CommonMark + GFM (tableaux, listes de tâches, barré), plus les formules KaTeX, les
diagrammes Mermaid, les encadrés, les notes de bas de page et les `==surlignages==`.
Référence complète : [Syntaxe Markdown](./markdown-syntax).

### Puis-je utiliser VeloxMark pour gérer mes notes ?

VeloxMark est un lecteur/éditeur Markdown concentré — ouvrez des dossiers et des fichiers,
utilisez le sommaire et la recherche, mais il n'y a pas de couche de gestion des
connaissances (pas de tags, de liens retour ni de base de données). Vos fichiers restent
du `.md` pur sur disque : n'importe quel autre outil peut les reprendre.

### Comment signaler un bug ?

Ouvrez une issue sur [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) avec la
version de l'application (menu Aide), votre système d'exploitation, les étapes de
reproduction et le Markdown fautif.

### Où sont stockés mes brouillons et mes paramètres ?

Préférences, brouillons et état de session vivent dans le répertoire standard de données
d'application par utilisateur (Electron `userData`) : Windows `%APPDATA%\VeloxMark`, macOS
`~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`. Les documents
eux-mêmes ne sont jamais déplacés ni copiés — vous éditez les fichiers là où ils sont.

### Pourquoi macOS indique-t-il que l'application provient d'un développeur non identifié ?

Les builds de publication sont actuellement non signés. Exécutez
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` une fois après
l'installation — voir [Installation](./installation#macos).

### L'application ne se met pas à jour automatiquement sur ma plateforme — est-ce normal ?

Oui. La mise à jour automatique complète est activée pour les installations NSIS sous
Windows et les AppImage Linux ; les autres formes d'installation se limitent à une
notification, et macOS ouvre actuellement la page des versions car les builds ne sont pas
signés. Détails : [Mise à jour automatique](./updates).
