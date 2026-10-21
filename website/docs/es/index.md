---
layout: home

title: VeloxMark
titleTemplate: Un editor de Markdown con vista previa en vivo
description: VeloxMark es un editor de Markdown gratuito y de código abierto con vista previa en vivo para macOS, Windows y Linux. Matemáticas KaTeX, diagramas Mermaid y tablas nativas — todo renderizado en vivo, todo en archivos .md planos.
keywords: [editor de markdown, vista previa en vivo, markdown WYSIWYG, editor de código abierto, KaTeX, diagramas Mermaid, alternativa a Typora, editor Markdown macOS, editor Markdown Windows, editor Markdown Linux]

hero:
  name: VeloxMark
  text: Escribe en Markdown. Todo lo demás es decoración.
  tagline: Un escritorio de escritura con vista previa en vivo para macOS, Windows y Linux — archivos de texto plano entran, documentos preciosos salen.
  image:
    src: /img/hero-light.png
    alt: Editor de VeloxMark con vista previa en vivo
  actions:
    - theme: brand
      text: Descargar gratis
      link: /es/download
    - theme: alt
      text: Leer la documentación
      link: /es/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Plataformas de escritorio</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">Idiomas de interfaz</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Gratis y de código abierto</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Cuentas necesarias</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Escribir <span class="vm-motif">▮</span></div>
    <h2>Tus palabras, no tu marcado.</h2>
    <p class="vm-lead">
      VeloxMark renderiza cada línea en el instante en que la dejas — los títulos, el énfasis
      y el código adoptan su forma final mientras el archivo sigue siendo Markdown plano por
      debajo. La línea que estás editando conserva su fuente, así que siempre sabes qué
      estás escribiendo.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Los marcadores se apartan</strong>
          <span>Las almohadillas, los asteriscos y las comillas invertidas se desvanecen cuando el cursor sigue adelante — y vuelven exactamente a su sitio cuando regresas.</span>
        </li>
        <li>
          <strong>Haz clic en cualquier bloque para editarlo</strong>
          <span>El código, las fórmulas, los diagramas y las tablas son componentes en vivo. Un clic recupera el código fuente entre vallas que hay debajo.</span>
        </li>
        <li>
          <strong>Pega como un humano</strong>
          <span>El texto enriquecido se convierte en Markdown limpio y las URL desnudas pasan a ser enlaces — automáticamente, y solo cuando tú quieres.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="Vista previa en vivo de VeloxMark con la línea del cursor en forma de código fuente" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Renderizar <span class="vm-motif">##</span></div>
    <h2>Escritura técnica, renderizada sobre la marcha.</h2>
    <p class="vm-lead">
      CommonMark y GFM, más las construcciones que un documento de trabajo realmente
      necesita — fórmulas, diagramas, notas destacadas, notas al pie y resaltado.
      Todo en vivo.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Tablas que puedes tocar</h3>
      <p>Editores de celda reales, anchos de columna arrastrables y alineación por columna — entran caracteres de tubería, sale una cuadrícula funcional.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>Función</th><th>Estado</th></tr>
            <tr><td>Vista previa en vivo</td><td>✓</td></tr>
            <tr><td>Editores de celda</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>Matemáticas y LaTeX</h3>
      <p>Fórmulas KaTeX en línea y de bloque, compuestas en el lugar. Haz clic en una fórmula para llegar a su fuente.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Diagramas</h3>
      <p>Diagramas de flujo y grafos Mermaid renderizados en el lugar, con exportación a SVG o PNG cuando los necesitas en otro sitio.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">Escribir</span><span class="arrow">→</span>
          <span class="node">Previsualizar</span><span class="arrow">→</span>
          <span class="node">Publicar</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>Bloques de código</h3>
      <p>Resaltado para cientos de lenguajes, números de línea opcionales, ajuste de línea y plegado de bloques largos.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Notas al pie y notas destacadas</h3>
      <p>Notas al pie que se renumeran solas, ocho tipos de notas destacadas y texto <code>==resaltado==</code>.</p>
      <div class="vm-demo">
        <div class="fnote">Las notas al pie<sup>1</sup> saltan a su definición. <sup>1</sup>: Como esta.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Listas de tareas</h3>
      <p>Casillas en las que puedes hacer clic — la sintaxis de corchetes se queda en el archivo, sin estorbarte.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Publicar la versión<br />☐ &nbsp;Escribir el registro de cambios</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — Acomodarse <span class="vm-motif">**</span></div>
      <h2>Papel de día, tinta de noche.</h2>
      <p class="vm-lead">
        Dos temas cuidadosamente ajustados con una pulsación entre ellos, recordados
        entre sesiones. La ventana sin marco y los menús los siguen.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Enfócate cuando lo necesites</strong>
          <span>Atenúa todo salvo la frase que estás escribiendo; el modo de máquina de escribir la mantiene fija en la línea central.</span>
        </li>
        <li>
          <strong>Teclado para todo</strong>
          <span>Comandos, plegado, apertura rápida y formato están a un atajo de distancia — consulta la referencia de atajos de teclado.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="Tema oscuro de VeloxMark" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="Tema claro de VeloxMark" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Modos sin distracciones</h3>
      <p>El modo de enfoque atenúa la página hasta una sola región; el modo de máquina de escribir sigue la línea del cursor. Activa cualquiera de los dos a mitad de frase.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="Modo de enfoque de VeloxMark" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>¿Listo? Publícalo.</h3>
      <p>PDF de calidad de impresión y HTML autónomo — con exportación solo de la selección incluida. El .md del disco nunca cambia.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="Diagrama y tabla renderizados en VeloxMark" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Empezar <span class="vm-motif">▮</span></div>
  <h2>Descárgalo. Abre un archivo.</h2>
  <p>Gratis, local primero y de código abierto. En cada escritorio donde escribas.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/es/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon e Intel</span></span>
    </a>
    <a class="vm-plat" href="/es/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 y ARM64</span></span>
    </a>
    <a class="vm-plat" href="/es/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Sumas de verificación en <code>SHA256SUMS.txt</code> · Actualización automática en Windows y Linux</p>
</div>
