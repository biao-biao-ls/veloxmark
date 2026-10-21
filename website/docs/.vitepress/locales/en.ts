/**
 * Website UI strings — English (root locale).
 * One pack per language; Chinese (and other translations) live only in these
 * packs and in website/docs/<lang>/ (see CLAUDE.md language policy).
 */

export const EN = {
  label: 'English',
  lang: 'en-US',
  hreflang: 'en',
  link: undefined as string | undefined, // root locale lives at /
  ogLocale: 'en_US',
  titleTemplate: 'A Markdown editor with live preview',
  description:
    'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. KaTeX math, Mermaid diagrams and native tables — all rendered live.',
  homeOgTitle: 'VeloxMark — a Markdown editor with live preview',
  keywords:
    'markdown editor, live preview, open source, WYSIWYG, KaTeX, Mermaid, Typora alternative, Electron, CodeMirror',
  nav: [
    { text: 'Docs', link: '/docs/' },
    { text: 'Download', link: '/download' }
  ],
  sidebar: [
    {
      text: 'Getting started',
      items: [
        { text: 'Introduction', link: '/docs/' },
        { text: 'Installation', link: '/docs/installation' },
        { text: 'Basics', link: '/docs/basics' }
      ]
    },
    {
      text: 'Writing',
      items: [
        { text: 'Editing in depth', link: '/docs/editing' },
        { text: 'Markdown syntax', link: '/docs/markdown-syntax' },
        { text: 'Images', link: '/docs/images' }
      ]
    },
    {
      text: 'Reference',
      items: [
        { text: 'Preferences', link: '/docs/preferences' },
        { text: 'Key bindings', link: '/docs/key-bindings' },
        { text: 'Language & localization', link: '/docs/language' },
        { text: 'Export a document', link: '/docs/export' },
        { text: 'Themes', link: '/docs/themes' }
      ]
    },
    {
      text: 'Help',
      items: [
        { text: 'Auto-update', link: '/docs/updates' },
        { text: 'FAQ', link: '/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Edit this page on GitHub',
  footerMessage: 'Released under the MIT License.',
  outlineLabel: 'On this page',
  docPrev: 'Previous',
  docNext: 'Next',
  breadcrumbHome: 'Home',
  breadcrumbDocs: 'Docs',
  trustTicks: ['macOS · Windows · Linux', 'Local-first, no account', 'MIT licensed, forever'],
  /** Localized strings for the SoftwareApplication JSON-LD. */
  schemaDescription:
    'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. Markdown source is the only data source — saving writes plain .md with zero round-trip loss. KaTeX math, Mermaid diagrams, native table editing, callouts, footnotes and highlights, all rendered live.',
  schemaFeatures: [
    'Live preview editing (Typora-style, in place)',
    'KaTeX math and Mermaid diagrams rendered live',
    'Native table editing with nested cell editors',
    'Focus mode, typewriter mode, light and dark themes',
    'PDF and HTML export',
    'Plain Markdown files with zero round-trip loss',
    'Nine UI languages'
  ],
  /** Raw llms.txt body served at /llms.txt (English, root). */
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark is a free, open-source (MIT) Markdown editor with live preview for macOS, Windows and Linux. Markdown source is the only data source: the editor renders headings, math, diagrams and tables in place while the file on disk stays plain Markdown with zero round-trip loss.\n\n' +
    'VeloxMark is built on Electron and CodeMirror 6. Its live-preview engine hides syntax markers when the cursor leaves a line (Typora-style), and any rendered block — code, KaTeX math, Mermaid diagram, table, image — can be clicked to edit its raw Markdown source. It ships native table editing, focus and typewriter modes, light/dark themes, PDF/HTML export, nine UI languages, and auto-update on Windows (NSIS) and Linux (AppImage).\n\n' +
    'Key facts: MIT licensed · no account, no telemetry · local-first · installs for macOS (dmg/zip), Windows (NSIS installer, portable zip), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases with SHA256SUMS.txt checksums.\n\n' +
    '## Documentation\n\n' +
    '- [Introduction](https://veloxmark.knzn.net/docs/): What VeloxMark is, how live preview works, and the zero round-trip-loss guarantee\n' +
    '- [Installation](https://veloxmark.knzn.net/docs/installation): Per-platform installers, checksum verification, build from source, uninstall\n' +
    '- [Basics](https://veloxmark.knzn.net/docs/basics): Window anatomy, sidebar (files/outline/search), tabs, editor modes\n' +
    '- [Editing in depth](https://veloxmark.knzn.net/docs/editing): Live preview behavior, block widgets, table editing, typing assists\n' +
    '- [Markdown syntax](https://veloxmark.knzn.net/docs/markdown-syntax): Everything rendered specially — headings, KaTeX math, Mermaid, callouts, footnotes, highlights, front matter\n' +
    '- [Images](https://veloxmark.knzn.net/docs/images): Path resolution, `=WxH` sizing, `{align=}`/`{flip=}` attributes, attachments\n' +
    '- [Preferences](https://veloxmark.knzn.net/docs/preferences): All settings with defaults — appearance, editor, files, autosave, images\n' +
    '- [Key bindings](https://veloxmark.knzn.net/docs/key-bindings): Full command/shortcut tables for every platform\n' +
    '- [Language & localization](https://veloxmark.knzn.net/docs/language): Nine UI languages and how language selection works\n' +
    '- [Export a document](https://veloxmark.knzn.net/docs/export): PDF and HTML export options, selection-only export\n' +
    '- [Themes](https://veloxmark.knzn.net/docs/themes): Light and dark themes, switching, how themes apply to widgets\n' +
    '- [Auto-update](https://veloxmark.knzn.net/docs/updates): Update behavior per install form (NSIS/AppImage full auto; others notify-only)\n' +
    '- [FAQ](https://veloxmark.knzn.net/docs/faq): Supported platforms, licensing, troubleshooting, where data is stored\n\n' +
    '## Download\n\n' +
    '- [Download](https://veloxmark.knzn.net/download): All installers by platform with checksum verification and update behavior\n\n' +
    '## Source\n\n' +
    '- [GitHub repository](https://github.com/biao-biao-ls/veloxmark): Source code, issue tracker, releases (MIT license)\n\n' +
    '## Translations\n\n' +
    '- [简体中文](https://veloxmark.knzn.net/zh/llms.txt): Simplified Chinese\n\n' +
    '## Optional\n\n' +
    '- [Full documentation as plain text](https://veloxmark.knzn.net/llms-full.txt): Complete docs content concatenated for offline LLM use\n'
}

export type WebsiteLocaleStrings = typeof EN
