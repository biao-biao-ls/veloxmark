# IT-01-FE-08 自测报告 — 仅删表确认流（删行/列无确认+确认框冻结文案/Esc 仅关最上层）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-08.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-30
- 验收：AC-OP-09 / AC-OP-10 / AC-RULE-15 / AC-ERR-07 / UI-IXD-05 / UI-ELEM-07
- 实现图：`IT-01-FE-08-impl.png`（🗑 触发的删表确认框：冻结文案 + 「取消」/「确认删除」danger 双按钮，对照 ui_07_global.html 场景 C）
- 过程图：`IT-01-FE-08-confirmed.png`（确认后 toast「已删除表格（Ctrl+Z 可撤销）」+ 撤销按钮）；`IT-01-FE-08-undone.png`（撤销一步还原后「已撤销」）
- CDP 全量结果：`IT-01-FE-08-cdp-results.json`（30/30 PASS，场景 S0–S7）

验证驱动：`temp/fe08-driver.mjs`（CDP WebSocket，全部 `Runtime.evaluate` 带 10s 超时；目标为**全新 Electron 实例**：debug port 9266 + 独立 `temp/fe08-userdata`，与其它并行任务实例隔离）。验证前已发 `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled` + `Page.bringToFront`；全程无「恢复未保存的草稿」对话框（如有按约定点「稍后」）。

## 1. 🗑 删除表格确认流（AC-OP-09 / AC-RULE-15 / UI-IXD-05，交互 #1）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 🗑 触发 | 弹确认框 | `dialog-overlay` 在场 | ✓ |
| 冻结文案 | 「删除后可用一步撤销还原，确认删除该表格」 | 逐字一致 | ✓ |
| 双按钮 | 「确认删除」（danger 红底）/「取消」 | `dialog-btn-danger` 在场，label 逐字 | ✓ |
| 按钮布局 | 确认主按钮居右（ui_07 场景 C） | `cancelLeft < confirmLeft` | ✓ |
| 分层挂点 | `dialog.isModalOpen()` = true | true | ✓ |

## 2. 取消零副作用（AC-ERR-07 #1，交互 #1）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 点「取消」 | 关框 | `open=false` | ✓ |
| 文档 | 逐字节不变 | `getDoc()` 前后等长 207、字节相等 | ✓ |
| 回执 | 无 toast | `card=false` | ✓ |
| undo 栈 | 无条目（无事务即无条目） | 关框路径零 dispatch | ✓ |

## 3. Esc 仅关最上层（PEND-04 / AC-ERR-07，交互 #3）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 确认框上 Esc | 只关确认框、不删除 | `open=false`，文档字节不变 | ✓ |
| 同步副作用 | 无 toast | `card=false` | ✓ |
| 再次 Esc | 不触碰文档（一键回安静归 FE-09） | 文档仍字节不变 | ✓ |
| 点遮罩空白 | 同 Esc：只关最上层 | (12,12) 点击 → 关框、文档不变、无 toast | ✓ |

> 分层契约：本任务只做确认框自身的最上层关闭语义（Dialog 自有 Esc/overlay 处理，`stopPropagation` 不落全局）；未自建第二套全局 Esc 路由。FE-09 useHushLayer 的最小挂点为 `dialog.isModalOpen()`（模态在场时 hush 让行），已随 S1/S2 断言 true/false 复位。

## 4. 确认删除 + 撤销一步还原（AC-OP-09，交互 #1）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 确认后 | 整表移除、正文收拢 | 源码无 `\| a2`，lead/tail 段完整 | ✓ |
| 回执 | 「已删除表格（Ctrl+Z 可撤销）」 | 逐字一致 | ✓ |
| 撤销按钮 | 在场、label「撤销」 | `toast-undo-btn` | ✓ |
| 一步还原 | 整表逐字节还原 | 点撤销后 `getDoc()` === 删前快照 | ✓ |
| 回执换态 | 「已撤销」无按钮 | ✓ | ✓ |

## 5. 删行/删列无确认直执行（AC-OP-10 / AC-RULE-15 / Q3，交互 #2）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 删行全程 | 无确认框 | `open=false` | ✓ |
| 删行回执 | 「已删除第 i 行（Ctrl+Z 可撤销）」 | 「已删除第 3 行（Ctrl+Z 可撤销）」+ 撤销按钮 | ✓ |
| 删列全程 | 无确认框 | `open=false` | ✓ |
| 删列回执 | 「已删除第 j 列（Ctrl+Z 可撤销）」 | 「已删除第 3 列（Ctrl+Z 可撤销）」+ 撤销按钮 | ✓ |

> 现状盘点结论：删行/列本就无确认路径（menu/toolbar/快捷键四面同源直执行），FE-07 已接撤销按钮；本任务未重复接线，仅以用例锁定「无确认」语义（`confirmDeleteTable.test.ts`）。

## 6. 菜单路径同走确认流（UI-IXD-05「🗑 与菜单同流」）

右键单元格 → 五组菜单「删除表格」（`data-op="deleteTable"`）→ 同一冻结确认框；Esc 关框零副作用（文档未删）。✓

## 7. 复刻自检（ui_07_global.html 场景 C）

| 设计稿标注 | 实现 | 对齐 |
|---|---|---|
| h3「删除表格」 | dialog title `ctx.deleteTable` | ✓ |
| p 冻结文案 | message 逐字 | ✓ |
| 「取消」btn-secondary | 次按钮左 | ✓ |
| 「确认删除」btn-danger | danger 主按钮右 | ✓ |
| 卡片 + 遮罩 + token 投影 | `.dialog` + `--shadow-modal` + `--radius-md` | ✓ |

## 8. 开发门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 0 Error |
| `npm run test:unit`（FE-08 范围 8 文件 98 用例） | 全过（含新增 `confirmDeleteTable.test.ts` 7 用例 + `Dialog.test.ts` 2 用例） |
| grep 断言 `ctx.deleteTableConfirm` 双字典 | zh 冻结串逐字 + en 非空对齐 |
| 全量 vitest | 仅并行任务在飞 WIP 用例波动（`listDrag.test.ts`/`livePreview/build.test.ts`，均非 FE-08 改动面，已核对 git 状态） |

## 9. 与前置/后续任务联调口径

- **FE-07**（toast 动作按钮）：直接复用 `undoAction`/`ToastHost`，删表回执与删行/列回执同源携「撤销」按钮；撤销 ack「已撤销」5s 驻留已实测。
- **FE-09**（useHushLayer）：确认框在场 Esc/点空白由 Dialog 消费（`stopPropagation` + overlay 命中隔离，点击不落穿到底层）；`dialog.isModalOpen()` 为分层判定最小挂点；再次 Esc 才走一键回安静（本任务不实现 hush，仅保证确认框关闭语义独立、零副作用）。
- **FE-01**（禁用即语义）：禁用态点击不执行、无确认框、无 toast 报错——`isTableOpDisabled` 判定不变，菜单禁用项 `disabled` 属性阻断点击。
