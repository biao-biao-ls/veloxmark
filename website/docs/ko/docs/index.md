---
title: 소개
description: VeloxMark 사용자 문서에 오신 것을 환영합니다 — Electron과 CodeMirror 6 기반의 무료 오픈 소스 Markdown 편집기, 실시간 미리보기.
keywords: [VeloxMark 문서, Markdown 편집기 가이드, 실시간 미리보기 편집기, 소개]
---

# 소개

VeloxMark 사용자 문서에 오신 것을 환영합니다. VeloxMark는 macOS, Windows, Linux를 위한
무료 오픈 소스 Markdown 편집기로, 실시간 미리보기를 제공하며 Typora에서 영감을 받아
Electron + CodeMirror 6로 만들어졌습니다.

<div class="vm-shot">

![VeloxMark 인터페이스](/img/hero-light.png)

</div>

## VeloxMark가 다른 점

**Markdown 소스가 유일한 데이터 소스입니다.** 렌더링된 제목, 수식, 다이어그램, 테이블처럼
풍부한 것은 모두 순수 텍스트 파일 위에 얹힌 일시적인 장식입니다. 저장하면 왕복 손실 없이
깔끔한 `.md`가 기록됩니다. 독자적인 문서 형식도, 숨겨진 상태도 없습니다.

실시간 미리보기 엔진은 문서와 선택 영역이 바뀔 때마다 장식을 다시 만듭니다. 문법 마커는
바꾸기 장식으로 숨겨지고, 코드 / 수식 / mermaid / 이미지 블록은 렌더링된 위젯으로 교체됩니다.
커서가 범위 안으로 들어가면 그 범위의 장식은 건너뛰고 소스 형태가 돌아옵니다. 커서 줄은
항상 소스 형태를 유지하므로, 지금 무엇을 편집하는지 정확히 알 수 있습니다.

## 다음 단계

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">설치</a></h3>
    <p>macOS, Windows, Linux용 설치 프로그램, 체크섬 검증, 플랫폼 참고 사항.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">기본</a></h3>
    <p>창, 사이드바, 탭과 세 가지 편집기 모드 — 첫 실행에서 보이는 모든 것.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">편집 심화</a></h3>
    <p>입력하는 동안 실시간 미리보기가 어떻게 동작하는지: 블록 위젯, 테이블, 집중 모드와 입력 도우미.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Markdown 문법</a></h3>
    <p>VeloxMark가 특별히 렌더링하는 모든 문법 구성 요소, 소스 예제 포함.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">단축키</a></h3>
    <p>플랫폼별 단축키가 포함된 전체 명령 목록.</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">자주 묻는 질문</a></h3>
    <p>지원 플랫폼, 문제 해결 및 버그 보고 방법.</p>
  </div>
</div>

## 라이선스

VeloxMark는 [MIT 라이선스](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)에 따라
배포됩니다. 소스는 [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark)에 있습니다.
