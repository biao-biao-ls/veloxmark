---
title: Descargar
description: Descarga VeloxMark para macOS, Windows y Linux — editor de Markdown gratuito y de código abierto. Instaladores, sumas de verificación SHA256, comportamiento de actualización automática y versiones anteriores.
keywords: [descargar VeloxMark, descarga editor de Markdown, macOS dmg, instalador de Windows, Linux AppImage, editor de Markdown de código abierto]
---

# Descargar

VeloxMark es gratuito y de código abierto bajo la
[licencia MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Todos los instaladores se publican en
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases),
junto con un manifiesto de sumas de verificación `SHA256SUMS.txt`.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon e Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — vehículo de actualización automática</li>
    </ul>
    <p class="notes">Compilaciones sin firmar: tras instalar, ejecuta <code>xattr -d com.apple.quarantine</code> sobre la aplicación si macOS la bloquea.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, con actualización automática</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — instalador universal</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — portable</li>
    </ul>
    <p class="notes">x64 y ARM64. Las instalaciones NSIS se actualizan en el sitio.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — con actualización automática</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — solo x64</li>
    </ul>
    <p class="notes">x86_64 y aarch64 (snap solo x64).</p>
  </div>
</div>

## Verificar las descargas

Cada release incluye un `SHA256SUMS.txt`. Comprueba tu descarga antes de instalar:

```bash
sha256sum -c SHA256SUMS.txt
```

## Comportamiento de la actualización automática

- **Instalaciones NSIS de Windows** y **AppImage de Linux** — comprobación, descarga e
  instalación completamente automáticas. La aplicación pregunta antes de salir para
  aplicar la actualización.
- **Las compilaciones de macOS** están sin firmar, por lo que el actualizador en el
  sitio no puede aplicarlas — al buscar actualizaciones se abre la página de releases.
- **Zip portable, instalaciones deb / rpm / snap / tar.gz** — las comprobaciones de
  actualización te avisan y te llevan al nuevo release; nada cambia a tus espaldas.

## Versiones anteriores

Cada versión publicada sigue disponible en la
[página de releases](https://github.com/biao-biao-ls/veloxmark/releases), con notas de
la versión y sumas de verificación.
