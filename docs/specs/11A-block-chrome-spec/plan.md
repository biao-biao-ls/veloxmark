# 11A 实施方案

## 技术决策与理由

- **规范落点**：附录章「## 附录：块级 chrome 规范」落 `docs/markdown-ux-optimization.md`（AC 允许的「本文件」）——P3 任务与规范同文档，spec 作者不会漏读；「约束与红线」补第 11 行指向附录（强制钩子）。条款四维：**N1 显隐时机**（静息零 chrome / hover 簇 / 聚焦编辑态 / 错误态）、**N2 位置槽位**（右上簇锚点、左上状态徽标、闭栏右下语言 chip、面板首行右上退出 chip、表格交互块例外、行内无 chip）、**N3 点击语义**（click-to-source / 提示 chip 冒泡 / 动作按钮 stopPropagation+反馈 / 退出 chip / 语言 chip / 跳源码）、**N4 皮肤**（token 族、`--widget-surface` hover 面、paint-only、零补丁）+ 元素×态形态索引表。
- **A1 修法（改代码）**：chip 并入 `.cm-md-block-toolbar` flex 行作最右元素——「同锚点一簇、chip 贴角、按钮向左排」N2 的落地实例。
  - `blockWidget.ts` `attachBlockToolbar` 返回 `HTMLElement`（bar）——调用方全部忽略返回值，向后兼容；
  - `widgets-math.ts` `MathBlockWidget.toDOM`：chip 改为 append 到 bar（DOM 序：按钮在前、chip 在后 → chip 视觉最右）；
  - `markdown.css` `.cm-md-math-hover-chip` 去 `position:absolute/top/right/opacity/transition`（bar 的 hover 揭示携带 chip），保留 11px/`--fg-dim`/user-select/cursor；删 `.cm-md-math-block:hover .cm-md-math-hover-chip` 揭示规则。
  - **缝核查**：math chip class 不被任何缝正则扫描（`e2e/seams/*` 只扫 `.cm-md-code-src-chip`/`.cm-md-block-toolbar-btn` 等）；P24 缝「Fold 先于 Copy」只读代码块工具栏按钮序——本改动零触碰。chip 点击仍冒泡至 `wrapWithGap` click-to-source（chip 无 listener、bar 无 stopPropagation，N3 语义不变）。
- **A2/A3（改规范）**：按 spec 审计结论写成 N2 角色槽位条款 + 表格交互块例外条款，显式记录差异来源（基准截图驱动）。
- **不改其它 widget**：mermaid/code 的形态已被规范收编（audit 一致），零顺手改（SDD 批外纪律）。

## 文件切法

| 源 | 改动 |
|---|---|
| `docs/markdown-ux-optimization.md` | ① 文末新增「附录：块级 chrome 规范」（N1–N4 + 形态索引表）；② 「约束与红线」+1 行（第 11 条指向附录）；③ 勾销 ⑱（收敛时） |
| `editor/blockWidget.ts` | `attachBlockToolbar` 返回 bar（void → HTMLElement） |
| `editor/widgets-math.ts` | MathBlockWidget：chip append 到 bar 作最右元素 |
| `styles/markdown.css` | `.cm-md-math-hover-chip` 改 flex 项（去 absolute/opacity 揭示），删其 hover 揭示规则 |
| `docs/specs/11A-block-chrome-spec/` | spec + plan（本文件）+ 收敛记录 |

## 状态/契约归属

零状态、零 i18n、零新测试（A1 是 DOM 组装顺序 + CSS 布局模式调整，无纯函数逻辑）。class 名全保留（`.cm-md-math-hover-chip`/`.cm-md-block-toolbar`/`.cm-md-block-toolbar-btn`）；`data-op`/命令 id/`__velox*` 零触碰。按钮顺序仅 math 域内（chip 不是按钮，不进 P24 缝的按钮序契约）。

## import 改动面

零新增 import。madge 例行守护。

## 任务拆分

1. 附录成文 + 红线 11 [先行，纯文档]
2. A1 修复（blockWidget/widgets-math/markdown.css）[独立小改]
3. 收敛（门禁 + 审计闭合记录 + 勾销）

## 验证方案

- `npm run typecheck && npm run test:unit`（全量回归）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 无既有字面量改动（class 名/按钮序/`data-op`/`__velox*` 零触碰）
- 人工冒烟（**待运行时冒烟补签**）：
  1. hover 块级公式：「复制」+「公式 </>」同排一簇（chip 贴右角、按钮向左），互不遮挡（对照 `math-hover.png` 的 chip 角位）
  2. 点击 chip / 公式体：进源码编辑（click-to-source 不回退）；点「复制」：✓ 闪现 + toast，不进编辑
  3. 代码块/mermaid hover 工具栏不回退（按钮序：Fold 先于 Copy）
  4. 深浅主题两张对照（chip/按钮走 token）

## 实现细化（2026-09-25 implement 时决策）

- 附录按 plan 落 `docs/markdown-ux-optimization.md` 文末（N1–N4 + 形态索引表）；「约束与红线」+第 11 条指向附录；「清单结构」注记补附录一句。形态索引表内容与代码逐一核对（mermaid 工具栏 4 项 = 复制源码/SVG/PNG/复制图；表格 hover 复制条 `table/widget.ts:376` 挂载）。
- A1 修复按 plan 三文件落地：
  - `blockWidget.ts` `attachBlockToolbar` 返回 bar（`void → HTMLElement`，注释记 11A-N2 用途；全部既有调用方忽略返回值，向后兼容）；
  - `widgets-math.ts` `MathBlockWidget.toDOM`：chip 创建后 append 到 bar 作最右元素（注释改写为 8A 语义 + 11A-A1 修因）；
  - `markdown.css` `.cm-md-math-hover-chip` 去 absolute/opacity 揭示（bar hover 揭示携带），删 `.cm-md-math-block:hover .cm-md-math-hover-chip` 规则。
- 缝面复核：P24 缝「Fold 先于 Copy」只读代码块工具栏按钮序（`.cm-md-block-toolbar-btn`）——math chip 是 span 非按钮、仅 math 域追加，零触碰；`.cm-md-math-hover-chip` class 名保留（CSS/TS 引用不变）。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / 341 例全绿 ✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 4 文件（3 代码 + 看板附录）；`__velox*`/`data-op`/`data-table-handle`/`.cm-md-block-toolbar-btn` 按钮序/`cm-md-code-src-chip` 零触碰（grep 命中仅附录文档引用行）✓
- AC1/AC2/AC4 成立（附录成文 + 红线 11 + A1 改码/A2/A3 改规范显式记录于 spec 审计发现与本记录）；AC3 待运行时冒烟补签（4 点）：
  1. hover 块级公式：「复制」+「公式 </>」同排一簇（chip 贴右角、按钮向左），互不遮挡（对照 `math-hover.png` 的 chip 角位）
  2. 点击 chip / 公式体：进源码编辑（click-to-source 不回退）；点「复制」：✓ 闪现 + toast，不进编辑
  3. 代码块/mermaid hover 工具栏不回退（按钮序：Fold 先于 Copy）
  4. 深浅主题两张对照（chip/按钮走 token）
