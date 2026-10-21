---
title: Installation
description: VeloxMark unter macOS, Windows oder Linux installieren — Installer-Formate, SHA256-Prüfsummen-Verifikation, Build aus dem Quellcode, Update- und Deinstallationsschritte.
keywords: [VeloxMark installieren, Markdown-Editor Installer, AppImage, NSIS, dmg, deb, rpm, snap, Prüfsummen-Verifikation]
---

# Installation

VeloxMark ist frei und quelloffen. Vorgefertigte Binärdateien für macOS, Windows und Linux werden auf
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases) veröffentlicht.
Jede Version enthält eine `SHA256SUMS.txt`, damit du deine Downloads überprüfen kannst.

## Windows

| Artefakt | Hinweise |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | NSIS-Installer, empfohlen. Aktualisiert sich direkt an Ort und Stelle. |
| `VeloxMark-Setup-<ver>.exe` | Universeller Installer (das Auto-Update-Manifest zeigt hierher). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Portable Version — entpacken und ausführen, kein Installer, kein Auto-Update. |

Führe den Installer aus und starte VeloxMark über das Startmenü. Es ist kein Konto erforderlich.

## macOS

| Artefakt | Hinweise |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Disk Images für Apple Silicon und Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip-Archive (auch der Träger für Auto-Updates). |

Ziehe die App in **Programme** und starte sie.

> [!WARNING]
> Release-Builds sind derzeit **nicht signiert**. macOS Gatekeeper wird die App beim ersten Start
> ablehnen. Entferne stattdessen das Quarantäne-Attribut:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Da die Builds nicht signiert sind, kann das eingebaute Auto-Update unter macOS nicht installieren — der Updater
fällt darauf zurück, die Releases-Seite zu öffnen, damit du die neue Version manuell herunterladen kannst.

## Linux

| Format | Hinweise |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Empfohlen. `chmod +x` und ausführen. Vollständiges Auto-Update. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Portables Tar-Archiv. |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap-Paket (nur x64). |

Deb-, rpm-, snap- und tar.gz-Installationen erhalten nur Hinweise zu Updates — die App teilt dir mit, dass es eine
neue Version gibt, und verweist auf die Releases-Seite.

## Download überprüfen

Jede Version enthält `SHA256SUMS.txt`. Prüfe deine Datei dagegen:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Unter macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (oder `shasum -a 256 <file>`
und von Hand vergleichen). Unter Windows (PowerShell):

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Aktualisieren

VeloxMark prüft GitHub Releases auf neue Versionen. Das Verhalten hängt von der Installationsform ab:

- **Windows NSIS** und **Linux AppImage** — vollständige Prüfung, Download und Installation. Nach dem
  Download fragt die App nach, bevor sie zum Installieren beendet wird.
- **macOS** — die Prüfung findet die Release, aber der nicht signierte Build kann
  Squirrel.Mac-Updates nicht abschließen; die App öffnet stattdessen die Releases-Seite.
- **Alles andere** (portables zip, deb / rpm / snap / tar.gz, Dev-Modus) — nur Hinweise bei der
  manuellen Prüfung.

Du kannst die neueste Version auch immer von der
[Releases-Seite](https://github.com/biao-biao-ls/veloxmark/releases) holen.

## Aus dem Quellcode bauen

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # development mode
npm run build    # production build to out/
```

Wenn Electron-Binärdateien in eingeschränkten Netzwerken nicht geladen werden können:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Pakete eine verteilbare Version mit `npm run build:win`, `npm run build:mac` oder `npm run build:linux`.

## Deinstallieren

- **Windows** — Einstellungen → Apps → VeloxMark → Deinstallieren.
- **macOS** — VeloxMark.app aus dem Programme-Ordner in den Papierkorb ziehen.
- **Linux** — das Paket entfernen (`apt remove`, `dnf remove`, `snap remove`) oder die
  AppImage / das entpackte Tar-Archiv löschen.

Benutzerdaten (Entwürfe, Einstellungen, Sitzungszustand) liegen im standardmäßigen Anwendungsdaten-
Verzeichnis des Benutzers; lösche es nur, wenn du wirklich bei null anfangen willst.
