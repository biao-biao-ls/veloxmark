# IT-01-FE-09 自测报告 — useHushLayer 一键回安静与模态叠加（Esc/空白分层收拢/确认框最上层优先）

- **任务ID**: IT-01/FE-09（useHushLayer 一键回安静与模态叠加）
- **测试时间**: 2026-10-03 07:25–07:55（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（主自测 S0–S9 **25/25 PASS** + fix-FN29 定向 **27/27 PASS**）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = hush 分层收拢 store 单测 + 表格分级退格模型单测 + z 序不变量单测 + CDP 实测（多浮层收拢/模态叠加/确认框最上层）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-09.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-21 | 多浮层/编辑态并存（含或不含模态确认框）：Esc/正文空白点击一键回安静——浮层全部收拢、编辑态退出、确认框层级正确 | ✅ 通过 | ① hush store 单测本轮重跑 `useHushLayer.test.ts` **16/16**（含 `second consume (modal gone) one-shot collapses the menu and focuses body`——确认框先行、二次 Esc 一键到底 ✓）；② CDP 存档 §2（Esc/正文空白一键回安静多浮层并存实测）+ §1（空栈 Esc 零副作用）；③ 模态叠加 PEND-04：§3 确认框最上层优先 + z 序不变量 `overlayZOrder.test.ts` **2/2**（`dialog-overlay z > table-grid-picker z > editor-context-menu z` + code-lang-picker 同 popover 层级）；④ math/code 双区收拢面（P1 batch-biz-p06 修复）：探针式 `currentBlockEdit()` 不依赖注册浮层也收拢（impl 8） |
| AC-FN-22 | 表格编辑态点正文其他段落：退出编辑态、工具栏/高亮/把手/chip 全消失无残留、后续输入落正文 | ✅ 通过 | ① 全退唯一出口 `exitTableEdit`（Esc/点正文，语义不变）：`secondary exit` 组 2 用例（`full quiet from edit form without active cell`/`full quiet from cell-active (one-shot collapse stays intact)`）✓；② chrome 收口 = bus 的 `close=exitTableEdit`（注册层逆序 → blockEdit.close() → focusBody → collapseChrome，impl 8）；③ CDP §2 实测无残留 + 焦点回正文 |
| AC-FN-29 | 表格单元格激活态点表格内空白（未命中单元格）：分级退格——退激活态回编辑态（工具栏保持）、非直达静息 | ✅ 通过 | ① 分级退格模型 `editMode.test.ts` **15/15**：`enterEditMode steps back to edit form: active cleared, session kept` + `enterTableEdit (gap click router)` 5 用例（`cell-active + gap click → graded step-back to edit form with no active cell`/`keeps the edit session that mounts the toolbar (toolbar retention)`/`does not jump the cursor to the table source`/静息切入 AC-FN-03/幂等）+ `setActiveCell.of(null) is the full exit` ✓；② CDP fix-FN29 存档 **27/27**（判据①分级退格非直达静息/判据②工具栏保持/判据③二次退出回静息，`IT-01-FE-09-fix-FN29-cdp-results.json`）；③ `editFrom` 与 `active` 解耦随 doc changes remap（`maps editFrom through doc changes like the active tableFrom`） |
| AC-RULE-05 | 浮层/编辑态收拢规则：一次收拢全部 chrome；模态确认框最上层优先（PEND-04）；Esc 不抢已消费键 | ✅ 通过 | ① one-shot 语义：Esc 一键到底（glb-hush:one-shot 取代两级 Esc，keyboardNav 死合同清理 impl 11）；② 不抢/不双触发：document keydown `event.defaultPrevented` 提前返回（CM keymap 已消费 Esc 不进 hush，impl 9）+ MenuBar/EditorContextMenu 委托 `hushLayers.consumeTop()` + 原 backstop 删除防双触发（impl 1）；③ 让位规则：`isDialogOverlayTarget` 遮罩目标菜单/拾取器一律 return（无穿透连带收掉下层，impl 2）+ nestedSession blur-exit 对 hush 持焦层让位（impl 3）；④ CDP §3/§5/§6（模态叠加/FE-04 联调不双触发/FE-08 口径一致） |
| UI-IXD-12 | Esc / 正文空白点击触发一键回安静；全部浮层与编辑态一次收拢 | ✅ 通过 | ① CDP §2 双触发路径实测（Esc 与空白点击等效）；② 复刻走查 ui_07_global.html 场景 A（dev 自测 §9）+ `IT-01-FE-09-impl.png`/`-quiet.png`（安静态）；③ toast 不误伤（§4：toast 永不注册，closed 集合无 toast 类 id） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| useHushLayer 分层收拢 store 全量 | ✅ 16/16 | `npx vitest run src/renderer/src/hooks/useHushLayer.test.ts` | 2026-10-03 07:25 重跑 |
| editMode 分级退格模型（AC-FN-29） | ✅ 15/15 | `npx vitest run src/renderer/src/editor/table/editMode.test.ts` | TDD 15 例（editFrom 解耦） |
| overlayZOrder z 序不变量（确认框恒最大） | ✅ 2/2 | `npx vitest run src/renderer/src/styles/overlayZOrder.test.ts` | 契约式源扫描断言 |
| CDP S0–S9 主自测 + fix-FN29 定向 | ✅ 25/25 + 27/27（存档） | `IT-01-FE-09-cdp-results.json` / `IT-01-FE-09-fix-FN29-cdp-results.json` | 全新实例（port 9279/9521 独立 user-data-dir） |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题已闭环：AC-FN-29 分级退格缺口——fix-FN29 定向修复（TDD + CDP 27/27，`IT-01-FE-09-fix-FN29-self-test.md`）；business-history PATH-06 双项 verdict=fixed（math/code 双区收拢面 P1 + grid-picker z 2400 压确认框 P2）。在案非缺陷：搜索面板（dock）保留自有 Esc 合同不入 hush 栈、toast 永不注册（impl 6）；quickopen/mermaid/link-tooltip 字面高 z 值各有自模态/纯 hover 理由（impl 10）。）

## 结论

**通过**。AC-FN-21 / AC-FN-22 / AC-FN-29 / AC-RULE-05 / UI-IXD-12 五条全过。本轮 useHushLayer 16/16 + editMode 15/15 + overlayZOrder 2/2 全绿（one-shot 收拢、分级退格、确认框恒最上层、Esc 不抢已消费键），CDP 25/25 + 27/27 存档证据在场，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| Esc/空白一键回安静（多浮层并存） | ✅ | — | ✅ | ✅（空栈零副作用） | ✅ |
| 模态叠加（确认框最上层/无穿透） | ✅ | — | ✅ | ✅（遮罩让位） | ✅ |
| 分级退格（AC-FN-29 gap 点击） | — | ✅ | ✅ | ✅（幂等） | ✅ |
| 不抢已消费键/不双触发/不误伤 toast | — | — | ✅ | ✅ | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 收拢/退格/z 序单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`hooks/useHushLayer.test.ts` 16/16、`editor/table/editMode.test.ts` 15/15、`styles/overlayZOrder.test.ts` 2/2（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-01-FE-09-self-test.md`（S0–S9 + 分层消费顺序用例清单）、`IT-01-FE-09-cdp-results.json`（25/25）、`IT-01-FE-09-fix-FN29-self-test.md`、`IT-01-FE-09-fix-FN29-cdp-results.json`（27/27）；截图 `IT-01-FE-09-impl.png` / `-quiet.png` / `fix-FN29-editform.png` / `fix-FN29-quiet.png`
- 登记面：business-history PATH-06（math/code 收拢面 + z 序）verdict=fixed
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
