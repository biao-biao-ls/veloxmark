---
title: Introduction
description: Welcome to the VeloxMark user documentation — a free, open-source Markdown editor with live preview, built on Electron and CodeMirror 6.
keywords: [VeloxMark documentation, Markdown editor guide, live preview editor, introduction]
---

# Introduction

Welcome to the user documentation of VeloxMark — a free, open-source Markdown editor with
live preview for macOS, Windows and Linux, inspired by Typora and built on Electron +
CodeMirror 6.

<div class="vm-shot">

![VeloxMark interface](/img/hero-light.png)

</div>

## What makes VeloxMark different

**Markdown source is the only data source.** Everything rich — rendered headings, math,
diagrams, tables — is an ephemeral decoration on top of your plain-text file. Saving writes
clean `.md` with zero round-trip loss. There is no proprietary document format and no
hidden state.

The live-preview engine rebuilds its decorations on every document and selection change:
syntax markers are hidden with replace decorations, and code / math / mermaid / image
blocks are swapped for rendered widgets. When the cursor enters a range, the decoration for
that range is skipped and the source form comes back. The caret line always stays in
source form so you always know exactly what you're editing.

## Where to go next

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">Installation</a></h3>
    <p>Installers for macOS, Windows and Linux, checksum verification, and platform notes.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">Basics</a></h3>
    <p>The window, the sidebar, tabs and the three editor modes — everything you see on first launch.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">Editing in depth</a></h3>
    <p>How live preview behaves while you type: block widgets, tables, focus modes and typing assists.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Markdown syntax</a></h3>
    <p>Every syntax construct VeloxMark renders specially, with source samples.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">Key bindings</a></h3>
    <p>The full command list with accelerators for each platform.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">FAQ</a></h3>
    <p>Supported platforms, troubleshooting and how to report a bug.</p>
  </div>
</div>

## License

VeloxMark is released under the [MIT License](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
The source lives at [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark).
