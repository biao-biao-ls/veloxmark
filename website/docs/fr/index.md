---
layout: home

title: VeloxMark
titleTemplate: Un éditeur Markdown avec aperçu en direct
description: VeloxMark est un éditeur Markdown gratuit et open source avec aperçu en direct pour macOS, Windows et Linux. Formules KaTeX, diagrammes Mermaid et tableaux natifs — tout est rendu en direct, tout en fichiers .md purs.
keywords: [éditeur markdown, aperçu en direct, markdown WYSIWYG, éditeur open source, KaTeX, diagrammes Mermaid, alternative à Typora, éditeur Markdown macOS, éditeur Markdown Windows, éditeur Markdown Linux]

hero:
  name: VeloxMark
  text: Écrivez en Markdown. Tout le reste est décor.
  tagline: Un bureau d'écriture avec aperçu en direct pour macOS, Windows et Linux — du texte brut à l'entrée, de beaux documents à la sortie.
  image:
    src: /img/hero-light.png
    alt: Éditeur VeloxMark avec aperçu en direct
  actions:
    - theme: brand
      text: Télécharger gratuitement
      link: /fr/download
    - theme: alt
      text: Lire la documentation
      link: /fr/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Plateformes de bureau</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">Langues d'interface</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Gratuit et open source</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Compte requis</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Écrire <span class="vm-motif">▮</span></div>
    <h2>Vos mots, pas vos balises.</h2>
    <p class="vm-lead">
      VeloxMark rend chaque ligne dès que vous la quittez — titres, emphase et code
      prennent leur forme finale tandis que le fichier reste du Markdown pur en dessous.
      La ligne en cours d'édition garde sa source : vous savez toujours ce que vous tapez.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Les marqueurs s'écartent</strong>
          <span>Dièses, astérisques et accents graves s'estompent quand le curseur repart — et réapparaissent exactement à leur place quand vous revenez.</span>
        </li>
        <li>
          <strong>Cliquez sur un bloc pour l'éditer</strong>
          <span>Code, formules, diagrammes et tableaux sont des composants vivants. Un clic fait réapparaître la source balisée en dessous.</span>
        </li>
        <li>
          <strong>Collez comme un humain</strong>
          <span>Le texte enrichi devient du Markdown propre et les URL nues deviennent des liens — automatiquement, et seulement quand vous le voulez.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="Aperçu en direct VeloxMark avec la ligne du curseur en forme source" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Rendre <span class="vm-motif">##</span></div>
    <h2>L'écriture technique, rendue au fil de la frappe.</h2>
    <p class="vm-lead">
      CommonMark et GFM, plus les constructions dont un document de travail a
      réellement besoin — formules, diagrammes, encadrés, notes de bas de page
      et surlignages. Tout cela en direct.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Des tableaux à portée de main</h3>
      <p>De vrais éditeurs de cellules, des largeurs de colonnes déplaçables et un alignement par colonne — des caractères pipe à l'entrée, une grille utilisable à la sortie.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>Fonctionnalité</th><th>État</th></tr>
            <tr><td>Aperçu en direct</td><td>✓</td></tr>
            <tr><td>Éditeurs de cellules</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>Maths et LaTeX</h3>
      <p>Formules KaTeX en ligne et en bloc, composées sur place. Cliquez sur une formule pour atteindre sa source.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Diagrammes</h3>
      <p>Diagrammes de flux et graphiques Mermaid rendus sur place, avec export SVG ou PNG pour les utiliser ailleurs.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">Écrire</span><span class="arrow">→</span>
          <span class="node">Aperçu</span><span class="arrow">→</span>
          <span class="node">Publier</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>Blocs de code</h3>
      <p>Coloration syntaxique pour des centaines de langages, numéros de ligne optionnels, retour à la ligne doux et pliage des blocs longs.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Notes de bas de page et encadrés</h3>
      <p>Des notes de bas de page qui se renumérotent, huit styles d'encadrés, et du texte <code>==surligné==</code>.</p>
      <div class="vm-demo">
        <div class="fnote">Les notes<sup>1</sup> sautent vers leur définition. <sup>1</sup> : Comme celle-ci.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Listes de tâches</h3>
      <p>Des cases à cocher cliquables — la syntaxe entre crochets reste dans le fichier, hors de votre chemin.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Publier la version<br />☐ &nbsp;Rédiger les notes de version</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — S'installer <span class="vm-motif">**</span></div>
      <h2>Papier le jour, encre la nuit.</h2>
      <p class="vm-lead">
        Deux thèmes soigneusement réglés, séparés par une frappe de touche,
        mémorisés d'une session à l'autre. La fenêtre sans cadre et les menus suivent.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Concentrez-vous quand il le faut</strong>
          <span>Atténuez tout sauf la phrase en cours d'écriture ; le mode machine à écrire la verrouille sur la ligne centrale.</span>
        </li>
        <li>
          <strong>Le clavier partout</strong>
          <span>Commandes, pliage, ouverture rapide et mise en forme sont à un raccourci près — voir la référence des raccourcis clavier.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="Thème sombre VeloxMark" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="Thème clair VeloxMark" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Modes sans distraction</h3>
      <p>Le mode focus réduit la page à une seule région ; le mode machine à écrire suit la ligne du curseur. Activez l'un ou l'autre en pleine phrase.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="Mode focus VeloxMark" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>Terminé ? Publiez.</h3>
      <p>PDF de qualité d'impression et HTML autonome — export de la seule sélection inclus. Le .md sur disque ne change jamais.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="Diagramme et tableau rendus par VeloxMark" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Commencer <span class="vm-motif">▮</span></div>
  <h2>Téléchargez-le. Ouvrez un fichier.</h2>
  <p>Gratuit, local d'abord et open source. Sur chaque bureau où vous écrivez.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/fr/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon et Intel</span></span>
    </a>
    <a class="vm-plat" href="/fr/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 et ARM64</span></span>
    </a>
    <a class="vm-plat" href="/fr/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Sommes de contrôle dans <code>SHA256SUMS.txt</code> · Mise à jour automatique sur Windows et Linux</p>
</div>
