# 3B 拆 table/widget.ts

## What / Why

`editor/table/widget.ts`（1151 行）混居五域：模型重解析、嵌套单元格会话（含 UX-P28 handoff 协议）、表格命令（提交/导航/结构操作）、键位/主题、TableWidget 类与测试钩子。按 backlog 3.7–3.12 拆为 `nestedSession` / `resolve` / `commands`（table 域）/ `keymap` 四模块 + `widget.ts` 残壳，`window.__veloxTable` 等 e2e 契约原样保留。

## 背景与现状

- **五域共文件**：
  - 模型重解析（L70–112）：`resolveTableModel`（私有）/`resolveWithFallback`（导出）——stale-instance 纪律的实现核。
  - 嵌套会话（L114–229 + L603–687 + L735–747）：`nestedViewInstance`/`activeNestedView`/`nestedPreviewField` seam/`nestedCellTheme`/`mountCellEditor`/`pendingHandoff`+`handoffKey`。
  - 命令（L232–601）：`moveCell`/`modelWithPendingText`/`STRUCTURE_TOASTS`/`runTableOp`/`commitActiveOnly`/`exitTableEdit`/`activateCellAt`/`clearTableEditAndFocusSource`/`handleTsvPaste`/`cellClipboard`/`openTableContextMenu`。
  - 键位（L165–208）：`Dir`/`cellKeymap`/`boundaryNav`。
  - Widget（L689–1087 + L1089–1151）：`TableWidgetActive`/`TableWidgetSpec`/`widthsEqual`/`handleBtn`/`TableWidget`/`tableTestHook`。
- **UX-P28 handoff 协议（correctness-critical）**：destroy 捕获 pending 文本 → `pendingHandoff`（key=`tableFrom:row:col`）→ toDOM 重挂载消费（one-shot）→ destroy 另排 microtask 回写提交。hop/retarget 跳过逻辑（isRetarget：state.active ≠ spec.active 时既不 handoff 也不 microtask）是防「旧文本覆盖目标格」的关键，两端协议不可拆散。
- **三份重复的「提交 pending」逻辑**（3.9 明令合并，勿原样复制）：`commitActiveOnly`（跳过 sentinel）、`activateCellAt` 内联（sentinel → 整表重写 `gridWithCellText`+`formatTable`）、`clearTableEditAndFocusSource` 内联（跳过 sentinel）。三者同构：取 nested 文本 → `escapeCell` → 与原模型格文本比较 → 产出 change；差异仅 sentinel 策略与 dispatch 合并方式。
- **死代码发现**：widget.ts 的 `cellClipboard`（L544–571）**零调用点**（全文件+全仓 grep 仅定义行）；活的剪贴板路径是 `contextMenu/opsTable.ts` 注册闭包内联的平行实现（L212–227，经 `table-cell` delta）。opsTable 版**不折叠 pending**（依赖 `openTableContextMenu` 先 `commitActiveOnly`）——两版语义平行现状保持，不在本任务合并。
- **消费面**：`livePreview/handlers-code.ts`（`TableWidget`）、`editor/setup.ts`（`setNestedPreviewField`，1D 注入缝）、`table/lifecycle.ts`（`activeNestedView`/`resolveWithFallback`/`exitTableEdit`）。
- **e2e 硬契约**：`window.__veloxTable`（nested/resolve/activate/move/setCellDoc/commit/clearEdit/op/pasteTsv 九方法，`scripts/cdp-p10.mjs` 依赖）、`window.__veloxTableCellView` + `td.__cellView`、命令 userEvent 字面量（`input.table.*`，探针与 toast 映射依赖）。
- **barrel 现状**：`table/index.ts` 已在阶段 0（fca74ae）删除——3.12 的「二选一」已收敛到「删除」侧；本任务只需保证拆分后不复活 barrel、`widget.ts` 为唯一入口。

## 验收标准（AC）

- **AC1（3.7 `table/nestedSession.ts`）**：收拢 `nestedViewInstance`+`activeNestedView`+`nestedPreviewField`/`setNestedPreviewField`+`pendingHandoff`/`handoffKey`+`mountCellEditor`+destroy 端逻辑；提供显式 handoff 接口 **`getHandoff`（mount 端 one-shot 消费）/`destroyHandoff`（destroy 端：捕获→置 handoff→microtask 提交→拆 nested view→清实例/`__veloxTableCellView`）/`commitHandoff`（microtask 回写体）/`mountCellEditor`（mount 端装配）**。destroy↔mount 两端同模块；isRetarget 跳过、handoff key 公式、one-shot 清除、microtask 同任务语义全部原样。`td.__cellView`/`window.__veloxTableCellView` 写点/清点不变。
- **AC2（3.8 `table/resolve.ts`）**：`resolveTableModel`（补 `export`，可见性偏差）+ `resolveWithFallback` 原样平移；stale-instance 纪律注释随行。
- **AC3（3.9 `table/commands.ts`）**：`moveCell`/`modelWithPendingText`/`STRUCTURE_TOASTS`/`runTableOp`/`commitActiveOnly`/`exitTableEdit`/`activateCellAt`/`clearTableEditAndFocusSource`/`handleTsvPaste`/`openTableContextMenu` 平移；**三份 pending 提交合并为单一 `pendingCommitChanges` helper**（sentinel 策略参数化：`'skip'`/`'rewrite'`；`activateCellAt` 取 rewrite，其余取 skip；dispatch 合并方式留在各调用点）。死代码 `cellClipboard` **删除**（零调用点证明在 plan；opsTable 平行实现不动）。
- **AC4（3.10 `table/keymap.ts`）**：`Dir`/`NestedNavFns`（导航词汇表）+ `nestedCellTheme`+`cellKeymap`+`boundaryNav`+TSV paste handler 工厂；**不 import commands**（环破缝：move/exit/tsv 以参数注入，先例 `setNestedPreviewField` 1D 注入缝），`cellKeymap`/`boundaryNav` 签名带 `move` 参数，行为逐键不变（含 UX-P10 ArrowUp/Down 返回 false 的 nav-leak 语义、Shift-Enter `<br>` 插入）。
- **AC5（3.11 `widget.ts` 残壳）**：只留 `TableWidget`（整类不动）+ `handleBtn`/`widthsEqual` + `tableTestHook` + 对外 re-export 面（`TableWidget`/`setNestedPreviewField`/`activeNestedView`/`resolveWithFallback`/`exitTableEdit`/`TableWidgetActive`/`TableWidgetSpec`）；`__veloxTable` 九方法形状与 userEvent 字面量不变。
- **AC6（3.12 barrel 状态）**：`table/index.ts` 不复活；`handlers-code.ts`/`setup.ts`/`lifecycle.ts` 三消费方 **import 路径零改动**（经 widget.ts re-export）。
- **AC7**：`npm run typecheck && npm run test:unit` 全绿；`npx madge --circular --extensions ts,tsx src/renderer/src` **0 cycles**；e2e 缝 grep 断言（`__veloxTable` 九方法、`__veloxTableCellView`、`handoffKey` 公式、`input.table.*` userEvent 集合）与拆分前一致。

## 约束

- **行为不变**：pendingHandoff 协议时序（destroy 先捕获后拆 view、microtask 在 CM6 update task 之后、hop 跳过）、`exitTableEdit` 单 dispatch 合并语义（UX-P28 防 lifecycle auto-exit 误触发）、`clearTableEditAndFocusSource` 单 dispatch、`runTableOp` 的 STRUCTURE_TOASTS 反馈、`openTableContextMenu` 先 `commitActiveOnly` 再解析、mountCellEditor 的多拍聚焦（microtask + setTimeout 10ms + lifecycle 自愈）与 blur 失焦即退场（setTimeout 0 defer）全部不变。
- 3.9 的 pending 提交合并是唯一结构性收敛点，必须做逐点等价证明（见 plan 等价表）；其余 body 原样平移（含注释）。
- stale-instance 纪律：事件闭包不捕获 cell 偏移、事件时 `resolveTableModel`/`resolveWithFallback` 重解析——平移后注释与实现同迁。
- e2e 硬契约：`__veloxTable`、`__veloxTableCellView`/`td.__cellView`、command userEvent 字面量、`setNestedPreviewField` 装配缝（setup.ts 调用点不改）。
- Constitution：`table/` 纯函数模块（parse/ops）已有单测；本次拆出模块为装配/命令层，不要求新增单测；`pendingCommitChanges` 为纯 change 构造逻辑，可测性留待后续。

## 不做

- 不动 `parse.ts`/`ops.ts`/`state.ts`/`insert.ts`/`lifecycle.ts`（消费面不改）。
- 不拆 `TableWidget` 类本体（toDOM/destroy/eq/ignoreEvent 整类保留，3.11 明示）。
- 不合并 opsTable 注册闭包与 commands 的平行语义（runOp 不折叠 pending vs runTableOp 折叠——跨模块行为对齐另立）。
- 不修 D3 已知限制（'out' 路径不提交 sentinel pending）；不改 UX-P10 nav-leak 语义。
- 不做 `widget.ts` 更名；不复活 `table/index.ts` barrel。
