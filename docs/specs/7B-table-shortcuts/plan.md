# 7B 实施方案

## 技术决策与理由

- **键位 = Typora 对齐**：Ctrl+Enter 插行（下方）、Alt+方向键移行列。不加 Ctrl+D 复制行等 Typora 菜单里没回显的键位——先把对齐做满，扩展另立。mac 下同为 Ctrl+Enter/Alt+方向（基准截图即此标注；⌘ 风格留给 ⑨ 的 `fmtShortcut` 展示层）。
- **struct 回调进 `NestedNavFns`**（与 move/exit/tsv 同缝）：keymap.ts 只声明 `StructCmd` 字面量 union + 绑定表工厂，命令实现落 `commands.ts` `tryStructCmd`（那里已有 `runTableOp`/`getTableEdit`）。签名 `(view, cmd) => boolean`——**返回是否接管**：nested 侧适配器恒 true；主编辑器侧未激活返回 false 落空到默认键（AC4 的实现机制）。
- **绑定表单一工厂 `structKeyBindings(tryRun)`**：nested 与主编辑器共用 5 行绑定，仅注入的 tryRun 不同——键位字面量只写一处（⑨ 回显 shortcut 时从此取真源）。
- **主编辑器侧落 `setup.ts` keymap.of 数组最前**：同 keymap.of 内先匹配先赢，未接管返回 false 继续 searchKeymap/defaultKeymap——零劫持。AC5 的"激活但焦点在主编辑器"间隙由它兜住；nested 有焦点时事件根本不进主 keymap，无双重处理。
- **插行方向 = 下方**（`insertRowOp(m, row)`，同菜单 insertRowBelow）：Typora Ctrl+Enter 语义即"下方插入行"；上方插入仍走菜单。
- **实现走 `runTableOp`**（AC6 pending 折叠 + AC7 undo 单步 + nextActive 跟随全部免费复用）；`tryStructCmd` 只做 active 读取 + cmd → opFn 映射（~25 行）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/table/keymap.ts` | `StructCmd` 类型 + `NestedNavFns.struct` + `structKeyBindings(tryRun)` 工厂（5 键位）+ `cellKeymap` 并入工厂绑定（nested 适配器） |
| `editor/table/commands.ts` | 新增 `tryStructCmd(view, cmd): boolean`（active 读取 + 5 cmd 映射到 `insertRowOp`/`moveRowOp`/`moveColOp` + `runTableOp`） |
| `editor/table/nestedSession.ts` | `cellKeymap(main, nav.move)` → 传整个 `nav`（`cellKeymap` 签名微调） |
| `editor/table/widget.ts` | `tableNav` 补 `struct: tryStructCmd` 适配（恒 true 语义的 void 包装）；导出 `tableStructBindings` 供 setup |
| `editor/setup.ts` | `keymap.of([…tableStructBindings, …searchKeymap, …])` 最前并入 |

## 状态/契约归属

无新状态。`NestedNavFns` 接口 +1 字段（内部缝，非 e2e 契约）。命令 id/`data-op`/`__velox*` 零改动。

## import 改动面

keymap.ts 仍零项目值 import（StructCmd 是本文件类型）；commands.ts 增 import `insertRowOp`/`moveRowOp`/`moveColOp`（同模块 ops，无环）；widget.ts/`setup.ts` 沿既有 import 面。`npx madge --circular` 守护 0 cycles。

## 任务拆分

1. `keymap.ts` StructCmd/bindings 工厂 + `commands.ts` `tryStructCmd` [先行]
2. `nestedSession.ts`/`widget.ts` 装配 + `setup.ts` 并入 [依赖 1]

## 验证方案

- `npm run typecheck && npm run test:unit`（全量既有测试绿；键位是 view 绑定层，无纯函数可测，AC 靠 cdp/人工冒烟）
- 人工冒烟（对照 `table-btn-4.png` 快捷键列）：单元格内 5 键位生效；边界 no-op；未进表格 Ctrl+Enter/Alt+方向不劫持（Ctrl+Enter 不插行、Alt+↑ 不动光标行）；插行后 undo 一步；编辑单元格未提交文本触发移行后文本随行走（pending 折叠验证）；UX-P10 裸 ↑↓ 仍单元格内动光标
- e2e 缝：grep diff 确认既有字面量零改动
- ⑨ 的前置核对：键位字面量单源在 `structKeyBindings`（⑨ 回显时引用）

## 实现细化（2026-09-24 implement 时决策）

- **`NestedNavFns.struct` 直接复用 `tryStructCmd`**（签名同 `StructTryFn`，返回是否接管）——无需 void 包装：nested 会话恒激活，返回值即 true。
- **`cellKeymap(main, nav)` 签名改为收整个 `nav`**（原收 `move` 单函数）：struct 绑定适配器 `(_v, cmd) => nav.struct(main, cmd)`——cmd 打到 main 会话（`getTableEdit` 在 main state 上）；既有 Tab/Enter 等绑定内部改用 `nav.move`，行为零变化。
- **`tableStructBindings = structKeyBindings(tryStructCmd)` 落 widget.ts 公共入口**（setup 沿 `setNestedPreviewField` 同一 import 面），keymap.of 数组最前——同 keymap.of 先匹配先赢；未激活时 `tryStructCmd` 返回 false 落空到 searchKeymap/defaultKeymap（defaultKeymap 的 Alt+↑↓ moveLine 等在非表格语境正常保留）。
- **UX-P10 无干扰确认**：`Alt-Arrow*` 与裸 `ArrowUp/Down`（`run: () => false` 落空 defaultKeymap 单元格内光标移动）是不同键位字面量，匹配不串。
- **`tryStructCmd` 事件时刻读 `getTableEdit(main.state).active`** 并解构 `{row, col, tableFrom}` 作为 opFn 锚点（stale-instance 纪律）；opFn 内 `runTableOp` 重解析 model + 折叠 pending——与 ① 菜单路径同函数。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓ 28 files / 289 tests（键位为 view 绑定层，无可测纯函数，AC 靠人工冒烟）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles
- e2e 缝核对：diff 5 文件零既有字面量改动（`commands/` 注册表、`DARWIN_COMMAND_ACCELERATORS`、shortcutSync 零触碰——AC4 后半成立）；`NestedNavFns` +1 字段为内部缝
- AC1–7 逐条核对：5 键位语义同 ①（同 `runTableOp`，AC1/2/6/7 同路径免费成立）；边界 no-op（op null，AC3）；未激活落空（AC4）；主编辑器侧兜底 = setup 侧同一 `tryStructCmd`（AC5）
- 人工冒烟：对照 `table-btn-4.png` 快捷键列——单元格 5 键位/边界 no-op/未进表格不劫持/pending 随行走/裸 ↑↓ 仍在单元格内——待运行时冒烟补签
