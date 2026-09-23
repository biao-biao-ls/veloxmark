# 3B 拆 table/widget.ts — 实施计划

## 模块 DAG 与环破缝

```
resolve.ts（叶：parse/state 类型）
  ↑
nestedSession.ts ──→ keymap.ts（叶：零项目内 import）
  ↑                      ↑（type Dir/NestedNavFns）
commands.ts ─────────────┘（仅 type import）
  ↑
widget.ts（残壳：TableWidget + handleBtn/widthsEqual + testHook + re-export）
```

- **环破点**：naive 切法 `nestedSession.mountCellEditor → keymap.cellKeymap → commands.moveCell` 与 `commands.* → nestedSession.activeNestedView` 成环。破法：**keymap.ts 不 import commands**——`cellKeymap(main, move)`/`boundaryNav(v, main, dir, move)`/TSV paste handler 工厂化，`move`/`exit`/`tsv` 由调用方以 `NestedNavFns` 注入（先例：1D `setNestedPreviewField` 注入缝）。`mountCellEditor(..., nav)` 接收同一 nav 对象；widget.toDOM 组装 `nav = { move: moveCell, exit: exitTableEdit, tsv: handleTsvPaste }`。
- **词汇表落点**：`Dir` + `NestedNavFns` 声明在 `keymap.ts`（导航词汇与键位同居）；commands 仅 `import type { Dir }`（不产生值依赖方向问题：keymap 零依赖）。若 madge 计 type-import 为边，此边 commands→keymap 单向、keymap 零出边，仍无环。
- **对外入口**：`widget.ts` re-export `TableWidget`/`setNestedPreviewField`/`activeNestedView`/`resolveWithFallback`/`exitTableEdit` + 类型——三消费方（handlers-code/setup/lifecycle）零改动。

## 目标文件清单

| 文件 | 内容 | 约行数 | 依赖 |
|---|---|---|---|
| `table/resolve.ts` | `resolveTableModel`（+export）/`resolveWithFallback` + stale-instance 注释 | ~55 | parse, state, @codemirror |
| `table/keymap.ts` | `Dir`/`NestedNavFns`/`nestedCellTheme`/`cellKeymap`/`boundaryNav`/`tsvPasteHandler` | ~110 | @codemirror 仅 |
| `table/nestedSession.ts` | `activeNestedView`/`setNestedPreviewField`/`getHandoff`/`destroyHandoff`/`commitHandoff`/`mountCellEditor`（含 blur 失焦退场、多拍聚焦、`__cellView`/`__veloxTableCellView` 缝） | ~190 | resolve, keymap, state, parse, livePreview/config, @codemirror |
| `table/commands.ts` | `moveCell`/`modelWithPendingText`/`STRUCTURE_TOASTS`/`runTableOp`/`commitActiveOnly`/`exitTableEdit`/`activateCellAt`/`clearTableEditAndFocusSource`/`handleTsvPaste`/`openTableContextMenu`/`pendingCommitChanges`（新，合并三份） | ~370 | resolve, nestedSession, keymap(type), parse, ops, state, contextMenu/registry, i18n |
| `table/widget.ts`（残壳） | 文件头（P10 + stale-instance + handoff 指路）/re-export/`TableWidgetActive`/`TableWidgetSpec`/`widthsEqual`/`handleBtn`/`TableWidget`/`tableTestHook`/`__veloxTable` 挂载 | ~520 | 以上全部 + parse/ops/state/blockWidget/theme |

## 三份「提交 pending」合并等价表（AC3）

共享 helper（commands.ts 内私有）：

```ts
/** 取 active nested 文本，与原模型格比较，产出 0/1 个 change。 */
function pendingCommitChanges(
  main: EditorView,
  resolved: { model: TableModel; lineFrom: number },
  opts: { sentinel: 'skip' | 'rewrite' }
): ChangeSpec[]
```

内部：`getTableEdit` + `activeNestedView()` 双卫语义等价于三处各自 guard；`escapeCell(nested 文本)`；格查找 `cells[active.row]?.[active.col]`；`!isSentinel && text≠cell.text` → cell-range replace；sentinel 分支按 `opts.sentinel`：`'skip'` 返回 `[]`，`'rewrite'` 返回 `gridWithCellText`+`formatTable` 整表替换。

| 现状 | 改道 | 等价性 |
|---|---|---|
| `commitActiveOnly`：resolve（`hintFrom ?? active.tableFrom`）→ guard 取 nested+active → 跳 sentinel → 自 dispatch `input.table.cell` | resolve 留原地；changes = `pendingCommitChanges(main, resolved, { sentinel: 'skip' })`；有 change 才 dispatch | guard/比较/文案全同；hintFrom 语义留在 resolve 调用 |
| `activateCellAt` 内联：guard → orig 比较 → sentinel 整表 rewrite / cell-range → 并入激活 dispatch | changes = `pendingCommitChanges(main, resolved, { sentinel: 'rewrite' })`；`changes.length ? changes : undefined` 并入激活 dispatch | sentinel rewrite 分支原样参数化收进 helper；dispatch 合并方式（与 setActiveCell 同事务）留调用点 |
| `clearTableEditAndFocusSource` 内联：guard → 跳 sentinel → 并入单 dispatch（selection+clear） | changes = `pendingCommitChanges(main, resolved, { sentinel: 'skip' })`；并入单 dispatch | UX-P28 单 dispatch 防误触发约束不动 |

不并：`moveCell` 的 `gridWithPending`/`cellChange`（hop 语义含结构追加行，形状不同）；`modelWithPendingText`（整表 ops 折叠进模型，不产 change）；destroy 端 microtask 提交（异步、走 `commitHandoff`）——各注释点名差异。

**死代码删除**：`cellClipboard` 删除。证明：`grep -n cellClipboard src/renderer/src/editor/table/widget.ts` 仅 L544 定义行；全仓活路径是 `contextMenu/opsTable.ts:212` 注册闭包内联版（`table-cell` delta 的 cut/copy/paste 项），不经 widget.ts。testHook 无此方法，cdp 契约不涉及。

## UX-P28 handoff 协议迁移要点（AC1，correctness-critical）

- `destroyHandoff({ dom, view, own, sourceFrom })` 原样吸收 `TableWidget.destroy` 全体：`findFromDOM` → pendingText 捕获（**先捕获后 `maybe.destroy()`**）→ isRetarget 判定（`getTableEdit(view.state).active` 与 `own` 比 row/col——diag-P28 注释随行，强调不得用 state.active 当 handoff 身份）→ 置 `pendingHandoff`（仅 pending ≠ committed 且非 sentinel）→ `commitHandoff`（queueMicrotask + try/catch + active 匹配三卫）→ `maybe.destroy()` → 实例/`__veloxTableCellView` 清理。
- `getHandoff(key)`：one-shot，匹配则返回文本并清空；toDOM 调用点（L888–898）改为 `const seed = getHandoff(handoffKey(this.sourceFrom, active.row, active.col))`。
- `handoffKey` 公式 `${t}:${r}:${c}` 与 one-shot 清除语义不变；注释「destroy sets it, mountCellEditor consumes」随迁。

## 任务拆分（叶优先）

1. **3.8** `resolve.ts`：正文+注释平移；`resolveTableModel` 补 export（可见性）；widget.ts 暂改 import（过渡态可编译）。
2. **3.7** `keymap.ts` 先行（nestedSession 依赖其 theme/键位工厂）：`Dir`/`NestedNavFns`/`nestedCellTheme`/`cellKeymap(main, move)`/`boundaryNav(..., move)`/`tsvPasteHandler(main, tsv)`——纯工厂，逐键对照原表。
3. **3.7** `nestedSession.ts`：实例/previewField seam/handoff API/`mountCellEditor(..., nav)`；blur 退场与多拍聚焦原样。
4. **3.9** `commands.ts`：十函数平移 + `pendingCommitChanges` 合并 + 删 `cellClipboard`；`Dir` type import。
5. **3.11** `widget.ts` 残壳化：类 body 仅改 `destroy()`→`destroyHandoff(...)` 一行委托、toDOM 挂载点改 `getHandoff`+`mountCellEditor(..., nav)`；testHook 九方法改从新模块 import（形状不变）；re-export 面就位。
6. **3.12 + 收敛**：grep 断言 + madge + typecheck/unit + 勾销。

## 验证方案（converge）

1. `npm run typecheck && npm run test:unit` 全绿。
2. `npx madge --circular --extensions ts,tsx src/renderer/src` **0 cycles**（注意 `--extensions ts,tsx` 必带，裸跑假绿）。
3. e2e 缝 grep 断言：
   - `__veloxTable` 九方法字面量：`nested`/`resolve`/`activate`/`move`/`setCellDoc`/`commit`/`clearEdit`/`op`/`pasteTsv` 全在；
   - `__veloxTableCellView` 写点（mountCellEditor）与清点（destroyHandoff）各 1；`td.__cellView` 写点 1；
   - `handoffKey` 公式 `\${t}:\${r}:\${c}` 不变；`pendingHandoff` 只读写于 nestedSession；
   - `input.table.*` userEvent 集合 ⊇ 拆分前（对照 grep 清单）。
4. 三消费方 import 零改动断言：`handlers-code.ts`/`setup.ts`/`lifecycle.ts` 的 `table/widget` import 行 diff = ∅。
5. 勾销 3.7–3.12 + 收敛记录；行为不变类人工冒烟建议：表格点击进格/Tab 换格/Enter 下移/Esc 退格、末格 Tab 追加行、行列增删把手、对齐、列宽拖拽、右键表格菜单（增删行列/对齐/剪贴）、TSV 粘贴、主题/列宽/语言切换触发 rebuild 时 pending 文本不丢（handoff）、hop 换格不串文本（diag-P28）、失焦即退场、sentinel 参差表格。
