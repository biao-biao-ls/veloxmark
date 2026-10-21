---
layout: home

title: VeloxMark
titleTemplate: ライブプレビュー付き Markdown エディター
description: VeloxMark は macOS・Windows・Linux 向けの無料オープンソース Markdown エディター。KaTeX 数式、Mermaid 図表、ネイティブなテーブル——すべてライブで描画、すべて純粋な .md ファイルに。
keywords: [markdown エディター, ライブプレビュー, WYSIWYG markdown, オープンソースエディター, KaTeX, Mermaid 図表, Typora 代替, Mac Markdown エディター, Windows Markdown エディター, Linux Markdown エディター]

hero:
  name: VeloxMark
  text: Markdown で書く。それ以外はすべて装飾。
  tagline: macOS・Windows・Linux 向けのライブプレビュー執筆デスク——プレーンテキストを入れて、美しいドキュメントを取り出す。
  image:
    src: /img/hero-light.png
    alt: VeloxMark ライブプレビュー・エディター
  actions:
    - theme: brand
      text: 無料でダウンロード
      link: /ja/download
    - theme: alt
      text: ドキュメントを読む
      link: /ja/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">デスクトッププラットフォーム</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">UI 言語</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">無料＆オープンソース</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">アカウント不要</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — 書く <span class="vm-motif">▮</span></div>
    <h2>あなたの言葉であって、マークアップではない。</h2>
    <p class="vm-lead">
      VeloxMark は、行から離れた瞬間にそれを描画します——見出し、強調、コードが
      最終的な形になり、ファイルの下では常にプレーンな Markdown のまま。
      編集中の行はソースを保つので、自分が何を打っているか常にわかります。
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>マークは自動的に退く</strong>
          <span>シャープ、アスタリスク、バッククォートはカーソルが動くと薄れ——戻れば元の場所に正確に現れます。</span>
        </li>
        <li>
          <strong>ブロックをクリックして編集</strong>
          <span>コード、数式、図表、テーブルはライブウィジェット。ワンクリックで下のフェンス済みソースが戻ります。</span>
        </li>
        <li>
          <strong>人間のように貼り付ける</strong>
          <span>リッチテキストはクリーンな Markdown になり、裸の URL はリンクになります——自動で、しかも必要なときだけ。</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="VeloxMark ライブプレビュー、カーソル行がソース形式のまま" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — 描画 <span class="vm-motif">##</span></div>
    <h2>技術文書を、書きながら描画する。</h2>
    <p class="vm-lead">
      CommonMark と GFM、そして実用的なドキュメントに本当に必要な構造——
      数式、図表、コールアウト、脚注、ハイライト。すべてライブで。
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>触れるテーブル</h3>
      <p>実際のセルエディター、ドラッグで変えられる列幅、列ごとの配置——パイプ文字を入れて、使えるグリッドを取り出す。</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>機能</th><th>状態</th></tr>
            <tr><td>ライブプレビュー</td><td>✓</td></tr>
            <tr><td>セル編集</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>数式と LaTeX</h3>
      <p>KaTeX のインライン／ブロック数式をその場で組版。数式をクリックするとソースへ。</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>図表</h3>
      <p>Mermaid のフローチャートとグラフをその場で描画。必要なときは SVG か PNG に書き出せます。</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">書く</span><span class="arrow">→</span>
          <span class="node">プレビュー</span><span class="arrow">→</span>
          <span class="node">公開</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>コードブロック</h3>
      <p>数百の言語のシンタックスハイライト、任意の行番号、ソフト折り返し、長いブロックの折りたたみ。</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>脚注とコールアウト</h3>
      <p>自動で振り直される脚注、8 種類のコールアウト、そして <code>==ハイライト==</code> テキスト。</p>
      <div class="vm-demo">
        <div class="fnote">脚注<sup>1</sup>は定義へジャンプします。<sup>1</sup>：この脚注のように。</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>タスクリスト</h3>
      <p>クリックできるチェックボックス——ブラケット構文はファイルに残り、邪魔になりません。</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;新しいバージョンを公開<br />☐ &nbsp;更新履歴を書く</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — 没頭 <span class="vm-motif">**</span></div>
      <h2>昼は紙、夜は墨。</h2>
      <p class="vm-lead">
        丁寧に調整された 2 つのテーマをキーひとつで切り替え、セッションをまたいで記憶。
        フレームレスウィンドウもメニューも追従します。
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>必要なときにフォーカス</strong>
          <span>書いている一文以外をすべて暗くする。タイプライターモードなら中央の行に固定。</span>
        </li>
        <li>
          <strong>キーボードで完結</strong>
          <span>コマンド、折りたたみ、クイックオープン、書式設定まで、すべてショートカットで——キーバインド参照をどうぞ。</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark ダークテーマ" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark ライトテーマ" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>集中を妨げないモード</h3>
      <p>フォーカスモードはページをひとつの領域に絞り、タイプライターモードはカーソル行を追います。文の途中でもオンにできます。</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark フォーカスモード" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>書き終えたら、送り出そう。</h3>
      <p>印刷品質の PDF と自己完結型 HTML——選択範囲のみの書き出しにも対応。ディスク上の .md は決して変わりません。</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark が描画した図表とテーブル" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — 始める <span class="vm-motif">▮</span></div>
  <h2>ダウンロードして、ファイルを開こう。</h2>
  <p>無料、ローカルファースト、オープンソース。どんなデスクトップでも書けます。</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/ja/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon と Intel</span></span>
    </a>
    <a class="vm-plat" href="/ja/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 と ARM64</span></span>
    </a>
    <a class="vm-plat" href="/ja/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px"><code>SHA256SUMS.txt</code> チェックサム付き · Windows と Linux で自動更新</p>
</div>
