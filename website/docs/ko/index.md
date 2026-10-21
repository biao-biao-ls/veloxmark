---
layout: home

title: VeloxMark
titleTemplate: 실시간 미리보기를 갖춘 Markdown 편집기
description: VeloxMark는 macOS, Windows, Linux를 위한 무료 오픈 소스 Markdown 편집기입니다. KaTeX 수식, Mermaid 다이어그램, 네이티브 테이블 — 모두 실시간 렌더링, 모두 순수 .md 파일로 저장됩니다.
keywords: [markdown 편집기, 실시간 미리보기, WYSIWYG markdown, 오픈 소스 편집기, KaTeX, Mermaid 다이어그램, Typora 대안, Mac Markdown 편집기, Windows Markdown 편집기, Linux Markdown 편집기]

hero:
  name: VeloxMark
  text: Markdown으로 쓰세요. 나머지는 모두 장식입니다.
  tagline: macOS·Windows·Linux를 위한 실시간 미리보기 글쓰기 책상 — 순수 텍스트 파일이 들어가면 아름다운 문서가 나옵니다.
  image:
    src: /img/hero-light.png
    alt: VeloxMark 실시간 미리보기 편집기
  actions:
    - theme: brand
      text: 무료로 다운로드
      link: /ko/download
    - theme: alt
      text: 문서 읽기
      link: /ko/docs/
---

<div class="vm-stats vm-reveal">
  <div class="stat"><div class="num">3</div><div class="lbl">데스크톱 플랫폼</div></div>
  <div class="stat"><div class="num">9</div><div class="lbl">인터페이스 언어</div></div>
  <div class="stat"><div class="num">MIT</div><div class="lbl">무료 오픈 소스</div></div>
  <div class="stat"><div class="num">0</div><div class="lbl">계정 요구</div></div>
</div>

<div id="preview"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">01</span> — 쓰기 <span class="vm-motif">▮</span></div>
    <h2>당신의 말이지, 마크업이 아닙니다.</h2>
    <p class="vm-lead">
      VeloxMark는 각 줄을 떠나는 순간 렌더링합니다 — 제목, 강조와 코드는 최종 형태를 갖추고,
      파일은 그 아래에서 언제나 순수 Markdown으로 남습니다. 지금 편집 중인 줄은 소스를
      그대로 보여주므로, 무엇을 쓰고 있는지 항상 알 수 있습니다.
    </p>
  </div>

  <div class="vm-split vm-reveal">
    <div class="vm-split-text">
      <ul class="vm-feature-list">
        <li>
          <strong>마커는 자리를 비켜줍니다</strong>
          <span>해시, 별표, 백틱은 커서가 떠나면 사라지고 — 다시 돌아오면 제자리에 그대로 나타납니다.</span>
        </li>
        <li>
          <strong>블록을 클릭하면 편집됩니다</strong>
          <span>코드, 수식, 다이어그램과 테이블은 살아 있는 위젯입니다. 한 번 클릭하면 아래의 펜스 소스가 돌아옵니다.</span>
        </li>
        <li>
          <strong>사람처럼 붙여넣기</strong>
          <span>리치 텍스트는 깔끔한 Markdown이 되고, 짧은 URL은 링크가 됩니다 — 자동으로, 그리고 원할 때만.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media">
      <div class="vm-shot">
        <img src="/img/caret-source-line.png" alt="커서 줄이 소스 형태를 유지하는 VeloxMark 실시간 미리보기" />
      </div>
    </div>
  </div>
</section>

<div id="extensions"></div>

<section class="vm-section">
  <div class="vm-chapter-head vm-reveal">
    <div class="vm-chapter-label"><span class="vm-num">02</span> — 렌더링 <span class="vm-motif">##</span></div>
    <h2>기술적인 글도, 쓰는 대로 렌더링됩니다.</h2>
    <p class="vm-lead">
      CommonMark와 GFM, 그리고 실무 문서에 정말 필요한 구성 요소 —
      수식, 다이어그램, 콜아웃, 각주와 강조. 모두 실시간으로.
    </p>
  </div>

  <div class="vm-grid-3">
    <div class="vm-card vm-reveal">
      <div class="icon-chip">| cell |</div>
      <h3>만질 수 있는 테이블</h3>
      <p>진짜 셀 편집기, 드래그 가능한 열 너비와 열별 정렬 — 파이프 문자를 넣으면 작동하는 그리드가 나옵니다.</p>
      <div class="vm-demo">
        <table>
          <tbody>
            <tr><th>기능</th><th>상태</th></tr>
            <tr><td>실시간 미리보기</td><td>✓</td></tr>
            <tr><td>셀 편집기</td><td>✓</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">$...$</div>
      <h3>수식 &amp; LaTeX</h3>
      <p>KaTeX 인라인 및 디스플레이 수식을 제자리에서 조판합니다. 수식을 클릭하면 소스로 이동합니다.</p>
      <div class="vm-demo">
        <div class="katex-like">e<sup>iπ</sup> + 1 = 0</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">```mermaid</div>
      <h3>다이어그램</h3>
      <p>Mermaid 플로차트와 그래프를 제자리에서 렌더링하고, 필요할 때는 SVG 또는 PNG로 내보낼 수 있습니다.</p>
      <div class="vm-demo">
        <div class="flow">
          <span class="node">작성</span><span class="arrow">→</span>
          <span class="node">미리보기</span><span class="arrow">→</span>
          <span class="node">배포</span>
        </div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">{ }</div>
      <h3>코드 블록</h3>
      <p>수백 가지 언어의 구문 강조, 선택적 줄 번호, 소프트 랩과 긴 블록 접기.</p>
      <div class="vm-demo">
        <div class="code-line"><span class="tok-kw">function</span> <span class="tok-fn">greet</span>(name) {</div>
        <div class="code-line">&nbsp;&nbsp;<span class="tok-kw">return</span> <span class="tok-str">`Hello, ${name}!`</span></div>
        <div class="code-line">}</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">[^1]</div>
      <h3>각주 &amp; 콜아웃</h3>
      <p>스스로 번호를 매기는 각주, 여덟 가지 콜아웃 스타일, 그리고 <code>==강조==</code> 텍스트.</p>
      <div class="vm-demo">
        <div class="fnote">각주<sup>1</sup>는 정의로 이동합니다. <sup>1</sup>: 이 각주처럼요.</div>
      </div>
    </div>
    <div class="vm-card vm-reveal">
      <div class="icon-chip">- [ ]</div>
      <h3>작업 목록</h3>
      <p>클릭할 수 있는 체크박스 — 대괄호 문법은 파일에 남아, 당신의 길을 막지 않습니다.</p>
      <div class="vm-demo">
        <div class="fnote">☑ &nbsp;릴리스 배포하기<br />☐ &nbsp;변경 로그 작성하기</div>
      </div>
    </div>
  </div>
</section>

<div id="themes"></div>

<section class="vm-section">
  <div class="vm-split reverse vm-reveal">
    <div class="vm-split-text">
      <div class="vm-chapter-label"><span class="vm-num">03</span> — 몰입 <span class="vm-motif">**</span></div>
      <h2>낮의 종이, 밤의 먹.</h2>
      <p class="vm-lead">
        세심하게 조율된 두 가지 테마를 키 하나로 오가며, 세션 사이에도 기억됩니다.
        프레임리스 창과 메뉴도 함께 따라갑니다.
      </p>
      <ul class="vm-feature-list">
        <li>
          <strong>필요할 때 집중하세요</strong>
          <span>지금 쓰는 문장 외의 모든 것을 흐리게 만들고, 타자기 모드는 그 줄을 가운데에 고정합니다.</span>
        </li>
        <li>
          <strong>모든 것을 키보드로</strong>
          <span>명령, 접기, 빠른 열기와 서식은 모두 단축키 하나 거리에 있습니다 — 단축키 참조를 보세요.</span>
        </li>
      </ul>
    </div>
    <div class="vm-split-media vm-pair">
      <div class="vm-shot">
        <img src="/img/hero-dark.png" alt="VeloxMark 다크 테마" />
      </div>
      <div class="vm-shot">
        <img src="/img/hero-light.png" alt="VeloxMark 라이트 테마" />
      </div>
    </div>
  </div>

  <div class="vm-grid-2">
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">F8 / F9</div>
      <h3>방해 없는 모드</h3>
      <p>포커스 모드는 페이지를 하나의 영역으로 좁히고, 타자기 모드는 커서 줄을 따라갑니다. 문장 쓰는 중간에도 켤 수 있습니다.</p>
      <div class="vm-shot">
        <img src="/img/focus-mode.png" alt="VeloxMark 포커스 모드" />
      </div>
    </div>
    <div class="vm-card wide vm-reveal">
      <div class="icon-chip">File → Export</div>
      <h3>다 썼나요? 내보내세요.</h3>
      <p>인쇄 수준의 PDF와 자체 완결형 HTML — 선택 영역만 내보내기까지 지원합니다. 디스크의 .md는 절대 변하지 않습니다.</p>
      <div class="vm-chip-row">
        <span class="chip">PDF</span>
        <span class="chip">HTML</span>
        <span class="chip">.md</span>
      </div>
      <div class="vm-shot">
        <img src="/img/mermaid-light.png" alt="VeloxMark가 렌더링한 다이어그램과 테이블" />
      </div>
    </div>
  </div>
</section>

<div id="download"></div>

<div class="vm-cta vm-reveal">
  <div class="vm-chapter-label" style="justify-content:center"><span class="vm-num">04</span> — 시작 <span class="vm-motif">▮</span></div>
  <h2>다운로드하고, 파일을 여세요.</h2>
  <p>무료, 로컬 우선, 오픈 소스. 당신이 글 쓰는 모든 데스크톱에서.</p>
  <div class="vm-platforms">
    <a class="vm-plat" href="/ko/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 12.9c.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.02-.01-2.3-.88-2.26-3.53zM14.2 6.02c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.24z"/></svg>
      <span>macOS<span class="sub">.dmg · Apple Silicon &amp; Intel</span></span>
    </a>
    <a class="vm-plat" href="/ko/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7.2H3v6.1zM11.5 4.2 21 2.8v8.7h-9.5V4.2zm0 16.9L21 19.8v-8.5h-9.5v8.8z"/></svg>
      <span>Windows<span class="sub">.exe · x64 &amp; ARM64</span></span>
    </a>
    <a class="vm-plat" href="/ko/download">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7H8.5C7.12 7 6 8.12 6 9.5v1.06C4.76 11.22 4 12.49 4 13.94V16c0 1.66 1.34 3 3 3h.17c.41 1.16 1.51 2 2.83 2h4c1.32 0 2.42-.84 2.83-2H17c1.66 0 3-1.34 3-3v-2.06c0-1.45-.76-2.72-2-3.38V9.5C18 8.12 16.88 7 15.5 7H13V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-2.5 12.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2z"/></svg>
      <span>Linux<span class="sub">.AppImage · .deb · .rpm</span></span>
    </a>
  </div>
  <p style="font-size:13px"><code>SHA256SUMS.txt</code> 체크섬 제공 · Windows &amp; Linux 자동 업데이트</p>
</div>
