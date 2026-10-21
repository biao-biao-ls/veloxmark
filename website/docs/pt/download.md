---
title: Transferir
description: Transfira o VeloxMark para macOS, Windows e Linux — editor de Markdown gratuito e de código aberto. Instaladores, checksums SHA256, comportamento de atualização automática e versões anteriores.
keywords: [transferir VeloxMark, download editor de Markdown, macOS dmg, instalador Windows, Linux AppImage, editor de Markdown de código aberto]
---

# Transferir

O VeloxMark é gratuito e de código aberto sob a
[Licença MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Todos os instaladores são publicados no
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases),
com um manifesto de checksums `SHA256SUMS.txt` ao lado deles.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon e Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — veículo de atualização automática</li>
    </ul>
    <p class="notes">Compilações por assinar — após a instalação, execute <code>xattr -d com.apple.quarantine</code> no aplicativo se o macOS o bloquear.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, com atualização automática</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — instalador universal</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — portátil</li>
    </ul>
    <p class="notes">x64 e ARM64. As instalações NSIS se atualizam no próprio lugar.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — com atualização automática</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — apenas x64</li>
    </ul>
    <p class="notes">x86_64 e aarch64 (snap apenas x64).</p>
  </div>
</div>

## Verificar as transferências

Cada release inclui um `SHA256SUMS.txt`. Verifique a sua transferência antes de instalar:

```bash
sha256sum -c SHA256SUMS.txt
```

## Comportamento da atualização automática

- **Instalações NSIS do Windows** e **AppImage do Linux** — verificação, transferência e
  instalação totalmente automáticas. O aplicativo pede confirmação antes de sair para
  aplicar a atualização.
- **Compilações do macOS** são por assinar, pelo que o atualizador no próprio lugar não
  consegue aplicá-las — verificar atualizações abre a página de releases.
- **Zip portátil, instalações deb / rpm / snap / tar.gz** — as verificações de atualização
  apenas o notificam e apontam para a nova release; nada é alterado às suas costas.

## Versões anteriores

Todas as versões publicadas permanecem disponíveis na
[página de releases](https://github.com/biao-biao-ls/veloxmark/releases), incluindo notas
de lançamento e checksums.
