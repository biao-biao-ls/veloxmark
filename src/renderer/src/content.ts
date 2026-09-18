/** Built-in documents shown when the app starts or via the Help menu (P14 i18n). */
import { getLang } from './i18n'

export const WELCOME_MD_EN = `# Welcome to VeloxMark

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

export const WELCOME_MD_ZH = `# 欢迎使用 VeloxMark

一款所见即所得的 **Markdown** 编辑器——离开某行后 \`语法\` 标记会自动隐藏，与 Typora 一致。

## 功能

- 实时预览编辑（所见即所得）
- *斜体*、**粗体**、~~删除线~~、\`行内代码\`
- [链接](https://commonmark.org)
- 任务列表：
  - [x] 打开文件（Ctrl+O）
  - [ ] 试试数学公式
- Mermaid 图表与代码高亮

## 数学

行内公式如 $E = mc^2$，以及块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## 代码

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## 图表

\`\`\`mermaid
graph LR
  A[编写 Markdown] --> B{实时预览}
  B --> C[美观呈现]
  B --> D[点击编辑源码]
\`\`\`

## 表格

| 功能 | 状态 | 说明 |
| :--- | :--: | ---: |
| 实时预览 | ✅ | Typora 风格 |
| 数学公式 | ✅ | KaTeX |
| Mermaid | ✅ | 点击可编辑 |

> 提示：点击任意渲染块（代码、公式、图表、表格）可编辑其源码。
> 按 \`Ctrl+O\` 打开 \`.md\` 文件，\`Ctrl+S\` 保存。
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

export const HELP_MD_ZH = `# Markdown 语法参考

## 标题

以 # 开头（1–6 个井号）：

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## 强调

\`\`\`markdown
**粗体**  *斜体*  ~~删除线~~  \`代码\`
\`\`\`

## 列表

\`\`\`markdown
- 无序项
1. 有序项
- [ ] 待办
- [x] 已完成
\`\`\`

## 引用与分隔线

\`\`\`markdown
> 引用文本

---
\`\`\`

## 数学（KaTeX）

\`\`\`markdown
行内：$a^2 + b^2 = c^2$

块级：
$$
\\frac{1}{2}
$$
\`\`\`

## 图表（Mermaid）

\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`

## 链接与图片

\`\`\`markdown
[文本](https://example.com)
![替代文字](./image.png)
\`\`\`
`

/** Welcome document in the active UI language. */
export function getWelcomeMd(lang: string = getLang()): string {
  return lang === 'zh' ? WELCOME_MD_ZH : WELCOME_MD_EN
}

/** Help / syntax-reference document in the active UI language. */
export function getHelpMd(lang: string = getLang()): string {
  return lang === 'zh' ? HELP_MD_ZH : HELP_MD_EN
}

/** Legacy aliases (English) — kept for older e2e scripts. */
export const WELCOME_MD = WELCOME_MD_EN
export const HELP_MD = HELP_MD_EN
