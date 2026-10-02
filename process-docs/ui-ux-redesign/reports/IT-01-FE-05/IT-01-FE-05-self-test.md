# IT-01-FE-05 自测报告 — ⊞ 网格选择器可选范围改造（max(20,R0)×max(12,C0) 动态上界/拖选缩放/超限表可选）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-05.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 验收：AC-RULE-12 / AC-OP-07 / AC-ERR-13 / AC-FN-04 / UI-IXD-02 / UI-ELEM-02
- 实现图：`IT-01-FE-05-impl.png`（表格编辑态 + ⊞ 网格选择器浮层，对照 ui_02 同区域全页静态态）
- 超限矩阵图：`IT-01-FE-05-overlimit-matrix.png`（25×15 表全选区 + 滚动条 + 读数 25 × 15 + 4 预设按钮）

## 1. 可选范围动态上界（AC-RULE-12 / AC-FN-04）

单测 `gridPicker.test.ts` → `gridUpperBound` 4 用例 + 边界钳制：

| 输入 R0×C0 | 上界 | 判定 | 结果 |
|---|---|---|---|
| 25×15（超限） | 25×15 | 逐维 max，不截既有结构 | ✓ |
| 25×10 | 25×12 | 行超限取 25，列落回下限 12 | ✓ |
| 5×5 | 20×12 | 双维均落回下限 20×12 | ✓ |
| 非法（0/-1/NaN） | 20×12 | 先回退 1×1 再取 max，下限不塌 | ✓ |
| 25.7×15.2 | 25×15 | `Math.trunc` 向零截断 | ✓ |

浏览器复核（25×15 表）：⊞ 打开后矩阵 `data-row` 达 25、`data-col` 达 15，读数初始化「25 × 15」，格点区限高滚动（60vh/12 行高双上限）——AC-FN-04「网格按当前表格行列数显示对应可选范围」✓。

键盘边界（`gridPickerKey` 单测）：方向键在 20×12 与 25×15 两种 bounds 下均钳制在 `[1, maxRow]×[1, maxCol]`，越界按键不再越界（AC-RULE-12 运行时派生常量生效）✓。

## 2. 拖选缩放 + 冻结 toast + 一次撤销（AC-OP-07）

测试表 25×15（表头 `H1…H15`，body `r{r}c{c}` 唯一格文，可验内容保留/尾部裁剪）。

| 步骤 | 操作 | 读数/结果 | toast（冻结文案） | 一次 Ctrl+Z | 结果 |
|---|---|---|---|---|---|
| 拖选 | mousedown(1,1) → mouseenter(3,3)/(4,3) → mouseup(4,3) | 拖动中读数「4 × 3」；松开后关浮层 | 「表格缩放为 4×3（Ctrl+Z 可撤销）」 | 还原 25×15 | ✓ |
| 内容语义 | 缩至 4×3 | 前 4 行×前 3 列内容原位保留（`H1/H2/H3`、`r2c1…r4c3`），尾行尾列出表 | 同上 | 逐字节还原 | ✓ |
| 1×1 极小 | 预设/拖选均可到 1×1 | 1×1 表合法 | 「表格缩放为 1×1（Ctrl+Z 可撤销）」 | 还原 25×15 | ✓ |

交互语义钉子（实现要点）：确认发生在 **mouseup 一次**（press-drag-release，`dragging` 标志 + document mouseup；单元格 click 处理已移除，避免按下/松开跨格时 click 落公共祖先造成双发或漏发）。mouseup 落在预设按钮上时放弃该次确认（预设走自身 click 路径，防双挑）。

## 3. 超限区可选/可确认（AC-ERR-13）

| 步骤 | 操作 | 期望 | 实测 | 结果 |
|---|---|---|---|---|
| 超限格存在 | 打开 25×15 表的 ⊞ | 格 (25,15) 可寻址、读数 25×15 | `data-row="25" data-col="15"` 命中，读数「25 × 15」 | ✓ |
| 超限区拖选 | mousedown(1,1) → hover(21,13) → hover(22,14) → mouseup | 读数 22×14 并确认缩放 | 读数「22 × 14」→ 表变 22×14 | ✓ |
| toast | 同上 | 冻结文案含实值 | 「表格缩放为 22×14（Ctrl+Z 可撤销）」 | ✓ |
| 一次撤销 | Ctrl+Z | 还原 25×15 | 25×15 | ✓ |

行 21–25 / 列 13–15 均在网格内可 hover/拖选/确认——超限表不截断既有结构、可选范围随表放大 ✓。矩阵视觉证据见 `IT-01-FE-05-overlimit-matrix.png`。

## 4. 预设按钮组（任务交互 #3）

页面元素表 #3 要求读数下方 4 预设：1×1 / 2×2 / 3×3 / 自动适应窗口（ui_02 mock 无此组，属任务可溯源偏离，已记 CHANGE-9）。

| 预设 | data-testid | 点击后表维度 | toast | 一次 Ctrl+Z | 结果 |
|---|---|---|---|---|---|
| 1×1 | `grid-preset-1x1` | 1×1 | 「表格缩放为 1×1（Ctrl+Z 可撤销）」 | 25×15 | ✓ |
| 2×2 | `grid-preset-2x2` | 2×2 | 「表格缩放为 2×2（Ctrl+Z 可撤销）」 | 25×15 | ✓ |
| 3×3 | `grid-preset-3x3` | 3×3 | 「表格缩放为 3×3（Ctrl+Z 可撤销）」 | 25×15 | ✓ |
| 自动适应窗口 | `grid-preset-autoFit` | 25×10（fitWidth=1038，⌊1038/96⌋=10；行数保持 R0=25） | 「表格缩放为 25×10（Ctrl+Z 可撤销）」 | 25×15 | ✓ |

- 预设与拖选同走 `onPick` → `resizeTableOp` 单事务（FE-01 语义：参差补齐、尾部生长/裁剪、同形返回 null 无事务）——撤销边界一致（一次 Ctrl+Z 还原）✓。
- 预设 mousedown `preventDefault`（不触发外点关闭、不触发拖选确认），click 独立确认 ✓。
- 自动适应窗口列数估算 `estimateAutoFitCols(fitWidth, maxCols)` = `clamp(⌊fitWidth/96⌋, 1, maxCols)`，行数保持当前 R0——任务称「既有窗口宽度估算列数逻辑」但仓内无此实现，自创名义列宽 96px 折算（`GRID_AUTO_FIT_COL_PX`），单测钉住钳制边界；已记 CHANGE-9。

## 5. UI-ELEM-02 / UI-IXD-02（浮层可见可辨 + 交互即验）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 浮层非空白（PRD「⊞ 网格选择器空白」缺陷面） | 表面/格点/选区均有实色 | 挂载修复后 `--widget-surface`/`--bg`/`--accent-soft-strong` 全部解析出实值（pickBg rgb(250,250,250)、选区 accent-soft-strong、选区边框 accent） | ✓ |
| 挂载点 | 主题变量在 `.app.theme-*` 下声明（非 `:root`） | `anchor.closest('.app')` 挂载，实测 parent=`app theme-light` | ✓ |
| 边界可辨 | 格点/选区/锚点三层可辨 | 未选格 `--bg`+`--bg-inset` 边；选区 `--accent-soft-strong` 底+`--accent` 边；锚点格实心 `--accent`（见 impl.png 5×4 选区右下锚点） | ✓ |
| 读数 | 「R × C」居中、`--fg-dim` | 「5 × 4」样式符合 ui_02 `.grid-pop-label` | ✓ |
| 样式纪律 | token 化、无裸 px 新值 | 格点尺寸/间距用 FE-11 `--grid-cell-size/--grid-cell-gap`；间距 `--space-*`、圆角 `--radius-*`；表面 `--widget-surface`、阴影 `--shadow-pop` | ✓ |
| 交互元素 testid | kebab-case | `grid-picker` / `grid-cell` / `grid-picker-readout` / `grid-preset-1x1|2x2|3x3|autoFit` | ✓ |
| 浮层边界内可达 | 超限矩阵不溢出屏 | 格点区 `max-height: min(60vh, 12 行高)` + overflow-y auto；定位挂载后按 `offsetWidth/Height` 钳制视口 | ✓ |
| 外点/Esc 取消 | 零变化关闭 | 外点 mousedown capture 关浮层；Esc `gridPickerKey→close` | ✓ |

实现图 `IT-01-FE-05-impl.png`：4×3 表 + 网格浮层（选区 5×4 高亮含锚点、读数、4 预设）全页静态态，与 ui_02_table_edit.html 的 `.grid-pop` 区域同区对照。

## 6. AC 验收证据映射

- **AC-RULE-12**（动态上界 max(20,R0)×max(12,C0)，缩放仅按拖选值）：§1 单测表 + §2 缩放仅取 pick 值（含 1×1 极小）；`gridUpperBound` 逐维 max，非法回退不塌下限。
- **AC-OP-07**（拖选松开触发 + 冻结 toast + 一次撤销）：§2 全表；toast 参数 `{R,C}` 实值插值由 `frozenCopy.test.ts` 冻结文案 + `toast.tableResized` 传参钉住。
- **AC-ERR-13**（超限表可选/可确认）：§3 全表 + overlimit-matrix.png。
- **AC-FN-04**（网格显示当前可选范围）：§1 浏览器复核（25 行×15 列格点实际渲染）。
- **UI-IXD-02**（按住拖选松开的交互口径）：§2 press-drag-release 确认语义（mouseup 单次确认、预设路径防双挑）。
- **UI-ELEM-02**（无空白不可见、边界可辨）：§5 全表 + impl.png。

## 7. 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error** ✓ |
| 单测 | `npm run test:unit` | **55 文件 686/686 全绿**（含本任务 gridPicker.test.ts 13 用例：RED 确认 `gridUpperBound is not a function` 后 GREEN）✓ |
| Lint | 项目无 lint 脚本 | 跳过 |
| 构建 | `npm run build` | 同 worktree 收敛时已过（electron-vite 产物已用于 CDP 实测，bundle hash 与实现一致） |
| cdp 冒烟 | `npm run test:smoke` | worktree 无该脚本；e2e 缝未破坏（`data-op="resizeTable"` 保留、`window.__veloxTable`/`__veloxP12`/`__veloxP23` 仅消费未改形、命令 id `input.table.resize` 复用） |

TDD 记录：先落 13 用例跑出 RED（`gridUpperBound is not a function`）→ 实现 `gridPicker.ts` 纯函数面 → 13 全绿 → UI/交互面经 CDP 逐条实测（§2–§5）。

## 8. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `src/renderer/src/editor/table/gridPicker.ts` | 全量改造：`gridUpperBound` 运行时上界（max(20,R0)×max(12,C0)）；`gridPickerKey` 带 bounds 钳制；`GRID_PRESETS`/`presetDims`/`estimateAutoFitCols` 预设纯函数；DOM 单例浮层（动态列模板、限高滚动、读数、4 预设）；press-drag-release 单次确认（mouseup）；挂载进 `anchor.closest('.app')`（主题变量真源，修空白缺陷）；定位挂载后钳视口 |
| `src/renderer/src/editor/table/gridPicker.test.ts` | 13 用例：上界 5 族、bounds 键控 3 族、autoFit 估算钳制、预设维度、冻结 toast 1×1 插值 |
| `src/renderer/src/editor/table/commands.ts` | `STRUCTURE_TOASTS` 增 `'input.table.resize': 'toast.tableResized'`；`runTableOp` 解析 `nextTable` 供 toast 传参 `{R,C}`（delete 行/列 `{i,j}` 路径不变） |
| `src/renderer/src/editor/table/toolbar.ts` | `openGridPicker` 传 `fitWidth: view.dom.clientWidth`（自动适应窗口估算源） |
| `src/renderer/src/i18n/zh.ts` / `en.ts` | 各 +4 key：`table.gridPreset1x1/2x2/3x3/AutoFit`（1×1 / 2×2 / 3×3 / 自动适应窗口·Fit to window） |
| `src/renderer/src/styles/overlays.css` | 7E/FE-05 区重写：`.table-grid-picker`（flex 列 + `--widget-surface`/`--radius-md`/`--shadow-pop`）、格点区（`--grid-cell-*` + 限高滚动）、`.table-grid-cell` 三层态、读数、预设组（`.btn` 族复用 + 本地几何） |

## 9. 动态发现 / 实现决策（已回写任务 frontmatter + CHANGE-9）

1. **主题变量挂载点**：`--widget-surface`/`--bg`/`--accent-*` 声明在 `.theme-light/.theme-dark`（`DIV.app`）而非 `:root`——body 直挂的浮层取不到任何主题变量即呈现空白（PRD ⊞ 网格选择器空白缺陷的根因）。修复：`anchor.closest('.app') ?? document.body` 挂载。后续任何 body 直挂浮层均须走同一挂载口径。
2. **AC-OP-07 确认时点**：「按住…拖选…并松开」= mouseup 确认一次，不是 click（mousedown/mouseup 跨格时 click 不命中格元素）。拖选确认与预设 click 双路径须防双挑（mouseup 落预设区则放弃）。
3. **自动适应窗口**：任务文案「按既有窗口宽度估算列数逻辑」查无既有实现——自创 `estimateAutoFitCols`（fitWidth/96px 名义列宽，钳 [1, maxCols]，行数保持 R0），单测钉住；如后续有正式窗口宽度规则，替换该纯函数即可（接缝单一）。
4. **toast 派发层**：resize toast 挂 `runTableOp` 的 `STRUCTURE_TOASTS`（与 deleteRow/Col 同层），菜单/工具栏/预设三入口一份文案；`toast.tableResized` 传参 `{R,C}` 为缩放后实值。
5. **预设按钮偏离 ui_02**：mock 无预设组，按任务页面元素表 #3/交互 #3 落地（可溯源到任务 AC/交互要求）——见 CHANGE-9。

## 10. 阶段 3 联调移交项（主 agent 编排）

1. **FE-06（列宽）**：缩放插/删列时列宽表如何随列对齐由 FE-06 `insertColWidths` 同族接缝决定；本任务 `resizeTableOp` 尾部生长/裁剪未接列宽表（FE-01 语义原样），联调确认缩放后列宽无残影即可。
2. **FE-07（撤销按钮面）**：toast「（Ctrl+Z 可撤销）」后缀已含于冻结文案；撤销按钮与 Ctrl+Z 等效入口归其回执面。
3. **QA 冒烟**：重点扫超限表（>20 行或 >12 列）⊞ 矩阵滚动可达 + 拖选确认 + 一次撤销；浅/深主题下浮层非空白（本任务只实测浅色，深色 token 同源翻值，建议抽验一眼）。
