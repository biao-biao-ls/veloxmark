## 代码审查报告 — IT-01/FE-08 仅删表确认流

**得分：** 96/100（阈值：90）
**状态：** ✅ 通过（无 Important；3 Minor——stale span 扩围进 fix-biz-PATH04-05 随批修，余 2 项入收口批候选）
**基线规范：** code-review SKILL.md + rubric-code-review.md（前端，阈值 90）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**：`blockHelpers.ts:81` 确认框同样用 `t()` 解析串直传（非 key 直传）；`opsTable.ts`/`contract.ts` 回执键四面同源模式；`state.ts` invertedEffects 注册于 `setup.ts:118-125`。新代码与既有模式一致。
- **CLAUDE.md 约定**：i18n 新 key 双字典同加（en.ts/zh.ts:90-94 均在）；纯逻辑配同目录单测；不渲染 widget（测试用 stub view）——均遵守。
- **并发中间态（不归因 FE-08）**：`opsTable.ts` 当前含 `whenWritable`/`withHandoffSuppressed`（AC-ERR-08/AC-PEND-11 修复批），`useHushLayer.ts`/`commands.ts` 同批在改——仅标注不下结论。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能完整 | 10 | 10 | — | |
| 遗漏需求 | 8 | 8 | — | |
| 多做需求 | 8 | 8 | 修复批中间态不计 | |
| 需求理解 | 7 | 7 | — | |
| 边界/异常 | 6 | 7 | stale span、widths debris | 客观 |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 9 | 10 | confirm 异步 gap 未复核 span | 客观 |
| 编码风格 | 8 | 8 | — | 与已有代码一致 |
| 测试覆盖 | 7 | 8 | 越界键 guard 无独立断言 | 客观 |
| 安全 | 8 | 8 | — | |
| 性能 | 8 | 8 | — | |
| DRY | 4 | 4 | — | |
| YAGNI | 4 | 4 | — | |
| **合计** | **96** | **100** | | |

**独立验证要点（未采信 frontmatter 自述）**：
- AC-OP-09/12 undo 机制真实成立：`source.ts:48-64` 删表事务骑 `setColWidth.of({tableFrom: from})` 字面键快照 → `state.ts:104-115 invertColWidths` 以 startState 值反演 → undo 事务先走 `state.ts:64` 越界键丢弃（键 6>docLen=5 被弃）再由反演 effect 重键位=还原表 tableFrom；对齐随 doc 字节还原。`state.test.ts:306-343` 用真实 `history()+deleteTableRange`（非 mock）断言列宽/active/editFrom 三态一步还原，机制链路逐环核对无断点。
- 仅删表确认：grep 全仓表域 `confirm(` 仅 `opsTable.ts:399`（deleteTable）；deleteRow/deleteCol 走 `runStructOp` 直执行（opsTable.ts:241-266），测试断言 `rt.confirm` 不被调（confirmDeleteTable.test.ts:129-153）。
- 冻结文案/按钮：`zh.ts:92-93` 与 AC-RULE-15 逐字一致（全角逗号/括号核对）；`frozenCopy.test.ts:43-45,145-148` 含确认按钮「确认删除」+ 复用 `dialog.cancel`「取消」；en/zh key 对齐由 `i18n.test.ts:52` 守护。
- Esc/空白零副作用：`Dialog.tsx:454-462`（Esc→cancel+stopPropagation）、`517-519`（overlay 命中自身才 cancel）、`331-333`（isModalOpen 挂点）；两按钮「取消左+确认右」（Dialog.tsx:563-569）符合 UI-IXD-05（按钮次序 CHANGE-11 已登记，按指令不深挖）。

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Minor | stale span | span 在点击时解析，confirm 是异步 Promise，resolve 后仍用旧 `span.from/to` 删区间；模态挡 UI 但挡不住外部文件重载/并发批新插入的 `whenWritable` 异步探针 gap，违反本文件自述的 stale-instance 纪律 | `opsTable.ts:389-413` | `.then(ok)` 内先经 `modelSpan()`/`resolveTableModel` 重解析表格 span 再调 `deleteTableRange`，重解析失败则静默返回 → **扩围进 fix-biz-PATH04-05 随批处理** |
| Minor | colWidths debris | undo 后旧键经 mapPos 漂到回插段末尾（`state.test.ts:285-287` 注释自认）残留 `[120,80]` 于错误键位，后续新表若 tableFrom 恰落该键会继承脏宽度 | `source.ts:55-61`、`state.ts:58-68` | 删表事务额外用 `restoreColWidths` 语义或一次性 effect 移除被替代的旧键（保持 invert 对称），或在 guard 中同时丢弃与还原表 tableFrom 不符的快照残留 → 收口批候选 |
| Minor | 测试盲点 | `state.ts:64` 越界键丢弃 guard 无独立单测（仅被删除/undo 集成用例隐式覆盖）；宽度的 redo 对称（`state.test.ts:234` 仅断言 activation）未断言 | `state.test.ts` | 补一条：构造 `from > doc.length` 的 debris 键跑一次 doc 变更，断言不抛且键被弃；补宽度 redo 断言 → 收口批候选 |
| Info | 中间态标注 | `opsTable.ts:397-413` 的 `whenWritable`/`withHandoffSuppressed` 属并发修复批（AC-ERR-08/AC-PEND-11），非 FE-08 交付物；其异步探针加剧上条 stale gap | `opsTable.ts:46-73` | 修复批收敛时一并按上条重解析 span |

### 结论

核心交付（仅删表确认流、冻结文案、删行/列无确认回执、Esc/空白关最上层、删表一次 Ctrl+Z 含对齐与列宽整表还原）经独立读码全部成立，undo 修复机制（字面键快照 + invertColWidths/invertActivation + 越界键丢弃）真实有效且有非 mock 测试钉住。3 项 Minor 不阻塞，stale span 一条已扩围进 fix-biz-PATH04-05（其异步探针加剧该 gap，同文件区随批修）。**通过（96 ≥ 90）**。

关键路径：`src/renderer/src/editor/contextMenu/opsTable.ts`、`editor/table/source.ts`、`editor/table/state.ts`、`components/Dialog.tsx`、`i18n/{zh,en,frozenCopy.test}.ts`、`editor/contextMenu/confirmDeleteTable.test.ts`、`editor/table/state.test.ts`
