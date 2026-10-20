import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_ZH = `# 欢迎使用 VeloxMark

一款所见即所得的 **Markdown** 编辑器——离开某行后 \`语法\` 标记会自动隐藏，与 Typora 一致。

## 功能

- 实时预览编辑（所见即所得）
- *斜体*、**粗体**、~~删除线~~、\`行内代码\`
- [链接](https://commonmark.org)与图片
- 任务列表：
  - [x] 打开文件（${OPEN_KEY}）
  - [ ] 试试数学公式
- Mermaid 图表与代码高亮
- 提示块、脚注、==高亮==
- 多标签编辑、大纲面板、导出 PDF/HTML

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

## 图片

![VeloxMark 标志](${WELCOME_LOGO_DATA_URI} =128x128)

## 扩展语法

提示块与 ==高亮文本==：

> [!TIP]
> 点击图表、公式或代码块即可编辑其源码。

脚注[^1]可跳转到定义处——点击序号试试。

[^1]: 就像这条。

> 提示：点击任意渲染块（代码、公式、图表、表格、图片）可进入编辑。
> 按 \`${OPEN_KEY}\` 打开 \`.md\` 文件，\`${SAVE_KEY}\` 保存。
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

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## 链接与图片

\`\`\`markdown
[文本](https://example.com)
![替代文字](./image.png)
\`\`\`
`
