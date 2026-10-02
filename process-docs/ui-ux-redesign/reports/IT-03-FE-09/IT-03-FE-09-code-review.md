## 代码审查报告 · IT-03/FE-09 点击语义固化与纯选中保护

**得分：94/100（阈值：90）　状态：✅ 通过（Important×1 裁定必修 → fix-cr-IT03FE09-hoverz；Minor×3 顺带同批 + Info×2）**
**基线规范：** code-review SKILL.md + rubric-code-review.md（前端 90 档）；风格归因已前置完成
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02
**范围：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer` 内 FE-09 实现面（clickSemantics 新模块 + 6 处接线 + CSS 压零 + hoverZones 裁决）。并发批 fix-biz-PATH04-05 在途面（opsTable/nestedSession）未计入；FE-04/05/06/07 收口产物按已核结论比对，无一致性冲突。

### 风格归因（前置）

- 已有代码风格（最高层，抽读 8 个同类文件）：纯判定模块 + 同目录 `*.test.ts`（outline/extract、table/parse 同型）；widget 手势 `preventDefault + stopPropagation` 自持（blockWidget/widgets-math/codeBlock 既有模式）；注释体例为「AC 编号 + 契约名 + 设计理由」双语块（image-widget/hoverZones 一致）；App 只接线零逻辑（CLAUDE.md 红线）。新代码全部吻合。
- CLAUDE.md：App 不堆逻辑、大文件局部小改、`useSyncExternalStore`/i18n/`t()` 规则——FE-09 零新 i18n key（判定模块无字符串），App 仅 +2 行（App.tsx:55,536-537），table/widget.ts 局部小改未动 pendingHandoff。
- 团队规范冲突项：无（不扣分项仅 Info）。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|-----|-----|--------|------|
| 功能实现 | 10 | 10 | — | 需求合规 |
| 需求遗漏 | 6 | 8 | I1（-2）AC-FN-18「不浮现」有残窗 | 客观 |
| 多做范围外 | 8 | 8 | — | — |
| 需求理解 | 7 | 7 | 双供给 selectionEmpty 设计与 AC 文义/FE-03 合同一致 | — |
| 边界覆盖 | 4 | 7 | I2（-2）I4（-1） | 客观 |
| 职责分离 | 10 | 10 | 判定独立模块、App 一行、各 widget 本地路由 | CLAUDE.md |
| 错误处理 | 10 | 10 | classify 全 null-safe（clickSemantics.ts:66-76） | — |
| 编码风格 | 8 | 8 | 与 hoverZones/blockWidget 体例一致 | 已有代码 |
| 测试覆盖 | 7 | 8 | I3（-1）syncPureSelectionChrome 无单测 | 客观 |
| 安全 | 8 | 8 | 无注入面（classList/dataset 仅常量） | — |
| 性能 | 8 | 8 | 事件级 closest + 选区变化一次 classList toggle | — |
| DRY | 4 | 4 | 路由表单源；`selectionEmpty: true` 5 处字面量为文档化合同面 | — |
| YAGNI | 4 | 4 | 无超范围功能；`select` 判决为契约必需面 | — |
| **合计** | **94** | **100** | | |

### 问题清单

| # | severity | item | detail | location | suggestion |
|---|----------|------|--------|----------|------------|
| I1 | Important | 纯选中手势中途仍可能浮现 chrome（-2） | AC-FN-18「不浮现」残窗：hover 后 150ms 内按下并在**同一 zone 内**拖选（mouseout 不触发、`hide()` 不被调用），`show()` 的 pending 定时器照常触发，浮层/把手在拖选中途弹出；`hideAllNow` 只在**编辑器内** mouseup 收口（hoverZones.ts:66-78），编辑器外松开无清扫。mousedown 无清扫，与模块头自述「hover never pops chrome mid-drag」不符 | `editor/livePreview/hoverZones.ts:45-86`（缺 mousedown 清扫）；`hooks/useHoverDiscipline.ts:147-163`（pending 定时器不感知按钮态） | hoverZones 增 mousedown handler：`if (e.buttons !== 0 或 !chromeAllowed(...))` 对 show-pending 条目执行 `hide(id)`（尊重 pinned/retained），或 activate() 前回调复检 chromeAllowed |
| I2 | Minor | select 判决的 hideAllNow 强杀 pinned 会话（-2） | `hideAllNow` 直接 `remove()` 绕过 `hide()` 的 pinned/retained 保护（useHoverDiscipline.ts:188 vs 243-246）；LinkHoverFloat 编辑态 pin 合同是「hide is frozen while editing」（LinkHoverFloat.tsx:86-92），而「按 anchor 文本拖选后松开」不经 click-outside（anchor.contains 豁免，LinkHoverFloat.tsx:79），hideAllNow 会中止编辑会话丢草稿 | `editor/livePreview/hoverZones.ts:77`；`hooks/useHoverDiscipline.ts:243-246` | select 判决改为逐条 `hide(id)`（天然尊重 pin/retain 且清 show-pending），或 hideAllNow 前检查是否存在 pinned 通道则跳过 |
| I3 | Minor | syncPureSelectionChrome 零单测（-1） | 纯模块 26 项测试全矩阵（6×2 路由 + chromeAllowed + classify）已达标，但导出面 `syncPureSelectionChrome`（clickSemantics.ts:85-87）未测——它只依赖 `view.dom.classList`/`view.state.selection.main.empty`，可 stub 测 | `editor/clickSemantics.test.ts`（缺失项） | 用鸭子 stub `{dom:{classList},state:{selection:{main:{empty}}}}` 补「非空选区→加类 / 空→去类」2 用例 |
| I4 | Minor | mouseup 裁决未过滤按键（-1） | hoverZones mouseup 不判 `event.button===0`，右键松开（选择为空）走 edit 判决的 post-drag recovery `show()`——右键弹 ctxMenu 的同一次手势还浮现 hover 浮层，与「同一次点击只产生一种语义」有轻微冲突 | `editor/livePreview/hoverZones.ts:66` | `if (e.button !== 0) return` 置于裁决之前 |
| I5 | Info | 任务文 AC 勾选仍为「未验证」 | frontmatter AC-RULE-13/AC-FN-17/AC-FN-18 与阶段 1-4 checkbox 全未勾——属 converge 阶段流程记账，非代码缺陷 | `process-docs/ui-ux-redesign/tasks/IT-03/FE-09.md:10-12,130-150` | converge 时按 typecheck+test:unit+e2e 缝验收后勾销 |
| I6 | Info | 快捷键回显单源（AC-FN-07/AC-RULE-11） | FE-09 无新增 i18n/快捷键面（clickSemantics 无字符串；render.image.*/render.link.* 属 FE-04/05 已收口键，en/zh 对齐）；commands↔darwin 双源残留为已登记跨任务债，未加重 | — | 无动作 |

### 核验要点（读码实证，非自述）

- 路由表 6×2 全矩阵单测在（clickSemantics.test.ts:13-49）；AC 阶段 1 的矩阵要求达标。
- 六路接线齐全：image-widget.ts:299（→FE-04 浮层，broken 图禁浮层 :304）、table/widget.ts:349,465（cell 激活/gap 分级步退，pendingHandoff 未动）、blockWidget.ts:50（math/code/mermaid 经 wrapWithGap）、mermaid/widget.ts:90（svg→lightbox，padding 落源码路）、hoverZones.ts:68-78（select 判决 hideAllNow 清竞态）、App.tsx:537（一行 syncPureSelectionChrome）。
- CSS 压零三处齐且位于 reveal 规则之后（markdown.css:717,1089；code-chrome.css:127）；hover JS 路径有 `buttons!==0 + chromeAllowed` 双闸（hoverZones.ts:49-50、table/toolbar.ts:208-209），与 FE-03 useHoverDiscipline 已核合同（97 分）一致。
- 双供给 selectionEmpty 契约（widget 手势固定 true / chrome 策略取活体）在模块头有完整论证（clickSemantics.ts:11-25），陈旧选区不锁死编辑入口——与 AC 文义及 FE-03 衔接面无冲突。

### 结论

✅ **94 ≥ 90，通过**。核心需求（AC-RULE-13 裁决收口 / AC-FN-17 四判据 / AC-FN-18 主路径）实现完整、判定模块单测扎实、App 零堆入。I1 为唯一 Important：纯选中手势中途的 pending-show 残窗（编辑器内松开可自愈）→ **裁定必修，fix-cr-IT03FE09-hoverz（I2/I3/I4 同文件顺带）**；I5/I6 无动作（converge 记账 / 已登记债）。
