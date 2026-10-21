---
title: Sprache & Lokalisierung
description: VeloxMark erscheint in neun Oberflächensprachen inklusive nativer Menüs und Beispieldokumente. So funktioniert die Sprachauswahl und so kannst du Übersetzungen beitragen.
keywords: [VeloxMark Sprachen, Markdown-Editor Lokalisierung, Oberflächensprache, Übersetzung]
---

# Sprache & Lokalisierung

Die Oberfläche von VeloxMark erscheint in neun Sprachen:

| Sprache | Code |
| --- | --- |
| Englisch | `en` |
| Chinesisch | `zh` |
| Japanisch | `ja` |
| Koreanisch | `ko` |
| Spanisch | `es` |
| Portugiesisch | `pt` |
| Französisch | `fr` |
| Deutsch | `de` |
| Russisch | `ru` |

(In der Sprachauswahl der App steht jede Sprache unter ihrem eigenen Namen.)

Die Lokalisierung deckt die gesamte Oberfläche ab: Menüs (nativ unter macOS), Dialoge, die Statusleiste —
und sogar die Willkommens- und Hilfe-Beispieldokumente sowie die Mermaid-Vorlagentexte, die je
Gebietsschema ausgewählt werden.

## Eine Sprache wählen

- **Dem System folgen** ist der Standard — die App wählt die Oberflächensprache anhand deines OS-Gebietsschemas,
  sofern dafür ein Sprachpaket existiert, andernfalls Englisch.
- **Explizit festlegen** über die Einstellungen / das Ansicht-Menü; die Auswahl bleibt über
  Sitzungen hinweg erhalten.

## Übersetzen

Übersetzungen liegen in einer Pack-Datei pro Sprache (Oberflächen-Wörterbuch, native Menütexte,
Willkommens-/Hilfe-Dokumente und Mermaid-Vorlagen). Die Parität der Wörterbuchschlüssel wird vom
Typsystem erzwungen — eine neue Sprache muss alle vier Packs mitbringen, um `npm run typecheck` zu bestehen.
Beiträge willkommen auf [GitHub](https://github.com/biao-biao-ls/veloxmark).
