# IT-01-FE-07 自测报告 — toast 动作按钮能力（useToast+ToastHost/5s 驻留/撤销按钮/多 toast 队列）

- **任务ID**: IT-01/FE-07（toast 动作按钮能力）
- **测试时间**: 2026-10-03 04:40–05:05（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（S0–S8 场景，`IT-01-FE-07-cdp-results.json` **22/22 PASS**）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = toast store/undo 三入口纯逻辑单测 + 表格 undo 回锚 invertedEffects 单测 + CDP 实测（驻留时间戳/三入口等效/零位移）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-07.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-OP-12 | 结构操作后按一次 Ctrl+Z / 编辑菜单「撤销」/ toast 撤销按钮（三入口）：一步还原、toast「已撤销」、随后键盘输入可直接进入正文 | ✅ 通过 | ① 三入口等效：CDP 存档 §3/§4 全表（字节级还原按 op 前快照比对，单步即还原；三入口终态焦点均回 `cm-content`）；undo 收口 = `undoWithAck` 三入口共用（`undoAction + runToastAction undoes one real history step and acks with the frozen undone receipt` ✓，`undo failure (empty stack) on the button posts no fake undone receipt` ✓）；② 判据3 undo 回锚（业务评审修复批①补齐）：`state.test.ts` > `invertActivation` 5 用例本轮重跑 ✓（`returns the pre-op activation snapshot for a doc-changing activation tr`/`restores the edit-form session when the op started from enterEditMode`/`clears the post-op active cell when the op started quiet`/effect-only 与纯文本编辑不入历史）——undo 后活动单元格/编辑态回落操作前锚点；③ 终态焦点：`refocusAfterUndo`（焦点已在 view.dom 内含嵌套不动，否则 view.focus()），dev 自测 §11-3 记录修复前后差异 |
| AC-ERR-04 | 误触一次表格结构操作后执行一次 Ctrl+Z：表格还原至误触前状态、toast 显示「已撤销」 | ✅ 通过 | ① CDP §4 Ctrl+Z 行：误触后的常态=焦点在嵌套单元格编辑器（nested history 空栈）——该缺陷已修（`cellKeymap` Mod-z 转发 `undo(nested) \|\| undoMain(main)`，修复后 `restored: true` + 「已撤销」）；② 单步即还原无需多步（AC-OP-12 三段断言全成立同源）；③ `undoWithAck > posts the frozen undone receipt` ✓ |
| AC-FN-06 | 表格结构操作后：toast 显示本次操作回执文案（与 ⋮ 菜单/右键菜单回显同源） | ✅ 通过 | ① CDP 存档 §1（结构操作回执 + 撤销按钮）+ §5（队列替换：同屏至多 1 条，新 toast 顶替旧 toast 且按自身时钟驻留）；② 回执 key 单源：`STRUCTURE_TOASTS`/`TABLE_OP_TOAST_KEYS`/`INSERT_TOAST_KEYS` → i18n 冻结键，同 op id 跨入口（⋮/右键/快捷键）文案由字典保证一致（AC-FN-06 菜单回显同源面 FE-04 contextMenu 95/95 同场）；③ 回执锚点取 op 前活动单元格非被删行列（impl 4） |
| UI-ELEM-03 | toast 自动消失；不获取键盘焦点；不遮挡光标所在输入行；出现/消失不引发布局位移 | ✅ 通过 | ① 自动消失 5s（PEND-05）：CDP §2 时间戳实测——S1 t0 基准、「已撤销」ack 同样驻留 **5135ms** 消失、第二条 toast 按自身时钟 **4912ms**（探针取样口径）；单测 `auto-dismisses exactly at TOAST_DWELL_MS (5s dwell, PEND-05)` + `replaces the current toast … resets the dwell clock` ✓；② 不夺焦/零位移：CDP §7 全表（toast 出现消失正文零布局位移，焦点不被夺取）；③ 不遮挡输入行：toast 宿主固定右下角 `--space-3`（ui_07 toast-anchor），矩形上边界 y≈720 与正文表格编辑区（顶 74/高 702）不相交（§7 几何实测） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| useToast store/undo 三入口全量（5s 驻留/队列替换/undo+ack/无动作形态/getToast 缝） | ✅ 10/10 | `npx vitest run src/renderer/src/hooks/useToast.test.ts` | 2026-10-03 04:40 重跑；含 `getMessage mirrors the visible message for the getToast e2e contract` |
| state invertedEffects（invertActivation undo 回锚/编辑态还原） | ✅ 26/26 | `npx vitest run src/renderer/src/editor/table/state.test.ts` | invertActivation 5 用例 + invertColWidths 同场 |
| CDP S0–S8（回执/驻留时间戳/三入口/队列/迁移/零位移） | ✅ 22/22（存档） | `IT-01-FE-07-cdp-results.json` | dev 存档 |
| 既有字符串 toast 迁移非回归 | ✅（存档） | dev 自测 §6 | showToast 调用点全量迁移行为不回归 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题已闭环：嵌套单元格焦点下 Ctrl+Z 被吞真缺陷——dev 阶段发现并修复（cellKeymap Mod-z 转发，dev 自测 §4）；业务评审修复批 PATH-01 undo 回锚 / PATH-02 编辑态还原 verdict=fixed（invertActivation）；PATH-08 toast 驻留期语言口径 CHANGE-24B 边界取舍 verdict=fixed（5s 窗内保持渲染时语言，非缺陷）。frontmatter doc-drift（AC-OP-12 早标「已验证」）已随 invertActivation 补齐名实相符。）

## 结论

**通过**。AC-OP-12 / AC-ERR-04 / AC-FN-06 / UI-ELEM-03 四条全过。本轮 useToast 10/10 + state 26/26 全绿，CDP 22/22 存档证据在场（5s 驻留时间戳实测、三入口字节级一步还原、undo 回锚、toast 几何不相交），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 结构操作回执 + 撤销按钮 | ✅ | — | ✅（冻结文案） | ✅（空栈无假回执） | ✅ |
| 5s 驻留/队列替换（新顶旧） | ✅ | — | ✅（时间戳） | — | ✅ |
| undo 三入口等效（回锚+终态焦点） | — | ✅ | ✅ | ✅（嵌套空栈转发） | ✅ |
| toast 不夺焦/不遮挡/零位移 | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest toast/undo 单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`hooks/useToast.test.ts` 10/10、`editor/table/state.test.ts` 26/26（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-01-FE-07-self-test.md`（S0–S8 + AC 证据映射 + 缺陷修复记录）、`IT-01-FE-07-cdp-results.json`（22/22）、截图 `IT-01-FE-07-impl.png` / `IT-01-FE-07-undone.png`
- 登记面：business-history PATH-01/PATH-02/PATH-08 verdict=fixed；CHANGE-24B toast 驻留期语言口径
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
