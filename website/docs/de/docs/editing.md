---
title: Bearbeiten im Detail
description: Wie sich die VeloxMark Live-Vorschau beim Tippen verhält — Syntaxmarker, Block-Widgets, natives Tabellenbearbeiten, Tippunterstützungen und Multi-Tab-Arbeitsweisen.
keywords: [Live-Vorschau-Bearbeitung, Markdown Tabellenbearbeitung, Block-Widgets, Tippunterstützungen, HTML als Markdown einfügen]
---

# Bearbeiten im Detail

Der Editor von VeloxMark ist CodeMirror 6 mit einer Dekorations-Engine, die die gerenderte
Ansicht bei jeder Dokument- und Auswahländerung neu aufbaut. Diese Seite erklärt, wie sich das
beim Schreiben verhält.

## Live-Vorschau

- Wenn der Cursor eine Zeile verlässt, werden ihre Syntaxmarker (`#`, `**`, `` ` ``, `*`, `~~`, `==`)
  mit Replace-Dekorationen ausgeblendet und die Zeile zeigt ihre endgültige Formatierung.
- Die **Cursorzeile bleibt immer in Quellform** — du siehst immer genau, was du
  tippst.
- Ein Klick in einen ausgeblendeten Marker holt die Quellform für diesen Bereich zurück.

<div class="vm-shot">

![Cursorzeile in Quellform](/img/caret-source-line.png)

</div>

## Block-Widgets

Codeblöcke, `$$`-Formeln, Mermaid-Diagramme und Bilder werden als Widgets an Stelle ihrer
Quelle gerendert. **Klicke einen beliebigen gerenderten Block an, um seine Quelle zu bearbeiten**;
verlässt du den Block, wird er wieder gerendert.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="KaTeX-Blockformel" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="Mermaid-Diagramm direkt gerendert" style="display:block;width:100%" />
  </div>
</div>

## Tabellen

Tabellen sind erstklassig: Jede Zelle ist ein verschachtelter CodeMirror-Editor.

- **Einfügen / Konvertieren** — über den Tabellen-Einfügen-Dialog eine Tabelle mit gewählter Zeilen-
  und Spaltenzahl erstellen oder den aktuellen Absatz in eine Tabelle umwandeln.
- **Spaltenbreite** — den Spaltenrand ziehen.
- **Ausrichtung** — Ausrichtung je Spalte setzen (links / zentriert / rechts); die Quell-Trennzeile
  (`:---`, `:--:`, `---:`) bleibt synchron.
- Alle Änderungen laufen über Transaktionen zurück in den Markdown-Quellbereich, den das Widget besitzt —
  das Dokument wird nie hinter deinem Rücken verändert.

<div class="vm-shot">

![Tabellenbearbeitung](/img/table-widget-light.png)

</div>

## Fokus- & Schreibmaschinenmodus

- Der **Fokusmodus** dimmt alles außer dem Absatz herunter, den du schreibst.
- Der **Schreibmaschinenmodus** hält die Cursorzeile auf der vertikalen Mitte.
- Beide lassen sich kombinieren; die Statusleiste zeigt `FOCUS` / `TYPEWRITER`-Chips, solange sie aktiv sind.

<div class="vm-shot">

![Fokusmodus](/img/focus-mode.png)

</div>

## Tippunterstützungen

- **HTML als Markdown einfügen** — aus der Zwischenablage eingefügter Rich Text wird in sauberes
  Markdown umgewandelt.
- **Nackte URLs** — eine eingefügte nackte URL wird automatisch zu einem Link.
- **Aufgabenlisten** — `- [ ]` wird als anklickbares Kontrollkästchen gerendert; Klick zum Umschalten.
- **Rückgängig/Wiederholen** — vollständiger Transaktionsverlauf (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Bearbeiten mit mehreren Tabs

Öffne mehrere Dateien gleichzeitig. Tabs lassen sich schließen und wieder öffnen, ungespeicherte
Änderungen werden markiert, und die Tableiste lässt sich per Ziehen umsortieren.

## Codeblöcke

- Syntaxhervorhebung über highlight.js für hunderte Sprachen.
- Optionale Zeilennummern, weiche Umbrüche und Einklappen langer Blöcke — siehe
  [Einstellungen](./preferences).

## Exportieren

Exportiere als PDF oder HTML über das Datei-Menü, inklusive HTML-Export nur der Auswahl. Siehe
[Dokument exportieren](./export).
