---
title: FAQ
description: VeloxMark FAQ — unterstützte Plattformen, Lizenz, wie die Live-Vorschau funktioniert, Datei-Roundtrips, Datenablage, macOS Gatekeeper und Update-Verhalten.
keywords: [VeloxMark FAQ, Markdown-Editor FAQ, Live-Vorschau Fragen, VeloxMark Fehlersuche]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Welche Plattformen werden unterstützt?","acceptedAnswer":{"@type":"Answer","text":"macOS (Apple Silicon und Intel), Windows 10/11 (x64 und ARM64) und Linux (x64 und arm64 — AppImage, deb, rpm, tar.gz; snap nur x64)."}},{"@type":"Question","name":"Ist VeloxMark kostenlos?","acceptedAnswer":{"@type":"Answer","text":"Ja. VeloxMark ist unter der MIT-Lizenz quelloffen. Kein Konto, kein Abonnement, keine Telemetrie."}},{"@type":"Question","name":"Was ist Live-Vorschau und wie unterscheidet sie sich von einer geteilten Ansicht?","acceptedAnswer":{"@type":"Answer","text":"Es gibt keinen Vorschaubereich. Der Editor rendert Markdown direkt an Ort und Stelle: Verlässt der Cursor eine Zeile, verschwinden die Syntaxmarker und die Zeile zeigt ihre endgültige Form. Die Cursorzeile bleibt immer in Quellform, und ein Klick auf einen beliebigen gerenderten Block holt dessen rohes Markdown zum Bearbeiten zurück. Die Markdown-Quelle ist die einzige Datenquelle — Speichern schreibt reines .md ohne Roundtrip-Verlust."}},{"@type":"Question","name":"Verändert VeloxMark meine Markdown-Dateien beim Speichern?","acceptedAnswer":{"@type":"Answer","text":"Nein. Speichern schreibt den Quelltext unverändert zurück. Alles Rendern ist Dekoration."}},{"@type":"Question","name":"Welche Markdown-Syntax wird unterstützt?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM (Tabellen, Aufgabenlisten, Durchgestrichen), dazu KaTeX-Formeln, Mermaid-Diagramme, Callouts, Fußnoten und hervorgehobener Text."}},{"@type":"Question","name":"Kann ich VeloxMark zur Notizverwaltung verwenden?","acceptedAnswer":{"@type":"Answer","text":"VeloxMark ist ein fokussierter Markdown-Leser/-Editor — öffne Ordner und Dateien, nutze Gliederung und Suche, aber es gibt keine Wissensmanagement-Schicht. Deine Dateien bleiben reines .md auf der Platte, sodass jedes andere Tool sie übernehmen kann."}},{"@type":"Question","name":"Wie melde ich einen Fehler?","acceptedAnswer":{"@type":"Answer","text":"Erstelle ein Issue auf GitHub mit der App-Version (Hilfe-Menü), deinem Betriebssystem, Schritten zur Reproduktion und dem problematischen Markdown."}},{"@type":"Question","name":"Wo werden meine Entwürfe und Einstellungen gespeichert?","acceptedAnswer":{"@type":"Answer","text":"Einstellungen, Entwürfe und Sitzungszustand liegen im standardmäßigen Anwendungsdaten-Verzeichnis des Benutzers (Electron userData): Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. Dokumente selbst werden nie verschoben oder kopiert."}},{"@type":"Question","name":"Warum sagt macOS, die App stamme von einem unbekannten Entwickler?","acceptedAnswer":{"@type":"Answer","text":"Release-Builds sind derzeit nicht signiert. Führe xattr -d com.apple.quarantine /Applications/VeloxMark.app einmal nach der Installation aus."}},{"@type":"Question","name":"Die App aktualisiert sich auf meiner Plattform nicht automatisch — ist das normal?","acceptedAnswer":{"@type":"Answer","text":"Ja. Vollautomatische Updates sind für Windows-NSIS-Installationen und Linux-AppImage aktiviert; andere Installationsformen zeigen nur Hinweise, und macOS weicht derzeit darauf aus, die Releases-Seite zu öffnen, weil die Builds nicht signiert sind."}}]}'
---

# Häufige Fragen (FAQ)

### Welche Plattformen werden unterstützt?

macOS (Apple Silicon und Intel), Windows 10/11 (x64 und ARM64) und Linux (x64 und arm64 —
AppImage, deb, rpm, tar.gz; snap nur x64). Siehe [Installation](./installation).

### Ist VeloxMark kostenlos?

Ja. VeloxMark ist unter der
[MIT-Lizenz](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE) quelloffen.
Kein Konto, kein Abonnement, keine Telemetrie.

### Was ist „Live-Vorschau“ und wie unterscheidet sie sich von einer geteilten Ansicht?

Es gibt keinen Vorschaubereich. Der Editor rendert dein Markdown **direkt an Ort und Stelle**: wenn der Cursor
eine Zeile verlässt, verschwinden Syntaxmarker wie `#`, `**` und `` ` `` und die Zeile zeigt ihre endgültige
Form. Die Cursorzeile bleibt immer in Quellform, und ein Klick auf einen beliebigen gerenderten Block (Code,
Formel, Diagramm, Tabelle, Bild) holt dessen rohes Markdown zum Bearbeiten zurück. Die Markdown-Quelle ist
die einzige Datenquelle — Speichern schreibt reines `.md` ohne Roundtrip-Verlust.

### Verändert VeloxMark meine Markdown-Dateien beim Speichern?

Nein. Speichern schreibt den Quelltext unverändert zurück. Alles Rendern ist Dekoration.

### Welche Markdown-Syntax wird unterstützt?

CommonMark + GFM (Tabellen, Aufgabenlisten, Durchgestrichen), dazu KaTeX-Formeln, Mermaid-Diagramme,
Callouts, Fußnoten und `==Hervorhebungen==`. Vollständige Referenz:
[Markdown-Syntax](./markdown-syntax).

### Kann ich VeloxMark zur Notizverwaltung verwenden?

VeloxMark ist ein fokussierter Markdown-Leser/-Editor — öffne Ordner und Dateien,
nutze Gliederung und Suche, aber es gibt keine Wissensmanagement-Schicht (keine Tags, keine Backlinks,
keine Datenbank). Deine Dateien bleiben reines `.md` auf der Platte, sodass jedes andere Tool sie übernehmen kann.

### Wie melde ich einen Fehler?

Erstelle ein Issue auf [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) mit der App-
Version (Hilfe-Menü), deinem Betriebssystem, Schritten zur Reproduktion und dem problematischen Markdown.

### Wo werden meine Entwürfe und Einstellungen gespeichert?

Einstellungen, Entwürfe und Sitzungszustand liegen im standardmäßigen Anwendungsdaten-
Verzeichnis des Benutzers (Electron `userData`): Windows `%APPDATA%\VeloxMark`, macOS
`~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`. Dokumente selbst werden
nie verschoben oder kopiert — du bearbeitest Dateien dort, wo sie liegen.

### Warum sagt macOS, die App stamme von einem unbekannten Entwickler?

Release-Builds sind derzeit nicht signiert. Führe
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` einmal nach der Installation aus — siehe
[Installation](./installation#macos).

### Die App aktualisiert sich auf meiner Plattform nicht automatisch — ist das normal?

Ja. Vollautomatische Updates sind für Windows-NSIS-Installationen und Linux-AppImage aktiviert; andere
Installationsformen zeigen nur Hinweise, und macOS weicht derzeit darauf aus, die Releases-Seite zu öffnen,
weil die Builds nicht signiert sind. Details: [Auto-Update](./updates).
