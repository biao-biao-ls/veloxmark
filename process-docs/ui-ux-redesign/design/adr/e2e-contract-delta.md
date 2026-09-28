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
