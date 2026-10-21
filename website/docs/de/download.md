---
title: Download
description: VeloxMark für macOS, Windows und Linux herunterladen — kostenloser, quelloffener Markdown-Editor. Installationspakete, SHA256-Prüfsummen, Auto-Update-Verhalten und ältere Versionen.
keywords: [VeloxMark herunterladen, Markdown-Editor Download, macOS dmg, Windows Installer, Linux AppImage, quelloffener Markdown-Editor]
---

# Download

VeloxMark ist unter der [MIT-Lizenz](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE) frei und quelloffen.
Alle Installationspakete werden auf [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases) veröffentlicht,
mit einer Prüfsummenliste `SHA256SUMS.txt` daneben.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon &amp; Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — Träger für Auto-Updates</li>
    </ul>
    <p class="notes">Nicht signierte Builds — führe nach der Installation <code>xattr -d com.apple.quarantine</code> für die App aus, falls macOS sie blockiert.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, Auto-Update</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — universeller Installer</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — portable Version</li>
    </ul>
    <p class="notes">x64 &amp; ARM64. NSIS-Installationen aktualisieren sich direkt an Ort und Stelle.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — Auto-Update</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — nur x64</li>
    </ul>
    <p class="notes">x86_64 &amp; aarch64 (snap nur x64).</p>
  </div>
</div>

## Downloads überprüfen

Jede Version enthält eine `SHA256SUMS.txt`. Prüfe deinen Download vor der Installation:

```bash
sha256sum -c SHA256SUMS.txt
```

## Auto-Update-Verhalten

- **Windows-NSIS-Installationen** und **Linux-AppImage** — vollständig automatische Prüfung, Download und
  Installation. Die App fragt nach, bevor sie zum Anwenden des Updates beendet wird.
- **macOS-Builds** sind nicht signiert, sodass der In-App-Updater sie nicht anwenden kann — die Update-Prüfung
  öffnet stattdessen die Releases-Seite.
- **Portables zip, deb / rpm / snap / tar.gz Installationen** — Update-Prüfungen benachrichtigen dich und verweisen
  auf die neue Version; im Hintergrund wird nichts geändert.

## Ältere Versionen

Jede veröffentlichte Version bleibt auf der
[Releases-Seite](https://github.com/biao-biao-ls/veloxmark/releases) verfügbar, inklusive Release Notes
und Prüfsummen.
