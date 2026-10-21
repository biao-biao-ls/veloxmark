# VeloxMark

Markdown으로 쓰세요 — 나머지는 모두 장식일 뿐입니다.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · **한국어** · [Español](es.md) · [Português](pt.md) · [Français](fr.md) · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark는 라이브 미리보기를 지원하는 무료 오픈 소스 Markdown 데스크톱 뷰어/에디터입니다. [Typora](https://typora.io)로 대표되는 마찰 없는 글쓰기 경험을 지향하면서도 `.md` 순수 텍스트의 완전한 이식성을 유지합니다 — Electron과 CodeMirror 6로 만들어졌으며 macOS, Windows, Linux에서 실행됩니다.

![VeloxMark 라이트 테마](../../website/docs/public/img/hero-light.png)

- 웹사이트와 문서: https://veloxmark.knzn.net
- 다운로드: https://github.com/biao-biao-ls/veloxmark/releases

## 기능

- **라이브 미리보기(Typora 스타일)**: Markdown 소스가 유일한 데이터입니다. 커서가 줄을 벗어나면 `#`, `**`, `` ` `` 같은 구문 기호가 숨겨지고 그 줄은 최종 스타일로 렌더링됩니다. 커서가 있는 줄은 항상 소스 형태로 표시됩니다
- **블록 렌더링**: 코드 블록(구문 강조), `$$` 수식(KaTeX), ```` ```mermaid ```` 다이어그램 — 블록을 클릭하면 소스를 편집할 수 있습니다
- **표**: 중첩 셀 편집기를 갖춘 네이티브 표 편집, 표 삽입/변환 대화 상자, 열 크기 조절과 정렬
- **아웃라인 탐색**: 사이드바의 제목 트리, 클릭으로 이동, 현재 위치 강조
- **다중 탭 편집**: 여러 파일을 동시에 열고, 탭을 닫고/복원하며, 저장되지 않은 변경 사항은 `•`로 표시
- **집중 모드**: 집중 모드, 타자기 모드, 소스 모드
- **라이트/다크 테마**:**보기 → 테마 전환** 메뉴로 전환하며 세션 간에 기억됩니다. 프레임리스 제목 표시줄과 앱 내 메뉴(파일/편집/보기/도움말)도 테마를 따릅니다
- **파일 작업**: 열기 / 저장 / 다른 이름으로 저장, 창 컨트롤(최소화/최대화/닫기)
- **내보내기**: PDF와 HTML, 선택 영역만 HTML로 내보내기 지원
- **입력 도우미**: URL을 붙여넣으면 자동으로 링크로 감싸고, 붙여넣은 HTML을 Markdown으로 변환
- **작업 목록**:`- [ ]`는 클릭 가능한 체크 박스로 렌더링됩니다
- **이미지**: 절대 경로, 상대 경로(현재 `.md` 파일 기준), 원격 이미지 지원
- **자동 업데이트**: 설치 프로그램이 GitHub Releases를 확인해 제자리에서 업데이트(Windows NSIS 및 Linux AppImage)
- **다국어 UI**: 한국어, English, 简体中文, 日本語, Español, Português, Français, Deutsch, Русский(네이티브 메뉴와 예제 문서 포함)

## 설치

[릴리스 페이지](https://github.com/biao-biao-ls/veloxmark/releases/latest)에서 사용 중인 플랫폼의 빌드를 다운로드하세요:

- **Windows** — NSIS 설치 프로그램(자동 업데이트 지원) 또는 휴대용 zip
- **macOS** — dmg와 zip(서명되지 않은 빌드). 첫 실행 시 마우스 오른쪽 클릭 → **열기**, 또는 검역 속성을 제거:`xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage(자동 업데이트 지원), deb, rpm, tar.gz, snap

## 개발

```bash
npm install
npm run dev      # 개발 모드(핫 리로드)
npm run build    # out/으로 빌드
npm run typecheck
```

> 제한된 네트워크에서 Electron 바이너리 다운로드가 실패하면:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## 기술 스택

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — 에디터 코어; StateField 데코레이션으로 라이브 미리보기 구현
- [KaTeX](https://katex.org) — 수식
- [mermaid](https://mermaid.js.org) — 다이어그램
- [highlight.js](https://highlightjs.org) — 코드 강조

## 아키텍처

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview/   live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh/ja/ko/es/pt/fr/de/ru)
```

핵심 설계: Markdown 텍스트가 항상 유일한 데이터 소스입니다(저장 시 순수 `.md`로 쓰며 왕복 손실이 없습니다). 데코레이션 엔진은 문서/선택이 바뀔 때마다 Decorations를 다시 만듭니다. 구문 기호는 replace 데코레이션으로 숨기고, 코드/수식/다이어그램 블록은 widget으로 교체합니다. 커서가 범위 안으로 들어가면 그 범위의 데코레이션을 건너뛰고 소스 형태가 돌아옵니다.

## 문서

전체 사용자 문서는 [웹사이트](https://veloxmark.knzn.net/ko/docs/)에 있습니다. 릴리스 절차서(프로세스, 산출물, 서명 상태, 문제 해결)는 [CLAUDE.md](../../CLAUDE.md)의 "Release process" 절을 참조하세요.

## 기여

- **커밋 메시지와 코드 주석은 영어로 작성해야 합니다.**
- **번역은 로컬라이제이션 팩에만 허용됩니다** — 언어마다 하나의 팩(파일 또는 디렉터리):
  - `src/renderer/src/i18n/<lang>.ts` — UI 사전과 언어 자칭
  - `electron/shared/menuStrings/<lang>.ts` — 네이티브 메뉴 문자열
  - `src/renderer/src/content/<lang>.ts` — 환영/도움말 문서
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — Mermaid 템플릿 본문
  - `docs/readme/<lang>.md` — 이 README의 번역
  - `website/docs/<lang>/`와 `website/docs/.vitepress/locales/<lang>.ts` — 웹사이트 페이지와 웹사이트 UI 문자열

  저장소의 나머지 파일은 모두 영어만 사용합니다.

## 라이선스

[MIT](../../LICENSE)
