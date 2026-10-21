---
layout: home

title: VeloxMark
titleTemplate: Um editor de Markdown com pré-visualização em tempo real
description: VeloxMark é um editor de Markdown gratuito e de código aberto, com pré-visualização em tempo real, para macOS, Windows e Linux. Matemática KaTeX, diagramas Mermaid e tabelas nativas — tudo renderizado em tempo real, tudo em arquivos .md puros.
keywords: [editor de markdown, pré-visualização em tempo real, markdown WYSIWYG, editor de código aberto, KaTeX, diagramas Mermaid, alternativa ao Typora, editor de Markdown macOS, editor de Markdown Windows, editor de Markdown Linux]

hero:
  name: VeloxMark
  text: Escreva em Markdown. Todo o resto é decoração.
  tagline: Uma mesa de escrita com pré-visualização em tempo real para macOS, Windows e Linux — entram arquivos de texto simples, saem documentos bonitos.
  image:
    src: /img/hero-light.png
    alt: Editor VeloxMark com pré-visualização em tempo real
  actions:
    - theme: brand
      text: Transferir gratuitamente
      link: /pt/download
    - theme: alt
      text: Ler a documentação
      link: /pt/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Plataformas de desktop</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">Idiomas de interface</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Gratuito e de código aberto</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Contas necessárias</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Escrever <span class="vm-motif">▮</span></div>
    <h2>Suas palavras, não a sua marcação.</h2>
    <p class="vm-lead">
      VeloxMark renderiza cada linha no momento em que você a abandona — títulos, ênfases e código
      assumem a sua forma final, enquanto o arquivo continua a ser Markdown simples por baixo. A linha
      que está editando mantém o seu código-fonte, para que saiba sempre o que está escrevendo.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Os marcadores saem de cena</strong>
          <span>Cerquilhas, asteriscos e crases desaparecem quando o cursor segue em frente — e voltam exatamente ao lugar certo quando você retorna.</span>
        </li>
        <li>
          <strong>Clique em qualquer bloco para editá-lo</strong>
          <span>Código, fórmulas, diagramas e tabelas são componentes ativos. Um clique recupera o código-fonte delimitado por baixo.</span>
        </li>
        <li>
          <strong>Cole como um ser humano</strong>
          <span>Texto rico vira Markdown limpo e URLs isoladas viram links — automaticamente, e só quando você quiser.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="VeloxMark com pré-visualização em tempo real e a linha do cursor em forma de código-fonte" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Renderizar <span class="vm-motif">##</span></div>
    <h2>Escrita técnica, renderizada enquanto você escreve.</h2>
    <p class="vm-lead">
      CommonMark e GFM, mais os construtos de que um documento de trabalho realmente precisa —
      fórmulas, diagramas, alertas, notas de rodapé e destaques. Tudo em tempo real.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Tabelas que você pode tocar</h3>
      <p>Editores de célula reais, larguras de coluna arrastáveis e alinhamento por coluna — entram caracteres de barra vertical, sai uma grade funcional.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>Função</th><th>Estado</th></tr>
            <tr><td>Pré-visualização em tempo real</td><td>✓</td></tr>
            <tr><td>Editores de célula</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>Matemática e LaTeX</h3>
      <p>KaTeX em linha e em bloco, tipografado no local. Clique numa fórmula para chegar ao seu código-fonte.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Diagramas</h3>
      <p>Fluxogramas e gráficos Mermaid renderizados no local, com exportação para SVG ou PNG quando precisar deles noutro sítio.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">Escrever</span><span class="arrow">→</span>
          <span class="node">Pré-visualizar</span><span class="arrow">→</span>
          <span class="node">Publicar</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>Blocos de código</h3>
      <p>Realce para centenas de linguagens, números de linha opcionais, quebra suave e colapso de blocos longos.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Notas de rodapé e alertas</h3>
      <p>Notas de rodapé que se renumeram, oito sabores de alerta e texto <code>==destacado==</code>.</p>
      <div class="vm-demo">
        <div class="fnote">As notas de rodapé<sup>1</sup> saltam para a definição. <sup>1</sup>: Como esta.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Listas de tarefas</h3>
      <p>Caixas de seleção clicáveis — a sintaxe de colchetes fica no arquivo, fora do seu caminho.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Publicar a versão<br />☐ &nbsp;Escrever o registro de alterações</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — Acomodar-se <span class="vm-motif">**</span></div>
      <h2>Papel de dia, tinta de noite.</h2>
      <p class="vm-lead">
        Dois temas cuidadosamente afinados, com uma tecla entre eles, lembrados entre
        sessões. A janela sem moldura e os menus acompanham.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Foco quando você precisa</strong>
          <span>Escurece tudo, exceto a frase que está escrevendo; o modo máquina de escrever mantém a linha do cursor presa à linha central.</span>
        </li>
        <li>
          <strong>Tudo pelo teclado</strong>
          <span>Comandos, dobras, abertura rápida e formatação estão a um atalho de distância — consulte a referência de atalhos de teclado.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark com tema escuro" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark com tema claro" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Modos sem distrações</h3>
      <p>O modo de foco reduz a página a uma única região; o modo máquina de escrever segue a linha do cursor. Ative qualquer um no meio da frase.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark em modo de foco" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>Pronto? Publique.</h3>
      <p>PDF de qualidade de impressão e HTML autocontido — incluindo exportação apenas da seleção. O arquivo .md em disco nunca muda.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark com diagrama e tabela renderizados" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Começar <span class="vm-motif">▮</span></div>
  <h2>Transfira. Abra um arquivo.</h2>
  <p>Gratuito, com dados locais e de código aberto. Em qualquer desktop onde você escreva.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/pt/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon e Intel</span></span>
    </a>
    <a class="vm-plat" href="/pt/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 e ARM64</span></span>
    </a>
    <a class="vm-plat" href="/pt/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Checksums em <code>SHA256SUMS.txt</code> · Atualização automática em Windows e Linux</p>
</div>
