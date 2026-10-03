## 代码审查报告 — IT-01/FE-06 列宽拖拽右邻吸收改造

**得分：91/100**（阈值：90）　**状态：✅ 通过**（A/B 裁定必修，已并入 fix-biz-PATH01 修复批）
**基线规范：** code-review/SKILL.md + rubric-code-review.md（前端，通用 90 阈值）
**评审对象：** D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer 实现代码（不采信 FE-06.md 自述，逐文件实读）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- **已有代码风格**：`editor/table/` 纯逻辑模块 + 同目录 `*.test.ts`（parse/ops/insert 均如此）；副作用进 `state.ts` StateField/StateEffect；CSS 用 `--*` token + `var(--x, fallback)`（`.cm-md-col-grip` 既有写法一致）；WidgetType 带 `eq`/`ignoreEvent`。
- **CLAUDE.md 约定**：纯函数配单测、禁止单测渲染 widget、token 唯一声明点、i18n `t('ns.key')` 且 en/zh 同步——新代码全部符合。
- 结论：风格类差异 0 项；下列扣分全部为客观问题（需求/DRY/健壮性/测试）。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 |
|---|---|---|---|
| 功能实现 | 10 | 10 | 吸收/末列例外/钳制/防误触/invertedEffects 撤销/AC-ERR-03 remap 全部落地且可读码验证 |
| 遗漏需求点 | 4 | 8 | AC-ERR-03「超界列宽重置」未接入生产路径（-4，见 A） |
| 多做需求之外 | 8 | 8 | 无 YAGNI 越界 |
| 需求理解 | 7 | 7 | PEND-10 语义、AC-OP-11 Then3 指定的 invertedEffects 路径均正确 |
| 边界覆盖 | 7 | 7 | 1 列表、pair<2、越界 j、NaN、误触、hi<lo 退化均有实现 |
| 职责分离 | 10 | 10 | colWidth.ts 纯域 / state.ts 效果 / widget.ts DOM 三层清晰 |
| 错误处理 | 8 | 10 | revert 后 DOM/state 不一致、pointercancel 无兜底（-2，见 C/D） |
| 项目风格 | 8 | 8 | 与既有模式一致 |
| 测试覆盖 | 7 | 8 | colWidth 21 例 + state 4 例测真实行为；hi<lo 退化分支无断言（-1，见 E） |
| 安全 | 8 | 8 | 无注入面（title 走 t()，无 innerHTML 用户串） |
| 性能 | 8 | 8 | 涂装只改 2 列样式，effect-only 事务零 doc change |
| DRY | 2 | 4 | 40/48 双最小宽地板 + 过时注释（-2，见 B） |
| YAGNI | 4 | 4 | 无冗余功能 |
| **合计** | **91** | **100** | |

### 问题清单

| # | 等级 | 检查项 | 位置 | 详情 | 建议 |
|---|---|---|---|---|---|
| A | Important | 需求遗漏（-4） | `editor/table/state.ts:131` | `colWidthRemapEffect` 调 `sanitizeWidths(widthsRemap(prev), nextColCount)` 未传 clamp → `>max` 的「超界」宽永不重置；该行为只存在于测试 `colWidth.test.ts:167-171`（传了 `{min:48,max:800}`）。AC-ERR-03 判据 1 明列「失效/超界列宽重置为默认列宽」，生产路径只覆盖「失效」 | 为 remap 提供 max 来源（如 clamp 注入或 remap 时用 wrap 宽度调用方传入）；若判定「超界」在纯层不可知，则同步收窄 sanitizeWidths 文档与测试口径，避免测试独享行为 |
| B | Important | DRY（-2） | `preferences/store.ts:371,382` | `normalizeColWidths` 仍是 `Math.max(40,…)` 并注释「40px, widget.ts col-grip parity」——与 `colWidth.ts:21` `MIN_COL_WIDTH=48`（自述「唯一声明点、替代魔数 40」）双源冲突且注释失实；40–47px 存量宽会以低于最小宽渲染（`widget.ts:194` 只判 `w>0`） | `normalizeColWidths` 引用 `MIN_COL_WIDTH`（或抽共享常量），修注释；同步 `store.test.ts:17-21` 断言 |
| C | Minor | 正确性（-1） | `editor/table/widget.ts:279-287` | mistouch 且已 paint 时 `revert()` 把**所有**列钉到 `startWidths`（含原本 auto 列），DOM 与 state（未写回）不一致直到下次重建 | revert 只还原本次 paint 的列（col/col+1 或末列）及 `table.style.width`，auto 列恢复无 `style.width` |
| D | Minor | 健壮性（-1） | `editor/table/widget.ts:321-322` | 仅挂 `mousemove`/`mouseup`，无 `pointercancel`/window blur 兜底；probe 事件无 pointerId 不做 capture，窗口外释放可能残留 document 监听与指示线 | 补 `pointercancel` 处理（复用 onUp 清理路径） |
| E | Minor | 测试（-1） | `editor/table/colWidth.ts:77-82` | `hi<lo` 退化分支（保和放弃钳制，宽可至 1px）无单测钉住 | 补 1 例：`absorbNeighbor([30,30],0,20,{min:48,max:60})` 类输入断言和不变量 |
| F | Info | i18n（不扣分） | `i18n/en.ts:544` / `i18n/zh.ts:539` | 本任务唯一 i18n 面 `tableHandle.colGrip` 两语齐、文案与 7F「仅会话、不入 .md」语义一致；「▸」字形与 AC-FN-07/AC-RULE-11 快捷键回显与 FE-06 无关（本任务无快捷键/菜单面），已确认无需核对项 | 无 |

### 附加核验（正面）
- AC-OP-11 撤销走 `invertColWidths`+`colWidthHistory`（`table/state.ts:97-111`，注册于 `editor/setup.ts:114`），effect-only 事务经 `invertedEffects` 进撤销栈（对照 `@codemirror/commands` HistEvent.fromTransaction 语义核实）；`restoreColWidths` 刻意不反演正确。
- AC-ERR-03 四个 dispatch 面（`table/commands.ts:281-311`、`contextMenu/opsTable.ts:394-433`、`table/toolbar.ts:91-99`、探针 `table/widget.ts:566-574`）均传 `widthsRemap`，结构+列宽同事务，符合一次 Ctrl+Z 同还原。
- 指示线 `.cm-md-col-drag-line`（`styles/markdown.css:1071-1079`）走 `--border-width`/`--drop-indicator`/`--accent` token，无 `.theme-dark` 补丁；`data-testid=col-grip`/`col-drag-line` 契约在位（`contract.test.ts:115` 守护）。

### 结论

**✅ 通过（91 ≥ 90）**。核心需求（右邻吸收总宽不变、最右列例外、钳制、防误触、会话持久化、单事务撤销、AC-ERR-03 remap）实现完整且测试扎实；A（超界重置未接线）裁定必修并入修复批，B（40/48 双地板）裁定必修-低一并收敛，C/D/E 记遗留。
