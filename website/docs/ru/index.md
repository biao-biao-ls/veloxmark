---
layout: home

title: VeloxMark
titleTemplate: Markdown-редактор с живым предпросмотром
description: VeloxMark — бесплатный Markdown-редактор с открытым исходным кодом и живым предпросмотром для macOS, Windows и Linux. Формулы KaTeX, диаграммы Mermaid и нативные таблицы — всё рендерится вживую, всё хранится в обычных .md-файлах.
keywords: [markdown редактор, живой предпросмотр, WYSIWYG markdown, редактор с открытым кодом, KaTeX, диаграммы Mermaid, альтернатива Typora, Markdown-редактор macOS, Markdown-редактор Windows, Markdown-редактор Linux]

hero:
  name: VeloxMark
  text: Пишите на Markdown. Всё остальное — лишь оформление.
  tagline: Письменный стол с живым предпросмотром для macOS, Windows и Linux — на входе обычные текстовые файлы, на выходе красивые документы.
  image:
    src: /img/hero-light.png
    alt: Редактор VeloxMark с живым предпросмотром
  actions:
    - theme: brand
      text: Скачать бесплатно
      link: /ru/download
    - theme: alt
      text: Читать документацию
      link: /ru/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">Настольные платформы</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">Языки интерфейса</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">Бесплатно и с открытым кодом</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">Требуется аккаунтов</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — Писать <span class="vm-motif">▮</span></div>
    <h2>Ваши слова, а не ваша разметка.</h2>
    <p class="vm-lead">
      VeloxMark рендерит каждую строку в момент, когда вы её покидаете, — заголовки,
      выделения и код обретают окончательный вид, а файл остаётся обычным Markdown.
      Строка, которую вы редактируете, сохраняет исходный текст, поэтому вы всегда
      знаете, что именно печатаете.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>Маркеры отступают</strong>
          <span>Решётки, звёздочки и обратные кавычки блекнут, когда курсор уходит, — и возвращаются ровно на своё место, когда вы возвращаетесь.</span>
        </li>
        <li>
          <strong>Щёлкните по любому блоку, чтобы отредактировать его</strong>
          <span>Код, формулы, диаграммы и таблицы — живые виджеты. Один щелчок — и под ними снова появляется исходный код в рамках.</span>
        </li>
        <li>
          <strong>Вставляйте по-человечески</strong>
          <span>Богатый текст превращается в аккуратный Markdown, а голые URL становятся ссылками, — автоматически и только когда вы этого хотите.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="Живой предпросмотр VeloxMark: строка с курсором остаётся в исходной форме" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — Рендерить <span class="vm-motif">##</span></div>
    <h2>Технические тексты, оформленные на ходу.</h2>
    <p class="vm-lead">
      CommonMark и GFM, плюс конструкции, которые действительно нужны рабочему
      документу, — формулы, диаграммы, выноски, сноски и подсветка. Всё вживую.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>Таблицы, к которым можно прикоснуться</h3>
      <p>Настоящие редакторы ячеек, перетаскиваемая ширина столбцов и выравнивание по столбцам, — на входе вертикальные черты, на выходе рабочая сетка.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>Возможность</th><th>Статус</th></tr>
            <tr><td>Живой предпросмотр</td><td>✓</td></tr>
            <tr><td>Редакторы ячеек</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>Математика и LaTeX</h3>
      <p>Внутристрочные и блочные формулы KaTeX, набранные на месте. Щёлкните по формуле, чтобы добраться до её исходного кода.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>Диаграммы</h3>
      <p>Блок-схемы и графы Mermaid рендерятся на месте, а при необходимости экспортируются в SVG или PNG.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">Написание</span><span class="arrow">→</span>
          <span class="node">Предпросмотр</span><span class="arrow">→</span>
          <span class="node">Публикация</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>Блоки кода</h3>
      <p>Подсветка для сотен языков, необязательные номера строк, мягкий перенос и свёртка длинных блоков.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>Сноски и выноски</h3>
      <p>Сноски, которые перенумеровываются сами, восемь типов выносок и текст с <code>==подсветкой==</code>.</p>
      <div class="vm-demo">
        <div class="fnote">Сноски<sup>1</sup> ведут к своему определению. <sup>1</sup>: Как эта.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>Списки задач</h3>
      <p>Флажки, которые можно щёлкнуть, — синтаксис скобок остаётся в файле и не мешает вам.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;Выпустить релиз<br />☐ &nbsp;Написать журнал изменений</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — Устроиться <span class="vm-motif">**</span></div>
      <h2>Днём — бумага, ночью — чернила.</h2>
      <p class="vm-lead">
        Две тщательно настроенные темы, переключаемые одним нажатием и запоминаемые
        между сессиями. Безрамочное окно и меню следуют за ними.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>Фокус, когда он нужен</strong>
          <span>Затемните всё, кроме предложения, которое вы пишете; режим печатной машинки удерживает его на центральной линии.</span>
        </li>
        <li>
          <strong>Клавиатура — везде</strong>
          <span>Команды, свёртка, быстрое открытие и форматирование — всё в одном нажатии; см. справочник горячих клавиш.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="Тёмная тема VeloxMark" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="Светлая тема VeloxMark" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>Режимы без отвлечений</h3>
      <p>Фокус сужает страницу до одной области; печатная машинка следует за строкой курсора. Включайте прямо посреди фразы.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="Режим фокуса VeloxMark" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>Готово? Отправляйте.</h3>
      <p>PDF печатного качества и самодостаточный HTML — включая экспорт только выделения. Файл .md на диске никогда не меняется.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="Отрендеренные диаграмма и таблица VeloxMark" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — Начать <span class="vm-motif">▮</span></div>
  <h2>Скачайте. Откройте файл.</h2>
  <p>Бесплатно, локально и с открытым исходным кодом. На любом настольном компьютере, где вы пишете.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/ru/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon и Intel</span></span>
    </a>
    <a class="vm-plat" href="/ru/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 и ARM64</span></span>
    </a>
    <a class="vm-plat" href="/ru/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px">Контрольные суммы в <code>SHA256SUMS.txt</code> · Автообновление в Windows и Linux</p>
</div>
