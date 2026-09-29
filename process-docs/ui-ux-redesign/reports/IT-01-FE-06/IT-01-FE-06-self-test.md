# IT-01-FE-06 自测报告 — 列宽拖拽右邻吸收改造（总宽不变/最右列例外/列宽钳制/防误触）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-06.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 验收：AC-OP-11 / AC-ERR-03 / UI-IXD-16
- 实现图：`IT-01-FE-06-impl.png`（编辑态表格，列宽 140/61/129 钳制后静态状态）

## 1. 列宽数值对照表（右邻吸收 before/after）

测试表（3 列）：`| Alpha | Beta | Gamma |`，正文列宽（`.cm-md-table-wrap.clientWidth`）= 331px，`MIN_COL_WIDTH = 48`。

### 1.1 中间列边界拖拽（右邻吸收，总宽不变）

拖拽第 0 列右边界 +30px：

| 列 | 拖拽前 (px) | 拖拽后 (px) | 变化 |
|---|---|---|---|
| col0 (Alpha) | 110 | 140 | +30 |
| col1 (Beta) | 91 | 61 | −30 |
| col2 (Gamma) | 129 | 129 | 0（不参与） |
| **总宽** | **330** | **330** | **0（不变）** |

- 对和不变量：col0+col1 拖拽前 201 = 拖拽后 201 ✓（仅 j 与 j+1 此消彼长）
- 存储读回：`tableColWidths["…/fe06-test.md"]["9"] = [140, 61, 129]`（tableFrom=9，500ms debounce 后入 session）

### 1.2 最右列边界拖拽（总宽例外，可增减）

| 操作 | col0 | col1 | col2 | 表总宽 | 说明 |
|---|---|---|---|---|---|
| 基线（auto 实测） | 110 | 91 | 129 | 330 | 未钉宽 |
| 最右列 −80px | 110 | 91 | 49 | **250** | 总宽随最右列收缩 −80 |
| 最右列 +80px | 110 | 91 | 129 | **330** | 总宽回涨 +80 |
| 最右列 +40px（从 auto 基线） | 110 | 91 | 130 | 332 | **钳制**：w_max = 正文列宽 − Σ其余 = 331−201 = 130，总宽封顶正文列宽，不溢出 |

- 最右列是唯一允许改变总宽的边界 ✓（中间边界总宽恒定）
- 钳制上下界：`w ∈ [48, 正文列宽 − Σ其余]`，单测另有 `w ∈ [min, max]` 与退化（min 优先）断言

### 1.3 钳制与防误触

| 场景 | 输入 | 结果 | 判定 |
|---|---|---|---|
| 拖到 0/负宽 | 最右列 −200px（w=−71） | 夹到 48px（MIN_COL_WIDTH） | ✓ 不出现 0/负宽 |
| 总宽溢出 | 最右列 +40px（w=169） | 夹到 130px，总宽 332≤正文列 | ✓ 不溢出正文栏 |
| 误触（点击未动） | mousedown+mouseup，dx=0 | `dragEndWidths → null`，live 涂装 revert，**不 dispatch** | ✓ 列宽与 session 均不变 |
| 误触（抖动 1px） | dx=1 < `DRAG_COMMIT_MIN_PX`(2) | 同上，无写回 | ✓ |
| 有效拖拽阈值 | dx=30 / dx=−60 | 正常提交（\|dx\|≥2） | ✓ |

防误触机制：拖拽期 `setPointerCapture`（合成事件降级到 document 监听兜底）+ 结束阈值 `isDragCommit(dx)`（2px，常量 `DRAG_COMMIT_MIN_PX`）。**阈值内松手 = 完全不写 `setColWidth`**（不是"存前值再还原"方案）。

## 2. AC 验收证据

### AC-OP-11 拖拽指示线、宽度随鼠标、写会话不写 .md、一次 Ctrl+Z 还原

| Then | 证据 |
|---|---|
| 拖拽中指示线 | `mousedown→mousemove` 后 DOM 出现 `.cm-md-col-drag-line[data-testid=col-drag-line]`，`display:block`，`left` 跟随 `clientX`（wrap 内绝对定位）；松手即 `remove()`。样式走 token：`width: var(--border-width)`、`background: var(--drop-indicator, var(--accent))` |
| 宽度实时跟随鼠标 | 拖拽中（mouseup 前）读 `col[data-col]`：第 0 列边界 −200px 时实时 `[auto, auto, 48px]`、`table.style.width=250px` |
| 只写会话不写 .md | 拖拽只 `dispatch({effects: setColWidth})`（零 doc change）；`.md` 源文不变；500ms debounce 后 `localStorage['veloxmark.session'].tableColWidths[filePath]` 出现 `[140,61,129]` |
| 一次 Ctrl+Z 还原 | 拖拽后 `[140px,61px,129px]` → 一次 Ctrl+Z → `[auto,auto,auto]`（= 拖前空映射）；机制：`colWidthHistory`（`invertedEffects.of(invertColWidths)`）注册进 `history()`，effect-only 事务进撤销栈，undo 反演回拖前宽 |

会话恢复（刷新/换文件）：

| 路径 | 结果 |
|---|---|
| 切到另一文件再切回 | `restoreColWidths` 全量换图 → 列宽 `[140px,61px,129px]`、`table.style.width=330px` 复原 ✓ |
| 整页 reload 后 `loadDoc(同 path)` | 同上复原 ✓（真实刷新路径，React 挂载时 effect 必跑） |
| 同 path 连续 `loadDoc`（不换文件） | 不触发 `[filePath]` effect、不重放 restore（与 useFoldSync 同口径既有限制，非 FE-06 回归） |

### AC-ERR-03 结构变更列宽钳制（失效/超界复位默认、不残留错位）

结构 op 与列宽 remap **同一事务**（one Ctrl+Z 同时还原结构与列宽）：

| 操作 | 列宽 before | 列宽 after | 判定 |
|---|---|---|---|
| `insertCol` at 0（3→4 列） | `[140, 61, 129]` | `[auto, 140, 61, 129]` | 新列 0 走默认（0=auto），旧列整体右移一位、数值不串位 ✓ |
| 一次 Ctrl+Z | `[auto, 140, 61, 129]` | `[140, 61, 129]`（3 grip） | 结构+宽度单步还原 ✓ |

- 纯函数面（25 个新单测）：`insertColWidths` / `deleteColWidths` / `moveColWidths` / `sanitizeWidths`（NaN/-5/30/900 等非有限或越界 → 0 复位默认；长出新 colCount 的残留丢弃；不足补默认）。
- 四个 dispatch 面全部接线（同一 `colWidthRemapEffect`）：`runTableOp`（工具栏/快捷键）、opsTable 内联 `runOp`（右键/⋮ 菜单）、`resizeTableOp`（恒等 remap + sanitize 收边）、`__veloxTable.op` 探针。
- 残留说明：`tableColWidths` 为 offset 键映射，整文档替换会留下 mapPos 残键（实测出现过 `"110"` 孤键）——与 useFoldSync 同级既有特性，孤键指向已消失的表格、不参与任何列宽读取；表格自身的列宽数组始终经 `sanitizeWidths` 夹紧，无列内错位。

### UI-IXD-16 边界拖拽热区、拖拽中指示线、松手生效

- 热区：表头 `th` 内 `.cm-md-col-grip`（`data-table-handle="col-grip"` + `data-testid="col-grip"` + `data-col`），editing 态每列 1 个（实测 3 个）。
- 指示线：见 AC-OP-11 Then1。
- 松手生效：宽度只在 `mouseup` 的 `dragEndWidths` 提交（含阈值判定）；拖拽中仅 DOM 涂装（revert 可回滚），不进 state/undo 栈。

## 3. 阶段 3 联调证据

| 项 | 结果 |
|---|---|
| FE-03 col-grip 契约完好 | editing 态 `data-table-handle` 集合 = `{col-grip}`（3 个 grip），无增删把手回归；额外挂 `data-testid="col-grip"`（frontend-dev 交互元素铁律，additive） |
| FE-01 结构 op 同事务钳制 | 见 AC-ERR-03 表：insertCol → `[auto,140,61,129]`，一次 Ctrl+Z 全还原 |
| 主题 token 翻值 | 指示线 `var(--drop-indicator, var(--accent, #4a9eed))`、`var(--border-width)`；`.app.theme-light` → `--drop-indicator: rgba(9,105,218,.35)` / `--accent: #0969da`，`.app.theme-dark` → `rgba(88,166,255,.45)` / `#58a6ff`（翻类即变，无 `.theme-dark` 选择器补丁） |

## 4. 质量门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 0 error |
| `npm run test:unit` | 450/450 绿（新增 25：`colWidth.test.ts` 21 + `state.test.ts` 4） |
| `npm run build` | 成功（浏览器验证即跑在该构建产物上） |
| e2e 缝 | `__veloxEditor.view` / `__veloxTable.{resolve,activate,op,…}` / `data-table-handle=col-grip` 均未破坏 |

## 5. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `src/editor/table/colWidth.ts` | **新增** 纯函数域：`MIN_COL_WIDTH=48`、`DRAG_COMMIT_MIN_PX=2`、`clampColWidth`、`absorbNeighbor`、`isDragCommit`、`dragEndWidths`、`insert/delete/moveColWidths`、`sanitizeWidths` |
| `src/editor/table/colWidth.test.ts` | **新增** 21 用例（对和不变量/最右列例外/钳制/防误触/结构 remap/sanitize） |
| `src/editor/table/state.ts` | `invertColWidths` + `colWidthHistory`（undo 反演）、`colWidthRemapEffect`（结构 op 同事务 remap） |
| `src/editor/table/state.test.ts` | **新增** 4 用例（反演还原/二次拖拽取真实前值/restoreColWidths 不进撤销栈） |
| `src/editor/setup.ts` | `history()` 后注册 `colWidthHistory` |
| `src/editor/table/widget.ts` | colgroup 常驻（`col[data-col]`）+ 全钉宽时 `table.style.width=Σ`；`addColGrip` 重写（吸收拖拽/指示线/指针捕获/阈值防误触/`data-testid`）；探针 `op` 接 widthsRemap |
| `src/editor/table/commands.ts` | `runTableOp` 增 `widthsRemap`；`tryStructCmd` moveCol 左/右接 `moveColWidths` |
| `src/editor/contextMenu/opsTable.ts` | 内联 `runOp` 增 `widthsRemap`；insert/delete/moveCol 菜单项接 remap |
| `src/editor/table/toolbar.ts` | resizeTable 接恒等 remap（sanitize 收边） |
| `src/styles/markdown.css` | `.cm-md-col-drag-line` 指示线样式（token 消费） |
