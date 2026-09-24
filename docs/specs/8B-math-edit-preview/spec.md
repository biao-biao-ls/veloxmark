# 8B 公式编辑态源码/预览双区（任务 8.2，含 8.1 hover 提示带）

## What / Why

聚焦编辑 `$$…$$` 时不再整块塌回裸源码：改为**上方源码区（面板 chrome）+ 下方实时 KaTeX 预览**，右上「公式 ✓」chip / Escape 退出回纯渲染态（对照 `temp/typora/math-focus.png`）。这是公式 UX 头号差距——现在编辑公式完全看不到渲染效果。本项沉淀「块内源码/预览双区」共用机制（面板 chrome + 尾随预览 block widget），④（10A mermaid 就地双区）直接复用。

**看板 ⑧（8.1 hover 提示带）按队列许可并入本 spec 一并做**（"chip 本就是双区编辑的入口"）：hover 块级公式显示整行浅灰底纹带 + 右上「公式 `</>`」chip，点击进源码编辑（= 现 click-to-source）。见「含 8A」节。

## 背景与现状

- 数学是**正则 pass**（`livePreview/handlers-math.ts`，无 lezer 节点）：multi-line `$$\n…\n$$`、single-line `$$…$$`、inline `$…$`；`blockTouched` 时 `continue` = 裸源码，无任何 chrome/预览——差距本体。
- 渲染态：`widgets-math.ts` `MathBlockWidget`（`BlockWidget` 基类：click-to-source + hover 工具栏「复制 TeX」+ wrapWithGap）。
- `renderKatexHtml`（`render-helpers.ts`）：`throwOnError: false`——无效 TeX 以 KaTeX 错误标记（红色 `.katex-error`）内联呈现，永不抛错；export 平行契约共用，不改。
- **路线先例**：P28 聚焦代码面板（`handlers-code.ts` `buildFocusedCodePanel`）——文本留在文档里直接编辑（无嵌套编辑器）、逐行 class 拼面板、开栏 mark 替换为 chip、P09 markTouched 显隐。③ 走同一路线（**不**走表格 nestedSession 路线：TeX 源码就是文档文本，嵌套会话徒增 pendingHandoff 类正确性风险且破坏单文档 undo）。
- 装饰重建已按文档变化全量进行——预览 widget `eq(tex)` 跟随每次键入即"实时刷新"。

## 验收标准（AC）

### 主体（8.2）

1. 聚焦（光标进入）`$$…$$` 块（multi-line 与 single-line 两种形态）：呈现**上方源码区 + 下方实时 KaTeX 预览**；源码区带面板 chrome（逐行 class 拼边框/底面，同一 shell 视觉语言）；`$$` 定界符保持可见（对照 `math-focus.png`）。
2. 编辑源码时预览随每次装饰重建刷新（逐键即实时；KaTeX 渲染挂在预览 widget `eq(tex)` 差异上）。
3. 无效 TeX：预览区显示 KaTeX 错误态（`.katex-error`），源码区可继续编辑（文档文本路径天然成立）。
4. 右上「公式 ✓」chip（绝对定位于面板首行右上，不占布局）点击退出编辑；**Escape** 亦退出（光标移出块后 = 回纯渲染态）。退出等价于"光标离开块"（blockTouched 解除）。
5. undo 语义不破坏：编辑全程是主文档文本事务，undo 逐步回退键入/退出位移一步回块内——无第二份历史。
6. 行内公式（`$…$`）编辑行为不变（显隐仍是 P09 markTouched；hover 是 ⑰ 另管）。
7. 零布局抖动红线遵守：chip 绝对定位零布局成本；双区展开只占本块自身 box（源码行 + 尾随预览 widget 的自然高度），gap 用 padding（wrapWithGap 惯例）；不额外引入 margin 抖动。

### 含 8A（8.1 hover 提示带，看板 ⑧）

8. hover 静息态块级公式：整行浅灰底纹带 + 右上「公式 `</>`」chip；移出即隐。
9. 点击行为与现 click-to-source 一致（点击公式任意处/chip → 进入源码编辑 = 8.2 双区）；hover 带不改 P09 语义（纯 CSS/装饰层）。
10. 深浅主题走 token（`--widget-surface`/`--border`/`--fg-dim` 族）；不新增 `.theme-dark` 选择器补丁。

## 约束

- 无 TeX 语法高亮器——源码区**不做着色**（`math-focus.png` 的着色不进本项 AC；后续如需另立）。
- i18n 新 key 必须 en+zh 同落（`math.chipLabel`/`math.chipEnterTitle`/`math.chipExitTitle`）；i18n 对齐测试守护。
- e2e 缝零破坏：既有 `__velox*`/`data-op`/命令 id 字面量零改动。
- 正则 pass 仍在树 pass 之后（ORDER CONTRACT 不变）；skip-range（code/URL 内部）语义不变。
- `renderKatexHtml` 不改（export 平行契约）；预览与静息态渲染同函数（same-shell）。
- Escape 绑定不得劫持全局：仅光标在数学块内时接管，否则落空（搜索面板 Escape 优先级高于本绑定）。
