# 7E 实施方案

## 技术决策与理由

- **`resizeTableOp(model, rows, cols, anchorRow = 0, anchorCol = 0)` 纯函数**（`ops.ts` 既有家族，undo 一步由 `runTableOp` 免费获得）：
  - 目标 `< 1` 或目标 = 当前规模 → `null`（no-op；AC2/AC7 双保险的 op 层一侧，7A 同款「UI 钳制 + op 拒绝」）。
  - 扩行 = 底部追加空行；缩行 = **截尾丢底行**（表头第 0 行恒保留）；扩列 = 各行尾补 `''` + `aligns.push('')`；缩列 = 各行截尾 + `aligns` 截尾。aligns 先补平到 `colCount` 再伸缩（ragged 安全，AC3）。
  - `nextActive` = anchor 钳入新形状（anchor 由调用方在**事件时**从 `getTableEdit` 读出——stale-instance 纪律，见下）。
  - 缩容丢内容是**显式语义**（AC6，Excel 网格锚定左上的选择模型）；不做"删行时内容上移"类变体。
- **popover = DOM 浮层 `editor/table/gridPicker.ts`**（否决 React 组件：入口在 widget 的 DOM 工具栏，ctxMenu 同模式的模块单例浮层；弹出锚 = ⊞ 按钮 rect，`position: fixed` 挂 body）。一次只开一个（模块级 singleton，重复打开先关旧）。
  - **纯函数 `gridPickerKey(key, row, col)`** 抽出键盘语义（方向键钳 1..20/1..12 → `move`、Enter → `pick`、Escape → `close`、其它 → `null`）——与 `TableInsertDialog.onKey` 同键位语义但不强行合并（对话框还有 convert 模式/表单补丁，交互契约不同；注释交叉标注）。
  - 交互：hover 即时更新高亮矩形 + 读数（不实时应用——**确认一次 dispatch**，AC1「一次 transaction」）；click cell / Enter = 确认；Escape / 点外部 = 取消（零改动，AC7）。
  - 网格 20×12，**cell 复用 `table-insert-cell`/`is-hover` class**（P22 同观感，红线 6 不新增平行皮肤）；popover 自身 shell（`.table-grid-picker`/读数）落 `styles/overlays.css`（`table-insert-grid` 同文件）。
- **过渡期入口 = 表格 hover 块工具栏 ⊞ 首钮**（AC8）：`attachBlockToolbar` 既有挂法，items 序首插 `{ label: '⊞', title: t('table.gridPickerTitle') }`。否决右键菜单入口：菜单 item 是同步 dispatch 形态，弹浮层需要锚点，语义不符。⑥ 7C 统一工具栏落地时**移交按钮**，popover/ops 语义零改动。
- **事件时重解析**（红线 4）：⊞ click → `resolveTableModel(view, this.sourceFrom)`（hint）取当前 dims 开 picker；onPick → `getTableEdit(view.state).active` 取 anchor → `runTableOp(view, sourceFrom, (m) => resizeTableOp(m, rows, cols, aRow, aCol), 'input.table.resize')`。不捕获 toDOM 时刻的 cells/偏移。
- **userEvent `input.table.resize`，不进 STRUCTURE_TOASTS**（静默——insert 系同款"表格自己就是反馈"，destructive toast 红线只归 delete 系）。`tableTestHook.op` 的 kind 表补 `resizeTable: (m, x, y) => resizeTableOp(m, x, y)` + userEvent 映射（add-only，探针对称）。
- **i18n +1 key ×2 文件**：`table.gridPickerTitle`（zh「调整行列数」/ en「Resize rows × cols」）。读数「R × C」是数字 + `×`，无文案 key。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/table/ops.ts` | **+`resizeTableOp`**（纯函数，语义见上） |
| `editor/table/ops.test.ts` | +6 例：扩/缩双向、缩行保表头、ragged aligns 伸缩、no-op/非法目标 null、anchor 钳制 |
| `editor/table/gridPicker.ts` | **新建**：`gridPickerKey`（纯）+ `openGridPicker(anchor, opts)`（DOM 浮层：20×12 网格/读数/键鼠/外点关闭/singleton） |
| `editor/table/gridPicker.test.ts` | **新建**：`gridPickerKey` 键位/钳制单测 |
| `editor/table/widget.ts` | hover 块工具栏 items 序首插 ⊞（事件时 resolve + pick 分发）；`tableTestHook.op` kind 表 +`resizeTable` |
| `styles/overlays.css` | `.table-grid-picker`（fixed 浮层 shell）+ `.table-grid-picker-readout`；cell 复用 `table-insert-cell` 族 |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +1 key（`table.gridPickerTitle`） |

## 状态/契约归属

无新状态（无 StateField/无存储；popover 生命周期 = DOM 浮层自身）。e2e 契约 add-only（新 class；`data-table-handle` 既有值族/`data-op`/命令 id/`__velox*` 零触碰）。列宽存储（`state.ts`）不碰（⑫ 归口）。

## import 改动面

`gridPicker` → i18n（纯 DOM，不 import 编辑器侧——回调由 widget 注入，避免 gridPicker→commands 环）；`widget` → `gridPicker` + 既有 `commands.runTableOp`/`resolve`/`state.getTableEdit` 面。无新环；`npx madge --circular --extensions ts,tsx` 守护。

## 任务拆分

1. `resizeTableOp` + 单测 [先行，纯逻辑]
2. `gridPicker.ts`（纯 key + DOM）+ 单测 + CSS [依赖 1 的语义参照]
3. `widget.ts` ⊞ 入口接线 + op hook 补项 + i18n [依赖 2]

## 验证方案

- `npm run typecheck && npm run test:unit`（ops.test + gridPicker.test 全绿、i18n 对齐过）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 内零既有字面量改动
- 人工冒烟（对照 `table-btn-1.png`）：
  1. 编辑态 hover 表格出工具栏「⊞ 复制」；⊞ 点开网格 popover，初始高亮 = 当前规模，读数「R × C」
  2. 向右/下拖大 → 松开点选：整表一次加行/列（空单元格），undo 一步还原
  3. 向左/上拖小 → 点选：底行/右列丢弃、表头不动、对齐截尾，undo 一步还原
  4. 拖到 1×1 停止（不再更小）；1×1 时点 ⊞ 再确认 = 无变化（无空 transaction）
  5. 键盘：Tab/点开后方向键移动高亮 + 读数、Enter 确认、Escape 关闭零改动、点击外部关闭零改动
  6. 待提交单元格文本在 resize 前被折叠（runTableOp 既有语义）；锚点单元格随 nextActive 落位
  7. 对齐列（含 ragged）：加/删列后冒号行正确

## 实现细化（2026-09-24 implement 时决策）

- **`resizeTableOp` 的 aligns 归一化先钳到 `colCount` 再伸缩**（`aligns.length = model.colCount` 截 phantom tail + while 补平）：aligns 比 colCount 长时多出的尾项视为幽灵列丢弃，再按目标宽伸缩——ragged 语义测试覆盖。
- **pick 顺序 = 先 `closePicker()` 再 `onPick`**：dispatch 会触发 widget 重建，浮层已卸不受牵连；取消（Escape/外点）零 dispatch（AC7）。
- **外点关闭监听挂 document 捕获阶段**：在编辑器/工具栏的 bubble handler 之前判定 inside/outside，与 attachBlockToolbar 的 stopPropagation 无竞争。
- **⊞ 二次点击 = 重开而非 toggle**（外点 mousedown 捕获先关旧浮层、click 再开新）——toggle 打磨归 ⑥ 工具栏期，不在本项憋。
- **网格 cell 复用 `table-insert-cell`/`is-hover` class**（P22 同观感，红线 6）；popover shell（`.table-grid-picker`/读数）落 `overlays.css` 与对话框网格同文件；读数「R × C」= 数字 + `×`，无 i18n key。
- **`GRID_MAX_ROW/COL`（20/12）gridPicker 自持**，注释标 mirrors `TableInsertDialog`——不反向 import components 层（dialog 不动，P22 探针零扰）。
- **`tableTestHook.op` 补 `resizeTable`**：arg/arg2 = rows/cols，anchor 默认 0,0（探针路径；产品路径经 onPick 事件时读 `getTableEdit` anchor）。userEvent `input.table.resize` 不进 STRUCTURE_TOASTS（静默，insert 系同款）。
- **stale-instance**：⊞ onClick 事件时 `resolveTableModel(view, this.sourceFrom)`（hint）取 dims、onPick 事件时 `getTableEdit(view.state).active` 取 anchor——均不捕获 toDOM 时刻偏移（既有 handle 按钮同款纪律）。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓ 31 files / 311 tests（新增 9 例：`ops.test.ts` +6——扩/缩/1×1/ragged aligns/no-op 与非法目标/anchor 钳制；`gridPicker.test.ts` 3 例——方向键钳制/Enter/Escape 与无关键）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles（223 files）
- e2e 缝核对：diff 内零既有字面量改动（`data-table-handle` 既有值族/`data-op`/`data-testid`/命令 id/`__velox*` 全不触碰；op hook 新 kind 为 add-only）
- AC1–9 逐条核对：一次 transaction（runTableOp 整表替换）/1×1 双保险（UI 钳制 + op null）/aligns 伸缩（含 ragged 测试）/键盘可达（纯函数 + 打开即聚焦）/读数 R×C/缩容丢底行右列保表头（显式语义）/确认关闭、取消零改动、no-op 不空事务/⊞ 过渡挂 hover 工具栏/缝零触碰——逻辑路径全通
- 人工冒烟（对照 `table-btn-1.png`）**待运行时冒烟补签**，重点实测点：① popover 锚位/观感与 20×12 网格 hover 矩形 ② 拖选扩/缩一步 undo ③ 1×1 停止 ④ 键盘方向+Enter/Escape ⑤ pending 单元格折叠与 nextActive 落位 ⑥ ragged 对齐冒号行
