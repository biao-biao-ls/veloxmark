/** Built-in documents shown when the app starts or via the Help menu. */

export const WELCOME_MD = `# Welcome to VeloxMark

A **Markdown** editor with live preview — \`syntax\` markers disappear as you move away from a line, just like Typora.

## Features

- Live preview editing (WYSIWYG-style)
- *Italics*, **bold**, ~~strikethrough~~, \`inline code\`
- [Links](https://commonmark.org)
- Task lists:
  - [x] Open a file (Ctrl+O)
  - [ ] Try a math formula
- Mermaid diagrams and highlighted code

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

> Tip: click any rendered block (code, math, diagram, table) to edit its source.
> Press \`Ctrl+O\` to open a \`.md\` file, \`Ctrl+S\` to save.
`

export const HELP_MD = `# Markdown Syntax Reference

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

\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`

## Links & images

\`\`\`markdown
[text](https://example.com)
![alt](./image.png)
\`\`\`
`
