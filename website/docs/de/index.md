---
layout: home

title: VeloxMark
titleTemplate: Ein Markdown-Editor mit Live-Vorschau
description: VeloxMark ist ein kostenloser, quelloffener Markdown-Editor mit Live-Vorschau für macOS, Windows und Linux. KaTeX-Formeln, Mermaid-Diagramme und native Tabellen — alles live gerendert, alles in reinen .md-Dateien.
keywords: [Markdown-Editor, Live-Vorschau, WYSIWYG Markdown, quelloffener Editor, KaTeX, Mermaid-Diagramme, Typora-Alternative, Markdown-Editor macOS, Markdown-Editor Windows, Markdown-Editor Linux]

hero:
  name: VeloxMark
  text: Schreibe in Markdown. Alles andere ist Dekoration.
  tagline: Eine Schreibumgebung mit Live-Vorschau für macOS, Windows und Linux — Klartextdateien hinein, schöne Dokumente heraus.
  image:
    src: /img/hero-light.png
    alt: VeloxMark Live-Vorschau-Editor
  actions:
    - theme: brand
      text: Kostenlos herunterladen
      link: /de/download
    - theme: alt
      text: Dokumentation lesen
      link: /de/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Desktop-Plattformen</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">Oberflächensprachen</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Frei &amp; quelloffen</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Konten erforderlich</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Schreiben <span class="vm-motif">▮</span></div>
    <h2>Deine Worte, nicht deine Auszeichnung.</h2>
    <p class="vm-lead">
      VeloxMark rendert jede Zeile, sobald du sie verlässt — Überschriften, Hervorhebungen und Code
      nehmen ihre endgültige Form an, während die Datei darunter reines Markdown bleibt. Die Zeile,
      die du gerade bearbeitest, behält ihre Quellform — du weißt also immer genau, was du tippst.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Marker treten beiseite</strong>
          <span>Rauten, Sterne und Backticks verblassen, sobald der Cursor weiterzieht — und erscheinen wieder genau dort, wo sie hingehören, wenn du zurückkommst.</span>
        </li>
        <li>
          <strong>Klicke einen beliebigen Block an, um ihn zu bearbeiten</strong>
          <span>Code, Formeln, Diagramme und Tabellen sind lebendige Widgets. Ein Klick holt die umschlossene Quelle darunter zurück.</span>
        </li>
        <li>
          <strong>Einfügen wie ein Mensch</strong>
          <span>Rich Text wird zu sauberem Markdown und nackte URLs werden zu Links — automatisch, und nur wenn du es willst.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="VeloxMark Live-Vorschau mit der Cursorzeile in Quellform" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Rendern <span class="vm-motif">##</span></div>
    <h2>Technisches Schreiben, live gerendert.</h2>
    <p class="vm-lead">
      CommonMark und GFM, dazu die Konstrukte, die ein Arbeitsdokument wirklich braucht —
      Formeln, Diagramme, Callouts, Fußnoten und Hervorhebungen. Alles live.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Tabellen, die man anfassen kann</h3>
      <p>Echte Zelleneditoren, ziehbare Spaltenbreiten und Ausrichtung je Spalte — Pipe-Zeichen hinein, ein funktionierendes Raster heraus.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>Funktion</th><th>Status</th></tr>
            <tr><td>Live-Vorschau</td><td>✓</td></tr>
            <tr><td>Zelleneditoren</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>Mathematik &amp; LaTeX</h3>
      <p>KaTeX-Formeln inline und als Block, direkt gesetzt. Klicke eine Formel an, um zu ihrer Quelle zu gelangen.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Diagramme</h3>
      <p>Mermaid-Flussdiagramme und Graphen direkt gerendert, bei Bedarf mit Export als SVG oder PNG.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">Schreiben</span><span class="arrow">→</span>
          <span class="node">Vorschau</span><span class="arrow">→</span>
          <span class="node">Veröffentlichen</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>Codeblöcke</h3>
      <p>Hervorhebung für hunderte Sprachen, optionale Zeilennummern, weiche Umbrüche und Einklappen langer Blöcke.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Fußnoten &amp; Callouts</h3>
      <p>Fußnoten, die sich selbst neu nummerieren, acht Callout-Varianten und <code>==hervorgehobener==</code> Text.</p>
      <div class="vm-demo">
        <div class="fnote">Fußnoten<sup>1</sup> springen zu ihrer Definition. <sup>1</sup>: Wie diese hier.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Aufgabenlisten</h3>
      <p>Anklickbare Kontrollkästchen — die Klammern-Syntax bleibt in der Datei und steht dir nicht im Weg.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Release veröffentlichen<br />☐ &nbsp;Changelog schreiben</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — Ankommen <span class="vm-motif">**</span></div>
      <h2>Tags Papier, nachts Tinte.</h2>
      <p class="vm-lead">
        Zwei sorgfältig abgestimmte Themes mit einem Tastendruck dazwischen, gemerkt über
        Sitzungen hinweg. Das rahmenlose Fenster und die Menüs ziehen mit.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Fokus, wenn du ihn brauchst</strong>
          <span>Alles außer dem Satz, den du schreibst, tritt zurück; der Schreibmaschinenmodus hält ihn auf der Mittellinie.</span>
        </li>
        <li>
          <strong>Durchgehend mit der Tastatur</strong>
          <span>Befehle, Einklappen, Schnellöffnen und Formatierung sind alle nur ein Tastenkürzel entfernt — siehe die Tastenkürzel-Referenz.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark dunkles Theme" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark helles Theme" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Modi ohne Ablenkung</h3>
      <p>Fokusmodus dimmt die Seite auf eine einzelne Region herunter; der Schreibmaschinenmodus folgt der Cursorzeile. Beides lässt sich mitten im Satz einschalten.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark Fokusmodus" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>Fertig? Raus damit.</h3>
      <p>Drucktaugliches PDF und eigenständiges HTML — inklusive Export nur der Auswahl. Die .md auf der Platte ändert sich nie.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark gerendertes Diagramm und Tabelle" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Loslegen <span class="vm-motif">▮</span></div>
  <h2>Lade es herunter. Öffne eine Datei.</h2>
  <p>Frei, lokal zuerst und quelloffen. Auf jedem Desktop, an dem du schreibst.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/de/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon &amp; Intel</span></span>
    </a>
    <a class="vm-plat" href="/de/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 &amp; ARM64</span></span>
    </a>
    <a class="vm-plat" href="/de/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Prüfsummen in <code>SHA256SUMS.txt</code> · Auto-Update unter Windows &amp; Linux</p>
</div>
