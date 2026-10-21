/**
 * Website UI strings — French.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const FR: WebsiteLocaleStrings = {
  label: 'Français',
  lang: 'fr-FR',
  hreflang: 'fr',
  link: '/fr/',
  ogLocale: 'fr_FR',
  titleTemplate: "Un éditeur Markdown avec aperçu en direct",
  description:
    "Un éditeur Markdown gratuit et open source avec aperçu en direct pour macOS, Windows et Linux. Formules KaTeX, diagrammes Mermaid et tableaux natifs — tout est rendu en direct.",
  homeOgTitle: "VeloxMark — un éditeur Markdown avec aperçu en direct",
  keywords:
    "éditeur markdown, aperçu en direct, open source, WYSIWYG, KaTeX, Mermaid, alternative à Typora, Electron, CodeMirror",
  nav: [
    { text: 'Documentation', link: '/fr/docs/' },
    { text: 'Télécharger', link: '/fr/download' }
  ],
  sidebar: [
    {
      text: 'Prise en main',
      items: [
        { text: 'Introduction', link: '/fr/docs/' },
        { text: 'Installation', link: '/fr/docs/installation' },
        { text: 'Bases', link: '/fr/docs/basics' }
      ]
    },
    {
      text: 'Écriture',
      items: [
        { text: 'Édition en profondeur', link: '/fr/docs/editing' },
        { text: 'Syntaxe Markdown', link: '/fr/docs/markdown-syntax' },
        { text: 'Images', link: '/fr/docs/images' }
      ]
    },
    {
      text: 'Référence',
      items: [
        { text: 'Préférences', link: '/fr/docs/preferences' },
        { text: 'Raccourcis clavier', link: '/fr/docs/key-bindings' },
        { text: 'Langue et localisation', link: '/fr/docs/language' },
        { text: 'Exporter un document', link: '/fr/docs/export' },
        { text: 'Thèmes', link: '/fr/docs/themes' }
      ]
    },
    {
      text: 'Aide',
      items: [
        { text: 'Mise à jour automatique', link: '/fr/docs/updates' },
        { text: 'FAQ', link: '/fr/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Modifier cette page sur GitHub',
  footerMessage: 'Publié sous licence MIT.',
  outlineLabel: 'Sur cette page',
  docPrev: 'Précédent',
  docNext: 'Suivant',
  breadcrumbHome: 'Accueil',
  breadcrumbDocs: 'Documentation',
  trustTicks: [
    'macOS · Windows · Linux',
    "Local d'abord, sans compte",
    'Licence MIT, pour toujours'
  ],
  schemaDescription:
    "Un éditeur Markdown gratuit et open source avec aperçu en direct pour macOS, Windows et Linux. La source Markdown est l'unique source de données — l'enregistrement écrit du .md pur sans perte aller-retour. Formules KaTeX, diagrammes Mermaid, édition native de tableaux, encadrés, notes de bas de page et surlignages, tout est rendu en direct.",
  schemaFeatures: [
    "Édition avec aperçu en direct (style Typora, sur place)",
    'Formules KaTeX et diagrammes Mermaid rendus en direct',
    'Édition native de tableaux avec éditeurs de cellules imbriqués',
    'Mode focus, mode machine à écrire, thèmes clair et sombre',
    'Export PDF et HTML',
    'Fichiers Markdown purs sans perte aller-retour',
    "Neuf langues d'interface"
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    "> VeloxMark est un éditeur Markdown gratuit et open source (MIT) avec aperçu en direct pour macOS, Windows et Linux. La source Markdown est l'unique source de données : l'éditeur rend les titres, les formules, les diagrammes et les tableaux sur place, tandis que le fichier sur disque reste du Markdown pur, avec une sauvegarde sans perte.\n\n" +
    "VeloxMark est construit sur Electron et CodeMirror 6. Son moteur d'aperçu en direct masque les marqueurs de syntaxe lorsque le curseur quitte une ligne (style Typora), et tout bloc rendu — code, formule KaTeX, diagramme Mermaid, tableau, image — peut être cliqué pour éditer sa source Markdown. Il propose l'édition native de tableaux, les modes focus et machine à écrire, les thèmes clair et sombre, l'export PDF/HTML, neuf langues d'interface, et la mise à jour automatique sur Windows (NSIS) et Linux (AppImage).\n\n" +
    "Faits clés : licence MIT · sans compte, sans télémétrie · local d'abord · installations pour macOS (dmg/zip), Windows (installateur NSIS, zip portable), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases avec sommes de contrôle SHA256SUMS.txt.\n\n" +
    '## Documentation\n\n' +
    "- [Introduction](https://veloxmark.knzn.net/fr/docs/) : ce qu'est VeloxMark, comment fonctionne l'aperçu en direct, et la garantie de sauvegarde sans perte\n" +
    "- [Installation](https://veloxmark.knzn.net/fr/docs/installation) : installateurs par plateforme, vérification des sommes de contrôle, compilation depuis les sources, désinstallation\n" +
    "- [Bases](https://veloxmark.knzn.net/fr/docs/basics) : anatomie de la fenêtre, barre latérale (fichiers/sommaire/recherche), onglets, modes de l'éditeur\n" +
    "- [Édition en profondeur](https://veloxmark.knzn.net/fr/docs/editing) : comportement de l'aperçu en direct, composants de bloc, édition de tableaux, aides à la saisie\n" +
    "- [Syntaxe Markdown](https://veloxmark.knzn.net/fr/docs/markdown-syntax) : tout ce qui est rendu spécialement — titres, formules KaTeX, Mermaid, encadrés, notes de bas de page, surlignages, front matter\n" +
    "- [Images](https://veloxmark.knzn.net/fr/docs/images) : résolution des chemins, dimensionnement `=WxH`, attributs `{align=}`/`{flip=}`, pièces jointes\n" +
    "- [Préférences](https://veloxmark.knzn.net/fr/docs/preferences) : tous les réglages avec leurs valeurs par défaut — apparence, éditeur, fichiers, enregistrement automatique, images\n" +
    "- [Raccourcis clavier](https://veloxmark.knzn.net/fr/docs/key-bindings) : tables complètes commandes/raccourcis pour chaque plateforme\n" +
    "- [Langue et localisation](https://veloxmark.knzn.net/fr/docs/language) : neuf langues d'interface et fonctionnement du choix de la langue\n" +
    "- [Exporter un document](https://veloxmark.knzn.net/fr/docs/export) : options d'export PDF et HTML, export de la seule sélection\n" +
    "- [Thèmes](https://veloxmark.knzn.net/fr/docs/themes) : thèmes clair et sombre, changement de thème, application aux composants\n" +
    "- [Mise à jour automatique](https://veloxmark.knzn.net/fr/docs/updates) : comportement de mise à jour par forme d'installation (NSIS/AppImage entièrement automatique ; les autres en notification seule)\n" +
    "- [FAQ](https://veloxmark.knzn.net/fr/docs/faq) : plateformes prises en charge, licence, dépannage, emplacement des données\n\n" +
    '## Téléchargement\n\n' +
    "- [Télécharger](https://veloxmark.knzn.net/fr/download) : tous les installateurs par plateforme avec vérification des sommes de contrôle et comportement de mise à jour\n\n" +
    '## Source\n\n' +
    '- [Dépôt GitHub](https://github.com/biao-biao-ls/veloxmark) : code source, suivi des problèmes, versions (licence MIT)\n\n' +
    '## Optionnel\n\n' +
    "- [Documentation complète en texte brut](https://veloxmark.knzn.net/fr/llms-full.txt) : contenu complet de la documentation concaténé pour une utilisation LLM hors ligne\n"
}
