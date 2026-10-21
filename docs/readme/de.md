# VeloxMark

Schreib in Markdown — alles andere ist Dekoration.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · [한국어](ko.md) · [Español](es.md) · [Português](pt.md) · [Français](fr.md) · **Deutsch** · [Русский](ru.md)

VeloxMark ist ein kostenloser, quelloffener Markdown-Desktop-Reader und -Editor mit Live-Vorschau. Er strebt das reibungslose Schreibgefühl an, das [Typora](https://typora.io) bekannt gemacht hat, und hält dabei `.md`-Reintextdateien vollständig portabel — gebaut mit Electron und CodeMirror 6, für macOS, Windows und Linux.

![VeloxMark helles Theme](../../website/docs/public/img/hero-light.png)

- Website und Dokumentation: https://veloxmark.knzn.net
- Downloads: https://github.com/biao-biao-ls/veloxmark/releases

## Funktionen

- **Live-Vorschau (Typora-Stil)**: Der Markdown-Quelltext ist die einzige Datenquelle. Verlässt der Cursor eine Zeile, verschwinden Syntaxmarker wie `#`, `**` und `` ` `` und die Zeile wird in ihrem endgültigen Stil dargestellt; die Cursorzeile bleibt in Quellform
- **Blockdarstellung**: Codeblöcke (Syntaxhervorhebung), `$$`-Mathematik (KaTeX) und ```` ```mermaid ````-Diagramme — ein Klick auf einen Block bearbeitet seinen Quelltext
- **Tabellen**: natives Tabelleneditieren mit verschachtelten Zelleditoren, Dialoge zum Einfügen/Umwandeln in Tabellen, Spaltenbreiten und Ausrichtung
- **Gliederungsnavigation**: Überschriftenbaum in der Seitenleiste mit Klick-Sprung und Hervorhebung der aktuellen Position
- **Mehrere Tabs**: mehrere Dateien gleichzeitig öffnen, Tabs schließen/wiederherstellen; ungespeicherte Änderungen sind mit `•` markiert
- **Fokusmodi**: Fokusmodus, Schreibmaschinenmodus und Quellmodus
- **Helles/dunkles Theme**: Umschalten über **Ansicht → Thema wechseln**, über Sitzungen hinweg gespeichert; die rahmenlose Titelleiste und die Menüs der App (Datei/Bearbeiten/Ansicht/Hilfe) folgen dem Theme
- **Dateioperationen**: Öffnen / Speichern / Speichern unter; eigene Fenstersteuerung (Minimieren/Maximieren/Schließen)
- **Export**: PDF und HTML, inklusive HTML-Export nur der Auswahl
- **Tippunterstützung**: eingefügte URLs werden zu Links, eingefügtes HTML wird zu Markdown
- **Aufgabenlisten**: `- [ ]` wird als anklickbare Checkbox dargestellt
- **Bilder**: absolute Pfade, relative Pfade (relativ zur aktuellen `.md`-Datei) und entfernte Bilder
- **Auto-Update**: Installer prüfen GitHub Releases und aktualisieren direkt (Windows NSIS und Linux AppImage)
- **Lokalisierung**: Oberfläche auf Deutsch, English, 简体中文, 日本語, 한국어, Español, Português, Français und Русский (inklusive nativer Menüs und Beispieldokumente)

## Installation

Lade den Build für deine Plattform von der [Release-Seite](https://github.com/biao-biao-ls/veloxmark/releases/latest) herunter:

- **Windows** — NSIS-Installer (mit Auto-Update) oder portables Zip
- **macOS** — dmg und zip (unsignierte Builds). Beim ersten Start Rechtsklick → **Öffnen**, oder die Quarantäne entfernen: `xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage (mit Auto-Update), deb, rpm, tar.gz oder snap

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsmodus (Hot Reload)
npm run build    # nach out/ bauen
npm run typecheck
```

> Falls der Download der Electron-Binärdateien in eingeschränkten Netzwerken scheitert:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Technik-Stack

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — Editor-Kern; Live-Vorschau über StateField-Dekorationen
- [KaTeX](https://katex.org) — Mathematik
- [mermaid](https://mermaid.js.org) — Diagramme
- [highlight.js](https://highlightjs.org) — Code-Hervorhebung

## Architektur

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

Kernprinzip: Der Markdown-Text ist immer die einzige Datenquelle (Speichern schreibt reines `.md`, null Verlust im Hin- und Zurückweg). Die Dekorations-Engine baut die Decorations bei jeder Dokument-/Selektionsänderung neu auf: Syntaxmarker werden mit Replace-Dekorationen versteckt, Code-/Mathematik-/Diagrammblöcke durch Widgets ersetzt. Betritt der Cursor einen Bereich, werden die Dekorationen dieses Bereichs übersprungen und die Quellform kehrt zurück.

## Dokumentation

Die vollständige Benutzerdokumentation liegt auf der [Website](https://veloxmark.knzn.net/de/docs/). Das Release-Handbuch (Prozess, Artefakte, Signierungsstatus, Fehlersuche) steht in [CLAUDE.md](../../CLAUDE.md) unter „Release process".

## Mitwirken

- **Commit-Nachrichten und Code-Kommentare müssen auf Englisch verfasst werden.**
- **Übersetzungen gehören ausschließlich in die Lokalisierungspakete** — ein Paket (Datei oder Verzeichnis) pro Sprache:
  - `src/renderer/src/i18n/<lang>.ts` — UI-Wörterbuch und Sprachselbstbezeichnungen
  - `electron/shared/menuStrings/<lang>.ts` — Texte der nativen Menüs
  - `src/renderer/src/content/<lang>.ts` — Willkommens-/Hilfedokumente
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — Mermaid-Vorlagentexte
  - `docs/readme/<lang>.md` — Übersetzungen dieses README
  - `website/docs/<lang>/` und `website/docs/.vitepress/locales/<lang>.ts` — Website-Seiten und Website-UI-Texte

  Alles Übrige im Repository bleibt ausschließlich Englisch.

## Lizenz

[MIT](../../LICENSE)
