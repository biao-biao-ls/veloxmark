# INFRA-01 探针断言迁移报告（data-table-handle 删4留1 与 data-op 断言上线）

- 任务：IT-01/INFRA-01（e2e 契约 delta 探针同步——删4留1 登记与断言迁移）
- 来源：business-review-IT01PATH07 1×P2（INFRA-01 交付物登记缺口；DOM 契约语义已实证对齐，本报告仅补档）
- 模式：fix-biz 文档/登记补档（零运行时行为变更）
- 日期：2026-10-02

## 1. 探针断言迁移对照表

对照表全文见 ADR 附录 A（同文，单一真源避免双写漂移）：
[design/adr/e2e-contract-delta.md 附录 A](../../design/adr/e2e-contract-delta.md#附录-a探针断言迁移对照表旧-4-把手断言下线--新-data-op-断言上线)

要点摘录（旧 4 把手断言下线 → 新 data-op 断言上线）：

| 旧断言（4 把手 data-table-handle 面） | 处置 | 新断言 | 落点 |
|---|---|---|---|
| `data-table-handle="row-insert"` / `"row-delete"` / `"col-insert-left"` / `"col-delete"` 存在断言（4 把手面） | **下线**（随把手 UI 移除，G-2） | 并入集合断言：DOM `data-table-handle` 值集合 = `{col-grip}`，4 旧把手字面量写入点零残留 | `editor/table/contract.test.ts` / cdp 探针集合扫描 |
| `data-table-handle="col-grip"` 存在断言 | **保留**（契约延续） | `col-grip` **唯一值**断言（`dataset.tableHandle = 'col-grip'` 为唯一写入点） | `contract.test.ts`（widget.ts 写入点扫描）/ cdp 探针 |
| 工具栏/⋮ 无统一 `data-op` 断言（增删操作经把手 DOM 面探测） | **上线** | `data-op` 19 项逐项断言（opsTable 同源，id 字面量不变） | `contract.test.ts:64-74` / cdp-p10/cdp-p27 |
| 工具栏键无 `data-op` 契约 | **上线** | 工具栏 6 键逐键挂 `TOOLBAR_DATA_OP`（`grid→resizeTable`、对齐三键/🗑 同源 opsTable id、`more→TBL-MOR-OPN`，CHANGE-3 口径） | `contract.test.ts:76-102`（`toolbar.ts:62` 挂载面）/ cdp 探针 |
| ⋮ 菜单项无 `data-op` 契约 | **上线** | 菜单项 `data-op={item.id}`（19 项经 registry 同源下发） | `EditorContextMenu.tsx:81` 挂载面 / cdp-p27 |
| `window.__velox*` / 命令 id 字面量 | **零改动** | 既有断言原样通过 | `e2e/handles.d.ts` / `commands.ts` |

**诚实标注**：旧断言原文不在本 checkout（`scripts/cdp-smoke.mjs` 不随仓，随外部 e2e 环境提供），「旧断言」列按 e2e-contract-delta 决策记录口径复原，非逐字原文。

## 2. 删4留1 落点核实（grep 证据）

核查范围：worktree `projects/.worktrees/typora/ui-ux-redesign/frontend` 全仓。

### 2.1 data-table-handle 唯一值 = col-grip

```
src/renderer/src/editor/table/widget.ts:214:    grip.dataset.tableHandle = 'col-grip'
src/renderer/src/editor/table/contract.ts:14:export const TABLE_HANDLE_CONTRACT = ['col-grip'] as const
```

- 写入点唯一：`dataset.tableHandle = …` 全仓仅 widget.ts 一处，值 `col-grip`。
- 登记集合同源：`TABLE_HANDLE_CONTRACT = ['col-grip']`（contract.ts 为 DOM 属性契约单源）。
- 契约测试钉住：`contract.test.ts:48-61`（集合 = `{col-grip}` + widget.ts 写入点正则扫描 → `['col-grip']`）。

### 2.2 4 旧把手字面量零残留

`row-insert` / `row-delete` / `col-insert-left` / `col-delete` 在运行时代码（ts/tsx/css/mjs）零残留；仅存于守护断言清单（断言其**不出现**，非契约登记）：

```
src/renderer/src/editor/table/contract.test.ts:23:const DELETED_HANDLES = ['row-insert', 'row-delete', 'col-insert-left', 'col-delete'] as const
src/renderer/src/editor/table/contract.test.ts:110:    expect(css).not.toContain('.cm-md-table-btn-row-insert')
src/renderer/src/editor/table/contract.test.ts:111:    expect(css).not.toContain('.cm-md-table-btn-row-delete')
src/renderer/src/editor/table/contract.test.ts:113:    expect(css).not.toContain('.cm-md-table-btn-col-delete')
```

（`contract.test.ts:53-61` 另有 `widget.ts` 源扫描逐字面量负向断言；CSS 侧把手带布局残留断言见 `:105-116`。）

### 2.3 data-op 挂载面存证

```
src/renderer/src/components/EditorContextMenu.tsx:81:      data-op={item.id}
src/renderer/src/editor/table/toolbar.ts:62:    b.dataset.op = TOOLBAR_DATA_OP[op]
```

- 菜单面：`data-op={item.id}`（19 项 opsTable id 经 registry 下发）。
- 工具栏面：6 键（grid/alignLeft/alignCenter/alignRight/more/deleteTable）经 `TOOLBAR_DATA_OP` 统一写 `dataset.op`（`contract.test.ts:93-102` 钉住 6 键齐全）。

## 3. test:smoke 限制说明

`npm run test:smoke` 引用的 `scripts/cdp-smoke.mjs` 不在本 checkout（探针脚本随外部 e2e 环境提供），本轮补档**不执行** test:smoke。

该限制**已登记**（本报告不重复改登记点）：

- FE-03 frontmatter `skipped-gates: ["test:smoke（scripts/cdp-smoke.mjs 不在本 checkout，归 INFRA-01）"]`（tasks/IT-01/FE-03.md）
- INFRA-01 frontmatter `implementation-notes`（tasks/IT-01/INFRA-01.md：「scripts/cdp-*.mjs 探针脚本不在本仓工作区……本任务交付物为 e2e/seams 与 handles.d.ts 契约登记 + 探针断言变更清单」）

## 4. 替代证据指针

外部 cdp 环境实测存证（菜单 19 + 工具栏 6 + `data-table-handle`={col-grip}）：

→ [reports/IT-04-FE-02/IT-04-FE-02-self-test-report.md](../IT-04-FE-02/IT-04-FE-02-self-test-report.md)

关键行（§3 cdp 冒烟 + e2e 缝契约终态扫描，批次③）：

> `__velox*` 26 键全在（含懒装 `__veloxTableCellView`）；data-op 冻结集菜单 19 + 工具栏 6 全在位（`resizeTable` 口径，CHANGE-3 探针基线）；`data-table-handle`={col-grip}；命令 id 字面量 68 项扫描存证……批次①–⑦ 驱动自检即冒烟载体（`scripts/cdp-smoke.mjs` 不随仓 INFRA-01 已登记）

## 5. 本轮落盘文件

| 文件 | 变更 |
|---|---|
| `design/adr/e2e-contract-delta.md` | 附录 A 探针断言迁移对照表（旧 4 断言下线 → 新 data-op 断言上线） |
| `src/renderer/src/e2e/handles.d.ts` | 文件头注释：DOM 属性契约单源声明（仅注释，零运行时变更） |
| `src/renderer/src/e2e/seams/index.ts` | 文件头注释同义指引（仅注释，零运行时变更） |
| `reports/IT-01-INFRA-01/IT-01-INFRA-01-migration.md` | 本报告 |
