---
title: Bilder
description: Bildunterstützung in VeloxMark — relative und absolute Pfade, Remote-URLs, Anzeigegröße mit =WxH, Ausrichtungs- und Spiegelungsattribute, Anhänge.
keywords: [Markdown Bilder, Bildgrößen-Syntax, Bildausrichtung, Anhangsordner, Remote-Bilder]
---

# Bilder

VeloxMark löst Bilder so auf, wie es eine Markdown-Datei auf der Platte tun sollte — relativ zu der Datei,
die du gerade bearbeitest.

## Unterstützte Pfade

| Form | Beispiel | Aufgelöst gegen |
| --- | --- | --- |
| Relativer Pfad | `![alt](./img/chart.png)` | Verzeichnis der aktuellen `.md`-Datei |
| Absoluter Pfad | `![alt](C:\pics\a.png)` / `![alt](/home/me/a.png)` | Wurzel des Dateisystems |
| Remote-URL | `![alt](https://example.com/a.png)` | Über das Netzwerk geladen |
| Data-URI | `![alt](data:image/png;base64,…)` | Inline eingebettet |

Relative Pfade sind die portable Wahl — verschiebe den Ordner mit deiner `.md` und ihren
Bildern zusammen und alles funktioniert weiter.

## Größe & Attribute

Ein optionales `=WxH`-Suffix hinter der URL setzt die gerenderten Abmessungen, und `{…}`-Gruppen
hinter der schließenden Klammer setzen Ausrichtung und Spiegelung:

```markdown
![logo](./logo.png =128x128)
![banner](./banner.png =800x200){align=center}{flip=h}
```

| Attribut | Werte | Wirkung |
| --- | --- | --- |
| `=WxH` | z. B. `=128x128` | Anzeigegröße in Pixeln |
| `{align=…}` | `left`, `center`, `right` | Horizontale Ausrichtung |
| `{flip=…}` | `h`, `v`, `hv` | Horizontal / vertikal / beides spiegeln |

Gerenderte Bilder lassen sich auch mit der Maus **in der Größe ziehen** (ergibt eine Breite in `%`), und das
Bild-Widget bietet Ausrichtung, Spiegeln, Größe zurücksetzen, URL bearbeiten und „Im Dateimanager anzeigen“.

## Klicken zum Bearbeiten

Bilder werden als Widgets gerendert. Klicke das Bild an, um seine Markdown-Quelle zu bearbeiten; verlässt du
den Block, wird er wieder gerendert — gleiches Verhalten wie bei Code-, Formel- und Diagrammblöcken.

## Lokale Sicherheit

Lokale Bilder werden über das interne `mdres://`-Protokoll der App ausgeliefert statt über rohen
`file://`-Zugriff, sodass ein Dokument nur Bilder anzeigen kann, die die App bewusst freigibt.
