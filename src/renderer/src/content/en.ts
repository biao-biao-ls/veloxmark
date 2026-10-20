import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_EN = `# Welcome to VeloxMark

A **Markdown** editor with live preview — \`syntax\` markers disappear as you move away from a line, just like Typora.

## Features

- Live preview editing (WYSIWYG-style)
- *Italics*, **bold**, ~~strikethrough~~, \`inline code\`
- [Links](https://commonmark.org) and images
- Task lists:
  - [x] Open a file (${OPEN_KEY})
  - [ ] Try a math formula
- Mermaid diagrams and highlighted code
- Callouts, footnotes, ==highlights==
- Multi-tab editing, outline panel, export to PDF/HTML

## Math

Inline math like $E = mc^2$ works, and display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Diagram

\`\`\`mermaid
graph LR
  A[Write Markdown] --> B{Live Preview}
  B --> C[Looks beautiful]
  B --> D[Click to edit source]
\`\`\`

## Table

| Feature | Status | Notes |
| :------ | :----: | ----: |
| Live preview | ✅ | Typora-style |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | click to edit |

## Image

![VeloxMark logo](${WELCOME_LOGO_DATA_URI} =128x128)

## Extended syntax

Callouts and ==highlighted text==:

> [!TIP]
> Click a diagram, formula, or code block to edit its source.

Footnotes[^1] jump to their definition — click the number to try.

[^1]: Like this one.

> Tip: click any rendered block (code, math, diagram, table, image) to edit it.
> Press \`${OPEN_KEY}\` to open a \`.md\` file, \`${SAVE_KEY}\` to save.
`

export const HELP_MD_EN = `# Markdown Syntax Reference

## Headings

Prefix with # (1–6 hashes):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Emphasis

\`\`\`markdown
**bold**  *italic*  ~~strikethrough~~  \`code\`
\`\`\`

## Lists

\`\`\`markdown
- unordered item
1. ordered item
- [ ] task
- [x] done
\`\`\`

## Quote & divider

\`\`\`markdown
> quoted text

---
\`\`\`

## Math (KaTeX)

\`\`\`markdown
inline: $a^2 + b^2 = c^2$

display:
$$
\\frac{1}{2}
$$
\`\`\`

## Diagrams (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## Links & images

\`\`\`markdown
[text](https://example.com)
![alt](./image.png)
\`\`\`
`
