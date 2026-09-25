# 7G 实施方案

## 技术决策与理由

- **负 margin 吸收**（spec 核心决策）：`.cm-md-table-wrap` 的 56/28 槽宽保持常驻（滚动口几何，删了把手就被 `overflow-x: auto` 裁剪），布局效果用负 margin 抵消——盒值与状态无关，进/出编辑 0px 位移由构造直接成立（UX-P28 F3 零抖动契约不回退，本项是它的收尾而非推翻）。
- **几何推导**（`--editor-gutter` = 16px，`--table-handle-gutter` = 56px，`--table-col-handle-gutter` = 28px，外层 gap = `--space-2` = 8px）：
  - 横向：`margin-left: calc(16px − 56px)` = −40px → wrap 边盒左缘 = cm-content 左缘 −40；内容盒左缘 = −40+56 = +16 = `.cm-line` 正文左缘 ✓；内容盒宽 = 正文列宽（`margin-right` 不变）→ 表格 `width: 100%` 右缘齐平 ✓。
  - 纵向：`margin-top: −28px` → wrap 边盒上缘 = 外层内容顶 −20（伸进块间空隙）；表格上缘 = 外层内容顶 = 正常块节奏 ✓；外层净高少 28px（死空隙消除）✓。
  - 行把手（`right:100%` + margin 30/4）占 [−38, +12]（cm-content 坐标），wrap padding box 左缘 = −40 → 把手在滚动口内 2px ✓；列把手带 = [表格顶−26, 表格顶−4]，在顶槽内 2px ✓（原 diag-P28 几何原样）。
- **gutter 共存**：行把手左伸与 `.cm-gutters`（z 200）搭接——表格 widget 的 gutter 元素无折叠箭头（空条）、行号数字在 widget 线顶部（与行把手垂直错开）→ 功能零损失；把手 `z-index` 1→210 保证压过 gutter 条可见可点。窄窗（<~800px）/行号开启时小牌与 gutter 条视觉搭接，接受并在冒烟项覆盖。
- **7C 工具栏同步平移**：`bottom` 抬高恰一个槽高（`calc(100% + var(--table-col-handle-gutter, 28px) - var(--space-1))`）→ 「工具栏→列把手带→表格」相对栈位与改造前逐像素一致；`left`/`width` 对齐表格列（`table-focus.png` 观感）。编辑态 chrome 向上 paint-only 覆盖前邻块 ~46px——零位移契约的必然代价（spec 已论证），属 7C 同类先例。
- **纯 CSS 零新测试**（7C/8A/9B/10B 先例）；门禁 = typecheck/test:unit 回归 + madge + 缝核对。

## 文件切法

| 源 | 改动 |
|---|---|
| `styles/markdown.css` | ① `.cm-md-table-wrap` margin 四值（负 margin 吸收）+ 几何注释；② 把手 z-index 1→210（两个变体规则摘出，落到 `.cm-md-table-handle-btn` 基类）；③ `.cm-md-table-toolbar` bottom 抬高 + left/width 对齐表格列 |

## 状态/契约归属

零状态、零 widget TS、零 i21n。class/attr 名全保留（e2e 缝零触碰）；导出侧零改动（导出表格本就满列、无把手）。

## import 改动面

零（纯 CSS）。madge 例行守护。

## 任务拆分

1. wrap 负 margin 吸收 + 把手 z-index [先行]
2. 7C 工具栏平移 [依赖 1]
3. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（全量回归）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动（仅 CSS 属性值/选择器内声明变化）
- 人工冒烟（**待运行时冒烟补签**）：
  1. 静息态：表格左右缘与正文齐平、占满正文列宽、上方无 28px 死空隙（对照 `table-default.png`）
  2. 进/出编辑态：正文与表格 **0px 位移**（DevTools 量下一块 y 坐标）；列宽 grip/列边界不跳
  3. 编辑态把手：行把手在表格外左带、列把手在表头上带，均不遮挡单元格文本；+/−/grip 全可点
  4. 编辑工具栏：⊞/对齐三键/⋮/🗑 全可用，位置在列把手带上方（相对表格同改造前），左缘与表格对齐（对照 `table-focus.png`）
  5. 行号开/关两种配置：把手可见可点、行号数字不被遮挡（数字在 widget 线顶部）
  6. 折叠箭头（邻近标题行）不受影响；宽表内滚 + 列宽拖拽不回退
  7. 窄窗（<800px）：把手可能与 gutter 条搭接但仍可见可点（已知劣化）
  8. 深浅主题两张对照

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 落地，无偏离：`.cm-md-table-wrap` margin 四值负吸收（top −28 / right gutter / bottom 0 / left gutter−56）；把手 `z-index` 从两个变体规则的 `1` 摘出、落到 `.cm-md-table-handle-btn` 基类 210（含 fold-gutter 共存注释）；`.cm-md-table-toolbar` `bottom: calc(100% + 槽高 - space-1)` 抬一槽高 + `left`/`width` 对齐表格列。
- 几何复核：行把手左缘 [−38, +12]（cm-content 坐标）落在 wrap padding box（−40 起）内 2px——槽宽 56px 原设计余量正好兜住负吸收后的滚动口边界，未改把手几何。
- `mountTableToolbar`/widget.ts 零触碰（工具栏定位纯 CSS）；导出侧确认零改动（导出表格满列、无把手）。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / 339 例全绿（全量回归）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 仅 `styles/markdown.css` 一文件（属性值/注释）；`data-table-handle` 五值、`dataset.tableFrom`、`.cm-md-table-handle-btn`/`.cm-md-table-toolbar` class、`__velox*` 零触碰 ✓
- AC1–4 构造性成立（盒值状态无关 = 0px 位移；把手几何 = 现状同位）；待运行时冒烟补签（8 点）：
  1. 静息态：表格左右缘与正文齐平、占满正文列宽、上方无 28px 死空隙（对照 `table-default.png`）
  2. 进/出编辑态：正文与表格 0px 位移（DevTools 量下一块 y）；列宽 grip/列边界不跳
  3. 编辑态把手：行/列把手不遮挡单元格文本，+/−/grip 全可点
  4. 编辑工具栏：⊞/对齐三键/⋮/🗑 全可用，栈位同改造前、左缘对齐表格（对照 `table-focus.png`）
  5. 行号开/关：把手可见可点、行号数字不被遮挡
  6. 邻近标题折叠箭头不受影响；宽表内滚 + 列宽拖拽不回退
  7. 窄窗（<800px）把手与 gutter 条搭接但可点（已知劣化）
  8. 深浅主题两张对照
