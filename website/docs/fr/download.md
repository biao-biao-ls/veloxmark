---
title: Télécharger
description: Téléchargez VeloxMark pour macOS, Windows et Linux — éditeur Markdown gratuit et open source. Installateurs, sommes de contrôle SHA256, comportement de mise à jour automatique et anciennes versions.
keywords: [télécharger VeloxMark, téléchargement éditeur Markdown, macOS dmg, installateur Windows, Linux AppImage, éditeur Markdown open source]
---

# Télécharger

VeloxMark est gratuit et open source sous la
[licence MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Tous les installateurs sont publiés sur
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases),
avec un manifeste de sommes de contrôle `SHA256SUMS.txt` à côté.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon et Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — support de mise à jour automatique</li>
    </ul>
    <p class="notes">Builds non signés — après l'installation, exécutez <code>xattr -d com.apple.quarantine</code> sur l'application si macOS la bloque.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, mise à jour automatique</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — installateur universel</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — portable</li>
    </ul>
    <p class="notes">x64 et ARM64. Les installations NSIS se mettent à jour sur place.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — mise à jour automatique</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — x64 uniquement</li>
    </ul>
    <p class="notes">x86_64 et aarch64 (snap en x64 uniquement).</p>
  </div>
</div>

## Vérifier le téléchargement

Chaque version fournit un `SHA256SUMS.txt`. Vérifiez votre téléchargement avant d'installer :

```bash
sha256sum -c SHA256SUMS.txt
```

## Comportement de la mise à jour automatique

- **Installations NSIS sous Windows** et **AppImage Linux** — vérification, téléchargement et
  installation entièrement automatiques. L'application demande votre accord avant de
  quitter pour appliquer la mise à jour.
- **Builds macOS** non signés : le programme de mise à jour sur place ne peut pas les
  appliquer — la vérification des mises à jour ouvre la page des versions à la place.
- **Zip portable, installations deb / rpm / snap / tar.gz** — la vérification des mises à
  jour vous prévient et vous oriente vers la nouvelle version ; rien n'est modifié dans
  votre dos.

## Anciennes versions

Chaque version publiée reste disponible sur la
[page des versions](https://github.com/biao-biao-ls/veloxmark/releases), avec les notes
de version et les sommes de contrôle.
