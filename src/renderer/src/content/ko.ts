import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_KO = `# VeloxMark에 오신 것을 환영합니다

실시간 미리보기를 갖춘 **Markdown** 편집기입니다. 다른 줄로 이동하면 \`구문\` 표시가 사라집니다. Typora와 같습니다.

## 기능

- 실시간 미리보기 편집 (WYSIWYG 방식)
- *기울임꼴*, **굵게**, ~~취소선~~, \`인라인 코드\`
- [링크](https://commonmark.org)와 이미지
- 작업 목록:
  - [x] 파일 열기 (${OPEN_KEY})
  - [ ] 수식 사용해 보기
- Mermaid 다이어그램과 코드 강조 표시
- 콜아웃, 각주, ==강조 표시==
- 다중 탭 편집, 개요 패널, PDF/HTML 내보내기

## 수식

인라인 수식 $E = mc^2$와 블록 수식이 작동합니다:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## 코드

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## 다이어그램

\`\`\`mermaid
graph LR
  A[Markdown 작성] --> B{실시간 미리보기}
  B --> C[아름답게 표시]
  B --> D[클릭하여 소스 편집]
\`\`\`

## 표

| 기능 | 상태 | 설명 |
| :--- | :--: | ---: |
| 실시간 미리보기 | ✅ | Typora 스타일 |
| 수식 | ✅ | KaTeX |
| Mermaid | ✅ | 클릭하여 편집 |

## 이미지

![VeloxMark 로고](${WELCOME_LOGO_DATA_URI} =128x128)

## 확장 문법

콜아웃과 ==강조 표시된 텍스트==:

> [!TIP]
> 다이어그램, 수식 또는 코드 블록을 클릭하면 소스를 편집할 수 있습니다.

각주[^1]는 정의로 이동합니다 — 번호를 클릭해 보세요.

[^1]: 이 각주처럼요.

> 팁: 렌더링된 블록(코드, 수식, 다이어그램, 표, 이미지)을 클릭하면 편집할 수 있습니다.
> \`${OPEN_KEY}\`로 \`.md\` 파일을 열고, \`${SAVE_KEY}\`로 저장하세요.
`

export const HELP_MD_KO = `# Markdown 문법 참고

## 제목

# 기호로 시작합니다 (1–6개):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## 강조

\`\`\`markdown
**굵게**  *기울임꼴*  ~~취소선~~  \`코드\`
\`\`\`

## 목록

\`\`\`markdown
- 순서 없는 항목
1. 순서 있는 항목
- [ ] 할 일
- [x] 완료
\`\`\`

## 인용 및 구분선

\`\`\`markdown
> 인용 텍스트

---
\`\`\`

## 수식 (KaTeX)

\`\`\`markdown
인라인: $a^2 + b^2 = c^2$

블록:
$$
\\frac{1}{2}
$$
\`\`\`

## 다이어그램 (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## 링크 및 이미지

\`\`\`markdown
[텍스트](https://example.com)
![대체 텍스트](./image.png)
\`\`\`
`
