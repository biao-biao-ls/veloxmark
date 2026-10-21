---
layout: home

title: VeloxMark
titleTemplate: A Markdown editor with live preview

hero:
  name: VeloxMark
  text: Write in Markdown. Everything else is decoration.
  tagline: A live-preview writing desk for macOS, Windows and Linux — plain-text files in, beautiful documents out.
  image:
    src: /img/hero-light.png
    alt: VeloxMark live-preview editor
  actions:
    - theme: brand
      text: Download for free
      link: /download
    - theme: alt
      text: Read the docs
      link: /docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Desktop platforms</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">UI languages</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Free &amp; open source</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Accounts required</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Write <span class="vm-motif">▮</span></div>
    <h2>Your words, not your markup.</h2>
    <p class="vm-lead">
      VeloxMark renders each line the moment you leave it — headings, emphasis and code
      take their final form while the file stays plain Markdown underneath. The line you
      are editing keeps its source, so you always know what you are typing.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Markers step aside</strong>
          <span>Hashes, asterisks and backticks fade as the cursor moves on — and return exactly where they belong when you come back.</span>
        </li>
        <li>
          <strong>Click any block to edit it</strong>
          <span>Code, formulas, diagrams and tables are live widgets. One click brings back the fenced source underneath.</span>
        </li>
        <li>
          <strong>Paste like a human</strong>
          <span>Rich text becomes clean Markdown and bare URLs become links — automatically, and only when you want it.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="VeloxMark live preview with the caret line in source form" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Render <span class="vm-motif">##</span></div>
    <h2>Technical writing, rendered as you go.</h2>
    <p class="vm-lead">
      CommonMark and GFM, plus the constructs a working document actually needs —
      math, diagrams, callouts, footnotes and highlights. All of it live.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Tables you can touch</h3>
      <p>Real cell editors, draggable column widths and per-column alignment — pipe characters in, a working grid out.</p>
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
      <div class="icon-chip">$...$</div>
      <h3>Math &amp; LaTeX</h3>
      <p>KaTeX inline and display math, typeset in place. Click a formula to reach its source.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Diagrams</h3>
      <p>Mermaid flowcharts and graphs rendered in place, with export to SVG or PNG when you need them elsewhere.</p>
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
      <p>Highlighting for hundreds of languages, optional line numbers, soft wrap and long-block collapsing.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Footnotes &amp; callouts</h3>
      <p>Footnotes that renumber themselves, eight callout flavours, and <code>==highlighted==</code> text.</p>
      <div class="vm-demo">
        <div class="fnote">Footnotes<sup>1</sup> jump to their definition. <sup>1</sup>: Like this one.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Task lists</h3>
      <p>Checkboxes you can click — the bracket syntax stays in the file, out of your way.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Ship the release<br />☐ &nbsp;Write the changelog</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — Settle in <span class="vm-motif">**</span></div>
      <h2>Day paper, night ink.</h2>
      <p class="vm-lead">
        Two carefully tuned themes with a keystroke between them, remembered across
        sessions. The frameless window and menus follow along.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Focus when you need it</strong>
          <span>Dim everything but the sentence you are writing; the typewriter mode keeps it locked to the centre line.</span>
        </li>
        <li>
          <strong>Keyboard throughout</strong>
          <span>Commands, folding, quick open and formatting are all a shortcut away — see the key binding reference.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark dark theme" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark light theme" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Distraction-free modes</h3>
      <p>Focus dims the page to a single region; typewriter rides the caret line. Turn either on mid-sentence.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark focus mode" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>Done? Ship it.</h3>
      <p>Print-grade PDF and self-contained HTML — selection-only export included. The .md on disk never changes.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark rendered diagram and table" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Begin <span class="vm-motif">▮</span></div>
  <h2>Download it. Open a file.</h2>
  <p>Free, local-first and open source. Every desktop you write on.</p>
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
  <p style="font-size:13px">Checksums in <code>SHA256SUMS.txt</code> · Auto-update on Windows &amp; Linux</p>
</div>
