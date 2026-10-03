# IT-01 FE-09 自测报告 — useHushLayer 一键回安静与模态叠加（Esc/空白分层收拢/确认框最上层优先）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-09.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-30
- 验收：AC-FN-21 / AC-FN-22 / AC-FN-29（边界接线）/ AC-RULE-05 / UI-IXD-12
- 实现图：`IT-01-FE-09-impl.png`（收拢前多浮层：⋮ 菜单展开 + 表格工具栏 + 单元格激活 + 操作 toast，对照 `ui_07_global.html` 场景 A 左「收拢前」角标）
- 过程图：`IT-01-FE-09-quiet.png`（一次 Esc 收拢后：零 chrome、光标回正文（焦点回正文·静息）、toast 不被收拢仍驻留，对照场景 A 右「收拢后」）
- CDP 全量结果：`IT-01-FE-09-cdp-results.json`（25/25 PASS，场景 S0–S9）

验证驱动：`temp/fe09-driver.mjs`（CDP WebSocket，全部 `Runtime.evaluate` 带 10s 超时；目标为**全新 Electron 实例**：debug port 9279 + 独立 `temp/fe09-userdata2`，与其它并行任务实例隔离）。验证前已发 `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled` + `Page.bringToFront`；全程无「恢复未保存的草稿」对话框（如有按约定点「稍后」）。

## 0. 分层消费顺序用例清单（任务阶段 2 必含）

分层表自顶向下：**确认框（modal）→ 菜单 / popover（⋮/右键/⊞/MenuBar）→ 表格工具栏 / 双区编辑 / chip（chrome）→ 静息 + 焦点回正文**。

| # | 场景（栈） | 触发 | 消费动作 | 终态 | 验证 |
|---|---|---|---|---|---|
| L1 | 空栈 | Esc | 消费结果 `none`，零副作用 | 静息；文档字节不变、不吞正文 Esc | 单测 + S1 |
| L2 | 仅菜单（MenuBar 下拉） | Esc | 一次收拢（含子菜单，非两级） | 静息 + 焦点回正文 | 单测 + S2 |
| L3 | 仅 chrome（表格工具栏） | Esc / 点正文空白 | 一次收拢 | 静息 + 焦点回正文 | 单测 + S7 |
| L4 | 菜单 + chrome 同开（⋮ 菜单 + 表格工具栏） | Esc | **一次收拢全部（非逐个关闭）** | 静息 + 焦点回正文 | 单测 + S4 |
| L5 | 确认框 + 菜单同开 | Esc #1 | **仅关最上层确认框**（零副作用，不删除） | 菜单保持 | 单测 + S5 |
| L6 | 确认框 + 菜单同开 | Esc #2 | 收拢剩余菜单 | 静息 + 焦点回正文 | 单测 + S5 |
| L7 | 确认框 + 菜单同开 | 点遮罩空白 | 仅关确认框（UI-IXD-12 无穿透、无删除；下层让行） | 菜单保持（blank == Esc） | S6 |
| L8 | 确认框在场（未注册，`isModalOpen()` 探针） | Esc | hush 整体让行（返回 `modal`） | 下层不收拢 | 单测（skip-guard） |
| L9 | toast 在场 | Esc | toast **不属**收拢对象 | toast 驻留至 5s 自灭 | 单测 + S8 |
| L10 | 仅 hover 浮层（无注册层） | Esc | `hideAllNow` 收拢外部 chrome、**不夺焦点** | 静息，光标原地 | 单测 |
| L11 | 表格内部空白（glb-hush:boundary） | 点表格空白 | **不进 hush 触发面**（表格点击路由管辖） | 分级退格归表格侧（见 §7 缺口说明） | 单测边界 + 边界选择器 |

单测（`hooks/useHushLayer.test.ts`，13 用例）同表覆盖：modal 顶优先 / 二次 Esc 全收 / 一次收拢全层（逆注册序）/ 模态在场保留下层 / 空栈零副作用 / skip-guard 让行 / collapseAll 顶序 + toast 不动 / 菜单+hover 同收 / hover-only 不夺焦点 / 死层自剪（isAlive）/ isLayerTarget 归属命中 / 同 id 重注册替换 / unregister 注销。

## 1. 空栈 Esc 零副作用（AC-FN-21 空态处理，交互 #1）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 空栈 Esc | 无动作、文档不变 | `getDoc()` 前后逐字节相等 | ✓ |
| chrome 快照 | 不误触任何浮层 | 菜单/⋮/工具栏/对话框 全 false 前后一致 | ✓ |
| 正文 Esc 既有行为 | 不吞（消费结果 `none` 即不 preventDefault） | 无异常、无焦点挪动 | ✓ |

## 2. Esc / 正文空白一键回安静（AC-FN-21 / AC-RULE-05 / UI-IXD-12，交互 #1）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| MenuBar 下拉 + Esc | 一次收拢 | `.menu-dropdown` 消失 | ✓ |
| ⋮/右键菜单 + Esc | 一次收拢（含子菜单，非两级） | `.velox-ctx-item` 消失，文档不变 | ✓ |
| 多层同开 + Esc | **一次全部收拢（非逐个）** | ⋮ 菜单与表格工具栏同帧消失 | ✓ |
| 焦点回归 | 焦点回正文（静息） | `activeElement = .cm-content` | ✓ |
| body-blank == Esc | 表格编辑态点正文段落 | 表格退编辑、工具栏/高亮全消、焦点回正文（AC-FN-22，0px 位移由 widget 布局保证） | ✓ |

## 3. 模态叠加 PEND-04（确认框最上层优先，交互 #2）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 确认框 + 菜单同开 | 确认框恒最上层 | `dialog-overlay` + `.menu-dropdown` 同时在场 | ✓ |
| Esc #1 | **仅关确认框**、零副作用 | 框消、菜单保持、文档字节不变 | ✓ |
| Esc #2 | 收拢剩余菜单 | 菜单消、焦点回正文 | ✓ |
| 点遮罩空白 | 同 Esc：仅关确认框 | (12,12) 点击 → 框消、菜单保持、无 toast（未删除）、文档不变 | ✓ |
| 无穿透（UI-IXD-12） | 击穿不落到正文/删除流 | 遮罩命中在最上层；`delete` 未执行（无 toast 回执） | ✓ |
| 删除防护 | Esc 永不执行/绕过删除 | 全程无删除副作用（FE-08 口径一致） | ✓ |

## 4. toast 不误伤（交互 #1 约束）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 操作 toast 在场 | 删行回执 + 撤销按钮 | 「已删除第 2 行（Ctrl+Z 可撤销）」 | ✓ |
| Esc 后 | toast 不被收拢 | toast DOM + seam 文案均保持 | ✓ |

## 5. FE-04 联调：⋮ 菜单开合注册/注销、Esc 不双重触发

- ⋮ 开 → `ctx-menu` 层注册；关（选中/外部/Esc）→ 注销 + 焦点归还合同保持。✓
- Esc 由 bus 统一消费后 `stopPropagation`（同节点监听 `stopImmediatePropagation`），菜单内/文档级不会双触发（S3 文档不变 + 单次收拢）。✓
- 键盘 ← 仍可从子菜单收拢回一级（keyboardNav 保留）；Esc 一律一键到底（裁决：AC-FN-21 one-shot 优先于 keyboardNav 两级 Esc）。

## 6. FE-08 联调（AC-ERR-07 口径一致）

- `dialog.isModalOpen()` 复用为 skip-guard 挂点（不重建）；`cancelActiveDialog` 作为 modal 层 `close()`（与 Dialog 自有 Esc/遮罩同路径 settle，零副作用）。✓
- 删表确认框 Esc/遮罩仅关框不删除（S5/S6 与 FE-08 S3/S4 同口径）。✓

## 7. 边界（glb-hush:boundary）与 AC-FN-29 缺口说明

- 表格区（`.cm-md-table-outer, .cm-md-table-toolbar`）点击**不进** hush 触发面（单测边界 + 选择器接线）。✓
- **AC-FN-29 分级退格（单元格激活 → 点表格空白 → 退回表格编辑态、工具栏保留）不在本任务落地**：表格侧 `TableEditState` 无「编辑态但无单元格激活」表示（`editing = active != null`，工具栏挂载条件同源），分级退格属表格点击路由职责（IT-03/FE-09 并行任务正在改 `editor/table/widget.ts` 点击路径/`clickSemantics.ts`）。本任务已交付边界选择器与分层栈 chrome 层挂点，退格模型移交该任务，见任务 frontmatter `implementation-notes`。

## 8. 开发门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 0 error |
| `npm run test:unit` | 63 文件 / 795 用例全过（含 useHushLayer 13 用例） |
| `npm run build` | ✓ 构建成功 |
| `npx madge --circular` | ✔ No circular dependency found（Dialog→useHushLayer 单向 `setModalProbe`，无环） |
| 浏览器验证 | 全新实例（port 9279 + 独立 user-data-dir）25/25 PASS |

## 9. 复刻走查（ui_07_global.html 场景 A「一键回安静」）

| 设计稿标注 | 实现 | 对齐 |
|---|---|---|
| 收拢前：菜单 ⋮ 展开 · 表格工具栏 · chip 浮层点 | impl.png：⋮ 五组菜单 + 工具栏 + 单元格激活 | ✓ |
| Esc / 点击正文空白 一次收拢（非逐个关闭） | S4 一次 Esc 同帧全消 | ✓ |
| 收拢后：焦点回正文 · 终态必为静息 | quiet.png：零 chrome、光标在正文 | ✓ |
| toast 两态独立于收拢 | S8 + quiet.png toast 驻留 | ✓ |
| 一次收拢语义说明（菜单/popover/工具栏/双区编辑/chip） | 分层表 L1–L11 用例清单 | ✓（双区编辑/chip 走 hoverDiscipline chrome 钩子，同一 hideAllNow 收口） |
