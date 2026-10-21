---
title: Скачать
description: Скачайте VeloxMark для macOS, Windows и Linux — бесплатный Markdown-редактор с открытым исходным кодом. Установщики, контрольные суммы SHA256, поведение автообновления и старые версии.
keywords: [скачать VeloxMark, скачать Markdown-редактор, macOS dmg, установщик Windows, Linux AppImage, Markdown-редактор с открытым кодом]
---

# Скачать

VeloxMark бесплатен и распространяется с открытым исходным кодом по
[лицензии MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Все установщики публикуются в [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases),
рядом с ними лежит манифест контрольных сумм `SHA256SUMS.txt`.

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon и Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — носитель для автообновления</li>
    </ul>
    <p class="notes">Неподписанные сборки — после установки, если macOS заблокирует приложение, выполните <code>xattr -d com.apple.quarantine</code> для приложения.</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS, с автообновлением</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — универсальный установщик</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — портативная версия</li>
    </ul>
    <p class="notes">x64 и ARM64. NSIS-установки обновляются на месте.</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — с автообновлением</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — только x64</li>
    </ul>
    <p class="notes">x86_64 и aarch64 (snap — только x64).</p>
  </div>
</div>

## Проверка загрузки

Каждый релиз поставляется с `SHA256SUMS.txt`. Перед установкой проверьте скачанное:

```bash
sha256sum -c SHA256SUMS.txt
```

## Поведение автообновления

- **Установки Windows NSIS** и **Linux AppImage** — полная автоматическая проверка,
  загрузка и установка. Приложение спрашивает разрешение, прежде чем выйти для установки.
- **Сборки macOS** неподписаны, поэтому обновитель на месте не может их применить, —
  проверка обновлений вместо этого открывает страницу релизов.
- **Портативный zip, установки deb / rpm / snap / tar.gz** — проверка обновлений лишь
  уведомляет вас и указывает на новый релиз; ничего не меняется за вашей спиной.

## Старые версии

Каждая опубликованная версия остаётся доступной на
[странице релизов](https://github.com/biao-biao-ls/veloxmark/releases) вместе с
примечаниями к выпуску и контрольными суммами.
