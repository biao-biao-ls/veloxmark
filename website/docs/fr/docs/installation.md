---
title: Installation
description: Installez VeloxMark sur macOS, Windows ou Linux — formats d'installateur, vérification des sommes de contrôle SHA256, compilation depuis les sources, mise à jour et désinstallation.
keywords: [installation VeloxMark, installateur éditeur Markdown, AppImage, NSIS, dmg, deb, rpm, snap, vérification checksum]
---

# Installation

VeloxMark est gratuit et open source. Des binaires précompilés pour macOS, Windows et
Linux sont publiés sur
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases).
Chaque version fournit un fichier `SHA256SUMS.txt` pour vérifier ce que vous téléchargez.

## Windows

| Artefact | Remarques |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | Installateur NSIS, recommandé. Mise à jour automatique sur place. |
| `VeloxMark-Setup-<ver>.exe` | Installateur universel (le manifeste de mise à jour automatique pointe ici). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Version portable — décompressez et lancez, sans installateur, sans mise à jour automatique. |

Lancez l'installateur et démarrez VeloxMark depuis le menu Démarrer. Aucun compte n'est
requis.

## macOS

| Artefact | Remarques |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Images disque pour Apple Silicon et Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Archives zip (aussi le support de mise à jour automatique). |

Faites glisser l'application dans **Applications** et lancez-la.

> [!WARNING]
> Les builds de publication sont actuellement **non signés**. macOS Gatekeeper refusera
> d'ouvrir l'application au premier lancement. Retirez plutôt l'attribut de quarantaine :
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Comme les builds ne sont pas signés, la mise à jour automatique intégrée ne peut pas
installer sur macOS — le programme de mise à jour se rabat sur l'ouverture de la page des
versions pour que vous téléchargiez la nouvelle version manuellement.

## Linux

| Format | Remarques |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Recommandé. `chmod +x` puis lancez. Mise à jour automatique complète. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu : `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Tarball portable. |
| `VeloxMark-Linux-x64-<ver>.snap` | Paquet Snap (x64 uniquement). |

Les installations deb, rpm, snap et tar.gz sont en notification seule pour les mises à
jour — l'application vous indique qu'une nouvelle version existe et vous oriente vers la
page des versions.

## Vérifier le téléchargement

Chaque version inclut `SHA256SUMS.txt`. Vérifiez votre fichier par rapport à celui-ci :

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Sur macOS : `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (ou `shasum -a 256 <file>`
et comparez à la main). Sur Windows (PowerShell) :

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Mise à jour

VeloxMark vérifie GitHub Releases pour les nouvelles versions. Le comportement dépend de
la forme d'installation :

- **Windows NSIS** et **Linux AppImage** — vérification, téléchargement et installation
  complets. Après le téléchargement, l'application demande votre accord avant de quitter
  pour installer.
- **macOS** — la vérification trouve la version, mais le build non signé ne peut pas
  terminer une mise à jour Squirrel.Mac ; l'application ouvre la page des versions à la
  place.
- **Tout le reste** (zip portable, deb / rpm / snap / tar.gz, mode dev) — vérification
  manuelle en notification seule.

Vous pouvez aussi toujours récupérer la dernière version sur la
[page des versions](https://github.com/biao-biao-ls/veloxmark/releases).

## Compiler depuis les sources

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # mode développement
npm run build    # build de production vers out/
```

Si les binaires d'Electron échouent à se télécharger sur les réseaux restreints :

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Créez un paquet distribuable avec `npm run build:win`, `npm run build:mac` ou
`npm run build:linux`.

## Désinstaller

- **Windows** — Paramètres → Applications → VeloxMark → Désinstaller.
- **macOS** — faites glisser VeloxMark.app depuis Applications vers la corbeille.
- **Linux** — supprimez le paquet (`apt remove`, `dnf remove`, `snap remove`) ou effacez
  l'AppImage / le tarball extrait.

Les données utilisateur (brouillons, préférences, état de session) vivent dans le
répertoire standard de données d'application par utilisateur ; ne le supprimez que si
vous voulez repartir de zéro.
