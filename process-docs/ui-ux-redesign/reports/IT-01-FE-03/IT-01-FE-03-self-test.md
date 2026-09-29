# IT-01-FE-03 自测报告 — 去增删把手与 data-op 契约迁移

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-03.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 验收：AC-FN-01 / AC-FN-02 / AC-RULE-17

## 1. 契约面集合前后对比（删 4 留 1 清单）

### 1.1 `data-table-handle` 契约集

| 契约值 | 变更前 | 变更后 | 处置 |
|---|---|---|---|
| `row-insert` | 写入（`handleBtn` 行首 +） | **删除** | 契约+UI 双删 |
| `row-delete` | 写入（`handleBtn` 行首 −） | **删除** | 契约+UI 双删 |
| `col-insert-left` | 写入（`addColHandles` 列首 +） | **删除** | 契约+UI 双删 |
| `col-delete` | 写入（`addColHandles` 列首 −） | **删除** | 契约+UI 双删 |
| `col-grip` | 写入（表头列宽抓手） | **保留** | 拖拽调列宽行为不变 |

- 变更前 DOM 集合：`{row-insert, row-delete, col-insert-left, col-delete, col-grip}`（5 项）
- 变更后 DOM 集合：`{col-grip}`（1 项）— 实测 editing 态 `handleValues = ["col-grip"]`，idle 态空
- 登记：ADR `design/adr/e2e-contract-delta.md` Q2「删 4 留 1」；单源 `src/editor/table/contract.ts` 的 `TABLE_HANDLE_CONTRACT`
- 测试锚：`contract.test.ts`（widget.ts 4 个已删字面量零残留 + `dataset.tableHandle = 'col-grip'` 唯一写入点）

### 1.2 `data-op` 契约面（opsTable 19 项冻结，字面量不变）

| 面 | 变更前 | 变更后 |
|---|---|---|
| opsTable.ts 19 id | 冻结 | **不变**（16 单元格级 + 3 文档级） |
| ⋮ 菜单 19 项 `data-op` | 已挂 | **不变**（与 opsTable 同源） |
| 工具栏 6 键 `data-op` | 未挂（无 data-op） | **新增挂载**（见下表） |

工具栏 6 键映射（`contract.ts` `TOOLBAR_DATA_OP` 单源）：

| 按钮 | data-op | 来源 |
|---|---|---|
| ⊞ 调整行列数 | `resizeTable` | FE-05「resizeTable op id 复用」+ task-list PATH-05 机器路径（change-log **CHANGE-3** 登记，替代 ui_03 的 `TBL-TOOL-GRID`） |
| ◧ 左对齐 | `alignLeft` | opsTable 同源 |
| ▣ 居中对齐 | `alignCenter` | opsTable 同源 |
| ◨ 右对齐 | `alignRight` | opsTable 同源 |
| ⋮ 更多 | `TBL-MOR-OPN` | ui_03 原型/menu-tree §4 菜单展开源锚点，字面量不变 |
| 🗑 删除表格 | `deleteTable` | opsTable 同源 |

实测工具栏扫描：`["resizeTable","alignLeft","alignCenter","alignRight","TBL-MOR-OPN","deleteTable"]` ✓

⋮ 菜单扫描：19 项 table op 与 opsTable 冻结集 **setEqual=true，missing=[]**；尾随通用右键段（cut/copy/paste/copyAs/paragraph/format/insert）为既有共享面，FE-03 未改动。

### 1.3 布局契约（28px 把手带/左侧留白清零）

| 项 | 变更前 | 变更后 |
|---|---|---|
| `--table-handle-gutter`（56px 负边距吸收） | 存在 | **删除** |
| `--table-col-handle-gutter`（28px） | 存在 | **删除** |
| `.cm-md-table-btn-row-insert/row-delete/col-insert/col-delete` | 存在 | **删除** |
| `.cm-md-col-grip` 样式 | 存在 | **保留** |
| `.cm-md-table-wrap` 布局 | 负边距吸收把手带 | `margin: 0 var(--editor-gutter)`，padding 0 |

## 2. AC 验收证据

### AC-FN-01 表格左缘与正文列左缘偏移 0px（无把手带）

- 进出编辑态布局位移（scroller 文档坐标，重查 DOM 防 stale）：`enterShift {x:0,y:0}`，`exitShift {x:0,y:0}`，段落漂移 ≤1px（亚像素）
- 文本级对齐：`para.rect.left + paddingLeft − table.rect.left = 0`（`.cm-line` 自带 `padding-left: var(--editor-gutter)`，已扣除）
- idle 态：`wrapPaddingLeft=0px`，`wrapMarginLeft=16px`（= `--editor-gutter`），把手数 0
- 截图：`IT-01-FE-03-idle.png`（静息）/ `IT-01-FE-03-impl.png`（编辑态，无把手带）

### AC-FN-02 编辑态无 +/− 增删把手；结构操作仅四入口

- DOM 扫描：`deletedBtns=0`（`.cm-md-table-btn-*` 全族）、`plusMinus=0`
- `data-table-handle` 集合 = `{col-grip}`（editing 态 gripCount=2~3 随列数）
- 四入口确认：
  1. 工具栏（`data-op` 6 键）— `IT-01-FE-03-impl.png`
  2. ⋮ 菜单（19 项）— `IT-01-FE-03-menu.png`
  3. 右键菜单（与 ⋮ 同一 surface，`openTableContextMenu`）
  4. 快捷键（`structKeyBindings`/`tableStructBindings`，未改动）
- col-grip 拖拽非回归：mousedown→move(+60px)→mouseup，列宽 261px→321px，`colgroup col[data-col=0] style.width="321px"` 持久化，editing 态保持

### AC-RULE-17 契约集演进已登记

- ADR `design/adr/e2e-contract-delta.md` Q2 裁决（删 4 留 1）已确认
- `design/change-log.md` **CHANGE-3**（pending）：⊞ data-op 取 `resizeTable`（op-id 命名空间）替代 ui_03 `TBL-TOOL-GRID`；⋮ 保持 `TBL-MOR-OPN`；风险中
- 单源登记：`src/editor/table/contract.ts` + `contract.test.ts` 8 条断言钉住（handle 集合 / 19 id 冻结 / 工具栏挂载 / CSS 残留清零）

## 3. 质量门禁

| 门禁 | 结果 |
|---|---|
| `npm run test:unit` | **394/394 通过**（含新增 contract.test.ts 8 条） |
| `npm run typecheck` | 见 §5（并行任务外部错误 1 处，非本任务文件） |
| e2e 缝 | `window.__veloxTable.activate/clearEdit/op`、`data-op`、`data-table-handle` 全部未破坏 |
| test:smoke | 本 checkout 无 `scripts/cdp-smoke.mjs`（INFRA-01 归属），跳过 |

## 4. 改动文件

| 文件 | 改动 |
|---|---|
| `src/editor/table/contract.ts` | **新增** 契约面单源（TABLE_HANDLE_CONTRACT / TABLE_MENU_OP_IDS / TOOLBAR_DATA_OP） |
| `src/editor/table/contract.test.ts` | **新增** 8 条契约断言（源文件扫描 + 常量集合同步） |
| `src/editor/table/widget.ts` | 删 `handleBtn`/`addRowHandles`/`addColHandles`；仅留 `addColGrip`（表头，editing 态） |
| `src/editor/table/toolbar.ts` | 6 键经 `TOOLBAR_DATA_OP[op]` 挂 `dataset.op` |
| `src/styles/markdown.css` | 删把手带布局变量与 4 个按钮样式；wrap 左缘对齐正文列 |

未改动：`opsTable.ts`（19 id 冻结面，FE-03 仅确认挂载点）、i18n 字典（`tableHandle.insertRowBelow/deleteRow/insertColLeft/deleteCol` key 保留，FE-11 收口）。

## 5. 已知事项 / 移交

1. **CHANGE-3 待主 agent 确认**：⊞ `data-op` 取舍（`resizeTable` vs ui_03 `TBL-TOOL-GRID`）已按 PATH-05 机器路径裁定并登记，评审时请拍板。
2. **i18n 残留 key**：4 个把手相关 `tableHandle.*` 文案 key 仍在 en/zh 字典（本任务不删 key，FE-11 i18n 收口时处理）。
3. **typecheck 外部错误**：`src/renderer/src/commands/shortcutSync.test.ts(84): Cannot find name 'stubOps'`——兄弟任务在飞改动，非本任务文件；vitest 不受影响。收尾前请重跑 typecheck。
4. **截图环境坑**（对复现者）：Electron 窗口失焦会触发 `lifecycle.ts` blur 自动退出表格编辑并关闭右键菜单；抓图需在同一 CDP 会话内 evaluate+capture；被遮挡窗口的合成器可能不上屏新图层，需 `Emulation.setFocusEmulationEnabled` + `setDeviceMetricsOverride`。
5. **测试环境噪音**：会话中出现「恢复未保存的草稿」弹窗（崩溃草稿，时间 2026/09/29 11:39）；按权限约束未执行「丢弃草稿」，截图期间仅 DOM 隐藏该弹窗遮罩，**草稿数据未动**，请用户自行处置。

## 6. 截图清单

| 文件 | 状态 | 内容 |
|---|---|---|
| `IT-01-FE-03-impl.png` | 编辑态 | 工具栏 6 键 + 活动单元格 + 无把手带 + 左缘对齐 |
| `IT-01-FE-03-menu.png` | ⋮ 菜单开 | 19 项 table ops（含 3 个红色危险项）+ 通用右键段 |
| `IT-01-FE-03-idle.png` | 静息态 | 无把手/无工具栏，表格左缘与正文列对齐 |
