---
title: Themes
description: Die hellen und dunklen Themes von VeloxMark — mit einem Klick umschalten, persistent über Sitzungen hinweg, und wie Themes auf Code-, Formel- und Diagramm-Widgets wirken.
keywords: [Markdown-Editor Dunkelmodus, helles Theme, dunkles Theme, Editor-Themes, Theme umschalten]
---

# Themes

VeloxMark bringt zwei erstklassige Themes mit — hell und dunkel — abgestimmt auf lange Schreib-
sitzungen. Beide decken die Editor-Umgebung, die Syntaxfarben und die Widgets der gerenderten Blöcke
ab (Formeln, Diagramme, Code, Tabellen).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark helles Theme" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark dunkles Theme" />
    </div>
  </div>
</div>

## Themes umschalten

- Menü: **Ansicht → Theme umschalten** (auch als Befehl „Theme umschalten“ verfügbar).
- Oder wähle `light` / `dark` / `system` explizit in den Einstellungen (Theme-Modus).
- Die Auswahl bleibt über Sitzungen hinweg erhalten.

Die eigene rahmenlose Titelleiste und die App-Menüs (Datei / Bearbeiten / Ansicht / Einfügen / Hilfe)
folgen dem aktiven Theme.

## Codebeispiel im dunklen Theme

<div class="vm-shot">

![Codeblock im dunklen Theme](/img/code-dark.png)

</div>

## Wie Themes angewendet werden

Der Editor ist [CodeMirror 6](https://codemirror.net); jedes Theme ist ein CM6-Theme plus CSS-
Variablen für die App-Umgebung. Gerenderte Widgets (KaTeX, Mermaid, highlight.js) übernehmen
dieselbe Palette, sodass ein Codeblock oder Diagramm nie deplatziert wirkt.
