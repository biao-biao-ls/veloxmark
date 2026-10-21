---
layout: home

title: VeloxMark
titleTemplate: 实时预览的 Markdown 编辑器
description: VeloxMark 是一款免费开源的 Markdown 编辑器，支持 macOS、Windows 和 Linux。KaTeX 公式、Mermaid 图表、原生表格——全部实时渲染，全部存为纯 .md 文件。
keywords: [markdown 编辑器, 实时预览, 所见即所得, 开源编辑器, KaTeX, Mermaid 图表, Typora 替代品, Mac Markdown 编辑器, Windows Markdown 编辑器, Linux Markdown 编辑器]

hero:
  name: VeloxMark
  text: 用 Markdown 写作，其余皆是装饰。
  tagline: 面向 macOS、Windows 与 Linux 的实时预览写作台——纯文本文件进，精美文档出。
  image:
    src: /img/hero-light.png
    alt: VeloxMark 实时预览编辑器
  actions:
    - theme: brand
      text: 免费下载
      link: /zh/download
    - theme: alt
      text: 阅读文档
      link: /zh/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">桌面平台</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">界面语言</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">免费开源</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">账户要求</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — 写作 <span class="vm-motif">▮</span></div>
    <h2>是你的文字，不是标记。</h2>
    <p class="vm-lead">
      VeloxMark 在你离开每一行的瞬间将其渲染成型——标题、强调与代码呈现最终样式，
      而文件始终是纯 Markdown。你正在编辑的那一行保留源码，永远清楚自己在写什么。
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>标记自动隐退</strong>
          <span>井号、星号与反引号在光标移开后淡出——回来时又原样浮现。</span>
        </li>
        <li>
          <strong>点击任意块即可编辑</strong>
          <span>代码、公式、图表与表格都是实时组件。点一下就找回底下的围栏源码。</span>
        </li>
        <li>
          <strong>像人一样粘贴</strong>
          <span>富文本转成干净的 Markdown，裸链接自动成为链接——自动完成，且只在你需要时。</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="VeloxMark 实时预览，光标行保持源码形式" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — 渲染 <span class="vm-motif">##</span></div>
    <h2>技术写作，落笔即成型。</h2>
    <p class="vm-lead">
      CommonMark 与 GFM，外加实用文档真正需要的构造——
      公式、图表、提示块、脚注与高亮。全部实时呈现。
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>可触摸的表格</h3>
      <p>真实的单元格编辑器、可拖拽列宽与逐列对齐——管道符进，可用的网格出。</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>功能</th><th>状态</th></tr>
            <tr><td>实时预览</td><td>✓</td></tr>
            <tr><td>单元格编辑</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>数学公式与 LaTeX</h3>
      <p>KaTeX 行内与块级公式，就地排版。点击公式即可编辑源码。</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>图表</h3>
      <p>Mermaid 流程图与图表就地渲染，需要时可导出 SVG 或 PNG。</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">写作</span><span class="arrow">→</span>
          <span class="node">预览</span><span class="arrow">→</span>
          <span class="node">发布</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>代码块</h3>
      <p>数百种语言的语法高亮，可选行号、软换行与长块折叠。</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>脚注与提示块</h3>
      <p>自动重编号的脚注、八种提示块样式，以及 <code>==高亮==</code> 文本。</p>
      <div class="vm-demo">
        <div class="fnote">脚注<sup>1</sup>跳转到定义处。<sup>1</sup>：就像这条。</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>任务列表</h3>
      <p>可点击的复选框——括号语法留在文件里，不挡你的路。</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;发布新版本<br />☐ &nbsp;撰写更新日志</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — 沉浸 <span class="vm-motif">**</span></div>
      <h2>日间纸白，夜间墨色。</h2>
      <p class="vm-lead">
        两套精心调校的主题，一键切换，跨会话记忆。
        无边框窗口与菜单随之变色。
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>需要时进入专注</strong>
          <span>让正在写的那一句之外的一切暗下去；打字机模式将其锁定在中线。</span>
        </li>
        <li>
          <strong>全程键盘可达</strong>
          <span>命令、折叠、快速打开与格式化都有快捷键——详见快捷键参考。</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark 暗色主题" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark 亮色主题" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>免打扰模式</h3>
      <p>专注模式将页面收束为一个区域；打字机模式紧随光标行。写到一半也能开启。</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark 专注模式" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>写完了？发出去。</h3>
      <p>印刷级 PDF 与自包含 HTML——支持仅选区导出。磁盘上的 .md 永远不变。</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark 渲染的图表与表格" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — 开始 <span class="vm-motif">▮</span></div>
  <h2>下载它，打开一个文件。</h2>
  <p>免费、本地优先、开源。你在哪台桌面写作都行。</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/zh/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon 与 Intel</span></span>
    </a>
    <a class="vm-plat" href="/zh/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 与 ARM64</span></span>
    </a>
    <a class="vm-plat" href="/zh/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">附 <code>SHA256SUMS.txt</code> 校验文件 · Windows 与 Linux 支持自动更新</p>
</div>
