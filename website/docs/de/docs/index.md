---
title: Einführung
description: Willkommen in der VeloxMark-Dokumentation — ein kostenloser, quelloffener Markdown-Editor mit Live-Vorschau, gebaut auf Electron und CodeMirror 6.
keywords: [VeloxMark Dokumentation, Markdown-Editor Anleitung, Live-Vorschau-Editor, Einführung]
---

# Einführung

Willkommen in der Benutzerdokumentation von VeloxMark — einem kostenlosen, quelloffenen Markdown-Editor mit
Live-Vorschau für macOS, Windows und Linux, inspiriert von Typora und gebaut auf Electron +
CodeMirror 6.

<div class="vm-shot">

![VeloxMark-Oberfläche](/img/hero-light.png)

</div>

## Was VeloxMark auszeichnet

**Die Markdown-Quelle ist die einzige Datenquelle.** Alles Reiche — gerenderte Überschriften, Formeln,
Diagramme, Tabellen — ist eine flüchtige Dekoration über deiner Klartextdatei. Speichern schreibt
sauberes `.md` ohne Roundtrip-Verlust. Es gibt kein proprietäres Dokumentformat und keinen
verborgenen Zustand.

Die Live-Vorschau-Engine baut ihre Dekorationen bei jeder Dokument- und Auswahländerung neu auf:
Syntaxmarker werden mit Replace-Dekorationen ausgeblendet, und Code- / Math- / Mermaid- / Bild-
Blöcke werden durch gerenderte Widgets ersetzt. Wenn der Cursor in einen Bereich gelangt, wird die
Dekoration für diesen Bereich übersprungen und die Quellform kehrt zurück. Die Cursorzeile bleibt
immer in Quellform, damit du immer genau weißt, was du gerade bearbeitest.

## Wie es weitergeht

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">Installation</a></h3>
    <p>Installationspakete für macOS, Windows und Linux, Prüfsummen-Verifikation und Plattform-Hinweise.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">Grundlagen</a></h3>
    <p>Das Fenster, die Seitenleiste, Tabs und die drei Editormodi — alles, was du beim ersten Start siehst.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">Bearbeiten im Detail</a></h3>
    <p>Wie sich die Live-Vorschau beim Tippen verhält: Block-Widgets, Tabellen, Fokusmodi und Tippunterstützungen.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Markdown-Syntax</a></h3>
    <p>Jedes Syntaxkonstrukt, das VeloxMark besonders rendert, mit Quellbeispielen.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">Tastenkürzel</a></h3>
    <p>Die vollständige Befehlsliste mit Tastenkürzeln für jede Plattform.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">FAQ</a></h3>
    <p>Unterstützte Plattformen, Fehlersuche und wie du einen Fehler meldest.</p>
  </div>
</div>

## Lizenz

VeloxMark wird unter der [MIT-Lizenz](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE) veröffentlicht.
Der Quellcode liegt auf [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark).
