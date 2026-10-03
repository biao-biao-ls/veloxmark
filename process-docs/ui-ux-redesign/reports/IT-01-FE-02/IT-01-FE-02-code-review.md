## 代码审查报告 — IT-01/FE-02 表格结构操作键位改造

**得分：** 95/100（阈值：90）
**状态：** ✅ 通过
**基线规范：** code-review/SKILL.md + rubric-code-review.md（前端，阈值 90）
**目标内容：** D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-02.md（评审对象=对应前端实现代码）
**工作目录：** D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

**已有代码风格**（已 Read keymap/commands/ops/opsTable/nestedSession/contract/shortcutDisplay/setup 等 10+ 文件）：文件头设计注释钉契约（AC/裁决号）、单一真源常量表 + 纯函数、stale-instance 纪律、循环依赖注入缝（NestedNavFns）、键字面量只声明一次、`*.test.ts` 同目录 headless 测纯逻辑。
**CLAUDE.md 约定**：TS strict；纯逻辑配单测、单测不渲染 widget；i18n 一律 `t('ns.key')` 且 en/zh 双字典同 key；e2e 缝/命令 id 不破坏。
**结论**：新代码与两层约定完全一致，风格类零扣分。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能全量实现 | 10 | 10 | — | |
| 需求遗漏 | 8 | 8 | — | |
| 范围外多做 | 8 | 8 | — | |
| 需求理解正确 | 7 | 7 | — | |
| 边界/异常覆盖 | 4 | 7 | macOS 回显≠实按（-3） | 客观（正确性/一致性） |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 10 | 10 | — | |
| 编码风格 | 8 | 8 | — | |
| 测试覆盖 | 7 | 8 | 冒号行左对齐仅断言长度（-1） | 客观（测试） |
| 安全 | 8 | 8 | — | |
| 性能 | 8 | 8 | — | |
| DRY | 3 | 4 | INSERT_TOAST_KEYS 与 TABLE_OP_TOAST_KEYS 双表（-1） | 客观（Minor） |
| YAGNI | 4 | 4 | — | |
| **合计** | **95** | **100** | | |

**核验结论（独立读码，不采信任务自述）**：STRUCT_KEYS 5 组 8 键冻结表与 TBL §3.2 一致（keymap.ts:72-81）；Q4 分流 `selection.empty` 在 keydown 读嵌套视图选区（keymap.ts:90-98，cellKeymap 传入 nested view）；Ctrl+Enter 专职插行、换行仅 Shift+Enter 写 `<br>`（keymap.ts:184-195），全仓无第二处 Ctrl-Enter 绑定（PEND-13 ✓）；AC-ERR-12 双层拦截（tryStructCmd 无 active 即 false + setup.ts:170 注册于 defaultKeymap 前）；回显由 STRUCT_KEYS 单源派生（opsTable.ts:191-194 → cmKeyToDisplay → fmtShortcut，无手写键位文案）；toast 冻结文案与 ac.md 逐字一致且 frozenCopy.test 守护；en/zh 各 523 key 对齐（i18n.test.ts 有守护）；无快捷键菜单项右侧留空（EditorContextMenu.tsx:92 `?? ''`，无占位符）；「▸」仅用于子菜单/折叠件，本任务面无误用。测试三层（纯表/绑定/路由）覆盖 AC 阶段 1-2 全部断言点。

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | macOS 回显与实按键不一致（AC-RULE-11「提示文本与实际触发键位一致」/AC-FN-07 ②） | STRUCT_KEYS 用 CM 字面量 `Ctrl-`（全平台=物理 Ctrl 键），菜单回显却经 fmtShortcut 的 mac 通道把 `Ctrl+`→`⌘`（shortcutDisplay.ts:14-17）。mac 上菜单显示「⌘Enter / ⌘⇧→」，实按 Cmd+Enter 无效、物理 Ctrl+Enter 才触发——回显与触发逐键不一致，且 Q4 放行后 mac 的词选扩展在 Alt-Shift-Arrow（@codemirror/commands standardKeymap），Ctrl+Shift+Arrow 有选区时是空操作而非「让位词选扩展」。App 命令侧无此问题（shortcutMatch.ts:34 把 Ctrl+ 匹配为 ctrlKey\|\|metaKey）；表格键走 CM keymap 无该语义。Windows 主平台行为正确。 | src/renderer/src/editor/table/keymap.ts:72-81、src/renderer/src/editor/contextMenu/opsTable.ts:193、src/renderer/src/commands/shortcutDisplay.ts:21-27 | 二选一收口并补 mac 断言：(a) 把 4 个 Ctrl 弦改为 `Mod-Enter`/`Mod-Shift-Enter`/`Mod-Shift-ArrowRight`/`Mod-Shift-ArrowLeft`（Mod=主修饰键，与 ⌘ 回显语义一致，注意同步 STRUCT_KEYS 注释/单测期望与 Q4 放行目标键组）；或 (b) 冻结键位即字面 Ctrl、对 struct 提示不走 mac ⌘ 通道（echo 显示 `Ctrl+…`）。决策依据写进 TBL-table-ops.md 平台口径。 |
| Minor | 冒号行左对齐项未断言取值 | AC-OP-03/04 要求「冒号行新增一项为左对齐标记」，测试只断言 `alignsOfDoc` 长度 3（keymap.test.ts:457、469），未断言新项为 `''`（GFM 左对齐）；实现侧 ops.ts:108 确实 splice `''`，正确但测试没钉住。 | src/renderer/src/editor/table/keymap.test.ts:457,469 | 补 `expect(alignsOfDoc(getDoc())).toEqual(['', '', ''])`（或对插入位逐项断言），防 FE-01 后续改动把对齐项写偏。 |
| Minor | INSERT_TOAST_KEYS 与 TABLE_OP_TOAST_KEYS 同 op 双表 | 4 个 insert 的 op id→i18n key 映射在 contract.ts:64-78 与 commands.ts:242-247 重复声明两份（值相同）；toastStructCmd 可直接走 toastTableOp/TABLE_OP_TOAST_KEYS 单表。 | src/renderer/src/editor/table/commands.ts:242-256 | 让 toastStructCmd 按 cmd 查 TABLE_OP_TOAST_KEYS（StructCmd ⊂ TableMenuOpId），删 INSERT_TOAST_KEYS；或给两表加同源测试断言。 |
| Info | 边界键吞没语义无断言 | 首行 Alt+↑ 等边界移动 runTableOp 返回 false 但 tryStructCmd 返回 true（commands.ts:379-418,417），键被静默吞掉（与菜单「禁用即语义、不弹 toast」口径一致）——行为合理但无测试钉住。 | src/renderer/src/editor/table/commands.ts:417 | 补一条边界移动「taken=true 且文档不变、无 toast」断言。 |
| Info | 任务文件「涉及文件」列 nestedSession.ts 已改，实际未改 | Q4 放行依赖既有 `keymap.of([cellKeymap, defaultKeymap…])` 顺序（nestedSession.ts:200），无需改动；frontmatter `doc-drift: []` 未登记该偏差。 | process-docs/ui-ux-redesign/tasks/IT-01/FE-02.md:101 | 联调收敛时把「nestedSession 无需改动（顺序已正确）」补进 implementation-notes/doc-drift，避免后续误读。 |

### 结论

需求面（3 键新增、Q4 分流、Ctrl+Enter 收口、键族作用域、单源回显、冻结 toast）全部落地且有真实测试钉住，工程质量符合项目宪法与既有模式，95/100 ≥ 90：**通过**。提交前建议顺手处理 2 个 Minor；Important 项（mac 回显/触发一致性）建议在 FE-04 联调或独立小任务中裁决收口——不影响 Windows 主平台功能正确性，故不阻塞本任务通过。
