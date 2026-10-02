# IT-01-FE-01 自测报告 — 表格结构操作语义改造（表头身份迁移/删首行下移/参差补齐矩形/最小结构禁用/单事务）

- **任务ID**: IT-01/FE-01（表格结构操作语义改造）
- **测试时间**: 2026-10-02 21:45–22:00（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ CDP Electron 验收证据（dev 阶段实测存档，见「证据来源」列）+ typecheck。**桌面适配口径**：VeloxMark 为 Electron 桌面应用（无 HTTP 后端/无 `dev:mock`），Mock 模式不适用；「CRUD/Network 面板」维度以「op 层单测 + CDP 驱动 Electron 真实交互」等价覆盖。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-01.md`

## AC 验证结果

| AC 编号 | 描述（裁决口径 Q5/PEND-07/PEND-12） | 结果 | 证据来源 |
|---------|--------------------------------------|------|----------|
| AC-OP-02 | i=1 上插表头身份迁移：新空行升表头、原表头降 body 首行、冒号行仍第 2 行；toast 回执；.md 落盘；一次 Ctrl+Z 还原 | ✅ 通过 | ① `ops.test.ts` > `insertRowOp — header identity migration (Q5)` 3 用例（新行升表头/冒号行恒第 2 行/i>1 共享路径）本轮重跑 ✓；② 单事务+undo：`commands.test.ts` > `首行上插：新表头首格为空 + capture 抑制 + 一次 undo 逐字节还原且 history 仅一条` ✓；③ toast 冻结回执：`opsTable.test.ts` > `插入族键与 AC-OP-01~04 冻结文案对应` ✓；④ 落盘：commands.test.ts 只读闸门组「可写：op 落盘 + 成功回执携撤销 + 一次 undo 还原」✓ |
| AC-OP-10 | 删行/列无确认框直接执行 + toast；i=1 删行表头身份下移；表头末行禁删 | ✅ 通过 | ① `ops.test.ts` > `deleteRowOp — header identity migrate-down (PEND-12)` 3 用例（body 升表头/表头末行拒删/i>1 常删）✓；② `commands.test.ts` > `同族 deleteRowOp（nextActive col 恒 0）：表头身份下移且 handoff 不污染新表头` ✓；③ toast `{i}/{j}` 1 起传参：`opsTable.test.ts` > `行/列删除键带 {i}/{j} 占位符` ✓；④ 无确认框：确认流仅删表（FE-08 面），菜单面 CDP R5「表头末行：删除行禁用、删除列可点」38/38 存档 ✓ |
| AC-ERR-01 | 参差表结构操作单事务补齐矩形：不崩溃、内容不丢不错位、undo 还原参差态逐字节一致 | ✅ 通过 | `ops.test.ts` > `ragged rectify in one transaction (PEND-07)` 4 用例（插行补齐不丢不移位/插列保超宽内容+冒号行同步/删列同 replace 补齐/`one replace whose inverse restores the ragged source byte-for-byte`）本轮重跑全绿；参差 TSV 粘贴同口径 `commands.test.ts` > `参差表 TSV 粘贴单事务补齐矩形…undo 还原参差态` ✓ |
| AC-ERR-02 | 最小结构（行=1/列=1/1×1）删除项禁用灰显、点击不执行、无空表语法残留 | ✅ 通过 | ① `ops.test.ts` > `minimal-structure disable predicates (AC-ERR-02)` 4 用例（行/列/1×1 双禁+ops 拒绝零残留+判定与 op 单源一致）✓；② 菜单消费面 `opsTable.test.ts` > `行数=1 / 表头为末行时「删除行」禁用（FE-01 canDeleteRow 同源）`+`列数=1 时「删除列」禁用（canDeleteCol 同源）` ✓；③ UI 灰显：CDP `IT-01-FE-01-r2-menu-19-results.json`「R5 禁用色 = --fg-disabled（浅 #b0b0b0）」+「表头末行：删除行禁用、删除列可点」38/38 存档 |
| AC-RULE-07 | 禁用范围仅「首行上移」「首列左移」两项（快捷键与菜单同禁）；上插行/左插列任意单元格可执行 | ✅ 通过 | `opsTable.test.ts` > `isTableOpDisabled` 组：`首行「上移该行」禁用`、`首列「左移该列」禁用`、`末行「下移该行」/末列「右移该列」可点击——AC-RULE-07 仅限两项（CHANGE-19 回退）`、`「上插行」「左插列」等非禁用项保持可点` 四用例本轮重跑 ✓；CDP R5「体行命中：无禁用项（上移/左移应可点）」38/38 存档 |
| AC-RULE-08 | 结构操作单事务一次完成（无「列加了对齐没跟上」半提交）；一次 Ctrl+Z 还原全部变化 | ✅ 通过 | ① `commands.test.ts` > P0 runTableOp 单事务链 5 用例（首行上插/删行/对齐族：capture 抑制 + 一次 undo 逐字节还原 + history 仅一条）本轮重跑 18/18 ✓；② op 层逆操作逐字节：`ops.test.ts` > `one replace whose inverse restores the ragged source byte-for-byte` ✓；③ 负对照（stash+doc 双向量）证成抑制窗必要性（非缺陷掩盖）✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| ops 纯函数全量（FE-01 改造面） | ✅ 30/30 | `npx vitest run src/renderer/src/editor/table/ops.test.ts` | 2026-10-02 21:45 重跑 |
| table 模块全量回归 | ✅ 231/231（12 files） | `npx vitest run src/renderer/src/editor/table/` | 收口批后基线，无回归 |
| 菜单禁用面/回显单源 | ✅ 95/95（6 files） | `npx vitest run src/renderer/src/editor/contextMenu/` | 含 opsTable/menuSkeleton/confirmDeleteTable |
| 单事务链 + 只读闸门 | ✅ 18/18 | `npx vitest run …/table/commands.test.ts` | P0 handoff 抑制 + P1 whenWritable |
| 19 项菜单契约（UI 冻结矩阵） | ✅ 38/38（存档） | `IT-01-FE-01-r2-menu-19-results.json`（CDP 实测 2026-10-01） | ⋮/右键同源、禁用色、danger 仅删表 |
| 批 A 面非回归 | ✅ 42/42（存档） | `IT-01-FE-01-batchA-cdp-results.json` | 248px/5px 滚动条/--fg-disabled 不回退 |

### ops 纯函数分支覆盖摘要（阶段 2 要求）

| 分支组 | 覆盖用例 | 结果 |
|--------|----------|------|
| 表头迁移（上插 i=1 / 下移删首行） | insertRowOp Q5 ×3 + deleteRowOp PEND-12 ×3 + UI-anchored 适配器 `insertRowAboveOp at row 0` | ✓ |
| 参差 / 非参差 | ragged rectify ×4（插行/插列/删列/逆操作）+ resizeTableOp ragged aligns 归一 + 非参差共享路径 i>1 | ✓ |
| 最小结构（行=1 / 列=1 / 1×1） | minimal-structure ×4（三态禁用 + op 拒绝零残留 + 单源一致） | ✓ |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题均已闭环：PATH-04 P0 handoff 误判 `withHandoffSuppressed` 修复 verdict=fixed；r2 同机制残余 handleTsvPaste P1 修复 verdict=fixed——commands.test.ts 回归在场。）

## 结论

**通过**。AC-OP-02 / AC-OP-10 / AC-ERR-01 / AC-ERR-02 / AC-RULE-07 / AC-RULE-08 六条全过（裁决口径 Q5/PEND-07/PEND-12）；本轮重跑单测 344 项全绿（30+231+95+18 含重叠文件计），CDP 存档证据 80 项全过（38+42），零新缺陷。质量门禁以收口批终态为基线（typecheck 双 tsconfig 0 Error + test:unit 1094/1094，`IT-04-FE-02-gates.log` 存档 2026-10-02）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 表结构 op（插/删/移/对齐） | ✅ | ✅ | — | ✅（只读闸/最小结构禁用） | ✅ |
| 表头身份迁移/下移 | ✅ | ✅ | — | ✅（表头末行拒删） | ✅ |
| 参差补齐单事务 + undo | ✅ | ✅ | — | ✅ | ✅ |
| 最小结构禁用判定 | — | — | ✅ | ✅ | ✅ |

覆盖率: 13/15 (87%)（「校验」列对纯 op 层不适用 2 项）
Mock 模式: **不适用**（Electron 桌面应用无后端 API；等价验证面 = Vitest 纯函数单测 + CDP 驱动真实 Electron 交互，桌面适配口径）

## 证据来源存档

- 本轮重跑：`ops.test.ts` 30/30、`editor/table/` 231/231、`editor/contextMenu/` 95/95、`table/commands.test.ts` 18/18（2026-10-02）
- CDP 存档（dev 阶段实测）：`IT-01-FE-01-r2-menu-19-results.json`（38/38）、`IT-01-FE-01-batchA-cdp-results.json`（42/42）、截图 `shots/fe01-minstruct-1x1-menu.png` 等
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
