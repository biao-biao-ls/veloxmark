## 代码审查报告 — IT-01/FE-05 ⊞ 网格选择器可选范围改造

**得分：** 96.5/100（阈值：90）
**状态：** ✅ 通过（1 Important 裁定必修-低，小修收口）
**基线规范：** code-review/SKILL.md + rubric-code-review.md（前端通用 90 分档）
**评审根目录：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`（下述路径均相对此根）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

**已有代码风格**（Read：table/gridPicker.ts、toolbar.ts、ops.ts、commands.ts、state.ts、contract.ts、parse.ts、overlays.css、zh.ts/en.ts、各 *.test.ts）：纯逻辑函数+DOM 单例分拆（ctxMenu 模式）、事件闭包不捕获 cell 偏移（stale-instance）、`t('ns.key')` 双字典、CSS token 化、纯函数同目录单测（禁止单测渲染 widget）、冻结文案族逐字字面量+冻结测试守护。
**CLAUDE.md 约定**：TS strict、Vitest 只测纯函数、`:root` token、en/zh key 对齐测试守护、e2e 缝（`data-op`/命令 id 字面量）不得破坏——全部与新代码一致。
**结论**：风格类无扣分项；客观类问题独立评定。

### 评分明细

| 维度 | 检查项 | 得分 | 满分 | 扣分项 | 归因 |
|------|--------|------|------|--------|------|
| 需求合规 | 功能全量实现（上界派生/拖选/预设/超限可选/toast/样式） | 10 | 10 | — | — |
| 需求合规 | 无遗漏（AC-RULE-12/OP-07/ERR-13/FN-04/UI-IXD-02/UI-ELEM-02 逐条核对） | 8 | 8 | — | — |
| 需求合规 | 无超范围（键盘导航/hush 注册为既有模式与 FE-09 契约） | 8 | 8 | — | — |
| 需求合规 | 理解正确（25×10→25×12 逐维、尾部增删、新增列默认左对齐） | 7 | 7 | — | — |
| 需求合规 | 边界与异常（非法尺寸/1×1/同形 no-op/参差补齐/对话框让位均覆盖，超宽矩阵横向不可达等缺口） | 3.5 | 7 | 部分通过（Issue 1/2/3） | 客观（可达性/边界） |
| 代码质量 | 职责分离（纯函数 gridUpperBound/gridPickerKey/presetDims/estimateAutoFitCols 与 DOM 单例分层） | 10 | 10 | — | — |
| 代码质量 | 错误处理（NaN/负数回退、null op 短路、resolve 失败守卫、fitWidth 防御） | 10 | 10 | — | — |
| 代码质量 | 编码风格（token CSS、双字典、冻结字面量族、data-op 契约+contract.test 守护） | 8 | 8 | — | — |
| 代码质量 | 测试覆盖（上界/钳制/预设/冻结 toast/invertColWidths 真实行为；DOM 胶水不测=项目约定） | 8 | 8 | — | 已有代码约定（Info） |
| 代码质量 | 安全（全程 textContent，无 innerHTML/注入面） | 8 | 8 | — | — |
| 代码质量 | 性能（矩阵规模 AC 强制；全量 paint 仅 Minor 备注） | 8 | 8 | — | — |
| 代码质量 | DRY（STRUCTURE_TOASTS/GRID_PRESETS/i18n 单源复用） | 4 | 4 | — | — |
| 代码质量 | YAGNI（无冗余功能） | 4 | 4 | — | — |
| **合计** | | **96.5** | **100** | | |

### 问题清单

| 等级 | 项 | 详情 | 位置 | 建议 |
|------|----|------|------|------|
| Important | 超宽矩阵横向不可达 | `.table-grid-picker-cells` 仅 `max-height`+`overflow-y`；AC-RULE-12 上界允许任意 C0（max(12,C0)），矩阵宽于视口时右缘溢出且不可横向滚动，钳位（:295）只能保左缘，极端形态下违反 AC-ERR-13「既有行列全部可选」 | styles/overlays.css:294-301 | 与纵向同口径加 `max-width: min(92vw, …)` + `overflow-x: auto`，保证超限列可达 |
| Minor | 拖选后落预设按钮松开=静默落空 | cell 按下拖到预设上松开：onRelease 丢弃确认（防双挑）且跨元素不合成 click，该次操作完全无反馈 | editor/table/gridPicker.ts:273-278 | 落预设区时执行该预设值（或回退 hover 值确认）；否则在冒烟清单登记该死区为已知行为 |
| Minor | 同形拖选静默无回执 | resizeTableOp 同形返回 null → 不 toast，用户松开后零反馈（AC-OP-07 未明确该态） | editor/table/ops.ts:218、editor/table/commands.ts:312 | 同形确认可复用「无需缩放」类回执或登记为可接受行为 |
| Minor | paint() 全量重绘 | 每次 mouseenter 对全部 R0×C0 格 classList.toggle，极大表拖选时 O(n)/事件 | editor/table/gridPicker.ts:204-212 | 可按上次 hover 范围做差集增量重绘；当前规模可接受，不阻塞 |
| Info | autoFit 宽度口径 | 实现取编辑器内容宽 `view.dom.clientWidth`，任务原文「窗口宽度」——已按 CHANGE-9 登记 doc-drift | editor/table/toolbar.ts:88 | 无需改，保持 change-log 溯源即可 |
| Info | 冻结回执双口径并存 | 冻结族逐字硬编码「（Ctrl+Z 可撤销）」（FE-11 grep 冻结设计）vs render.* 族 UNDO_SUFFIX 拼接；本任务回显与 cmd.undo `Ctrl+Z` 一致（AC-FN-07/AC-RULE-11 单源一致性成立） | i18n/zh.ts:275-291、i18n/zh.ts:5、commands/editCmds.ts:29 | 无需改 |
| Info | 字形检查 | 「▸」与本任务文案无关（grid 系列 key 无 ▸）；读数间隔「 · 」（U+00B7）与 ui_02 mock 逐字对齐 | editor/table/gridPicker.ts:178 | 无 |

### i18n 专项（范围提示项）

- en/zh key 对齐：`table.gridPickerTitle/gridScaleFull/gridPreset1x1|2x2|3x3/autoFit`、`toast.tableResized` 双侧齐全，占位符 `{R}{C}` 一致（i18n.test.ts:52-79 全局守护）✅
- 冻结文案：`toast.tableResized` = 「表格缩放为 {R}×{C}（Ctrl+Z 可撤销）」逐字命中冻结表（frozenCopy.test.ts:34,84；gridPicker.test.ts:105-108 1×1 插值断言）✅
- 预设标签 `1×1/2×2/3×3`（U+00D7）与 mock 一致，en「Fit to window」/zh「自动适应窗口」质量正常 ✅

### 结论

96.5 ≥ 90，**通过**。核心改造（逐维 max(20,R0)×max(12,C0) 上界、拖选 mouseup 单次确认、预设组、超限表全可选、单事务缩放+undo 一步还原含列宽——invertColWidths 已测）均已在真实代码中核实实现且有纯逻辑单测守护；Issue 1（超宽矩阵横向可达性）裁定必修-低并小修收口；其余 Minor 遗留登记。
