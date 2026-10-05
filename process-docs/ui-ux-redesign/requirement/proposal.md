---
created: "2026-09-28"
author: "zhanghuanbiao + Claude"
status: Draft
---

# Proposal: VeloxMark UI/UX 全面交互重设计（现代极简）

## Problem

VeloxMark 功能面已基本齐备，但 UI/UX 是前期无设计规划、边开发边长出来的产物——缺乏统一设计语言与成体系的交互规范，存在明确的交互缺陷（表格系列、下拉溢出等），整体用起来"不专业"。

### Evidence

- 用户一手反馈（2026-09-28）：表格左侧留白；聚焦编辑时 +/− 增删把手冗余（⋮ 菜单已覆盖同功能）；⋮ 下拉超出应用可视范围；⊞ 网格选择器下拉呈空白；缺"按光标单元格上下左右插行列"快捷键；"UI 与 UX 用起来很不专业"。
- 代码一手核实（2026-09-28）：⋮ 复用右键全量菜单约 20 项、仅简单视口 clamp 无滚动；⊞ popover 网格皮肤断裂（`.table-insert-cell` 在 `--widget-surface` 上几乎不可见）；`STRUCT_KEYS` 仅 5 键（下插行 + 移行列），无四向插入；+/− 把手带 56/28px 槽位常驻是"左侧留白"来源。
- 既有评估记录：`docs/refactor-tasks.md` 阶段 5「观感差距约 25%」、阶段 6「左导航约 Typora 55–65%」；`docs/markdown-ux-optimization.md` P3 探索池 8 项（图片/链接/引用/列表/标题等编辑体验）未动。
- 根因（用户自述）：前期没有规划好 UI 再进行开发。

### Urgency

- 功能已"基本可用"，正处产品化窗口期——越晚改，UI 债务随功能增量继续放大。
- 表格是高频编辑路径，点名缺陷是日常摩擦。
- 既有两套看板按元素/区域逐点对齐，无全局设计语言，已出现各自为战（11A 被迫额外收口块级 chrome 即是信号）。

## Proposed Solution

先立设计语言、再按规范长 UI，SDD 逐项落地：

1. **产出《UI/UX 设计规范》**：视觉微调原则 + 交互模式库 + 块级 chrome 规范扩展 + 快捷键总表 + 信息架构。风格锚点 = **Notion**（留白/内容优先/悬浮才现控件）+ **Linear**（克制密度/精细圆角/快捷键驱动/短促动效）双锚点混搭；视觉层跟随交互改造微调，不推倒既有 token 架构。
2. **UI 原型先行**（/zcode:ui 高保真原型）经用户确认，作为动代码的前置门禁。
3. **新建 `docs/ui-redesign-tasks.md` 总看板**，SDD 逐项改造四大区域：顶部菜单栏与下拉、左侧导航栏、右侧 Markdown 渲染区全语法预览/编辑交互、表格交互五缺陷修复。
4. **成功指标四项**：点名缺陷清零 / 设计规范定稿 / 对照走查达标 / 可发现性达标。

### Innovation Highlights

- 不再逐区域对标单一产品截图，而是"设计规范先行、按规范长 UI"——把 11A 块级 chrome 规范的理念升级为全界面设计语言。
- 双锚点混搭：Notion 的内容优先观感 × Linear 的效率密度，适配写作工具（既不空旷也不压迫）。
- 快捷键总表单源派生菜单提示——顺带治理 commands/main.ts 快捷键双源债与提示缺失。

> 领域术语见 `process-docs/TASK0001/requirement/support/glossary.md`（跨阶段共享术语表，拷问中即时维护）。

## Requirements Analysis

### Key Scenarios

JTBD 主故事：When 写作者在 VeloxMark 中编辑含表格/图表/公式的文档, I want 交互像专业工具一样顺滑、可预期、可发现, so I can 专注内容创作而不是与界面搏斗。

- Happy path：光标在表格单元格 → Ctrl+Shift+←/→/Enter 四向插行列，菜单回显同快捷键；鼠标 hover 块级元素 → 控件簇浮现，⊞ 拖选一拖缩放整表。
- 边界：小窗口/低分辨率下菜单不超出可视区（限高滚动 + 翻转）；深浅主题观感一致；超长菜单可滚动可达；键盘全程可达。
- 错误/防错：首行不上移、首列不左移等无效操作禁用并可感知；快捷键仅表格编辑激活态生效，不劫持全局输入。

### Non-Functional Requirements

| 维度 | 要求 |
|------|------|
| 布局稳定 | 进出编辑态正文零布局抖动（位移 ≤1px，UX-P28 F3 契约不回退） |
| 兼容 | e2e 缝硬契约（`__velox*`/`data-op`/命令 id/`data-table-handle`）不破坏；导出侧平行契约同步 |
| 性能 | hover/focus chrome 一律 paint-level；动效时长 ≤150ms |
| 可发现性 | 结构操作 100% 菜单回显快捷键；hover 提示覆盖全部可点击块级控件 |

### Constraints & Dependencies

- Markdown 源码唯一数据源；显示态持久化不写入 .md 正文。
- 既有收敛成果是红线：5A–6G（观感/左导航）、7A–7H（表格）、8x/9x/10x/11A（块级 chrome）不许改坏，改则双处同步。
- 主题色单源 `export/palette.ts`、token 纪律、i18n 双字典、按钮 primitives 等 Constitution 条款继续有效。
- macOS 原生菜单与自绘 MenuBar 双源需同步改造。

## Alternatives & Industry Benchmarking

### Industry Solutions

Typora（纸面克制）、Notion（内容优先/悬浮控件）、Linear（高密度精细/快捷键驱动）、Obsidian、VS Code（快捷键可发现性）。

### Comparison Table

| Approach | Source | Pros | Cons | Verdict |
|----------|--------|------|------|---------|
| 什么都不做 | — | 零成本 | 点名缺陷日常摩擦，专业感无改善 | Rejected: 窗口期错过 |
| 继续逐点对标 Typora | 既有两看板 | 有截图基准 | 无全局设计语言，各自为战（11A 信号） | Rejected: 治标 |
| 照搬 Typora 视觉 | Typora | 克制 | 用户明确拒绝；不够现代 | Rejected: 2026-09-28 用户拍板 |
| **设计语言先行 + 双锚点混搭 + SDD 落地** | Notion×Linear | 全局一致、可扩展、缺陷一并清零 | 前期投入规范/原型 | **Selected: 用户拍板（现代极简 + 规范原型先行）** |

## Feasibility Assessment

### Technical Feasibility

全部改动落在既有 CM6 Decoration/Widget + React + CSS token 架构内，无结构性障碍；表格快捷键/菜单/网格选择器均有现成机制可扩展。

### Resource & Timeline

SDD 单元节奏已被两套看板（38+ 项）验证可行；设计阶段有 /zcode:ui 与 ui-ux-design agent 支持；分期由 M15 版本规划承载。

### Dependency Readiness

temp/typora 素材（table/code/math/mermaid 基准图）可继续作参考；Notion/Linear 风格需设计阶段调研产出规范草案（用户接受"设计阶段定细节"）。

## Assumptions Challenged

| 假设 | Challenge Tool | Finding |
|------|---------------|---------|
| 对标 Typora 即达"专业" | Assumption Flip | Overturned：用户要现代极简（Notion+Linear），Typora 截图降为参考素材 |
| 7C 保留 +/− 把手是好 UX（直达入口） | Worst-Day | Overturned：用户点名去除；⋮ 菜单与快捷键已覆盖其价值 |
| 11A 块级 chrome 规范已覆盖"UI 规范"需求 | 5 Whys | Refined：块级够用，但缺全界面设计语言（菜单/左导航/全局密度/动效） |

## Scope

### Core Path（核心路径 — 本轮交付）

- **设计规范定稿 + UI 原型评审通过**（视觉微调原则/交互模式库/chrome 规范扩展/快捷键总表/信息架构）——动代码前置门禁
- **表格交互五缺陷**：左侧留白消除（删 +/− 把手与常驻槽位）、⋮ 菜单分组 + 限高滚动、⊞ 网格选择器修复、四向插行列快捷键（方案 A：Ctrl+Shift+Enter 上插 / Ctrl+Enter 下插 / Ctrl+Shift+←/→ 左右插列）、工具栏与右键菜单一致性收口
- **顶部菜单栏**：信息架构重排、下拉防溢出/防丢失、快捷键提示全量、视觉统一
- **左侧导航栏**：统一审计改造（视觉细节、功能缺口、布局行为）
- **渲染区高收益交互**：图片编辑（11.1）、链接编辑（11.2）、列表/任务项/标题折叠/引用折叠（11.3–11.5）、公式/代码/mermaid 体验统一审计

### Iteration Pool（迭代池 — 后续轮次处理）

- 脚注 hover 预览（11.6）——低收益，跳转/回跳已可用
- 行内代码/强调 hover 提示（11.7）——低收益，行内已有 8D 底纹先例可后补
- 分隔线/front-matter 观感核对（11.8）——低收益，缺对照基准
- 动效精修（全库动效时长/缓动统一）——依赖规范定稿后打磨
- 无障碍强化（树键盘导航/多选 6.16、aria 全量）——不阻塞核心体验

### Out of Scope

- 视觉 token 体系重塑（色彩/字体体系推倒重来；本次仅跟随微调）
- 新 Markdown 语法能力（脚注/缩写等渲染能力不在本次）
- 移动端/触屏适配
- 运营埋点/监控（桌面应用不涉及）

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 改造中破坏已收敛 UI（5A–6G/7A–11A 成果） | M | H | 总看板红线引用既有收敛记录；SDD converge 强制人工冒烟 + e2e 缝核对 |
| 范围蔓延（全区域重设计易失控） | H | M | 核心/迭代分流已用户确认；M15 分期；规范+原型门禁挡前置 |
| 快捷键冲突/劫持全局输入 | M | M | 方案 A 键位走查；仅表格编辑激活态生效；与 commands 全局快捷键一致性测试 |
| 设计规范与实现脱节 | M | M | 形态索引表随实现更新；每 SDD 单元对照规范验收 |

## Success Criteria

- [ ] 点名 5 缺陷全部修复并经人工验收：表格左侧留白消除、+/− 把手移除、⋮ 下拉不超界且可达、⊞ 下拉正常显示、四向插行列快捷键生效
- [ ] 《UI/UX 设计规范》五部分（视觉/交互模式/chrome/快捷键/信息架构）定稿，UI 原型评审通过
- [ ] 全界面按规范对照走查清单全部通过（深浅主题各一遍）
- [ ] 可发现性走查通过：结构操作菜单 100% 回显快捷键，块级可点击控件 hover 提示全覆盖

## Next Steps

- 继续 `/zcode:prd` 流程：生成完整 PRD（核心闭环契约 → 模块补全 → 功能树/菜单树/AC）
- PRD 定稿后执行 `/zcode:ui` 产出高保真原型，评审通过后按总看板开首批 SDD 改造
