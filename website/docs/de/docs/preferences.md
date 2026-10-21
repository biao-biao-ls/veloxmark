---
title: Einstellungen
description: Alle VeloxMark-Einstellungen mit Standardwerten — Theme, Editorschriften, Tippunterstützungen, Auto-Speichern und Absturz-Wiederherstellung, Bilder und Anhänge, Sprache.
keywords: [VeloxMark Einstellungen, Editor-Einstellungen, Auto-Speichern, Absturz-Wiederherstellung, Schriftgröße, Anhangsordner]
---

# Einstellungen

Öffne die Einstellungen mit `Ctrl+,` (`Cmd+,` unter macOS) oder über das **Datei →
Einstellungen**-Menü in der App. Die Einstellungen bleiben über Sitzungen hinweg erhalten.

## Erscheinungsbild

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Theme | System | `light` / `dark` / dem Betriebssystem folgen. Umschalten im Ansicht-Menü. |
| Editor-Schriftart | Systemschriftstapel | Schriftfamilie der Schreibfläche. |
| Schriftgröße | 16 | Editor-Schriftgröße in Pixeln. |
| Zeilenhöhe | 1.6 | Zeilenhöhe im Editor. |
| Breite der Inhaltsspalte | 0 (auto) | Maximale Zeilenbreite der Schreibspalte; `0` lässt die App wählen. |
| Statusleiste anzeigen | An | Cursorposition, Zähler und Modusanzeigen. |
| Seitenleiste standardmäßig geöffnet | An | Wenn keine vorherige Sitzung gespeichert ist. |

## Editor

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Tippunterstützungen | An | Listenfortführung, Überschriftenebene erhöhen, Einfüge-Umwandlungen. |
| Nackte URLs beim Einfügen verlinken | An | Aus einer eingefügten nackten URL einen Markdown-Link machen. |
| HTML beim Einfügen konvertieren | An | Eingefügten Rich Text in sauberes Markdown umwandeln. |
| Beim Speichern formatieren | Aus | Markdown normalisieren (Abstände, Listenmarker, Tabellenausrichtung) vor dem Schreiben. |
| Zeilennummern anzeigen | Aus | Zeilennummern-Spalte im Editor. |
| Zeilennummern in Codeblöcken | Aus | Zeilennummern in Codeblock-Widgets rendern. |
| Codeblöcke umbrechen | An | Lange Zeilen innerhalb von Codeblöcken umbrechen. |
| Codeblock-Einklapp-Schwelle | 20 Zeilen | Längere Blöcke werden mit Ausklapp-Steuerung eingeklappt; `0` deaktiviert. |
| Fokusmodus | Aus | Alles außer der aktuellen Region herunterdimmen. |
| Schreibmaschinenmodus | Aus | Die Cursorzeile auf der vertikalen Mitte fixieren. |
| Quellmodus | Aus | Immer rohes Markdown anzeigen. |

## Dateien

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Auto-Speichern | Debounce (3 s) | `off` / `debounce` (nachdem das Tippen endet) / `interval` (alle N Minuten). |
| Auto-Speichern-Verzögerung | 3 s | Debounce-Verzögerung für den Debounce-Modus. |
| Auto-Speichern-Intervall | 5 min | Intervall für den Intervall-Modus. |
| Absturz-Wiederherstellung | An | Entwürfe ungespeicherter Änderungen aufbewahren und nach einem Absturz Wiederherstellung anbieten. |
| Letzte Sitzung wiederherstellen | An | Tabs, Ordner und Cursorposition beim Start wieder öffnen. |
| Versteckte Dateien anzeigen | Aus | Punktdateien im Dateibaum anzeigen. |
| Ignorierte Namen | `node_modules`, `.git`, … | Namen, die im Dateibaum ausgeblendet werden. |

## Bilder & Anhänge

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Anhangsordner | `assets` | Ordner (relativ zum Dokument) für eingefügte/eingefügte Bilder. |
| Benennung von Bilddateien | Zeitstempel | Dateien mit Zeitstempel oder den Originaldateinamen behalten. |
| Externe Bilder kopieren | An | Bilder von außerhalb des Dokumentordners in die Anhänge kopieren. |
| Remote-Bilder herunterladen | Aus | Remote-Bild-URLs in die Anhänge laden. |

## Sprache

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Oberflächensprache | System | Dem Gebietsschema des Betriebssystems folgen oder eine der neun Sprachen festlegen. Siehe [Sprache & Lokalisierung](./language). |

## Links

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| Externe Links bestätigen | An | Nachfragen, bevor ein Link im Browser geöffnet wird. |
