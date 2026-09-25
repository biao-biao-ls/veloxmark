# 7H spec — 表格静息态视觉微调（7.10 / ⑯）

> 看板任务：⑯ 7.10（`docs/markdown-ux-optimization.md` 实施优先级 P2 观感对齐）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/table-default.png`：表头底色是**很浅的灰**（清晰但不沉重的色带）、所有边框（含表头下缘）**统一 1px 细线**。VeloxMark 现状：`--table-header-bg`（light `#e8e8e8`）比基准深一档；`.cm-md-table th` 有 `border-bottom: 2px` 独粗下缘，与四周 1px 不统一。

**What**：表头底色更浅、th 下边框回落 1px 统一细线；改色按红线 6 走 `export/palette.ts` 单源 + `palette.test.ts` 对齐流程。

**Why**：观感对齐基准；且改色顺带收拢**编辑器↔导出的表格取色分歧**（见决策 1）。

## 决策 1：table token 入 palette 单源（收拢导出分歧）

红线 6：「主题色单源 `export/palette.ts`」。`--table-header-bg`/`--table-stripe-bg` 今日只活在 `styles/themes.css`（无测试守护），而导出两面（`exportCss.ts` th/zebra、`inlineStyles.ts` th/zebra 走 `bgAlt`）**th 与 zebra 同为 `--bg-alt`、无层级**——编辑器与导出各表各色。本项把 `tableHeaderBg`/`tableStripeBg` 增补为 `PaletteToken`：

- `RUNTIME_CSS_VAR` 映射 `--table-header-bg`/`--table-stripe-bg`（与 `paletteToCssVars` 的 kebab 推导同名，无 bgAlt 式撞名）；
- `themes.css` 手工同步值，由 `palette.test.ts` 现成循环自动守护（零测试改动即获守护）；
- `exportCss.ts`/`inlineStyles.ts` 的 th/zebra 切到同源 token——**编辑器与导出一张表两处渲染从此同色同层级**（红线 8 平行契约一次收拢）。

## 决策 2：取值（light 基准驱动；dark 不猜）

- **light 表头**：`#e8e8e8` → **`#f0f0f0`**——比现状浅（任务要求）、仍深于 zebra `#f6f6f6`（F02「header clearly deeper than zebra」层级保持），对白底读得出色带（基准观感）。
- **light zebra**：**保持 `#f6f6f6`**（基准条纹很淡，层级由表头值承担）。
- **dark 两值不改**（`#2d2d2e`/`#252526`，F02 曾调过层级）：无深色基准截图，深浅主题冒烟只验**不回归**，不猜新值。
- **th 下边框**：删 `border-bottom: 2px` 覆盖，回落共享 `border: 1px solid var(--border)`——统一细线（导出侧本就 1px，双面自此一致）。

**已知连带（非回退）**：`.cm-md-table-handle-btn` 皮肤共用 `--table-header-bg`，随表头一起变浅（同族表面，观感一致）；导出 zebra 由 `--bg-alt`(#fafafa) 切 `#f6f6f6`、导出表头由 `#fafafa` 切 `#f0f0f0`（同源收拢的必然结果，层级从无到有）。

## AC（可测试）

1. **观感**：light 表头底色明显浅于现状且深于 zebra（`#f0f0f0`）；th 四周边框统一 1px（无独粗下缘）。
2. **palette 单源**：两 token 入 `palette.ts`（`PaletteToken`/`RUNTIME_CSS_VAR`/双 `*_PALETTE`）；`themes.css` 值与 palette 一致（`palette.test.ts` 守护）；`exportCss`/`inlineStyles` 的 th/zebra 消费 table token（不再借 `bgAlt`）。
3. **palette 测试通过**：既有循环自动覆盖新 token；另按 callout 先例补导出面字节级钉（`EXPORT_DOC_CSS` 取 `var(--table-*-bg)`、`tagStyles().th` 带 palette 值）。
4. **双主题冒烟**：深浅主题各一张对照截图（dark 值零改动，验不回归）。
5. **红线**：不新增 `.theme-dark` 选择器补丁（主题拆分值只在 `themes.css` 声明点）；class/attr/e2e 缝零触碰。

## Out of scope

- 单元格 padding 双面差异（编辑器 `--space-2/--space-3` vs 导出 `6px 13px`）——基准未点名，另项；
- dark 表头微调（无深色基准）；字体/字重；⑱ 块级 chrome 规范。

## 约束引用

1（e2e 缝）→ 纯取色/边框值，class/attr 零改动；6（主题色单源 palette + 不新增 `.theme-dark` 补丁）→ 本项即执行该流程；8（导出侧平行契约）→ exportCss/inlineStyles 与编辑器双处同步且归一单源；9（单测纯函数）→ palette/inlineStyles 均纯函数可测。
