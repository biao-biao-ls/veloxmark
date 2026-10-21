/**
 * Website UI strings — German.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const DE: WebsiteLocaleStrings = {
  label: 'Deutsch',
  lang: 'de-DE',
  hreflang: 'de',
  link: '/de/',
  ogLocale: 'de_DE',
  titleTemplate: 'Ein Markdown-Editor mit Live-Vorschau',
  description:
    'Ein kostenloser, quelloffener Markdown-Editor mit Live-Vorschau für macOS, Windows und Linux. KaTeX-Formeln, Mermaid-Diagramme und native Tabellen — alles live gerendert.',
  homeOgTitle: 'VeloxMark — ein Markdown-Editor mit Live-Vorschau',
  keywords:
    'Markdown-Editor, Live-Vorschau, Open Source, WYSIWYG, KaTeX, Mermaid, Typora-Alternative, Electron, CodeMirror',
  nav: [
    { text: 'Dokumentation', link: '/de/docs/' },
    { text: 'Download', link: '/de/download' }
  ],
  sidebar: [
    {
      text: 'Erste Schritte',
      items: [
        { text: 'Einführung', link: '/de/docs/' },
        { text: 'Installation', link: '/de/docs/installation' },
        { text: 'Grundlagen', link: '/de/docs/basics' }
      ]
    },
    {
      text: 'Schreiben',
      items: [
        { text: 'Bearbeiten im Detail', link: '/de/docs/editing' },
        { text: 'Markdown-Syntax', link: '/de/docs/markdown-syntax' },
        { text: 'Bilder', link: '/de/docs/images' }
      ]
    },
    {
      text: 'Referenz',
      items: [
        { text: 'Einstellungen', link: '/de/docs/preferences' },
        { text: 'Tastenkürzel', link: '/de/docs/key-bindings' },
        { text: 'Sprache & Lokalisierung', link: '/de/docs/language' },
        { text: 'Dokument exportieren', link: '/de/docs/export' },
        { text: 'Themes', link: '/de/docs/themes' }
      ]
    },
    {
      text: 'Hilfe',
      items: [
        { text: 'Auto-Update', link: '/de/docs/updates' },
        { text: 'FAQ', link: '/de/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Diese Seite auf GitHub bearbeiten',
  footerMessage: 'Veröffentlicht unter der MIT-Lizenz.',
  outlineLabel: 'Auf dieser Seite',
  docPrev: 'Vorherige',
  docNext: 'Nächste',
  breadcrumbHome: 'Startseite',
  breadcrumbDocs: 'Dokumentation',
  trustTicks: ['macOS · Windows · Linux', 'Lokal zuerst, kein Konto', 'MIT-lizenziert, für immer'],
  /** Localized strings for the SoftwareApplication JSON-LD. */
  schemaDescription:
    'Ein kostenloser, quelloffener Markdown-Editor mit Live-Vorschau für macOS, Windows und Linux. Die Markdown-Quelle ist die einzige Datenquelle — Speichern schreibt reines .md ohne Roundtrip-Verlust. KaTeX-Formeln, Mermaid-Diagramme, natives Tabellenbearbeiten, Callouts, Fußnoten und Hervorhebungen, alles live gerendert.',
  schemaFeatures: [
    'Live-Vorschau-Bearbeitung (Typora-Stil, direkt an Ort und Stelle)',
    'KaTeX-Formeln und Mermaid-Diagramme live gerendert',
    'Natives Tabellenbearbeiten mit verschachtelten Zelleneditoren',
    'Fokusmodus, Schreibmaschinenmodus, helle und dunkle Themes',
    'PDF- und HTML-Export',
    'Reine Markdown-Dateien ohne Roundtrip-Verlust',
    'Neun Oberflächensprachen'
  ],
  /** Raw llms.txt body served at /de/llms.txt (German). */
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark ist ein kostenloser, quelloffener (MIT) Markdown-Editor mit Live-Vorschau für macOS, Windows und Linux. Die Markdown-Quelle ist die einzige Datenquelle: Der Editor rendert Überschriften, Formeln, Diagramme und Tabellen direkt an Ort und Stelle, während die Datei auf der Platte reines Markdown bleibt — Speichern erfolgt verlustfrei.\n\n' +
    'VeloxMark basiert auf Electron und CodeMirror 6. Die Live-Vorschau-Engine blendet Syntaxmarker aus, sobald der Cursor eine Zeile verlässt (Typora-Stil), und jeder gerenderte Block — Code, KaTeX-Formel, Mermaid-Diagramm, Tabelle, Bild — lässt sich anklicken, um seine Markdown-Quelle zu bearbeiten. Zum Lieferumfang gehören natives Tabellenbearbeiten, Fokus- und Schreibmaschinenmodus, helle und dunkle Themes, PDF-/HTML-Export, neun Oberflächensprachen sowie Auto-Update unter Windows (NSIS) und Linux (AppImage).\n\n' +
    'Wesentliche Fakten: MIT-lizenziert · kein Konto, keine Telemetrie · lokal zuerst · Installationen für macOS (dmg/zip), Windows (NSIS-Installer, portables zip), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases mit SHA256SUMS.txt-Prüfsummen.\n\n' +
    '## Dokumentation\n\n' +
    '- [Einführung](https://veloxmark.knzn.net/de/docs/): Was VeloxMark ist, wie die Live-Vorschau funktioniert und die Garantie verlustfreien Speicherns\n' +
    '- [Installation](https://veloxmark.knzn.net/de/docs/installation): Installationspakete je Plattform, Prüfsummen-Verifikation, Build aus dem Quellcode, Deinstallation\n' +
    '- [Grundlagen](https://veloxmark.knzn.net/de/docs/basics): Fensteraufbau, Seitenleiste (Dateien/Gliederung/Suche), Tabs, Editormodi\n' +
    '- [Bearbeiten im Detail](https://veloxmark.knzn.net/de/docs/editing): Verhalten der Live-Vorschau, Block-Widgets, Tabellenbearbeitung, Tippunterstützungen\n' +
    '- [Markdown-Syntax](https://veloxmark.knzn.net/de/docs/markdown-syntax): Alles Besonders Gerenderte — Überschriften, KaTeX-Formeln, Mermaid, Callouts, Fußnoten, Hervorhebungen, Front Matter\n' +
    '- [Bilder](https://veloxmark.knzn.net/de/docs/images): Pfadauflösung, Größenangabe `=WxH`, Attribute `{align=}`/`{flip=}`, Anhänge\n' +
    '- [Einstellungen](https://veloxmark.knzn.net/de/docs/preferences): Alle Einstellungen mit Standardwerten — Erscheinungsbild, Editor, Dateien, Autospeichern, Bilder\n' +
    '- [Tastenkürzel](https://veloxmark.knzn.net/de/docs/key-bindings): Vollständige Befehls-/Tastenkürzel-Tabellen für jede Plattform\n' +
    '- [Sprache & Lokalisierung](https://veloxmark.knzn.net/de/docs/language): Neun Oberflächensprachen und wie die Sprachauswahl funktioniert\n' +
    '- [Dokument exportieren](https://veloxmark.knzn.net/de/docs/export): PDF- und HTML-Exportoptionen, Export nur der Auswahl\n' +
    '- [Themes](https://veloxmark.knzn.net/de/docs/themes): Helle und dunkle Themes, Umschalten, wie Themes auf Widgets wirken\n' +
    '- [Auto-Update](https://veloxmark.knzn.net/de/docs/updates): Update-Verhalten je Installationsform (NSIS/AppImage vollautomatisch; übrige nur mit Hinweis)\n' +
    '- [FAQ](https://veloxmark.knzn.net/de/docs/faq): Unterstützte Plattformen, Lizenz, Fehlersuche, wo Daten gespeichert werden\n\n' +
    '## Download\n\n' +
    '- [Download](https://veloxmark.knzn.net/de/download): Alle Installationspakete je Plattform mit Prüfsummen-Verifikation und Update-Verhalten\n\n' +
    '## Quellcode\n\n' +
    '- [GitHub-Repository](https://github.com/biao-biao-ls/veloxmark): Quellcode, Issue-Tracker, Releases (MIT-Lizenz)\n\n' +
    '## Optional\n\n' +
    '- [Vollständige Dokumentation als Klartext](https://veloxmark.knzn.net/de/llms-full.txt): Sämtliche Dokumentationsinhalte zusammengefügt für die Offline-Nutzung mit LLMs\n'
}
