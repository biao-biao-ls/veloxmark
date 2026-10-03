## 代码审查报告 — IT-02/FE-02 快捷键回显单源派生与双源守护

**总分：** 97/100（阈值：90）  **状态：** ✅ 通过（97 >= 90）
**基线规范：** code-review/SKILL.md、rubric-code-review.md、eval-loop/prompts/reviewer.md（均已 Read）
**代码基：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/`（下文 file:line 相对此根）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02
**说明：** 评审物理只读、未运行 typecheck/vitest，门禁结论按静态读码给出；快照静态推演 shortcutSync/shortcutMatch 各断言与现表/现注册表一致（可过）。

### 风格归因（前置）
- 已有代码（最高）：commands/ 小文件群 + 同目录 `*.test.ts`、`src/renderer/src/test-stubs/` 共享 stub、文件头 JSDoc 带任务/来源锚点、纯函数单测不渲染——新代码与既有模式一致。
- CLAUDE.md（次高）：纯函数配同目录单测、i18n 双字典对齐、e2e 缝不动、"快捷键双源债不要加重"——本任务以 shortcutSync.test 补守护，符合。
- 结论：无风格类扣分；下列扣分均为客观项（验收判据/正确性/死代码）。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规-功能实现 | 10 | 10 | 交付物齐全且读码验证成立（见下核对） | — |
| 需求合规-遗漏需求 | 8 | 8 | 无遗漏；阶段 3/4 未勾属流程正常态 | — |
| 需求合规-多做需求外 | 8 | 8 | shortcutDisplay.test/test-stubs 抽取被 CLAUDE.md 要求，非蔓延 | — |
| 需求合规-理解正确 | 6 | 7 | -1：例外表记载 darwin 拼写与实际字面量不一致（问题 2） | 客观 |
| 需求合规-边界覆盖 | 6 | 7 | -1：AC 阶段 1 grep 判据字面不成立（问题 1） | 客观 |
| 质量-职责分离 | 10 | 10 | shortcutDisplay.ts 单一职责纯模块 | — |
| 质量-错误处理 | 10 | 10 | commandItem 未知 id fail-fast；fmtShortcut 空串/裸键安全有测 | — |
| 质量-项目风格 | 8 | 8 | 与既有模式一致 | — |
| 质量-测试覆盖 | 8 | 8 | 真注册表 buildCommands/buildMenus + no-op ops stub，非 mock 业务 | — |
| 质量-安全隐患 | 8 | 8 | 纯字符串派生 + React 文本渲染，无面 | — |
| 质量-性能 | 8 | 8 | 纯字符串 split/map，无热路径 | — |
| 质量-DRY | 4 | 4 | stubCommandOps 共用；fmtShortcut 三消费方同源 | — |
| 质量-YAGNI | 3 | 4 | -1：Titlebar formatShortcut 死 prop 链（问题 3） | 客观 |
| **合计** | **97** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Minor | AC 阶段 1 grep 判据字面不成立 | AC 勾选"grep 'Ctrl+' menuLayout/MenuBar 无命中"，但注释含键位串，原样 grep 会命中；回显路径本身全派生（spirit 达标） | src/renderer/src/commands/menuLayout.ts:108（`// …+ Ctrl+Shift+T row must stay single-line.`） | 注释改引用命令 id（reopenClosedTab）而非键位串，或将 AC 判据改为"无回显字面量命中（注释除外）" |
| Minor | DERIVATION_EXCEPTIONS.toggleDevTools 记载拼写与 darwin 实际字面量不一致 | 例外登记 `Cmd+Alt+I`，darwin 菜单实际硬编码 `Alt+Cmd+I`（功能同弦）；BE-01 迁入表时将触发守护断言被迫归一，属迁移摩擦。zoom/devtools 加速键在 darwin.ts 仍为表外第三源（BE-01 域，过渡态已注释声明） | src/renderer/src/commands/shortcutSync.test.ts:48-52 vs electron/menu/darwin.ts:240-247 | BE-01 迁表时统一为 `Cmd+Alt+I`（或同步改例外值与钉住断言为 `Alt+Cmd+I`），迁完删除 darwin.ts 内联字面量 |
| Minor | Titlebar `formatShortcut` 为死 prop | 解构后组件体从未使用（tooltip 走 t('app.searchInFolder')），链路 useMenus→App→Titlebar 全为空转 | src/renderer/src/components/Titlebar.tsx:13,36；src/renderer/src/hooks/useMenus.ts:60；src/renderer/src/App.tsx:1362,1399 | 要么用 fmtShortcut 派生 tooltip 键面（顺带收敛问题 5 存量债），要么删除 prop 链 |
| Minor | build.ts 注释陈述过时 | 注释称 toggleTheme 与 reopenClosedTab 同键、靠注册序遮蔽——与 Q6 撤键现状（toggleTheme 无 shortcut）及 shortcutSync Q6 断言矛盾 | src/renderer/src/commands/build.ts:4-6 vs src/renderer/src/commands/viewCmds.ts:162-169 | 注释改为 Q6 后口径：顺序仍固定，但同键遮蔽前提已消除 |
| Info | app.searchInFolder tooltip 键面双源 | i18n 文案烘 `（Ctrl+Shift+F）`（跨任务存量债，FE-01 已知，不重复深挖） | src/renderer/src/i18n/en.ts:435、zh.ts:430 | 随问题 3 一并收敛：`t('app.searchInFolder') + fmtShortcut(registry)` 派生 |
| Info | toast.* 冻结文案烘键面 | `（Ctrl+Z 可撤销）` 后缀属 AC 冻结文案（frozenCopy.test 钉住），非菜单回显，不触 AC-RULE-11 | src/renderer/src/i18n/zh.ts:278-292 | 维持冻结；若 undo 改键需同步该文案族（既有约定） |
| Info | 任务文件自述与代码现状不符 | implementation-notes 第 6 条称 Q6 仍双键遮蔽、清理归 FE-03；实际 viewCmds 已撤键且注释标 FE-02 | process-docs/ui-ux-redesign/tasks/IT-02/FE-02.md:33 vs viewCmds.ts:162-169 | 勘误 implementation-notes（代码正确，文档漂移） |
| Info | 子菜单箭头 ▸ 复用 .menu-item-shortcut | ui_04 分设 .mi-arrow/.mi-key；复用后观感等价（11px/--fg-dim/右对齐），与既有 app 做法一致，仅提示 | src/renderer/src/components/MenuBar.tsx:534 | 如需像素级对稿可加 .menu-item-arrow 别名，不强制 |

### 需求合规核对（独立读码验证，未采信任务自述）
- **AC-FN-07：成立。** menuLayout.ts:170 `shortcut: cmd.shortcut ? fmtShortcut(cmd.shortcut, isMac) : undefined`（唯一派生入口）；MenuBar.tsx:401-403/585-587 无键不渲染占位；shortcutMatch.test.ts:166-211 对 buildMenus 全量（含子菜单）断言：有键 100% 回显且文本=fmtShortcut(键位)、无键 undefined、isMac 双平台。
- **AC-RULE-11：成立。** menuLayout/MenuBar 无回显键位字面量（唯问题 1 注释）；shortcutSync.test.ts:37-61 DERIVATION_EXCEPTIONS 机制断言（reason/accelerator 非空+已知命令、非 pending 防死条目）+ 反向钉住 bold/italic/inlineCode 无原生加速键 + Q6 Ctrl+Shift+T 唯一归属 reopenClosedTab + Q7 键位表钉住；表格 ⋮/右键经 opsTable.ts:191-193 `fmtShortcut(cmKeyToDisplay(STRUCT_KEYS))` 同一派生（AC"同一 fmtShortcut"达标）。
- **AC-NF-06：成立。** shortcutMatch.test.ts:197-210 真实注册表 chord↔trigger 一致；shortcutSync.test.ts:196-215 双源审计记录 100% 一致（saveFile 形状样例钉住，含 exception 分支期望值核对）。
- **fmtShortcut 规则固化：** shortcutDisplay.test.ts 覆盖透传/单双修饰/裸 F 键/箭头/空串矩阵；doc-drift 口径（macOS `⌘+`/`⌘⌥I` 为 darwin 显示形态不从注册表派生）与实现一致。

### 结论

97 >= 90，**通过**。核心目标（fmtShortcut 回显单源派生固化 + shortcutSync 双源守护基线）读码验证成立，测试测真实注册表行为、守护含机制/卫生/反向钉住与过渡态自失效设计。4 项 Minor 均不阻断：建议顺手修复问题 1（注释措辞）与问题 3（死 prop，可携问题 5 一并收敛）；问题 2 随 BE-01 迁表归一。修复后无需重新评审即可提交，问题 2 若在 BE-01 落地时未归一将由 shortcutSync.test 自动拦截。
