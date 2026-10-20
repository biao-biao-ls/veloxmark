---
layout: home

hero:
  name: VeloxMark
  text: Write in Markdown. Everything else is decoration.
  tagline: A fast, focused desktop editor with live preview — open source, cross-platform, zero round-trip loss.
  image:
    src: /logo.png
    alt: VeloxMark
  actions:
    - theme: brand
      text: Download
      link: /download
    - theme: alt
      text: View on GitHub
      link: https://github.com/biao-biao-ls/veloxmark

features:
  - icon: ✍️
    title: Live preview, Typora-style
    details: "Markdown source is the single source of truth. When the cursor leaves a line, markers like #, ** and ` hide and the line renders in its final style — the caret line stays in source form."
  - icon: 🧊
    title: Blocks that come alive
    details: "Syntax-highlighted code, KaTeX math and mermaid diagrams render in place. Click any block to drop straight back into its source."
  - icon: 📊
    title: Tables that behave
    details: "Native table editing with nested cell editors, column resize, alignment controls, and insert / convert-to-table dialogs."
  - icon: 🗂
    title: Outline and tabs
    details: "A heading tree in the sidebar with click-to-jump and position highlighting. Open several files at once; unsaved tabs are marked."
  - icon: 🌗
    title: Light and dark, focused
    details: "Theme toggle remembered across sessions, plus focus mode, typewriter mode and a clean source mode."
  - icon: 📄
    title: Your files stay yours
    details: "Plain .md in, plain .md out — zero round-trip loss. Export to PDF or HTML (selection included) when you need to share."
---

<div class="doc-mock">
  <div class="doc-title">product-launch.md</div>
  <h2>Q3 launch notes</h2>
  <p>When the cursor moves on, the <strong>markers disappear</strong> and the line simply looks finished.</p>
  <p class="source-line"><span class="marker">## </span>Q3 launch notes<br><span class="marker">**</span>markers disappear<span class="marker">**</span> and the line simply looks finished.</p>
</div>

<h2 id="features">The editing experience</h2>

VeloxMark is built around one invariant: **Markdown text is the only data source**. Everything
rich — highlighted code, rendered math, live diagrams, interactive tables — is an ephemeral
decoration layered on top of the source. Saving always writes plain Markdown with zero
round-trip loss, so your documents remain portable forever.

<div class="doc-mock">
  <div class="doc-title">syntax that stays out of the way</div>
  <h2>One document, three block types</h2>
  <p>Code fences with highlight.js, <code>$$</code> math via KaTeX, and <code>```mermaid</code> diagrams — each swaps its source for a rendered widget, and back again on click.</p>
</div>

## Ready in two minutes

VeloxMark ships for macOS, Windows and Linux. Installers check GitHub Releases and update
in place — no account, no telemetry, no lock-in.

- **Open source** — MIT licensed, developed in the open on GitHub
- **Cross-platform** — native builds for every major desktop OS
- **Local-first** — your documents never leave your machine

<div style="margin: 32px 0">
  <a href="/download" class="vp-button brand">Download VeloxMark</a>
  &nbsp;
  <a href="https://github.com/biao-biao-ls/veloxmark" class="vp-button alt">Star on GitHub</a>
</div>
