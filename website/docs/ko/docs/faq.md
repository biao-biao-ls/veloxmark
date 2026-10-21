---
title: 자주 묻는 질문
description: VeloxMark 자주 묻는 질문 — 지원 플랫폼, 라이선스, 실시간 미리보기 동작, 파일 왕복, 데이터 저장 위치, macOS Gatekeeper와 업데이트 동작.
keywords: [VeloxMark FAQ, Markdown 편집기 FAQ, 실시간 미리보기 질문, VeloxMark 문제 해결]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"어떤 플랫폼을 지원하나요?","acceptedAnswer":{"@type":"Answer","text":"macOS(Apple Silicon 및 Intel), Windows 10/11(x64 및 ARM64), Linux(x64 및 arm64 — AppImage, deb, rpm, tar.gz; snap은 x64 전용)를 지원합니다."}},{"@type":"Question","name":"VeloxMark는 무료인가요?","acceptedAnswer":{"@type":"Answer","text":"네. VeloxMark는 MIT 라이선스로 공개된 오픈 소스입니다. 계정도, 구독도, 텔레메트리도 없습니다."}},{"@type":"Question","name":"실시간 미리보기란 무엇이며 분할 보기와 어떻게 다른가요?","acceptedAnswer":{"@type":"Answer","text":"미리보기 창이 없습니다. 편집기는 Markdown을 제자리에서 렌더링합니다: 커서가 줄을 떠나면 문법 마커가 숨겨지고 해당 줄은 최종 형태를 보여줍니다. 커서 줄은 항상 소스 형태를 유지하며, 렌더링된 블록(코드, 수식, 다이어그램, 테이블, 이미지)을 클릭하면 편집할 수 있도록 원시 Markdown이 돌아옵니다. Markdown 소스가 유일한 데이터 소스입니다 — 저장하면 순수 .md로 기록되며 왕복 손실이 없습니다."}},{"@type":"Question","name":"저장할 때 VeloxMark가 Markdown 파일을 수정하나요?","acceptedAnswer":{"@type":"Answer","text":"아니요. 저장은 소스 텍스트를 그대로 다시 기록할 뿐입니다. 모든 렌더링은 장식입니다."}},{"@type":"Question","name":"어떤 Markdown 문법을 지원하나요?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM(테이블, 작업 목록, 취소선), 그리고 KaTeX 수식, Mermaid 다이어그램, 콜아웃, 각주와 강조 텍스트."}},{"@type":"Question","name":"VeloxMark로 노트를 관리할 수 있나요?","acceptedAnswer":{"@type":"Answer","text":"VeloxMark는 집중된 Markdown 리더/편집기입니다 — 폴더와 파일을 열고 개요와 검색을 사용할 수 있지만, 지식 관리 계층은 없습니다. 파일은 디스크에서 순수 .md로 남으므로 다른 도구가 그대로 이어받을 수 있습니다."}},{"@type":"Question","name":"버그를 어떻게 보고하나요?","acceptedAnswer":{"@type":"Answer","text":"앱 버전(도움말 메뉴), 운영 체제, 재현 단계와 문제가 되는 Markdown과 함께 GitHub에 이슈를 등록해 주세요."}},{"@type":"Question","name":"초안과 설정은 어디에 저장되나요?","acceptedAnswer":{"@type":"Answer","text":"환경 설정, 초안과 세션 상태는 표준 사용자별 애플리케이션 데이터 디렉터리(Electron userData)에 있습니다: Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. 문서 자체는 절대 이동하거나 복사되지 않습니다."}},{"@type":"Question","name":"macOS가 알 수 없는 개발자라고 말하는 이유는 무엇인가요?","acceptedAnswer":{"@type":"Answer","text":"릴리스 빌드는 현재 서명되지 않았습니다. 설치 후 xattr -d com.apple.quarantine /Applications/VeloxMark.app을 한 번 실행하세요."}},{"@type":"Question","name":"제 플랫폼에서 자동 업데이트가 되지 않습니다 — 정상인가요?","acceptedAnswer":{"@type":"Answer","text":"네, 정상입니다. 완전한 자동 업데이트는 Windows NSIS 설치와 Linux AppImage에서만 활성화됩니다. 다른 설치 형식은 알림만 제공하며, macOS는 빌드가 서명되지 않아 현재 릴리스 페이지를 여는 것으로 대체됩니다."}}]}'
---

# 자주 묻는 질문 (FAQ)

### 어떤 플랫폼을 지원하나요?

macOS(Apple Silicon 및 Intel), Windows 10/11(x64 및 ARM64), Linux
(x64 및 arm64 — AppImage, deb, rpm, tar.gz; snap은 x64 전용)를 지원합니다.
[설치](./installation)를 보세요.

### VeloxMark는 무료인가요?

네. VeloxMark는
[MIT 라이선스](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)로 공개된
오픈 소스입니다. 계정도, 구독도, 텔레메트리도 없습니다.

### 실시간 미리보기란 무엇이며 분할 보기와 어떻게 다른가요?

미리보기 창이 없습니다. 편집기는 Markdown을 **제자리에서** 렌더링합니다: 커서가
줄을 떠나면 `#`, `**`, `` ` `` 같은 문법 마커가 숨겨지고 해당 줄은 최종 형태를
보여줍니다. 커서 줄은 항상 소스 형태를 유지하며, 렌더링된 블록(코드, 수식,
다이어그램, 테이블, 이미지)을 클릭하면 편집할 수 있도록 원시 Markdown이 돌아옵니다.
Markdown 소스가 유일한 데이터 소스입니다 — 저장하면 순수 `.md`로 기록되며
왕복 손실이 없습니다.

### 저장할 때 VeloxMark가 Markdown 파일을 수정하나요?

아니요. 저장은 소스 텍스트를 그대로 다시 기록할 뿐입니다. 모든 렌더링은 장식입니다.

### 어떤 Markdown 문법을 지원하나요?

CommonMark + GFM(테이블, 작업 목록, 취소선), 그리고 KaTeX 수식, Mermaid 다이어그램,
콜아웃, 각주와 `==강조==`. 전체 참조: [Markdown 문법](./markdown-syntax).

### VeloxMark로 노트를 관리할 수 있나요?

VeloxMark는 집중된 Markdown 리더/편집기입니다 — 폴더와 파일을 열고, 개요와 검색을
사용할 수 있지만, 지식 관리 계층은 없습니다(태그, 역링크나 데이터베이스 없음).
파일은 디스크에서 순수 `.md`로 남으므로 다른 도구가 그대로 이어받을 수 있습니다.

### 버그를 어떻게 보고하나요?

앱 버전(도움말 메뉴), 운영 체제, 재현 단계와 문제가 되는 Markdown과 함께
[GitHub](https://github.com/biao-biao-ls/veloxmark/issues)에 이슈를 등록해 주세요.

### 초안과 설정은 어디에 저장되나요?

환경 설정, 초안과 세션 상태는 표준 사용자별 애플리케이션 데이터 디렉터리
(Electron `userData`)에 있습니다: Windows `%APPDATA%\VeloxMark`, macOS
`~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`.
문서 자체는 절대 이동하거나 복사되지 않습니다 — 파일이 있는 곳에서 편집합니다.

### macOS가 알 수 없는 개발자라고 말하는 이유는 무엇인가요?

릴리스 빌드는 현재 서명되지 않았습니다. 설치 후
`xattr -d com.apple.quarantine /Applications/VeloxMark.app`을 한 번 실행하세요 —
[설치](./installation#macos)를 보세요.

### 제 플랫폼에서 자동 업데이트가 되지 않습니다 — 정상인가요?

네, 정상입니다. 완전한 자동 업데이트는 Windows NSIS 설치와 Linux AppImage에서만
활성화됩니다. 다른 설치 형식은 알림만 제공하며, macOS는 빌드가 서명되지 않아
현재 릴리스 페이지를 여는 것으로 대체됩니다.
자세한 내용: [자동 업데이트](./updates).
