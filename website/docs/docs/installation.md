---
title: Installation
description: Install VeloxMark on macOS, Windows or Linux — installer formats, SHA256 checksum verification, build from source, updating and uninstall steps.
keywords: [VeloxMark install, Markdown editor installer, AppImage, NSIS, dmg, deb, rpm, snap, checksum verification]
---

# Installation

VeloxMark is free and open source. Pre-built binaries for macOS, Windows and Linux are
published on [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases).
Every release ships a `SHA256SUMS.txt` file so you can verify what you download.

## Windows

| Artifact | Notes |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | NSIS installer, recommended. Auto-updates in place. |
| `VeloxMark-Setup-<ver>.exe` | Universal installer (the auto-update manifest points here). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Portable build — unzip and run, no installer, no auto-update. |

Run the installer and launch VeloxMark from the Start Menu. No account is required.

## macOS

| Artifact | Notes |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Disk images for Apple Silicon and Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip archives (also the auto-update vehicle). |

Drag the app into **Applications** and launch it.

> [!WARNING]
> Release builds are currently **unsigned**. macOS Gatekeeper will refuse to open the app
> on first launch. Remove the quarantine attribute instead:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Because the builds are unsigned, in-app auto-update cannot install on macOS — the updater
degrades to opening the releases page so you can download the new version manually.

## Linux

| Format | Notes |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Recommended. `chmod +x` and run. Full auto-update. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Portable tarball. |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap package (x64 only). |

Deb, rpm, snap and tar.gz installs are notify-only for updates — the app tells you a new
version exists and points you at the releases page.

## Verify the download

Each release includes `SHA256SUMS.txt`. Check your file against it:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

On macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (or `shasum -a 256 <file>`
and compare by hand). On Windows (PowerShell):

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Updating

VeloxMark checks GitHub Releases for new versions. Behavior depends on the install form:

- **Windows NSIS** and **Linux AppImage** — full check, download and install. After the
  download the app asks before quitting to install.
- **macOS** — the check finds the release, but the unsigned build cannot complete
  Squirrel.Mac updates; the app opens the releases page instead.
- **Everything else** (portable zip, deb / rpm / snap / tar.gz, dev mode) — notify-only
  manual checking.

You can also always grab the latest version from the
[releases page](https://github.com/biao-biao-ls/veloxmark/releases).

## Build from source

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # development mode
npm run build    # production build to out/
```

If Electron binaries fail to download on restricted networks:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Package a distributable with `npm run build:win`, `npm run build:mac` or `npm run build:linux`.

## Uninstall

- **Windows** — Settings → Apps → VeloxMark → Uninstall.
- **macOS** — drag VeloxMark.app from Applications to the Trash.
- **Linux** — remove the package (`apt remove`, `dnf remove`, `snap remove`) or delete the
  AppImage / extracted tarball.

User data (drafts, preferences, session state) lives in the standard per-user application
data directory; delete it only if you want a clean slate.
