---
title: Dokument exportieren
description: VeloxMark-Dokumente als PDF oder HTML exportieren — Seiteneinstellungen, Themes, Bild-Einbettung, KaTeX-Schriften, HTML-Export nur der Auswahl und Kopieren als Rich Text.
keywords: [Markdown als PDF exportieren, Markdown als HTML, PDF-Exportoptionen, Auswahl exportieren, Rich Text kopieren]
---

# Dokument exportieren

VeloxMark exportiert aus der **Markdown-Quelle** — nicht aus dem Editor-DOM — sodass die Ausgabe
deinem Dokument exakt entspricht. Verfügbar über das Datei-Menü: **Exportieren → PDF…** oder
**Exportieren → HTML…**. Beide öffnen denselben Export-Dialog.

## Optionen

| Gruppe | Einstellung | Werte |
| --- | --- | --- |
| Seite (PDF) | Papierformat | A4, Letter |
| Seite (PDF) | Ränder | Normal, Schmal |
| Seite (PDF) | Kopf- und Fußzeile | An / aus — die Kopfzeile zeigt den Dokumenttitel / Dateinamen, die Fußzeile zeigt `Seite / Gesamt` |
| Stil | Theme | Dem aktuellen Theme folgen oder Hell erzwingen |
| Bilder | Als Base64 einbetten / relative Pfade behalten | PDF bettet immer ein |
| Mathematik | KaTeX-Schriften | Einbetten (offline-fähig) oder CDN-Fallback (kleinere Datei) |

## Was gerendert wird

Die vollständige Pipeline reproduziert alles, was die Live-Vorschau zeigt:

- Überschriften, Listen, Aufgabenlisten (als angehakte Kontrollkästchen), Tabellen mit Ausrichtung
- Code mit highlight.js-Syntaxfarben
- **KaTeX-Formeln** als echter gesetzter Formelsatz
- **Mermaid-Diagramme** als Inline-SVG
- Callouts, Fußnoten (nummeriert mit Rückverweisen), `==Hervorhebungen==`, hochgestellt,
  tiefgestellt, Abkürzungen und Definitionslisten
- Bilder mit Größen- / Ausrichtungs- / Spiegelungsattributen, relativ zum Dokument aufgelöst und
  dort eingebettet, wo die Option es vorsieht
- Front-Matter-`title` wird zur Dokument-H1

Die PDF-Erzeugung rendert das HTML in einem verborgenen sandboxed Fenster, wartet auf Schriften und Bilder
und druckt dann mit Hintergründen als PDF.

## Export nur der Auswahl

**Bearbeiten → Auswahl als HTML exportieren…** exportiert nur den ausgewählten Bereich als eigenständige HTML-
Datei (ohne Auswahl wird das ganze Dokument verwendet). Derselbe Auswahl-oder-Dokument-Geltungsbereich
gilt für **Als Rich Text kopieren** und **Als HTML kopieren**.

## Roundtrip-Garantie

Export verändert deine Datei nie. Die `.md` auf der Platte bleibt die einzige Quelle der Wahrheit;
das exportierte PDF/HTML ist nur eine Darstellung davon.
