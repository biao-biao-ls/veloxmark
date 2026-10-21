---
title: Grundlagen
description: Das VeloxMark-Fenster im Überblick — Titelleiste, Seitenleiste (Dateien, Gliederung, Suche), Tabs, Editormodi, Dateien öffnen und speichern.
keywords: [VeloxMark Grundlagen, Markdown-Editor Oberfläche, Gliederungsbereich, Tabs, Fokusmodus, Schreibmaschinenmodus, Quellmodus]
---

# Grundlagen

VeloxMark öffnet ein Willkommensdokument, das zugleich eine Funktionsrundreise ist. Diese Seite führt
durch Fenster, Seitenleiste, Tabs und die Editormodi.

## Das Fenster

<div class="vm-shot">

![VeloxMark-Fenster](/img/hero-light.png)

</div>

- **Titelleiste** — eigene rahmenlose Leiste mit dem App-Menü (Datei / Bearbeiten / Ansicht / Einfügen /
  Hilfe) und den Fenstersteuerelementen. Folgt dem hellen/dunklen Theme.
- **Seitenleiste** — drei Bereiche: **Dateien** (Ordner-Arbeitsbereich), **Gliederung** (Überschriftenbaum des
  aktiven Dokuments) und **Suche** (Suche im Ordner).
- **Tableiste** — ein Tab pro geöffnetem Dokument, mit Markierung ungespeicherter Änderungen.
- **Editor** — die Schreibfläche mit Live-Vorschau.
- **Statusleiste** — Cursorposition, Wort- / Zeichen- / Zeilenzähler und Indikatoren für die
  Fokusmodi, wenn aktiv.

## Seitenleiste

- **Dateien** — öffne einen Ordner und durchsuche seine Markdown-Dateien; Klick öffnet einen Tab.
- **Gliederung** — Überschriftenbaum des aktiven Dokuments mit Klick-zum-Springen und
  Hervorhebung der aktuellen Position.
- **Suche** — Volltextsuche im geöffneten Ordner, mit Ersetzen.

## Tabs

- Öffne mehrere Dateien gleichzeitig; jede erhält einen Tab.
- Ungespeicherte Änderungen werden am Tab markiert.
- Tabs schließen und wieder öffnen; ein geschlossener Tab lässt sich wiederherstellen.
- Tabs zum Umsortieren ziehen.

## Editormodi

| Modus | Was er tut |
| --- | --- |
| **Live-Vorschau** (Standard) | Markdown wird direkt gerendert; die Cursorzeile bleibt in Quellform |
| **Quellmodus** | Die ganze Zeit rohes Markdown, für volle Kontrolle |
| **Fokusmodus** | Alles außer der aktuellen Zeile tritt zurück |
| **Schreibmaschinenmodus** | Die aktuelle Zeile bleibt auf der vertikalen Mitte fixiert |

Das Theme schaltest du im Ansicht-Menü um. Vollständige Befehlsliste: [Tastenkürzel](./key-bindings).

## Öffnen & Speichern

- **Öffnen** einer `.md`-Datei (`Ctrl+O` / `Cmd+O`) oder einen Ordner über das Datei-Menü öffnen.
- **Speichern** (`Ctrl+S` / `Cmd+S`) schreibt die reine Quelle zurück — ohne Roundtrip-Verlust.
- **Speichern unter** schreibt eine Kopie unter neuem Namen.
- Ungespeicherte Arbeit wird als Entwurf aufbewahrt und kann wiederhergestellt werden.

## Nächste Schritte

- [Bearbeiten im Detail](./editing) — wie sich die Live-Vorschau beim Tippen verhält.
- [Markdown-Syntax](./markdown-syntax) — alles, was besonders gerendert wird.
- [Einstellungen](./preferences) — stelle den Editor nach deinem Geschmack ein.
