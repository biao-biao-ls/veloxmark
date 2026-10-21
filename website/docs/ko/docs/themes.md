---
title: 테마
description: VeloxMark 라이트 및 다크 테마 — 한 번의 클릭으로 전환, 세션 사이에도 유지, 코드·수식·다이어그램 위젯에 테마가 적용되는 방식.
keywords: [Markdown 편집기 다크 모드, 라이트 테마, 다크 테마, 편집기 테마, 테마 전환]
---

# 테마

VeloxMark는 긴 글쓰기 시간을 위해 조율된 두 가지 일급 테마 — 라이트와 다크 — 를
제공합니다. 둘 다 편집기 크롬, 구문 색상과 렌더링된 블록 위젯(수식, 다이어그램, 코드,
테이블)을 포함합니다.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark 라이트 테마" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark 다크 테마" />
    </div>
  </div>
</div>

## 테마 전환

- 메뉴: **보기 → 테마 전환** ("테마 전환" 명령으로도 사용할 수 있습니다).
- 또는 환경 설정(테마 모드)에서 `light` / `dark` / `system`을 명시적으로 선택합니다.
- 선택은 세션 사이에 기억됩니다.

사용자 지정 프레임리스 제목 표시줄과 앱 내 메뉴(파일 / 편집 / 보기 / 삽입 / 도움말)는
활성 테마를 따릅니다.

## 다크 테마 코드 예제

<div class="vm-shot">

![다크 테마의 코드 블록](/img/code-dark.png)

</div>

## 테마 적용 방식

편집기는 [CodeMirror 6](https://codemirror.net)입니다. 각 테마는 CM6 테마와 앱 셸을
덮는 CSS 변수로 이루어집니다. 렌더링된 위젯(KaTeX, Mermaid, highlight.js)도 같은
팔레트를 사용하므로, 코드 블록이나 다이어그램이 어색해 보이는 일은 없습니다.
