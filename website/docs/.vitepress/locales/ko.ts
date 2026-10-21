/**
 * Website UI strings — Korean.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const KO: WebsiteLocaleStrings = {
  label: '한국어',
  lang: 'ko-KR',
  hreflang: 'ko',
  link: '/ko/',
  ogLocale: 'ko_KR',
  titleTemplate: '실시간 미리보기를 갖춘 Markdown 편집기',
  description:
    'macOS, Windows, Linux를 위한 무료 오픈 소스 Markdown 편집기입니다. KaTeX 수식, Mermaid 다이어그램, 네이티브 테이블 — 모두 실시간으로 렌더링됩니다.',
  homeOgTitle: 'VeloxMark — 실시간 미리보기를 갖춘 Markdown 편집기',
  keywords:
    'markdown 편집기, 실시간 미리보기, 오픈 소스, WYSIWYG, KaTeX, Mermaid, Typora 대안, Electron, CodeMirror',
  nav: [
    { text: '문서', link: '/ko/docs/' },
    { text: '다운로드', link: '/ko/download' }
  ],
  sidebar: [
    {
      text: '시작하기',
      items: [
        { text: '소개', link: '/ko/docs/' },
        { text: '설치', link: '/ko/docs/installation' },
        { text: '기본', link: '/ko/docs/basics' }
      ]
    },
    {
      text: '작성',
      items: [
        { text: '편집 심화', link: '/ko/docs/editing' },
        { text: 'Markdown 문법', link: '/ko/docs/markdown-syntax' },
        { text: '이미지', link: '/ko/docs/images' }
      ]
    },
    {
      text: '참조',
      items: [
        { text: '환경 설정', link: '/ko/docs/preferences' },
        { text: '단축키', link: '/ko/docs/key-bindings' },
        { text: '언어 및 현지화', link: '/ko/docs/language' },
        { text: '문서 내보내기', link: '/ko/docs/export' },
        { text: '테마', link: '/ko/docs/themes' }
      ]
    },
    {
      text: '도움말',
      items: [
        { text: '자동 업데이트', link: '/ko/docs/updates' },
        { text: '자주 묻는 질문', link: '/ko/docs/faq' }
      ]
    }
  ],
  editLinkText: 'GitHub에서 이 페이지 편집',
  footerMessage: 'MIT 라이선스에 따라 배포됩니다.',
  outlineLabel: '이 페이지 목차',
  docPrev: '이전',
  docNext: '다음',
  breadcrumbHome: '홈',
  breadcrumbDocs: '문서',
  trustTicks: ['macOS · Windows · Linux', '로컬 우선, 계정 불필요', 'MIT 라이선스, 영원히'],
  schemaDescription:
    'macOS, Windows, Linux를 위한 무료 오픈 소스 Markdown 편집기이며 실시간 미리보기를 제공합니다. Markdown 소스가 유일한 데이터 소스입니다 — 저장하면 순수 .md 파일로 쓰이며 왕복 손실이 없습니다. KaTeX 수식, Mermaid 다이어그램, 네이티브 테이블 편집, 콜아웃, 각주와 강조까지 모두 실시간으로 렌더링됩니다.',
  schemaFeatures: [
    '실시간 미리보기 편집 (Typora 스타일, 제자리 렌더링)',
    'KaTeX 수식과 Mermaid 다이어그램 실시간 렌더링',
    '중첩 셀 편집기를 갖춘 네이티브 테이블 편집',
    '포커스 모드, 타자기 모드, 라이트/다크 테마',
    'PDF 및 HTML 내보내기',
    '왕복 손실 없는 순수 Markdown 파일',
    '아홉 가지 인터페이스 언어'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark는 macOS, Windows, Linux를 위한 무료 오픈 소스(MIT) Markdown 편집기이며 실시간 미리보기를 제공합니다. Markdown 소스가 유일한 데이터 소스입니다: 편집기는 제목, 수식, 다이어그램, 테이블을 제자리에서 렌더링하지만, 디스크의 파일은 언제나 순수 Markdown으로 남아 왕복 손실 없이 저장됩니다.\n\n' +
    'VeloxMark는 Electron과 CodeMirror 6 기반으로 만들어졌습니다. 실시간 미리보기 엔진은 커서가 한 줄을 벗어나면 문법 마커를 숨기고(Typora 스타일), 렌더링된 모든 블록 — 코드, KaTeX 수식, Mermaid 다이어그램, 테이블, 이미지 — 을 클릭하면 그 Markdown 소스를 편집할 수 있습니다. 네이티브 테이블 편집, 포커스 모드와 타자기 모드, 라이트/다크 테마, PDF/HTML 내보내기, 아홉 가지 인터페이스 언어, 그리고 Windows(NSIS)와 Linux(AppImage)에서의 자동 업데이트를 제공합니다.\n\n' +
    '핵심 사실: MIT 라이선스 · 계정 불필요, 텔레메트리 없음 · 로컬 우선 · macOS(dmg/zip), Windows(NSIS 설치 프로그램, 포터블 zip), Linux(AppImage, deb, rpm, tar.gz, snap) 설치 제공 · SHA256SUMS.txt 체크섬이 포함된 GitHub Releases.\n\n' +
    '## 문서\n\n' +
    '- [소개](https://veloxmark.knzn.net/ko/docs/): VeloxMark란 무엇인지, 실시간 미리보기 동작 방식, 왕복 무손실 보장\n' +
    '- [설치](https://veloxmark.knzn.net/ko/docs/installation): 플랫폼별 설치 프로그램, 체크섬 검증, 소스에서 빌드, 제거\n' +
    '- [기본](https://veloxmark.knzn.net/ko/docs/basics): 창 구성, 사이드바(파일/개요/검색), 탭, 편집기 모드\n' +
    '- [편집 심화](https://veloxmark.knzn.net/ko/docs/editing): 실시간 미리보기 동작, 블록 위젯, 테이블 편집, 입력 도우미\n' +
    '- [Markdown 문법](https://veloxmark.knzn.net/ko/docs/markdown-syntax): 특별히 렌더링되는 모든 것 — 제목, KaTeX 수식, Mermaid, 콜아웃, 각주, 강조, 프론트 매터\n' +
    '- [이미지](https://veloxmark.knzn.net/ko/docs/images): 경로 해석, `=WxH` 크기, `{align=}`/`{flip=}` 속성, 첨부 파일\n' +
    '- [환경 설정](https://veloxmark.knzn.net/ko/docs/preferences): 기본값이 포함된 전체 설정 — 모양, 편집기, 파일, 자동 저장, 이미지\n' +
    '- [단축키](https://veloxmark.knzn.net/ko/docs/key-bindings): 플랫폼별 전체 명령/단축키 표\n' +
    '- [언어 및 현지화](https://veloxmark.knzn.net/ko/docs/language): 아홉 가지 인터페이스 언어와 언어 선택 방식\n' +
    '- [문서 내보내기](https://veloxmark.knzn.net/ko/docs/export): PDF 및 HTML 내보내기 옵션, 선택 영역만 내보내기\n' +
    '- [테마](https://veloxmark.knzn.net/ko/docs/themes): 라이트/다크 테마, 전환 방법, 위젯에 테마가 적용되는 방식\n' +
    '- [자동 업데이트](https://veloxmark.knzn.net/ko/docs/updates): 설치 형식별 업데이트 동작(NSIS/AppImage 전체 자동, 그 외 알림만)\n' +
    '- [자주 묻는 질문](https://veloxmark.knzn.net/ko/docs/faq): 지원 플랫폼, 라이선스, 문제 해결, 데이터 저장 위치\n\n' +
    '## 다운로드\n\n' +
    '- [다운로드](https://veloxmark.knzn.net/ko/download): 플랫폼별 전체 설치 프로그램, 체크섬 검증 및 업데이트 동작\n\n' +
    '## 소스\n\n' +
    '- [GitHub 저장소](https://github.com/biao-biao-ls/veloxmark): 소스 코드, 이슈 트래커, 릴리스(MIT 라이선스)\n\n' +
    '## 선택 사항\n\n' +
    '- [전체 문서 일반 텍스트](https://veloxmark.knzn.net/ko/llms-full.txt): 오프라인 LLM 사용을 위해 이어 붙인 전체 문서 내용\n'
}
