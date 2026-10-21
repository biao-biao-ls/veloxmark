---
title: 下载
description: 下载 VeloxMark——支持 macOS、Windows 与 Linux 的免费开源 Markdown 编辑器。安装包、SHA256 校验、自动更新行为与历史版本。
keywords: [下载 VeloxMark, Markdown 编辑器下载, macOS dmg, Windows 安装包, Linux AppImage, 开源 Markdown 编辑器]
---

# 下载

VeloxMark 基于 [MIT 许可证](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)免费开源。
所有安装包发布在 [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)，
并附带 `SHA256SUMS.txt` 校验清单。

<div class="platform-grid">
  <div class="platform-card">
    <h3>macOS</h3>
    <ul class="formats">
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.dmg</code> — Apple Silicon 与 Intel</li>
      <li><code>VeloxMark-Mac-&lt;arch&gt;-&lt;ver&gt;.zip</code> — 自动更新载体</li>
    </ul>
    <p class="notes">未签名构建——安装后若 macOS 拦截，请对应用执行 <code>xattr -d com.apple.quarantine</code>。</p>
  </div>
  <div class="platform-card">
    <h3>Windows</h3>
    <ul class="formats">
      <li><code>VeloxMark-Setup-&lt;ver&gt;-&lt;arch&gt;.exe</code> — NSIS，支持自动更新</li>
      <li><code>VeloxMark-Setup-&lt;ver&gt;.exe</code> — 通用安装包</li>
      <li><code>VeloxMark-Win-&lt;arch&gt;-&lt;ver&gt;.zip</code> — 便携版</li>
    </ul>
    <p class="notes">x64 与 ARM64。NSIS 安装可原地自动更新。</p>
  </div>
  <div class="platform-card">
    <h3>Linux</h3>
    <ul class="formats">
      <li><code>VeloxMark-Linux-x86_64-&lt;ver&gt;.AppImage</code> — 支持自动更新</li>
      <li><code>.deb</code> / <code>.rpm</code></li>
      <li><code>.tar.gz</code></li>
      <li><code>.snap</code> — 仅 x64</li>
    </ul>
    <p class="notes">x86_64 与 aarch64（snap 仅 x64）。</p>
  </div>
</div>

## 校验下载文件

每个版本都附带 `SHA256SUMS.txt`。安装前请校验：

```bash
sha256sum -c SHA256SUMS.txt
```

## 自动更新行为

- **Windows NSIS 安装** 与 **Linux AppImage** —— 完整的自动检查、下载与安装。应用会在退出安装前征求你的同意。
- **macOS 构建** 未签名，原地更新器无法应用——检查更新会改为打开发布页。
- **便携 zip、deb / rpm / snap / tar.gz 安装** —— 更新检查仅通知你并指向新版本；不会擅自在后台改动任何东西。

## 历史版本

每个已发布版本都保留在
[发布页](https://github.com/biao-biao-ls/veloxmark/releases)，含发布说明与校验文件。
