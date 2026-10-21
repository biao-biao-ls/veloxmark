---
title: ダウンロード
description: VeloxMark を macOS・Windows・Linux 向けにダウンロード——無料のオープンソース Markdown エディター。インストーラー、SHA256 チェックサム、自動更新の動作、旧バージョン。
keywords: [VeloxMark ダウンロード, Markdown エディター ダウンロード, macOS dmg, Windows インストーラー, Linux AppImage, オープンソース Markdown エディター]
---

# ダウンロード

VeloxMark は [MIT ライセンス](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)の下で無料のオープンソースとして公開されています。
すべてのインストーラーは [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases) に公開され、
`SHA256SUMS.txt` チェックサム一覧が添付されています。

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon と Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — 自動更新用パッケージ</li>
    </ul>
    <p class="notes">未署名ビルド——インストール後、macOS にブロックされた場合はアプリに対して <code>xattr -d com.apple.quarantine</code> を実行してください。</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS、自動更新対応</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — ユニバーサルインストーラー</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — ポータブル版</li>
    </ul>
    <p class="notes">x64 と ARM64。NSIS インストールはその場で自動更新されます。</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — 自動更新対応</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — x64 のみ</li>
    </ul>
    <p class="notes">x86_64 と aarch64（snap は x64 のみ）。</p>
  </div>
</div>

## ダウンロードの検証

各リリースには `SHA256SUMS.txt` が付属しています。インストール前にダウンロードを検証してください：

```bash
sha256sum -c SHA256SUMS.txt
```

## 自動更新の動作

- **Windows NSIS インストール**と **Linux AppImage** —— 完全な自動チェック、ダウンロード、
  インストール。アプリは終了して更新を適用する前に確認を求めます。
- **macOS ビルド**は未署名のため、その場の更新ツールでは適用できません——更新の確認は
  代わりにリリースページを開きます。
- **ポータブル zip、deb / rpm / snap / tar.gz インストール** —— 更新チェックは通知して
  新しいリリースへ案内するだけで、背後で何も変更されません。

## 旧バージョン

公開されたすべてのバージョンは
[リリースページ](https://github.com/biao-biao-ls/veloxmark/releases)に残っており、リリースノートと
チェックサムも確認できます。
