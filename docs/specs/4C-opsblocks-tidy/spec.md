# 4.3 opsBlocks 整理（= 2.17）

## What / Why

`contextMenu/opsBlocks.ts`（438 行）业务注册器与视图辅助函数混排：6 个私有 helper（L25–94）+ 一对逐字重复的缩进函数（L269–303）夹在注册器之间；`transforms.ts` 表格段（L133–181）是表格域逻辑错挂在 contextMenu；两模块各自手写同形的「逐行建 changes → 单 dispatch」循环。整理为：注册器纯注册、helper 独立成家、表格段归位 table/、dispatch 形态收敛单原语。

## 背景与现状

- **opsBlocks**：`enclosingNode`/`mathRange`/`fenceBody`/`mermaidSvgAt`/`deleteRange`/`confirmDanger` 六 helper + `indentFenceBody`/`indentSelectedLines`（两函数仅 from/to 来源与 userEvent 不同，循环体逐字相同）散在 7 个 `registerContextMenuOps` 注册器之间。
- **transforms.ts dispatch 约定**（文件头明文）：纯 view dispatch、no menu/no toast、单 undo step；`setHeadingLevel`/`toggleBlockquote`/`convertList` 三个函数手写同形 per-line 循环（建 changes 数组 → `if (changes.length)` → 单 dispatch + `userEvent`）。opsBlocks 的缩进对也是同约定。
- **transforms 表格段**：`tableModelOf`/`tableMarkdown`/`formatTableSourceRange`/`deleteTableRange` 是表格源域操作（消费方仅 `opsTable.ts`）；`tableSource` 为**死导出**（零调用点，`tableModelOf`/`tableMarkdown` 直接 `sliceDoc`）。依赖方向无环前提已核：`editor/format.ts` 只 import `table/parse`，`table/source.ts → format → parse` 不成环。
- userEvent 字面量（`indent.code`/`indent.selection`/`callout.type`/`delete.*`/`input.contextMenu.*`）是探针/行为契约，**逐字保留**。

## 验收标准（AC）

- **AC1**：新 `contextMenu/blockHelpers.ts` 持有 opsBlocks 全部视图辅助（六 helper + 缩进对合并为 `indentLines` 单实现 + 薄包装）；opsBlocks 只剩 `registerContextMenuOps` 注册器与注册器专属常量/内联逻辑（`CALLOUT_TYPES`、fm.edit 的 fence 扫描）。
- **AC2**：「逐行建 changes → 单 dispatch」收敛为 `transforms.ts` 导出的单原语 `applyLineChanges`（dispatch 约定的实现点）；`setHeadingLevel`/`toggleBlockquote`/`convertList` 与 `indentLines` 全部复用之——**change 形状逐字等价**（indent 保持 line 首插 `'  '` 不换成整行替换），userEvent 字面量逐一不变；`changes.length` 空跳过语义保留在原语内。
- **AC3**：`transforms.ts` 表格段迁新 `editor/table/source.ts`（`tableModelOf`/`tableMarkdown`/`formatTableSourceRange`/`deleteTableRange` 原样平移）；死导出 `tableSource` 删除（cellClipboard 先例）；消费方 `opsTable.ts` 改 import 路径；`transforms.ts` 不再 import `table/*`/`format`。
- **AC4**：全仓 `data-op` id、userEvent 字面量、菜单项集合**零变化**（e2e 缝硬契约）；收敛门禁 typecheck + test:unit 全绿 + madge 0 cycles。

## 约束

- body 原样平移纪律（含注释）；合并缩进对/三循环属「同形去重」，逐点等价表落 plan。
- `opsBlocks.ts` 是 setup.ts 的自举副作用 import，注册时序不变。
- 不动 `opsTable.ts` 的 `cellClipboard` 内联语义（3B 已注明跨模块平行不并）；不动 `menuSkeleton`/`commands/*` 的 transforms 导入面（函数仍从 transforms 导出）。

## 不做

- 不重排注册器 id/label；不把 `menuSkeleton`/`opsTable` 一并重组；不抽 registry barrel；不做 `table/source.ts` 的进一步合并（如并入 `ops.ts`）。
