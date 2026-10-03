# IT-01-FE-06 自测报告 — 列宽拖拽右邻吸收改造（总宽不变/最右列例外/列宽钳制/防误触）

- **任务ID**: IT-01/FE-06（列宽拖拽右邻吸收改造）
- **测试时间**: 2026-10-03 03:20–03:38（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP 实测存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；吸收域为纯函数（colWidth.ts），验证面 = 吸收/钳制/防误触/remap 单测 + invertedEffects 撤销单测。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-06.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-OP-11 | 拖列边界到新宽度松开：指示线反馈、右邻吸收总宽不变（最右列例外可增减）、钳制、一次 Ctrl+Z 还原 | ✅ 通过 | ① 总宽不变量：`absorbNeighbor — middle boundary (right-neighbor absorb)` 5 用例（`keeps the pair sum (hence total width) invariant: 120/120 → 150/90`/3 列全表和不变/双侧不归零/`keeps both sides inside the content-column max`/越界 j 拒绝）；② 最右列例外：`last boundary (total-width exception)` 4 用例（只改末列总宽跟随/总宽可缩/`w∈[min, content width]` 1 列表同路径/总宽不溢出正文列）；③ 一次 undo 还原（AC-OP-11 Then3 指定 invertedEffects 路径）：`state.test.ts` > `invertColWidths` 4 用例（`returns the pre-drag widths so one undo restores them`/二次拖拽捕获真实前值/`stays out of transactions without setColWidth`（会话恢复不进撤销栈）/只反演触碰的表）；④ 指示线：`.cm-md-col-drag-line[data-testid=col-drag-line]` 走 token（契约增量⑥）+ dev CDP 存档 |
| AC-ERR-03 | 列结构变化（插/删/缩放删/移列）后列宽数组与列数正确 remap，同事务一次 undo 全还原 | ✅ 通过 | ① remap 纯函数：`AC-ERR-03 structure remap` 6 用例（`insertColWidths shifts old widths right and defaults the new column`/`deleteColWidths drops the column width and shifts left (no residue)`/`moveColWidths carries the width with the column`/`sanitizeWidths maps onto the new column count and resets invalid values`/失效超界重置/insert+sanitize 合规）✓；② 同事务：colWidthRemapEffect 四个 dispatch 面（runTableOp/opsTable 内联/toolbar resize/探针 op）全传 widthsRemap（implementation-notes §5）——结构+列宽一次 Ctrl+Z 同还原（commands.test 单事务链 18/18 同场） |
| UI-IXD-16 | 列边界拖拽区按住拖拽调列宽；过程指示线；松开生效 | ✅ 通过 | ① 防误触/生效时点：`anti-mistouch` 3 用例（`treats sub-threshold displacement as a click, not a drag`/`dragEndWidths returns null on a pure click — no tableColWidths writeback`/手势 commit 才返回吸收宽度）✓；② 拖拽零 doc change 只 dispatch effects → tableColWidths 唯一持久面（7F 500ms debounce）；③ UI 实证 `IT-01-FE-06-impl.png`（指示线 + col-grip）+ col-grip 拖拽 CDP 非回归（FE-03 存档：列宽 261→321 持久化） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| colWidth 吸收域全量（钳制/吸收/最右例外/防误触/remap） | ✅ 21/21 | `npx vitest run …/table/colWidth.test.ts` | 2026-10-03 03:20 重跑 |
| state invertedEffects 全量（invertColWidths/invertActivation/undo 锚点） | ✅ 26/26 | `npx vitest run …/table/state.test.ts` | 两文件合计 **47/47** |
| MIN_COL_WIDTH=48 单点 | ✅ | `MIN_COL_WIDTH token > is 48px and is the single default lower bound` | 替代魔数 40 |
| 会话恢复不进撤销栈 | ✅ | `invertColWidths > stays out of transactions without setColWidth` | restore 刻意不反演 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案备注非缺陷：tableColWidths 为 offset 键映射，整文档替换留 mapPos 孤键（与 fold sync 同级既有特性，孤键不参与列宽读取）；同 path 连续 loadDoc 不重放 restore（既有 `[filePath]` effect 限制）。）

## 结论

**通过**。AC-OP-11 / AC-ERR-03 / UI-IXD-16 三条全过。本轮 colWidth 21/21 + state 26/26（合计 47/47）全绿（含总宽不变量、最右列例外、防误触 null 判定、invertedEffects 一次 undo），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|----------|
| 右邻吸收（总宽不变量） | — | ✅ | ✅ | — | ✅ |
| 最右列例外（总宽可增减+钳制） | — | ✅ | ✅ | ✅（不溢出正文列） | ✅ |
| 防误触（阈值 2px/点击不写回） | — | — | ✅ | ✅ | ✅ |
| 结构 remap + 同事务 undo | — | ✅ | ✅ | ✅（无残留） | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 吸收域/撤销单测，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/table/colWidth.test.ts` 21/21、`editor/table/state.test.ts` 26/26（2026-10-03）
- UI 存档（dev 阶段）：`IT-01-FE-06-impl.png`、`IT-01-FE-06-self-test.md`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
