---
title: Actualización automática
description: Cómo se actualiza VeloxMark según la forma de instalación — actualización automática completa en Windows NSIS y Linux AppImage, solo notificación en el resto, alternativa manual.
keywords: [actualización automática de VeloxMark, electron-updater, actualización AppImage, actualización NSIS, actualizar manualmente]
---

# Actualización automática

VeloxMark busca nuevas versiones en
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
y enruta la actualización de forma distinta según cómo lo hayas instalado.

## Comportamiento por forma de instalación

| Forma de instalación | Comportamiento de actualización |
| --- | --- |
| Instalador NSIS de Windows | Comprobación completa → descarga → aviso → instalación al reiniciar |
| Linux AppImage | Comprobación completa → descarga → aviso → instalación al reiniciar |
| macOS (dmg / zip) | Solo comprobación: la compilación sin firmar no puede completar las actualizaciones de Squirrel.Mac, así que la aplicación abre la página de releases |
| Zip portable / deb / rpm / snap / tar.gz | Solo notificación: se anuncia una nueva versión y se enlaza |
| Modo de desarrollo (`npm run dev`) | Solo notificación |

Cuando una descarga termina, **la aplicación pregunta antes de salir para instalar** —
nada ocurre a tus espaldas.

## Comprobar manualmente

Usa **Ayuda → Buscar actualizaciones** en el menú de la aplicación. En las formas de
instalación de solo notificación, esto abre o te lleva a la página de releases.

## Manifiestos de actualización

Los assets de cada release incluyen los manifiestos de electron-updater (`latest.yml`,
`latest-mac.yml`, `latest-linux.yml`, `latest-linux-arm64.yml`) y `SHA256SUMS.txt`. El
`path` del manifiesto de Windows apunta al `VeloxMark-Setup-<ver>.exe` universal.

## Si una actualización falla

1. Comprueba tu red / proxy: las actualizaciones provienen de GitHub Releases.
2. Verifica la descarga manualmente contra `SHA256SUMS.txt`
   (consulta [Instalación](./installation#verificar-la-descarga)).
3. Recurre a una instalación limpia desde la
   [página de releases](https://github.com/biao-biao-ls/veloxmark/releases) —
   tus ajustes y borradores se conservan.
