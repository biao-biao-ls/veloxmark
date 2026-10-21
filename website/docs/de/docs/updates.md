---
title: Auto-Update
description: Wie VeloxMark sich je Installationsform aktualisiert — vollautomatisches Update unter Windows NSIS und Linux AppImage, anderswo nur Hinweise, manuelle Fallback-Option.
keywords: [VeloxMark Auto-Update, electron-updater, AppImage Update, NSIS Update, manuell aktualisieren]
---

# Auto-Update

VeloxMark prüft [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
auf neue Versionen und leitet das Update je nach Installationsform unterschiedlich an.

## Verhalten je Installationsform

| Installationsform | Update-Verhalten |
| --- | --- |
| Windows-NSIS-Installer | Volle Prüfung → Download → Nachfrage → Installation beim Neustart |
| Linux-AppImage | Volle Prüfung → Download → Nachfrage → Installation beim Neustart |
| macOS (dmg / zip) | Nur Prüfung — der nicht signierte Build kann Squirrel.Mac-Updates nicht abschließen, daher öffnet die App die Releases-Seite |
| Portables zip / deb / rpm / snap / tar.gz | Nur Hinweis — eine neue Version wird angekündigt und verlinkt |
| Dev-Modus (`npm run dev`) | Nur Hinweis |

Nach Abschluss eines Downloads **fragt die App nach, bevor sie zum Installieren beendet wird** — es geschieht
nichts hinter deinem Rücken.

## Manuell prüfen

Nutze **Hilfe → Nach Updates suchen** im App-Menü. Bei Installationsformen mit Nur-Hinweis öffnet bzw.
verweist das auf die Releases-Seite.

## Update-Manifeste

Die Release-Assets enthalten electron-updater-Manifeste (`latest.yml`, `latest-mac.yml`,
`latest-linux.yml`, `latest-linux-arm64.yml`) und `SHA256SUMS.txt`. Das `path` im Windows-Manifest
zeigt auf den universellen `VeloxMark-Setup-<ver>.exe`.

## Wenn ein Update fehlschlägt

1. Prüfe dein Netzwerk / deinen Proxy — Updates kommen von GitHub Releases.
2. Überprüfe den Download manuell gegen `SHA256SUMS.txt`
   (siehe [Installation](./installation#download-uberprufen)).
3. Greife auf eine frische Installation von der [Releases-Seite](https://github.com/biao-biao-ls/veloxmark/releases) zurück —
   deine Einstellungen und Entwürfe bleiben erhalten.
