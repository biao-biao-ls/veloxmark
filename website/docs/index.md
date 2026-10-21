---
layout: home

title: VeloxMark
titleTemplate: The Markdown editor that gets out of your way

hero:
  name: VeloxMark
  text: Write in Markdown. Everything else is decoration.
  tagline: Real-time preview, beautiful typography, and zero distractions. Free and open source for macOS, Windows and Linux.
  image:
    src: /img/hero-dark.png
    alt: VeloxMark live-preview editor
  actions:
    - theme: brand
      text: Download for free
      link: /download
    - theme: alt
      text: Read the docs
      link: /docs/
    - theme: alt
      text: Star on GitHub
      link: https://github.com/biao-biao-ls/veloxmark

features:
  - icon: 🪄
    title: Live preview, in place
    details: Markdown source is the only data source. Markers melt away when you leave a line — the caret line stays in source form. No split pane, no toggling.
  - icon: ∑
    title: Math (KaTeX)
    details: Inline $E = mc^2$ and display math render instantly. Click any formula to edit its source.
  - icon: ▦
    title: Native tables
    details: Real cell editors, column resize, alignment and insert/convert dialogs — not just pipe characters.
  - icon: ◈
    title: Mermaid diagrams
    details: Flowcharts and graphs render in place. Click the diagram to drop back into its fenced source.
  - icon: ☾
    title: Focus & dark mode
    details: Focus mode, typewriter mode and a light/dark theme that follows you across sessions. Keyboard-first throughout.
  - icon: ↧
    title: Plain .md, zero loss
    details: Saving writes clean Markdown with zero round-trip loss. Export to PDF or self-contained HTML when you're done.
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Desktop platforms</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">UI languages</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Free &amp; open source</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Accounts required</div></div>
</div>

<div id="preview"></div>

<div class="vm-reveal">
  <span class="vm-kicker">Real-time preview</span>
  <h2>See it as you mean it.</h2>
  <p class="vm-lead">
    A true WYSIWYG editor — your Markdown transforms in place the moment the cursor leaves a line.
    No split view, no preview toggle, no visual mode switch.
  </p>
</div>

<div class="vm-split vm-reveal">
  <div class="vm-split-text">
    <ul class="vm-feature-list">
      <li>
        <strong>Render in place</strong>
        <span>Type <code>## Heading</code> and watch the markup melt away. Syntax markers hide on blur and return exactly where they belong.</span>
      </li>
      <li>
        <strong>Source when you need it</strong>
        <span>The caret line stays in source form. Click any code block, formula, diagram or table to edit its raw Markdown.</span>
      </li>
      <li>
        <strong>Paste &amp; go</strong>
        <span>Paste rich text and VeloxMark converts it to clean Markdown. Bare URLs get wrapped into links automatically.</span>
      </li>
    </ul>
  </div>
  <div class="vm-split-media">
    <div class="vm-window">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">shipping-notes.md</span>
      </div>
      <img src="/img/caret-source-line.png" alt="VeloxMark live preview with the caret line in source form" />
    </div>
  </div>
</div>

<div id="extensions"></div>

<div class="vm-reveal" style="text-align:center">
  <span class="vm-kicker">Markdown, extended</span>
  <h2>Everything you reach for, rendered live.</h2>
  <p class="vm-lead" style="margin-inline:auto">
    CommonMark and GFM, plus the syntax writers of technical documents actually use —
    math, diagrams, callouts, footnotes and highlights.
  </p>
</div>

<div class="vm-grid-3">
  <div class="vm-card vm-reveal">
    <div class="icon-chip">▦</div>
    <h3>Tables</h3>
    <p>Build them visually with nested cell editors, or pipe them in with Markdown. Resize and align columns with the mouse.</p>
    <div class="vm-demo">
      <table>
        <tbody>
          <tr><th>Feature</th><th>Status</th></tr>
          <tr><td>Live preview</td><td>✓</td></tr>
          <tr><td>Cell editors</td><td>✓</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="vm-card vm-reveal">
    <div class="icon-chip">∑</div>
    <h3>Math &amp; LaTeX</h3>
    <p>KaTeX inline and block math, rendered instantly. Click a formula to edit its source, exactly like any other block.</p>
    <div class="vm-demo">
      <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
    </div>
  </div>
  <div class="vm-card vm-reveal">
    <div class="icon-chip">◈</div>
    <h3>Diagrams</h3>
    <p>Flowcharts and graphs via Mermaid, rendered in place. Click the diagram to drop into its fenced source.</p>
    <div class="vm-demo">
      <div class="flow">
        <span class="node">Write</span><span class="arrow">→</span>
        <span class="node">Preview</span><span class="arrow">→</span>
        <span class="node">Ship</span>
      </div>
    </div>
  </div>
  <div class="vm-card vm-reveal">
    <div class="icon-chip">{ }</div>
    <h3>Code blocks</h3>
    <p>Syntax highlighting for hundreds of languages, with optional line numbers, wrapping and long-block collapsing.</p>
    <div class="vm-demo">
      <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
      <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
      <div class="code-line">}</div>
    </div>
  </div>
  <div class="vm-card vm-reveal">
    <div class="icon-chip">¶</div>
    <h3>Footnotes &amp; callouts</h3>
    <p>Two-way footnotes that renumber themselves, GitHub-style callouts, and <code>==highlighted==</code> text.</p>
    <div class="vm-demo">
      <div class="fnote">Footnotes<sup>1</sup> jump to their definition. <sup>1</sup>: Like this one.</div>
    </div>
  </div>
  <div class="vm-card vm-reveal">
    <div class="icon-chip">☑</div>
    <h3>Task lists</h3>
    <p><code>- [ ]</code> renders as a clickable checkbox. Check items off without ever seeing a bracket.</p>
    <div class="vm-demo">
      <div class="fnote">☑ &nbsp;Ship the release<br />☐ &nbsp;Write the changelog</div>
    </div>
  </div>
</div>

<div id="themes"></div>

<div class="vm-split reverse vm-reveal">
  <div class="vm-split-text">
    <span class="vm-kicker">Light &amp; dark</span>
    <h2>Easy on the eyes, day or night.</h2>
    <p class="vm-lead">
      Switch themes in one click from the View menu — remembered across sessions.
      The frameless title bar and in-app menus follow along.
    </p>
    <ul class="vm-feature-list">
      <li>
        <strong>Light &amp; dark, instantly</strong>
        <span>Both themes are first-class, tuned for long writing sessions.</span>
      </li>
      <li>
        <strong>Focus &amp; typewriter modes</strong>
        <span>Dim everything but the line you're writing, and keep it locked to center. Distraction-free by design.</span>
      </li>
    </ul>
  </div>
  <div class="vm-split-media">
    <div class="vm-window">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">welcome.md — dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark dark theme" />
    </div>
    <div class="vm-window" style="margin-top:18px">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">welcome.md — light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark light theme" />
    </div>
  </div>
</div>

<div class="vm-grid-2">
  <div class="vm-card wide vm-reveal">
    <div class="icon-chip">◎</div>
    <h3>Focus &amp; typewriter mode</h3>
    <p>Dim everything but the line you're writing, and keep it locked to center. Distraction-free by design.</p>
    <div class="vm-shot" style="margin-bottom:0">
      <img src="/img/focus-mode.png" alt="VeloxMark focus mode" />
    </div>
  </div>
  <div class="vm-card wide vm-reveal">
    <div class="icon-chip">↧</div>
    <h3>Export anywhere</h3>
    <p>Turn any document into a polished PDF or a self-contained HTML file — selection-only HTML export included.</p>
    <div class="vm-chip-row">
      <span class="chip">PDF</span>
      <span class="chip">HTML</span>
      <span class="chip">.md</span>
    </div>
    <div class="vm-shot" style="margin-bottom:0">
      <img src="/img/mermaid-light.png" alt="VeloxMark rendered diagram and table" />
    </div>
  </div>
</div>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <span class="vm-kicker">Free download</span>
  <h2>Start writing in <span class="grad-text">two minutes</span>.</h2>
  <p>One download. No account, no subscription. Every desktop you write on.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon &amp; Intel</span></span>
    </a>
    <a class="vm-plat" href="/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 &amp; ARM64</span></span>
    </a>
    <a class="vm-plat" href="/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Checksums provided in <code>SHA256SUMS.txt</code> · Auto-update on Windows &amp; Linux</p>
</div>
