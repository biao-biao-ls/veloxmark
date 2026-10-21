---
title: Download
description: Download VeloxMark for macOS, Windows and Linux — free, open-source Markdown editor. Installers, SHA256 checksums, auto-update behavior and older versions.
keywords: [download VeloxMark, Markdown editor download, macOS dmg, Windows installer, Linux AppImage, open source Markdown editor]
---

# Download

VeloxMark is free and open source under the [MIT License](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
All installers are published on [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases),
with a `SHA256SUMS.txt` checksum manifest alongside them.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon &amp; Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — auto-update vehicle</li>
    </ul>
    <p class="notes">Unsigned builds — after installing, run <code>xattr -d com.apple.quarantine</code> on the app if macOS blocks it.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, auto-update</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — universal installer</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — portable</li>
    </ul>
    <p class="notes">x64 &amp; ARM64. NSIS installs update themselves in place.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — auto-update</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — x64 only</li>
    </ul>
    <p class="notes">x86_64 &amp; aarch64 (snap is x64 only).</p>
  </div>
</div>

## Verifying downloads

Each release ships a `SHA256SUMS.txt`. Check your download before installing:

```bash
sha256sum -c SHA256SUMS.txt
```

## Auto-update behavior

- **Windows NSIS installs** and **Linux AppImage** — full automatic check, download and
  install. The app asks before quitting to apply the update.
- **macOS builds** are unsigned, so the in-place updater cannot apply them — checking for
  updates opens the releases page instead.
- **Portable zip, deb / rpm / snap / tar.gz installs** — update checks notify you and point
  you at the new release; nothing is changed behind your back.

## Older versions

Every published version stays available on the
[releases page](https://github.com/biao-biao-ls/veloxmark/releases), including release notes
and checksums.
