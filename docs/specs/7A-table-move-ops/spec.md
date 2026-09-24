# 7A 表格行/列移动操作（任务 7.1）

## What / Why

为 GFM 表格补「上移该行 / 下移该行 / 左移该列 / 右移该列」四个结构操作。这是与 Typora 表格操作菜单（基准 `temp/typora/table-btn-4.png`）相比唯一缺的能力；纯函数 + 菜单项，无 UI 结构改动，是看板 ②（结构快捷键）/⑨（菜单快捷键提示）的依赖前置。

## 背景与现状

- 纯 op 层：`src/renderer/src/editor/table/ops.ts` 已有 `insertRowOp`/`deleteRowOp`/`insertColOp`/`deleteColOp`/`setAlignOp`，全部返回 `TableOp`（整表 replace + `nextActive`）——移动 op 照此模式补齐。全仓无 moveRow/moveCol（2026-09-24 评估）。
- 菜单层：`src/renderer/src/editor/contextMenu/opsTable.ts` `tableDeltaItems` 现有 insertRowAbove/Below、deleteRow、insertColLeft/Right、deleteCol、align×3、cell 剪贴板、copyTable/formatTableSource/deleteTable。id 是 cdp-p10/cdp-p27 契约——**只增不改**。
- 菜单项支持 `disabled`/`shortcut`（`contextMenu/types.ts` L51-53）。
- 无 `ops.test.ts`（`parse.test.ts` 顺带测过 `parseTsv`）。

## 验收标准（AC）

1. 右键菜单表格项新增 4 项：上移该行、下移该行、左移该列、右移该列（位于行列增删组之后、对齐组之前），id 分别为 `moveRowUp`/`moveRowDown`/`moveColLeft`/`moveColRight`。
2. 移动语义：交换相邻行/列的单元格文本；**列移动时 `aligns` 随列走**；整表一次 replace（undo 一步还原）。
3. 边界语义（plan 定为菜单 `disabled` + op 层 `null` 双保险）：表头（UI row 0）不上移；末行不下移；首列不左移；末列不右移。表头可下移（= 与首行体交换，体行上移同理可与表头交换——GFM 表头恒为第一行，交换即换表头内容，语义自然）。
4. 移动后 `nextActive` 落在被移动的行/列上（行移动保持原 `col`，列移动保持原 `row`）。
5. `ops.test.ts` 新增纯函数单测覆盖：行/列交换正确性、aligns 随列、四向边界返回 null、nextActive 跟随。
6. i18n：`ctx.moveRowUp/moveRowDown/moveColLeft/moveColRight` 同时落 `en.ts` + `zh.ts`。
7. `__veloxTable.op` 测试钩子支持同名 kind（与产品路径同 userEvent）。

## 约束

- 菜单 id 字面量是 cdp 契约：新增 id 进 `opsTable.ts` 时同步文件头契约注释；既有 id 不改。
- 结构操作 userEvent：行 `input.table.moveRow`、列 `input.table.moveCol`（不进 `STRUCTURE_TOASTS`——移动即时可见，同 insert/align 保持安静）。
- stale-instance 纪律不变（本任务走既有 `runOp` 路径，无新事件闭包）。
- i18n key 全对齐有测试守护。
