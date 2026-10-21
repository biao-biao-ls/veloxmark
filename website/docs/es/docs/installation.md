---
title: Instalación
description: Instala VeloxMark en macOS, Windows o Linux — formatos de instalador, verificación de sumas SHA256, compilación desde el código fuente, actualización y pasos de desinstalación.
keywords: [instalar VeloxMark, instalador del editor de Markdown, AppImage, NSIS, dmg, deb, rpm, snap, verificación de sumas]
---

# Instalación

VeloxMark es gratuito y de código abierto. Los binarios precompilados para macOS, Windows
y Linux se publican en
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases).
Cada release incluye un archivo `SHA256SUMS.txt` para que puedas verificar lo que
descargas.

## Windows

| Artefacto | Notas |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | Instalador NSIS, recomendado. Se actualiza en el sitio. |
| `VeloxMark-Setup-<ver>.exe` | Instalador universal (el manifiesto de actualización automática apunta aquí). |
| `VeloxMark-Win-<arch>-<ver>.zip` | Compilación portable: descomprime y ejecuta, sin instalador y sin actualización automática. |

Ejecuta el instalador y lanza VeloxMark desde el menú Inicio. No se requiere ninguna cuenta.

## macOS

| Artefacto | Notas |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Imágenes de disco para Apple Silicon e Intel. |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Archivos zip (también el vehículo de actualización automática). |

Arrastra la aplicación a **Aplicaciones** y lánzala.

> [!WARNING]
> Las compilaciones de publicación están actualmente **sin firmar**. Gatekeeper de macOS
> se negará a abrir la aplicación en el primer arranque. Elimina en su lugar el atributo
> de cuarentena:
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

Como las compilaciones están sin firmar, la actualización automática dentro de la
aplicación no puede instalarse en macOS — el actualizador degrada su comportamiento a
abrir la página de releases para que descargues la nueva versión manualmente.

## Linux

| Formato | Notas |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | Recomendado. `chmod +x` y ejecutar. Actualización automática completa. |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu: `sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE. |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | Tarball portable. |
| `VeloxMark-Linux-x64-<ver>.snap` | Paquete Snap (solo x64). |

Las instalaciones deb, rpm, snap y tar.gz solo reciben notificaciones de actualización: la
aplicación te avisa de que existe una nueva versión y te lleva a la página de releases.

## Verificar la descarga

Cada release incluye `SHA256SUMS.txt`. Comprueba tu archivo contra él:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

En macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing` (o `shasum -a 256 <file>`
y compara a mano). En Windows (PowerShell):

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## Actualización

VeloxMark busca nuevas versiones en GitHub Releases. El comportamiento depende de la
forma de instalación:

- **Windows NSIS** y **Linux AppImage** — comprobación, descarga e instalación
  completas. Tras la descarga, la aplicación pregunta antes de salir para instalar.
- **macOS** — la comprobación encuentra el release, pero la compilación sin firmar no
  puede completar las actualizaciones de Squirrel.Mac; la aplicación abre la página de
  releases en su lugar.
- **Todo lo demás** (zip portable, deb / rpm / snap / tar.gz, modo de desarrollo) —
  comprobación manual solo con notificación.

Siempre puedes obtener la última versión desde la
[página de releases](https://github.com/biao-biao-ls/veloxmark/releases).

## Compilar desde el código fuente

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # modo de desarrollo
npm run build    # compilación de producción en out/
```

Si falla la descarga de los binarios de Electron en redes restringidas:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Empaqueta una versión distribuible con `npm run build:win`, `npm run build:mac` o
`npm run build:linux`.

## Desinstalar

- **Windows** — Configuración → Aplicaciones → VeloxMark → Desinstalar.
- **macOS** — arrastra VeloxMark.app desde Aplicaciones a la Papelera.
- **Linux** — elimina el paquete (`apt remove`, `dnf remove`, `snap remove`) o borra el
  AppImage / el tarball extraído.

Los datos de usuario (borradores, preferencias, estado de la sesión) viven en el
directorio estándar de datos de aplicación por usuario; elimínalo solo si quieres empezar
de cero.
