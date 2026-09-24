# 8B 实施方案

## 技术决策与理由

- **路线 = P28 文本源码双区**（决策点"plan 择一"）：TeX 源码留在文档里直接编辑，编辑态 = 装饰层拼装「面板 chrome + chip + 尾随预览 widget」。否决表格 nestedSession 路线：嵌套会话带来 pendingHandoff 类正确性风险、独立 undo 历史与主文档 undo 纠缠（AC5 直接受损），而数学源码是纯文本无需单元格级 inline live preview。
- **预览 = 尾随 block widget**：`Decoration.widget({ block: true, side: 1, widget: MathPreviewWidget(tex) })` 挂在块末（lineTo）。widget 只含 `renderKatexHtml(tex, true)`（与 `MathBlockWidget` 同函数——same-shell 契约，无效 TeX 天然红色错误态，AC2/3 免费成立）。`eq(tex, i18nEpoch)`——逐键重建时仅内容变才换 DOM。
- **chip = 面板首行内绝对定位 widget**（AC7 零布局成本）：行 class `cm-md-math-src-first` 给 `position: relative`，chip `position: absolute; right; top`。定界符 `$$` 保持可见（不像 P28 隐藏 fence——`math-focus.png` 显示 `$$…$$`，且定界符正是待编辑文本）。点击 chip / Escape → `exitMathEdit(view)`：选区移到块后（`exitTableEdit select:'after'` 同款语义）→ blockTouched 解除 → 下次重建回纯渲染。
- **Escape 绑定置于 searchKeymap 之后**：搜索面板开着时 Escape 先关面板（searchKeymap 命令未命中返回 false 才落空到本绑定）；本绑定仅在光标处于数学块内接管。与 7B 的 tableStructBindings（置于最前）不同位置是刻意的——那组是结构性编辑键（须压过 defaultKeymap 的 Alt 移行），本组是退出键（须让位于搜索）。
- **正则抽取 `livePreview/mathScan.ts`（纯函数 + 单测）**：multi/single/inline 三形态扫描 + 重叠剔除逻辑从 `handlers-math.ts` 抽出为 `scanMath(text, offset)`、`findMathBlockAt(text, pos)`（chip/Escape 用）。handlers 只留 skip-range/touched/装饰分支——regex 真源一处，⑩（错误跳源）也用它。
- **共用机制沉淀（④ 复用面）**：`livePreview/dualPane.ts` 提供 `previewBelow(pos, widget)`（尾随 block widget 装配）+ 面板行 class 命名/首行 chip 绝对定位的 CSS 约定注释。行 class 循环不强行抽象（math/code 各自承载不同 chrome 名）。④ = buildFocusedCodePanel 既有面板 + `previewBelow` 挂 MermaidPreviewWidget。
- **8A hover 带 = 纯 CSS + 一个 chip 元素**：`MathBlockWidget.toDOM` 追加 `.cm-md-math-hover-chip`（文本「公式 `</>`」，title 进源码提示），底纹带 `.cm-md-block-gap:hover` 背景（token）。chip 点击冒泡到 wrapWithGap 的 click-to-source（无需独立 handler——AC9 同语义）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/livePreview/mathScan.ts` | **新建**：`scanMath`/`findMathBlockAt` 纯函数（三形态 + 重叠剔除） |
| `editor/livePreview/mathScan.test.ts` | **新建**：扫描/定位单测 |
| `editor/livePreview/handlers-math.ts` | `collectMathDecos` 换用 `scanMath`；blockTouched 分支改走 `buildFocusedMathPanel`（行 class + chip + `previewBelow`） |
| `editor/livePreview/dualPane.ts` | **新建**：`previewBelow(pos, widget)` 小助手 + 双区约定注释 |
| `editor/widgets-math.ts` | 新增 `MathPreviewWidget`（`eq(tex, i18nEpoch)`、`ignoreEvent: true`）与 `MathEditChip`（点击 → `exitMathEdit`）；`MathBlockWidget.toDOM` 追加 hover chip（8A） |
| `editor/mathEdit.ts` | **新建**：`exitMathEdit(view)`（`findMathBlockAt` + 选区移到块后）+ `mathEditExitBindings`（Escape） |
| `editor/setup.ts` | keymap.of 中 searchKeymap 之后并入 `mathEditExitBindings` |
| `styles/markdown.css` | `.cm-md-math-src*` 面板行 class（复用 code-src 同 shell 视觉语言）、`.cm-md-math-preview`、`.cm-md-math-edit-chip`（绝对定位）、`.cm-md-math-hover-chip` + hover 底纹带（8A）——全走 token |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +3 key（`math.chipLabel`/`math.chipEnterTitle`/`math.chipExitTitle`） |

## 状态/契约归属

无新状态（无 StateField/无存储）。chip/Escape 都是"移动选区"一次性事务。e2e 契约零改动。

## import 改动面

`mathEdit.ts` → `mathScan` + CM keymap；`widgets-math.ts` → `mathEdit`（chip 回调）；`handlers-math.ts` → `mathScan`/`dualPane`/`widgets-math`（既有面）。`mathEdit` 不 import widgets——无环。`npx madge --circular` 守护。

## 任务拆分

1. `mathScan.ts` + 单测 [先行]
2. `dualPane.ts` + `widgets-math.ts` 两个新 widget + `mathEdit.ts` [依赖 1]
3. `handlers-math.ts` 聚焦面板分支 + CSS + i18n [依赖 2]
4. `setup.ts` Escape 并入 + 8A hover chip/底纹 [依赖 3，P]

## 验证方案

- `npm run typecheck && npm run test:unit`（mathScan 单测全绿、i18n 对齐过）
- 人工冒烟（对照 `math-default.png`/`math-hover.png`/`math-focus.png`）：
  1. 静息态零 chrome 居中渲染不变；hover 出底纹带 + 「公式 `</>`」chip，移出即隐；点击进双区
  2. 聚焦 `$$…$$`（多行/单行两态）：上源码（`$$` 可见、面板 chrome）+ 下实时预览；键入预览逐键刷新
  3. 故意写坏 TeX：预览红色错误态，源码继续可编辑
  4. 「公式 ✓」点击退出、Escape 退出——都回纯渲染；undo 键入逐步回退、退出位移一步回
  5. 行内公式显隐不变；搜索面板开着按 Escape 先关面板；非数学块 Escape 不被劫持
  6. 深浅主题两张对照
- e2e 缝：grep diff 确认既有字面量零改动

## 实现细化（2026-09-24 implement 时决策）

- **`scanMath` = 行为保持抽取**（非修 bug）：matchAll 在**被拒匹配**上也推进 lastIndex 的 quirk、mid-line `$$z$$` 泄漏内层 `$z$`、`content.includes('$$')` 对 `[^$\n]` 内容恒假的死检查——全部按抽取前语义原样保留，测试用例显式记录（后续如修另立任务；export 平行契约不受影响——两侧都没改语义）。
- **`previewBelow` 位置取 `Math.min(last.to + 1, doc.length)`**（块末行的下一行起点/文末）：块级 widget 的行边界吸附行为以冒烟实测为准（本仓首个 `Decoration.widget({ block: true })` 用法）；若落位异常改 side/pos 很小。
- **`MathEditChip` 用 `toDOM(view)` 直调 `exitMathEdit(view)`**，不持闭包（`eq` 只比 i18nEpoch，旧 DOM 复用时无 stale 闭包风险）。
- **Escape 绑定位置刻意在 searchKeymap 之后**（与 7B tableStructBindings 置最前相反）：退出键让位于搜索面板关闭；仅光标在数学块内接管（`findMathBlockAt` 命中才 return true）。
- **`$$` 定界符编辑态保持可见**（不像 P28 隐藏 fence——`math-focus.png` 显示 `$$…$$`，且定界符是待编辑文本）；chip 不替换任何文本（纯插入 widget，绝对定位）。
- **8A hover 带 = `.cm-md-math-block:hover` 自身 box 的 token 底面 + 圆角**（块已有 `margin: 0 var(--editor-gutter)`，带宽即正文列宽）；chip 复用块 `position: relative` 锚点，点击冒泡 wrapWithGap click-to-source（无独立 handler）。
- **预览错误态零新渲染路径**：`renderKatexHtml`（throwOnError: false）的 `.katex-error` 红字即错误态（AC3）；不改渲染函数（export 平行契约）。
- **userEvent `select.math.exit`**（对齐 `select.table.exit` 命名）；不进任何 toast 表。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓ 29 files / 297 tests（新增 `mathScan.test.ts` 8 例：multi/single/inline 扫描、重叠剔除、offset、findMathBlockAt 命中/未命中/inline 不命中）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles
- e2e 缝核对：diff 内零既有字面量改动（无 `__velox*`/`data-op`/命令 id 触碰）
- AC1–10 逐条核对：双区/实时刷新/错误态/chip+Escape 退出/undo 文本事务/行内不变/零布局（chip 绝对定位）/hover 带+chip/click-to-source 同语义/token 化——逻辑路径全通
- 人工冒烟（对照 math-default/hover/focus 三图、深浅主题）**待运行时补签**，重点实测点：① 预览 widget 落位（块级 widget 行边界吸附）② 面板行 class 拼缝观感 ③ Escape 在搜索面板开/关两态
