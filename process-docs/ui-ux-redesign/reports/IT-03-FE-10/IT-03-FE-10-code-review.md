## 代码审查报告 — IT-03/FE-10（公式/代码/mermaid 块观感审计微调与非回归）

**得分：97/100（阈值：90）　状态：✅ 通过（无 Critical/Important；2 Minor 入收口批候选 + 3 Info 登记候选）**
**基线规范：** code-review SKILL.md + rubric-code-review.md + 项目/渲染进程 CLAUDE.md（风格归因已前置）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**：themes.css theme-split 双侧声明 + 说明注释体例（FE-01 float 族先例，themes.css:54-70）；错误条 mermaid/math selector-list 共享（markdown.css:488 8C 注释体例）；token 消费一律 var()。新代码与先例一致。
- **CLAUDE.md 约定**：`:root`/theme-split 纪律、不新增 `.theme-dark` 选择器补丁、不写裸 px 新值——本次改动均符合（删除既有补丁而非新增）。
- **团队 rubric**：无冲突项。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|-----|-----|--------|------|
| 功能实现 | 10 | 10 | — | — |
| 遗漏需求点 | 7 | 8 | -1：错误条触碰规则内间距/字号仍裸 px，与同任务 code-chrome.css token 化深度不一致（#2） | 客观（观感审计深度） |
| 多做需求外 | 8 | 8 | —（零契约变更、导出零 diff 均守约） | — |
| 理解正确性 | 7 | 7 | —（ren-block:audit-preserve 零改色口径正确；AC-ERR-10 双态判定有记录） | — |
| 边界/异常 | 7 | 7 | —（错误态/last-good/对比度边界 4.513:1 有量化留档） | — |
| 职责分离 | 10 | 10 | — | — |
| 错误处理 | 10 | 10 | — | — |
| 风格/模式 | 8 | 8 | — | — |
| 测试覆盖 | 6 | 8 | -2：--errbar-* 未登记 tokens.test.ts 影子声明守卫（#1） | 客观（测试） |
| 安全 | 8 | 8 | —（textContent 路径，无注入面） | — |
| 性能 | 8 | 8 | — | — |
| DRY | 4 | 4 | — | — |
| YAGNI | 4 | 4 | — | — |
| **合计** | **97** | **100** | | |

### 独立核实（抽样）

- `themes.css:90-95/159-162`：--errbar-fg/bg/border 双侧齐全，值与声明逐字节一致口径成立（浅色 fg #b45309 对合成底 ≈4.5:1 与留档 4.513:1 吻合）；amber 全仓仅 themes.css 一处（4 副本同步未触发，合规）。
- `markdown.css:468-486`：错误条改吃 var(--errbar-*)，旧 `.theme-dark` 补丁已删；tokens.test.ts:128 双侧奇偶守卫覆盖。
- `code-chrome.css`：全文件裸 px 清零（3.2em/#000 蒙版例外有注释标定）；calc(--space-2 - --space-half)=6px 与注释一致，--space-half/--text-meta/--text-caption/--border-width 均存在于 tokens.css。
- 导出联动（AC-OP-18）：export/ 无 colWidths/colgroup/width 泄漏，图片 width/height 仅来自解析 attr（inline.ts:92，inline.test.ts 守护）——与 FE-04 已核结论一致；dualPane.ts/codeBlockUi.ts 纯逻辑零 diff 属实（文件无任何样式面）。
- AC-ERR-10/11 通道在位：widgets-math.ts:38-64 错误条+跳源码（跳转重解析 stale 纪律）；renderHost.ts:63-125 last-good/错误条/修复重渲染，mermaid 双区共享。
- i18n：math.renderFailed/jumpToSource、mermaid.errorLabel/jumpToSource/failed/updating/rendering en/zh 双侧对齐（zh.ts:348-349,465-469 ↔ en.ts:353-354,472-476），文案自然；i18n.test.ts 键奇偶守护在位。
- AC-FN-07/AC-RULE-11：commands/shortcutDisplay.ts 单源派生 + shortcutSync.test.ts 例外登记（zoomIn/toggleDevTools）与 AC 允许清单一致，本任务零命令/文案改动（darwin 残留属已登记存量，不重复扣）。
- 并发批在途（opsTable.gate.test TS2322/commands.test 负控/nestedSession TS18047）未计入本任务。

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | 测试守卫缺口 | 新增 theme-split 族 --errbar-fg/bg/border 未登记 THEME_SPLIT_OVERLAY_TOKENS（FE-01 七 token 先例均登记），影子声明扫描/单点声明守卫对新族失效（通用双侧奇偶仍覆盖） | `src/renderer/src/styles/tokens.test.ts:82-96`（对照 themes.css:93-95,160-162） | 将 3 个 --errbar-* 加入 THEME_SPLIT_OVERLAY_TOKENS，让「themes.css 外零声明」断言覆盖新族 |
| Minor | 观感 token 化深度不一致 | 本任务已触碰的错误条规则仅颜色 token 化，gap:8px/margin-top:8px/padding:6px 10px/font-size:12px/border-left:3px/border-radius:0 4px 4px 0 仍裸 px；同任务 code-chrome.css 同值域已 calc 化 | `src/renderer/src/styles/markdown.css:471-483` | 后续微调批把间距/字号对齐 --space-2/--text-meta 等 token（数值等价零视觉变化），或在 tokens.test.ts 登记例外口径 |
| Info | 实现注记措辞失准 | 「删除全仓唯一 .theme-dark 选择器级补丁」不成立：callout×8（markdown.css:327-334）、.katex（1226）、buttons.css:64、overlays.css:196 存量白名单补丁仍在 | FE-10.md:34 / self-test.md:33 | 改写为「删除错误条的 .theme-dark 补丁（存量白名单不动）」，避免后续 agent 误判仓库状态 |
| Info | 文档措辞 vs 契约 | 页面元素表「源码区+预览区并排」实为上下双区（replica-review #1 已自记）；dualPane 零 diff 下不改布局正确，但 frontmatter `doc-drift: []` 与该结论不一致 | FE-10.md:67 | 回写元素表措辞（并排→上下双区）或把该项登记进 doc-drift |
| Info | AC 双态口径 | AC-ERR-10 判据2「错误条+跳源码」实际落在渲染态 MathBlockWidget，双区预览 MathPreviewWidget 无错误条（mermaid 双区有，renderHost 共享）；CDP S2 拆双态判定合理但与 AC 单态文面有落差（8C/10A 存量通道，非本任务引入） | widgets-math.ts:38-64,103-108 | 若需双区内错误条属行为变更另立任务；否则 AC/元素表注明「预览错误标识在双区、错误条在渲染态」双态口径 |

### 结论

观感审计微调以最小 token 面落地（themes/markdown/code-chrome 三件），零契约变更、零改色（未触发 4 副本同步）、导出三通道零泄漏，与 FE-04/FE-09 已核合同一致；i18n 与快捷键回显单源面无回归。扣分仅 2 项（守卫枚举缺口 -2、错误条间距 token 化深度 -1），均为收口批可修的 Minor。**97 ≥ 90，通过**。
