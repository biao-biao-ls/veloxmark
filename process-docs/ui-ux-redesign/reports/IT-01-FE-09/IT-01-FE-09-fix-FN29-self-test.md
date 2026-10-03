# IT-01 FE-09 fix-FN29 自测报告 — AC-FN-29 分级退格 定向缺口修复

- 日期：2026-09-30
- 范围：**定向缺口修复**（仅 AC-FN-29 分级退格），非全量开发；不覆盖 FE-09 其余 AC
- 工作包：`D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 产物前缀：`IT-01-FE-09-fix-FN29-*`（不覆盖既有 `IT-01-FE-09-*` 产物）

## 1. 缺口与根因

| 项 | 内容 |
|---|---|
| 缺口 | AC-FN-29：单元格激活态下点表格内未命中任何单元格的空白（gap）应**分级退格**——①退出激活态、回到**表格编辑态**（非直达静息）②表格工具栏**保持挂载**。旧实现 gap 点击走 `clearTableEditAndFocusSource` 全退（提交+回表格源） |
| 根因 | `TableEditState` 无「编辑态但无 active」表示（`editing = active != null`，工具栏挂载同源） |
| 修复思路 | 状态层加 `editFrom: number \| null`（编辑会话）与 `active` 解耦：`setActiveCell.of(cell)` 激活即开会话；`setActiveCell.of(null)` = 全退（既有调用点零回归）；新增 `enterEditMode.of(tableFrom)` = 分级退格（active 清、会话留）。gap 点击路由改走新命令 `enterTableEdit`；全退唯一出口 `exitTableEdit`（Esc / 点正文 / 选区离开） |

## 2. 代码改动（TDD：RED 先行）

| 文件 | 改动 |
|---|---|
| `src/renderer/src/editor/table/editMode.test.ts` | 新增：15 个 RED 测试（状态模型/gap 路由/二次退出/AC-FN-32 转移/`eq` 重建契约），先跑确认 14 失败 |
| `src/renderer/src/editor/table/state.ts` | `TableEditState` 增 `editFrom`；新 effect `enterEditMode`；`setActiveCell` 语义扩展（null=全退）；docChanged 映射 `editFrom` |
| `src/renderer/src/editor/table/commands.ts` | 新命令 `enterTableEdit`（gap 路由：分级退格/未命中路径，幂等，pending 先提交，不动光标）；`exitTableEdit` 扩展清 `editFrom`；删 `clearTableEditAndFocusSource` |
| `src/renderer/src/editor/table/widget.ts` | `TableWidgetSpec.editing` 与 `active` 解耦；`eq` 加 `editing` 比较（静息↔退格形态必须重建 DOM 挂/卸工具栏）；gap mousedown → `enterTableEdit`；工具栏按 `editing` 挂载 |
| `src/renderer/src/editor/table/lifecycle.ts` | `ownOp` 纳入 `enterEditMode`（gap 自身事务不触发选区离开自动退出）；自动退出/Esc 按会话（`active?.tableFrom ?? editFrom`）识别退格形态 |
| `src/renderer/src/editor/livePreview/handlers-code.ts` | `enterTable` 的 hatch 抑制与 spec `editing` 跟随编辑会话（激活态 OR 退格形态） |

复用不重建：useHushLayer 边界选择器（`TABLE_REGION_SEL` 表格区不进 hush 触发面）与 chrome 层 `close: exitTableEdit` 原样沿用（扩展后的 exit 自然覆盖退格形态）；clickSemantics 裁决（AC-RULE-13）未改。

## 3. 质量门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | ✅ 0 Error |
| `npm run test:unit`（Vitest） | ✅ 820/820（table 域 131，含新增 editMode 15） |
| `npm run build` | ✅ built in 25.13s |
| 文案冻结面（toast.*/ctx.*/err.*） | ✅ 零改动、零新增文案 |
| e2e 缝（`window.__velox*`） | ✅ 零新增 key（探针走 DOM 类 + 既有缝） |

## 4. CDP 浏览器验证（AC-FN-29 逐条判据）

环境：**全新 Electron 实例**——debug port `9521`（避开占用中的 9279/9457）+ 独立 user-data-dir `D:/code/typora/temp/fn29-fix-userdata`；`Runtime.evaluate` 带 8s 墙钟超时；验证前 `Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled({enabled:true})`；草稿恢复对话框一律点「稍后」（本次运行未出现该对话框）。驱动：`IT-01-FE-09-fix-FN29-cdp-driver.mjs`，结果：`IT-01-FE-09-fix-FN29-cdp-results.json`，**27/27 PASS**。

### 判据① gap 点击后状态（分级退格，非直达静息）

前置：点击单元格 (1,0)「a」→ 激活态成立（`nested=true, .cm-md-table-editing=1, toolbar=1`）。点击表格 gap（`<table>` 边框下缘外 6px，outer 内边距空档，gapH=8）：

| 观测 | 点击前 | 点击后 | 判定 |
|---|---|---|---|
| 激活态 `window.__veloxTable.nested` | true | **false**（退出激活） | ✅ |
| 单元格编辑 DOM `.cm-md-table-cell-editing` | 1 | **0** | ✅ |
| 表格编辑态 `.cm-md-table-editing` | 1 | **1**（回到表格编辑态，非静息） | ✅ |
| 文档写入 | — | 零写入（纯点击不落文档） | ✅ |
| 光标 | from=0 | from=0（不跳表格源，与旧全退行为区分） | ✅ |

### 判据② 工具栏挂载（保持可见）

gap 点击后 `.cm-md-table-toolbar` 计数 **1**，六键 `data-op` 全在位（契约 `TOOLBAR_DATA_OP` 同源字面量）：`resizeTable`（⊞）/ `alignLeft`/`alignCenter`/`alignRight`（对齐三键）/ `TBL-MOR-OPN`（⋮）/ `deleteTable`（🗑）。证据截图：`IT-01-FE-09-fix-FN29-editform.png`。

### 判据③ 二次退出路径（回静息）

| 路径 | 操作 | 结果 | 判定 |
|---|---|---|---|
| Esc 一键（AC-FN-21） | 退格形态下按 Esc | toolbar=0 / editing=0 / nested=false（全静息） | ✅ |
| 点正文空白（AC-FN-22） | 再入（cell→gap 退格）后点正文段 | toolbar=0 / editing=0 / nested=false（全静息） | ✅ |

Esc 一次到底语义未回归（无残留 chrome）。证据截图：`IT-01-FE-09-fix-FN29-quiet.png`。

## 5. 零回归

| 项 | 结果 |
|---|---|
| AC-FN-03 单元格点击激活 + 工具栏浮现 | ✅ |
| AC-FN-03 未命中路径：静息→点 gap→编辑态无 active + 工具栏浮现（与分级退格同模型交付） | ✅ |
| AC-FN-32 激活转移：A(1,0)→B(2,1) 单 active、工具栏保持 | ✅ |
| AC-FN-32：退格形态再点单元格可再激活（edit→active 通路活，回到 (1,0)） | ✅ |
| pendingHandoff / pendingCommitChanges：`setCellDoc('pending-gap')` 后 gap 点击 → 源码含 `pending-gap` 且仍在编辑态 | ✅ |
| AC-RULE-13 点击语义路由（clickSemantics） | ✅ 未改；gap press 仍裁决 `edit` → `enterTableEdit` |
| AC-RULE-17/18 / FE-06 | ✅ 未触及（改动面限 `editor/table/*` + handlers-code enterTable + lifecycle） |
| `window.__velox*` 缝 key 集 | ✅ 白名单外零新增、零删除（`__veloxTableCellView` 为 nestedSession 既有懒安装契约缝） |
| Esc one-shot（AC-FN-21/22） | ✅ 见判据③ |

## 6. 并行边界遵守

未触碰：标题/引用折叠装饰管线（IT-03/FE-07）、`editor/widgets.ts` 公式/代码/mermaid（IT-03/FE-10）、export 面、hoverDiscipline 核心计时。改动面：`editor/table/{state,commands,widget,lifecycle,editMode.test}.ts` + `handlers-code.ts` enterTable 局部 + `lifecycle.ts`。

## 7. 产物清单

| 文件 | 说明 |
|---|---|
| `IT-01-FE-09-fix-FN29-cdp-driver.mjs` | CDP 驱动（S0–S7） |
| `IT-01-FE-09-fix-FN29-cdp-results.json` | 27/27 PASS 明细 |
| `IT-01-FE-09-fix-FN29-self-test.md` | 本报告 |
| `IT-01-FE-09-fix-FN29-editform.png` | 退格形态（工具栏保持）截图 |
| `IT-01-FE-09-fix-FN29-quiet.png` | 静息形态截图 |

## 8. 结论

AC-FN-29 三条判据全部通过（分级退格状态、工具栏保持、二次退出路径），零回归清单全绿，质量门禁全过。缺口闭环。
