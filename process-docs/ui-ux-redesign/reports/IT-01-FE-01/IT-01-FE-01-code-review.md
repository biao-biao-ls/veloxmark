## 代码审查报告 — IT-01/FE-01 表格结构操作语义改造

**得分：** 98/100（阈值：90）　**状态：** ✅ 通过
**基线规范：** rubric-code-review.md + reviewer.md（前端通用面，无 backend 专项）
**评审面：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`（ops.ts / ops.test.ts / parse.ts / opsTable.ts / menuSkeleton.ts+test / keymap.ts / i18n en+zh / commands.ts 消费侧）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- **已有代码风格**：`editor/table/` 纯函数 op 层（TableOp 整表 replace + JSDoc 英文注释）、同目录 Vitest 真 round-trip 断言（formatTable↔parseTableModel，不 mock）、registry/delta 菜单装配——新代码与之一致。
- **CLAUDE.md**：纯逻辑模块配 `*.test.ts`；i18n 双字典 key 对齐有测试守护；「单一真源」模式（ops.ts 适配器/禁用判定收口）符合宪法精神。
- **结论**：无风格冲突；客观问题（DRY/正确性）按 rubric 处理。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规·功能实现 | 10 | 10 | — | Q5/PEND-07/PEND-12 全部落地（ops.ts:57-62 零特例表头迁移、:94-100 删首行下移、parse.ts:162-170 colCount=max+padRow 仅补齐、:76-86 禁用单源） |
| 需求合规·遗漏 | 8 | 8 | — | AC-OP-02/10/ERR-01/ERR-02/RULE-07/08 op 层判据全覆盖；toast 归 FE-04 run 闭包、列宽归 FE-06 均为任务声明的跨任务边界 |
| 需求合规·多做 | 8 | 8 | — | 适配器/UI-anchored 单源、menuSkeleton 19 项裁剪均在 implementation-notes 范围内；无超纲功能 |
| 需求合规·理解正确 | 7 | 7 | — | 「表头身份=网格布局结果」零分支、canDeleteRow≡无 body 行、参差内容不丢失（超宽行保留）均按裁决口径 |
| 需求合规·边界覆盖 | 7 | 7 | — | 1×1/行数=1/表头末行/参差/越界 row-col/空表回退均有断言（ops.test.ts:155-363） |
| 质量·职责分离 | 10 | 10 | — | 纯 op/解析/菜单禁用/键位各归其位，ops.ts 单源导出被 opsTable/commands 双消费 |
| 质量·错误处理 | 10 | 10 | — | deleteRowOp/deleteColOp 返回 null 守卫最小结构；nextActive 越界钳制（ops.ts:33-35）；menu 对 model 缺失默认禁用 |
| 质量·编码风格 | 8 | 8 | — | 与既有 table/* 一致 |
| 质量·测试覆盖 | 8 | 8 | — | 测真实行为非 mock；menuSkeleton.test.ts 19 项 id/文案/kbd 冻结 + 零通用项 + 通用面不裁三面锁定；frozenCopy.test 守护占位符 |
| 质量·安全隐患 | 8 | 8 | — | 纯字符串变换，无注入/XSS 面（renderInlineCell 既有 HTML 转义在前） |
| 质量·性能 | 8 | 8 | — | O(n) 整表 replace，表级数据量无问题 |
| 质量·DRY | 2 | 4 | 单元格转义逻辑三处重复（-2） | 客观（既有债务，FE-01 未加重） |
| 质量·YAGNI | 4 | 4 | — | 适配器恰为契约面所需 |
| **合计** | **98** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | nextActive 锚定不一致 | 插列后活动单元格硬编码跳至表头行（insertColOp nextActive row:0）；deleteRowOp/insertRowOp 的 nextActive col 恒 0。AC 未断言插入后光标落点，但 API §3.2「锚定当前激活单元格」语义下，用户在第 3 行插列后光标跳到表头属体验瑕疵；moveColOp 已有 row 参数先例 | src/renderer/src/editor/table/ops.ts:61,99,114 | insertColOp 增加 anchorRow 参数（或由 insertColLeftOp/insertColRightOp 透传 row），nextActive 跟随锚定行列；同批统一 deleteRowOp 的 col 锚定 |
| Minor | 转义逻辑三处重复 | `escapeCell` / `escapeForCell` / pasteTsvOp 内联的 `replace(/\r\n\|\r\|\n/g,'<br>').replace(/(?<!\\)\|/g,'\\|')` 完全相同；属 P10/P22 期既有债务，FE-01 未加重但处于本次评审面 | src/renderer/src/editor/table/ops.ts:320-323,341-343；src/renderer/src/editor/table/parse.ts:188-190 | ops.ts 改为 `import { escapeCell }`，删除本地 escapeForCell，pasteTsvOp 内联处同改（行为不变重构） |
| Info | en 文案微瑕 | `menu.grp.structDelete` en 为「Structure」，zh「结构删除」含删除义；组内含 copyTable/formatTableSource 非全删除项 | src/renderer/src/i18n/en.ts:128 | ui_03 冻结名不强改；如后续动文案可评估 'Structure / Delete' |
| Info | 任务notes预警债务已清 | implementation-notes 预警「widget.ts addRowHandles 局部 canDeleteRow/canDeleteCol 副本」「opsTable 同名 local const」在本 worktree 均已不存在——opsTable.ts:18-19 已改调 ops.ts 单源 | src/renderer/src/editor/table/widget.ts；src/renderer/src/editor/contextMenu/opsTable.ts:377-380 | 无需动作；FE-03/FE-04 checklist 可据此勾销 |
| Info | 门禁未执行 | 本 agent 物理只读，`npm run typecheck`/`test:unit`/`build` 未运行；测试期望已人工推演与实现一致（表头迁移/参差补齐/禁用/undo 逐字节 4 组均对得上） | — | 主 agent 收敛时必跑 `npm run typecheck && npm run test:unit` 确认 |

### 专项核验（范围提示项）
- **i18n key 对齐**：en/zh 裁剪面逐 key 对齐（i18n.test.ts 守护）；toast.rowDeleted/colDeleted 等占位符 `{i}`/`{j}` 双字典一致，frozenCopy.test.ts:79-80 登记占位符；调用侧 `t(key,{i:row+1,j:col+1})`（opsTable.ts:220、commands.ts:322）1 起传参正确。
- **冻结文案**：zh toast/确认文案与 ac.md 逐字一致（「已在上方插入行（Ctrl+Z 可撤销）」「已删除第 {i} 行…」「删除后可用一步撤销还原，确认删除该表格」）。
- **AC-FN-07/AC-RULE-11 快捷键回显单源**：键字面量唯一声明于 keymap.ts STRUCT_KEYS（:72-80），绑定与回显同源；opsTable.ts:191-194 经 `cmKeyToDisplay→fmtShortcut` 派生，无键项 11 项留空（menuSkeleton.test.ts:31-51 冻结 kbd 逐字）；`Ctrl+Shift+Enter` 等字面量仅存于 keymap.ts+测试，无手工双源。
- **「▸」字形**：EditorContextMenu.tsx:92 与 MenuBar.tsx:534 同用 U+25B8，格式一致；表上下文面 19 项全为叶项无子菜单，不出现该字形（符合裁剪契约）。

### 结论

✅ **通过（98 ≥ 90）**。Q5 表头身份迁移零特例、PEND-12 删首行下移+末行禁删、PEND-07 参差单事务补齐（含超宽行内容不丢失）、AC-ERR-02 最小结构禁用单源、单事务一次 undo 还原均以真实代码+锁定测试验证到位，消费侧（opsTable/commands）已改调单源适配器。2 项 Minor（nextActive 锚定、转义 DRY）建议顺手修，不阻塞验收；最终以 typecheck+test:unit 门禁收口。
