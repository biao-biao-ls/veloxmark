# 9B 实施方案

## 技术决策与理由

- **顶栏整删**（`codeBlock-widget.ts` label 装配 4 行 + `markdown.css` `.cm-md-code-lang` 规则）：不留降级残骸。聚焦 chip 已是语言真源（9.3 显示名）。
- **hover 角标 = `.cm-md-code-idle-chip`**：`langDisplayName(this.lang)` 文本；皮肤与 `.cm-md-code-src-chip` 合并规则体（选择器列表扩展——font/color/padding/user-select/absolute right-bottom 全部同值），仅另加三条差异规则：`opacity: 0` / `.cm-md-code-block:hover` 显现 / `.cm-md-code-block-collapsed` 隐藏（8A `cm-md-math-hover-chip` 显现机制同款；折叠态避让 `.cm-md-code-expander` 满宽底行）。
- **角标只读**：不挂 click（点击冒泡 `wrapWithGap` click-to-source，与块语义一致）；不进 `eq`（文本由 lang 派生，eq 已比较 lang）。
- **导出只做减法**：`codeBlockHtml` 去 `.export-code-lang` label（`lang === ''` 时本就不产——indented code 路径零变化）；`exportCss.ts` 规则与 `inlineStyles.ts` 条目一并删；`inlineStyles.test.ts` 钉名列表同步去掉（in-repo 守护随契约走）。不补 `language-x` class（spec out of scope）。
- **`codeBlockHtml` 钉测**（新建 `renderDoc/code.test.ts`）：纯函数输出形态——有 lang/无 lang 两分支，含 `hljs`、不含 `export-code-lang`。highlight 片段以入参透传断言（不测 hljs 本体）。
- **`code-chrome.css` 注释修正**：`cm-md-code-src-chip` 注释里「Visual values carry over from the rendered widget's .cm-md-code-lang label」的来源描述随顶栏消亡更新。
- **复制富文本共用面**：`copyRichText` 走同一 `codeBlockHtml`——同步丢标签（期望行为，同一观感契约）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/codeBlock-widget.ts` | label 装配 → `cm-md-code-idle-chip` 角标（~5 行） |
| `styles/markdown.css` | 删 `.cm-md-code-lang` 规则 |
| `styles/code-chrome.css` | `.cm-md-code-src-chip` 选择器扩展 + 角标 3 条差异规则 + 注释修正 |
| `export/renderDoc/code.ts` | `codeBlockHtml` 去 label |
| `export/renderDoc/code.test.ts` | **新建**：输出形态钉测 |
| `export/exportCss.ts` | 删 `.export-code-lang` 规则 |
| `export/inlineStyles.ts` | 删 `export-code-lang` 条目 |
| `export/inlineStyles.test.ts` | 钉名列表去掉 `export-code-lang` |

## 状态/契约归属

零新状态。导出 DOM 契约变更（`.export-code-lang` 移除）为任务授权面，in-repo 守护三处同步（renderDoc 输出 / inlineStyles 注册表 / 其单测）。

## import 改动面

零新增（`langDisplayName` 已在 codeBlock-widget import 面）。madge 例行守护。

## 任务拆分

1. 静息观感：widget 角标 + 两 CSS [先行]
2. 导出同步：code.ts + exportCss + inlineStyles + 两个测试 [依赖 1 的观感定型]
3. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（code.test + inlineStyles.test 全绿）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 显式核对 `export-code-lang` 移除为唯一契约变更，零其它既有字面量
- 人工冒烟（**待运行时冒烟补签**）：
  1. 静息态：圆角灰底 + 高亮、无横条（对照 `code-default.png`）
  2. hover：右下角语言角标浮现（显示名如 `TypeScript`）；移出即隐
  3. 复制/折叠/展开按钮与行为不回退；折叠态角标隐藏、展开按钮可点
  4. 聚焦：⑦ 右下 chip 照常（可交互切换）；角标与 chip 同位连续
  5. 导出 HTML/PDF/复制富文本：代码块无语言横条，观感同步
  6. 深浅主题两张对照

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 落地，无偏离：widget label 装配 → `cm-md-code-idle-chip` 角标（`langDisplayName`）；`.cm-md-code-lang` 规则整删；`code-chrome.css` `.cm-md-code-src-chip` 选择器扩展共享皮肤 + 角标 3 条差异规则（`opacity: 0` / hover 显现 / 折叠隐藏）；导出四件套同步（code.ts / exportCss / inlineStyles / inlineStyles.test 钉名列表改钉 `export-code`）。
- `codeBlockHtml` 的 `lang` 参数保留但不再消费（call-site 对称；`void lang` 显式占位）——不补 `language-x` class（spec out of scope）。
- `code.test.ts` 2 例精确形态钉测（有 lang / 空 lang 同形；highlight 片段透传——入参已是可信 HTML）。
- `escapeHtml` import 在 code.ts 仍被 mermaid 错误路径使用，无死 import。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / 339 例全绿（337 → 339，+2 `codeBlockHtml`）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 内契约变更仅 `cm-md-code-lang`/`export-code-lang` 移除（本任务授权面，in-repo 守护三处同步）；`data-op`/`data-table-handle`/`__velox`/mermaid class 零触碰 ✓
- AC1–5 逻辑路径核对全通；待运行时冒烟补签（6 点）：
  1. 静息态：圆角灰底 + 高亮、无横条（对照 `code-default.png`）
  2. hover：右下角语言角标浮现（显示名如 `TypeScript`）；移出即隐
  3. 复制/折叠/展开按钮与行为不回退；折叠态角标隐藏、展开按钮可点
  4. 聚焦：⑦ 右下 chip 照常（可交互切换）；角标与 chip 同位连续
  5. 导出 HTML/PDF/复制富文本：代码块无语言横条，观感同步
  6. 深浅主题两张对照
