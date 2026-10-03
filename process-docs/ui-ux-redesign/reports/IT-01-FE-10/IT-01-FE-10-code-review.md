## 代码审查报告（IT-01/FE-10 静息零 chrome 与防抖零抖动）

**得分：** 92/100（阈值：90）
**状态：** ✅ 通过（临界；Important #1 裁定必修，已派 fix-cr-FE10-quietlock）
**基线规范：** code-review SKILL.md + eval-loop/reviewer.md + rubric-code-review.md（前端通用，非后端 95 口径）
**评审对象：** 任务 D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md 对应前端实现，工作目录 D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer（独立读真实代码，未采信任务自述）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**（最高层，抽读 chromeState/useHushLayer/toolbar/contract.test/opsTable/useHoverDiscipline 等 8 个同类面）：模块级单例 bus（Dialog/ctxMenu/mermaidLightbox 同型）✓；纯 reducer + factory runtime + 同目录 `*.test.ts` ✓；fs 读 CSS/token 做同源断言（contract.test 同法）✓；中英双语注释+AC 编号回链 ✓。
- **CLAUDE.md 约定**：strict TS、`:root` token 唯一声明（`--chrome-duration` 在 tokens.css:101）、无 `.theme-dark` 选择器补丁、i18n 双字典 `t()` ✓。
- **结论**：风格一致，无风格扣分项。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现 | 10 | 10 | — | — |
| 遗漏需求 | 8 | 8 | — | — |
| 多做需求外 | 8 | 8 | —（error 见 YAGNI；方案 A/复制条口径已登记裁决不扣） | — |
| 需求理解 | 6 | 7 | quietLock 把「立即静息」扩大为吞掉下一次真实 hover（-1） | 客观/理解偏差 |
| 边界覆盖 | 5 | 7 | leave→hush→enter 事件序缺陷（-2） | 客观 |
| 职责分离 | 9 | 10 | microVisible 注释语义与 editing 态不刷漆漂移（-1） | 客观（一致性） |
| 错误处理 | 10 | 10 | —（stale id/锚不匹配/try-close 防护齐） | — |
| 编码风格 | 8 | 8 | — | — |
| 测试覆盖 | 6 | 8 | quietLock 释放时序无回归测试（-2） | 客观 |
| 安全 | 8 | 8 | — | — |
| 性能 | 8 | 8 | —（单计时器/class 切换） | — |
| DRY | 3 | 4 | enter/retarget 微观 switch 重复（-1） | — |
| YAGNI | 3 | 4 | error()/errorFixed() runtime 无生产接线（-1） | — |
| **合计** | **92** | **100** | | |

### 问题清单

**Important（应修）**
1. `quietLock` 吞掉下一次真实 hover（非仅驻留指针）| `editor/table/chromeState.ts:154-156,220-225` + `toolbar.ts:199` | 释放仅靠 `leave`（且 leave 在锁置位**之前**发生则永不释放该次）：编辑态退出（editExit 置锁）或 hover 后 <150ms 内点正文空白（hide-pending 中 hush 置锁）时，指针若不在 wrap 上，下一次真实 pointerenter 被整段 no-op——AC-NF-04「hover ≥150ms 浮现」在该次 hover 不成立，需离开再进入才复燃。implementation-note 8 只登记「驻留指针需 leave+re-enter」，实际覆盖面更大（含指针从未在场的首 hover）。— suggestion：锁语义改为「合成 enter/retarget 压制」而不吞真实跨界 enter——如 host 在 pointerenter 传 `crossedBoundary` 标志（relatedTarget 不在任何 wrap 内即真进入，进则解锁并正常防抖），或 quietLock 置位时挂短解锁计时（指针不在锚上即放行）；补 `leave→hush→enter` 序回归测试。

**Minor**
2. `microVisible` 注释「Painted while visible OR hide-pending」与实现漂移 | `chromeState.ts:57-58,376-387` | editing/error 态 microVisible=true 但 applyPaint 仅 `phase==='hover'` 刷 `.cm-md-chrome-on`，editing 把手靠 `.cm-md-table-editing` 只开 pointer-events（markdown.css:1053-1055，自身 :hover 才画提示线，FE-03 同口径视觉无回归）——未来 host 若按 chromeSurfaces 派生会误判。— suggestion：注释改为「micro 已激活（hover=刷漆 / editing=结构命中）」，或 editing 态也走 paint，与 chromeSurfaces 同源。
3. enter/retarget 两分支 micro switch ~20 行重复 | `chromeState.ts:158-179` vs `192-208` | 仅 show-pending 分支 schedule 不同（重启 vs 保钟）。— suggestion：抽 `pendingEnter(snapshot, base, restartClock)` helper。
4. `error()/errorFixed()` runtime 无生产 dispatch（仅单测）| `chromeState.ts:408-409` | 四态建模是 AC-RULE-01 要求，但接线缺失则错误态为预留面。— suggestion：注释标明预留接线方（FE-06/AC-ERR 族），或在错误条落地任务挂接。

**Info（不扣分）**
5. 方案 A（col-grip 常驻 DOM+CSS 零漆，widget.ts:392-397）与 hover 复制条浮现（markdown.css:707-710）均为已登记/已裁决口径，维持。
6. i18n 兼核（范围附加）：FE-10 面 key（table.gridPickerTitle/moreTitle/copyTitle、ctx.align*、ctx.deleteTable、toolbar.copy、toast.copiedTable）en.ts/zh.ts 全对齐、文案质量正常；「▸」字形与 AC-FN-07/AC-RULE-11 回显单源（commands/shortcutDisplay.ts + opsTable STRUCT_KEYS）测试在位，未见问题。

### 结论

四态收口单点（chromeSurfaces + 36 例单测 + CHROME_DEBOUNCE_MS=HOVER_DELAY_MS=150=--chrome-duration 三方同源断言）、双向防抖/取消、0px slot 不变量、FN-31/32/33 例外与写作者路径均有真实代码与测试支撑，与项目既有模式一致。92 分过线；问题 #1 是 AC-NF-04 hover 路径的真实行为缺陷且常触发（任何编辑退出后首 hover），修复面小，裁定必修已派小修（fix-cr-FE10-quietlock，含回归测试）；#2 捎带同行修；#3/#4 记遗留。
