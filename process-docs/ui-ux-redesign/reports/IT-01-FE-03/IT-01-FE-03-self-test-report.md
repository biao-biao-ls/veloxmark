# IT-01-FE-03 自测报告 — 去增删把手与 data-op 契约迁移（删4留1/左侧留白清零/工具栏⋮挂 data-op）

- **任务ID**: IT-01/FE-03（去增删把手与 data-op 契约迁移）
- **测试时间**: 2026-10-02 22:20–22:35（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（DOM 扫描/几何测量/拖拽非回归）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；契约面为纯逻辑+源文件扫描层，验证面 = contract 单测重跑 + CDP 实测证据存档（`IT-01-FE-03-self-test.md` §2）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-03.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-01 | 静息态表格左缘与正文列左缘偏移 0px；无把手带/常驻留白槽；四周无常驻控件 | ✅ 通过 | ① 几何实测（CDP 存档）：`para.rect.left + paddingLeft − table.rect.left = 0`（已扣 `.cm-line` 自带 `padding-left: var(--editor-gutter)`）+ 进出编辑态 `enterShift{0,0}/exitShift{0,0}`（≤1px 亚像素）；② idle 态 `wrapPaddingLeft=0px`、`wrapMarginLeft=16px`（= `--editor-gutter`）、把手数 0；③ 静态钉住：`contract.test.ts` > `markdown.css 无把手带布局与增删把手按钮残留`（`--table-handle-gutter`/`--table-col-handle-gutter` 负边距吸收布局零残留）本轮重跑 ✓；④ 截图 `IT-01-FE-03-idle.png` |
| AC-FN-02 | 编辑态四周无 +/− 增删把手；行列增删入口仅工具栏/⋮/右键/快捷键四处 | ✅ 通过 | ① DOM 扫描（CDP 存档）：`deletedBtns=0`（`.cm-md-table-btn-*` 全族）、`plusMinus=0`、`data-table-handle` 集合 = `{col-grip}`；② 静态钉住：`contract.test.ts` > `契约集登记值 = {col-grip}` + `widget.ts 只写入 col-grip，4 个已删把手契约字面量零残留` 本轮重跑 ✓；③ 四入口在位：工具栏 `toolbar.ts 为 6 个工具栏按钮逐一挂 TOOLBAR_DATA_OP` ✓ + `IT-01-FE-03-impl.png`；⋮ 19 项 `IT-01-FE-03-menu.png`（同右键 surface）；快捷键 `structKeyBindings`/`tableStructBindings` 未改动（FE-02 keymap.test 25/25 在场）；④ col-grip 拖拽非回归（CDP 存档）：mousedown→move(+60px)→mouseup，列宽 261px→321px 持久化 |
| AC-RULE-17 | e2e 缝硬契约；删4留1/⊞=`resizeTable`/⋮=`TBL-MOR-OPN` 为已登记准入变更；此后变更须走登记流程 | ✅ 通过 | ① 契约面单源：`contract.test.ts` > `data-op 契约（opsTable 19 项同源）` 5 用例（TABLE_MENU_OP_IDS 冻结 19 项/opsTable.ts id 面冻结集合/工具栏 op 类 data-op 同源/`工具栏 ⊞/⋮ 入口锚点字面量不变（resizeTable / TBL-MOR-OPN，CHANGE-3）`/TOOLBAR_DATA_OP 6 键挂载）本轮重跑 8/8 ✓；② 登记面：ADR `design/adr/e2e-contract-delta.md` Q2 裁决 + CHANGE-3（**已 merged**——ac.md v1.4 AC-RULE-17 尾注确认「⊞ 工具栏项挂 `data-op="resizeTable"` … CHANGE-3 登记」，dev 阶段 pending 疑虑已闭环） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| contract 契约面全量（删4留1 / data-op 19 项同源 / CSS 残留清零） | ✅ 8/8 | `npx vitest run src/renderer/src/editor/table/contract.test.ts` | 2026-10-02 22:20 重跑，用例名逐条见上表 |
| 契约面集合前后对比（删 4 留 1） | ✅ | dev 存档 `IT-01-FE-03-self-test.md` §1 集合对比表 | row-insert/row-delete/col-insert-left/col-delete 清零，col-grip 保留 |
| col-grip 拖拽非回归 | ✅ | CDP 实测存档（列宽 261→321px 持久化） | editing 态保持 |
| e2e 缝未破坏 | ✅ | `window.__veloxTable.activate/clearEdit/op`、`data-op`、`data-table-handle` 全部在位 | contract.test 源扫描钉住 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交项已闭环：① CHANGE-3 ⊞ `data-op=resizeTable` 取舍——已 merged，ac.md v1.4 AC-RULE-17 转正确认；② i18n 残留 `tableHandle.*` 4 key——按计划 FE-11 收口（FE-11 自测时核验）；③ dev 期 typecheck 外部错误 `shortcutSync.test.ts stubOps`——收口批已清，终态 typecheck 双 0。）

## 结论

**通过**。AC-FN-01 / AC-FN-02 / AC-RULE-17 三条全过。本轮 contract.test.ts 8/8 全绿（契约面静态钉住），CDP 存档几何/DOM/拖拽证据在场，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 删4留1 契约面（DOM/源码双扫） | ✅ | — | ✅ | — | ✅ |
| 左缘 0px 布局（无把手带） | ✅ | — | ✅ | — | ✅ |
| 工具栏/⋮ data-op 挂载单源 | — | ✅ | ✅ | — | ✅ |
| col-grip 拖拽非回归 | — | ✅ | — | — | ✅ |

覆盖率: 8/12 (67%)（纯契约/布局面，「错误处理」列大面积不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 契约单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`src/renderer/src/editor/table/contract.test.ts` 8/8（2026-10-02）
- CDP 存档（dev 阶段实测）：`IT-01-FE-03-self-test.md`（契约面集合前后对比 + 几何/DOM/拖拽证据）、截图 `IT-01-FE-03-idle.png` / `-impl.png` / `-menu.png`
- 登记面：`design/adr/e2e-contract-delta.md` Q2、`design/change-log.md` CHANGE-3（merged）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
