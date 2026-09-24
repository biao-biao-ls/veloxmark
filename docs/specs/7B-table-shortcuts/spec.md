# 7B 表格结构操作快捷键（任务 7.2）

## What / Why

为表格编辑态补结构操作快捷键：**Ctrl+Enter**（下方插行）、**Alt+↑/↓**（上移/下移该行）、**Alt+←/→**（左移/右移该列），与 Typora 一致（基准 `temp/typora/table-btn-4.png` 菜单右列快捷键回显）。现在结构操作只能走右键菜单/把手，键盘流全缺；本项是看板 ⑨（菜单快捷键提示）的依赖前置。依赖 ①（7A 移动 op）已收敛。

## 背景与现状

- 单元格嵌套编辑态键位：`editor/table/keymap.ts` `cellKeymap`（Tab/Shift-Tab/Enter/Shift-Enter/Escape/边界箭头；UX-P10 裸 ↑↓ 留在单元格内）。keymap.ts 是 cycle-break 缝——**不得 import 项目值**，命令回调经 `NestedNavFns` 注入（widget.ts `tableNav` 装配，nestedSession `mountCellEditor` 消费）。
- 结构 op 层：① 已落 `moveRowOp`/`moveColOp`；`runTableOp`（commands.ts）折叠 pending 文本 + `setActiveCell(nextActive)` + STRUCTURE_TOASTS（仅 deleteRow/deleteCol）。
- 主编辑器 keymap：`editor/setup.ts` L141 `keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab])`。
- 全局命令表（`commands/` + `electron/main.ts` `DARWIN_COMMAND_ACCELERATORS`）是另一套双源快捷键——本任务**不进**全局表。

## 验收标准（AC）

1. 单元格嵌套编辑态下：Ctrl+Enter = 当前行下方插入一行；Alt+↑/↓ = 上移/下移该行；Alt+←/→ = 左移/右移该列。语义与 ① 菜单项完全同源（相邻交换、列移动 aligns 随列、`nextActive` 跟随被移动行/列、整表一次 replace）。
2. userEvent/toast 与 ① 菜单路径一致：`input.table.insertRow` / `input.table.moveRow` / `input.table.moveCol`；全部安静（不进 `STRUCTURE_TOASTS`）。
3. 边界 no-op：首行 Alt+↑、末行 Alt+↓、首列 Alt+←、末列 Alt+→ 无效果、不报错、不 toast（与菜单 disabled 对应，op 层 null 双保险沿用）。
4. **仅表格编辑激活态生效，不劫持全局**：未激活表格时按键走默认行为（handler 返回 false 落空到后续键位）；不注册进全局命令表（`commands/` 注册表、`DARWIN_COMMAND_ACCELERATORS`、shortcutSync 测试零改动）。
5. 主编辑器侧兜底：表格激活但焦点在主编辑器（nested mount focus 微任务/超时间隙）时，同键同语义生效。
6. pending 文本不丢：触发快捷键时未提交的单元格嵌套文本随 `runTableOp` 折叠进整表 rewrite（与菜单路径同函数）。
7. undo 一步还原（同 ① 整表 replace 语义）。

## 约束

- `keymap.ts` 注入缝纪律：扩展 `NestedNavFns` 加 `struct` 回调，keymap.ts 本身仍零项目值 import。
- UX-P10 不回退：裸 ArrowUp/Down 仍只在单元格内移动光标（`Alt-Arrow*` 是独立键位，不与 `ArrowUp/Down` 绑定混淆）。
- e2e 缝零破坏：既有 `__velox*`/`data-op`/命令 id 字面量零改动；键位行为新增不改既有探针路径。
- stale-instance 纪律：handler 在事件时刻从 `getTableEdit(view.state).active` 读行列，不捕获 cell 偏移。
- i18n：本项无新文案（菜单 `shortcut` 回显是 ⑨ 的事）。
