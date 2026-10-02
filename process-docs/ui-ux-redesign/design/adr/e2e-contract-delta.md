# ADR：e2e 缝契约集演进（删 4 留 1）

- 状态：已确认（2026-09-28，grill-me Q2）
- 决策类型：难逆（外部 cdp 探针消费契约）+ 真权衡（G-2 去把手 vs AC-RULE-17 不可变）

## 背景

AC-RULE-17（原）声明 `data-table-handle` 探针契约家族不可变；G-2（契约 delta 裁决）要求移除常驻 +/− 增删把手。两契约直接冲突，且 `data-table-handle` 家族（`row-insert|row-delete|col-insert-left|col-delete|col-grip`）被外部 cdp 探针以正则扫描消费。

## 决策

**登记契约集演进：删 4 留 1。**

- 删除：`data-table-handle="row-insert"` / `"row-delete"` / `"col-insert-left"` / `"col-delete"`（随把手 UI 一并移除，G-2 语义）
- 保留：`data-table-handle="col-grip"`（列宽拖拽抓手仍有 UI，契约延续）
- 工具栏 / ⋮ 菜单改挂统一 `data-op` id（与 opsTable.ts **19 个 data-op id**（16 单元格级 + 3 文档级）同源，计数口径见 `api/TBL-table-ops.md` §1，menu-tree §4.2 对应）
- AC-RULE-17 修订为：「已登记的契约集演进（删 4 留 1）为准入变更；此后契约集变更须走登记流程，禁止静默破坏」

## 后果

- 外部 cdp 探针需同步下线 4 个把手断言，改断言工具栏/⋮ 的 `data-op` id；探针与本仓 `cdp-*.mjs` 同批更新
- 契约「不可变」红线改为「演进须登记」——保留防静默破坏的内核，允许有据可查的契约变更
- 备选（弃）：保把手不动（违 G-2）；新增平行契约不删旧的（死契约堆积，探针双断言长期漂移）

## 引用

grill-rulings.md Q2；ac.md AC-RULE-17 修订项；menu-tree.md §4.2

---

## 附录 A：探针断言迁移对照表（旧 4 把手断言下线 → 新 data-op 断言上线）

> 登记来源：INFRA-01 交付物（tasks/IT-01/INFRA-01.md「涉及文件」契约 delta 登记文档行 / 交互操作 3：探针断言变更清单含旧断言→新断言迁移对照）。
> 素材口径：本 ADR 决策记录（删 4 留 1）+ `editor/table/contract.test.ts:53-74` + 挂载面 `EditorContextMenu.tsx:81`（`data-op={item.id}`）/ `toolbar.ts:62`（工具栏 6 键 `dataset.op = TOOLBAR_DATA_OP[op]`）。
>
> **诚实标注**：旧断言原文不在本 checkout（`scripts/cdp-smoke.mjs` 随外部 e2e 环境提供，不随仓；已登记于 INFRA-01 implementation-notes 与 FE-03 skipped-gates），下表「旧断言」列按 e2e-contract-delta 决策记录口径复原，非逐字原文。

### A.1 data-table-handle 把手面（4 把手断言下线 → 集合断言上线）

| # | 旧断言（data-table-handle 4 把手面，按决策记录口径复原） | 处置 | 新断言 | 落点 |
|---|---|---|---|---|
| 1 | `data-table-handle="row-insert"` 存在（行增把手面） | **下线**（随把手 UI 移除，G-2） | 并入集合断言：DOM `data-table-handle` 值集合 = `{col-grip}`；`row-insert` 字面量在写入点零残留 | `contract.test.ts`（`TABLE_HANDLE_CONTRACT = ['col-grip']` + widget.ts 源扫描断言）/ cdp 探针集合扫描 |
| 2 | `data-table-handle="row-delete"` 存在（行删把手面） | **下线**（同上） | 同上，`row-delete` 字面量零残留 | 同上 |
| 3 | `data-table-handle="col-insert-left"` 存在（列增把手面） | **下线**（同上） | 同上，`col-insert-left` 字面量零残留 | 同上 |
| 4 | `data-table-handle="col-delete"` 存在（列删把手面） | **下线**（同上） | 同上，`col-delete` 字面量零残留 | 同上 |
| 5 | `data-table-handle="col-grip"` 存在（列宽抓手面） | **保留**（契约延续，承载 UI 仍在） | `data-table-handle="col-grip"` **唯一值**断言（`dataset.tableHandle = 'col-grip'` 为 widget.ts 唯一写入点） | `contract.test.ts`（`widget.ts` 写入点正则扫描 `dataset\.tableHandle\s*=\s*'([^']+)'` → `['col-grip']`）/ cdp 探针 |

### A.2 data-op 面（工具栏/⋮ 断言上线，id 字面量零改动）

| # | 旧断言（把手时代对照面） | 处置 | 新断言 | 落点 |
|---|---|---|---|---|
| 6 | 工具栏/⋮ 无统一 `data-op` 断言（增删操作经把手 DOM 面探测） | **上线** | `data-op` 19 项逐项断言：`TABLE_MENU_OP_IDS` 与冻结集逐项一致 + `opsTable.ts` id 面 = 19 项集合（字面量不变） | `contract.test.ts:64-74` / cdp-p10/cdp-p27 契约扫描 |
| 7 | 同上（工具栏键无 data-op 契约） | **上线** | 工具栏 6 键逐键挂 `TOOLBAR_DATA_OP`：`grid→resizeTable`、`alignLeft/alignCenter/alignRight/deleteTable→` opsTable 同源 id、`more→TBL-MOR-OPN`（CHANGE-3 口径） | `contract.test.ts:76-102`（toolbar.ts 挂载点扫描）/ cdp 探针 |
| 8 | ⋮ 菜单项无 `data-op` 契约 | **上线** | 菜单项 `data-op={item.id}`（19 项 opsTable id 经 registry 装配同源下发） | `EditorContextMenu.tsx:81` 挂载面（`contract.test.ts` opsTable id 面断言钉住集合）/ cdp-p27 |

### A.3 零改动面（对照完整性）

| 契约面 | 处置 | 说明 |
|---|---|---|
| `window.__velox*` 系列（handles.d.ts） | **零改动** | JS handle 契约不随本 delta 演进；DOM 属性契约单源在 `editor/table/contract.ts`，勿在 handles.d.ts 登记 |
| 命令 id 字面量（commands.ts） | **零改动** | 探针既有断言原样通过 |

### A.4 复核证据（grep 落点）

- 全仓 `dataset.tableHandle = …` 写入点唯一：`widget.ts` `= 'col-grip'`（`contract.ts` `TABLE_HANDLE_CONTRACT = ['col-grip']` 登记值同源）。
- 4 旧把手字面量（`row-insert`/`row-delete`/`col-insert-left`/`col-delete`）在运行时代码零残留；仅存于 `contract.test.ts` 的 `DELETED_HANDLES` 负向断言清单（断言其不出现，属守护断言非契约登记）。
- 详细核验与 test:smoke 限制说明见 `reports/IT-01-INFRA-01/IT-01-INFRA-01-migration.md`。
