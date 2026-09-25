# 7H 实施方案

## 技术决策与理由

- **palette 增补**（spec 决策 1）：`PaletteToken` += `tableHeaderBg`/`tableStripeBg`；`RUNTIME_CSS_VAR` 映射同名 kebab（`paletteToCssVars` 推导 `tableHeaderBg → --table-header-bg`，与运行时名一致、无 bgAlt 撞名特例）；`LIGHT_PALETTE` = `{ tableHeaderBg: '#f0f0f0', tableStripeBg: '#f6f6f6' }`、`DARK_PALETTE` = `{ tableHeaderBg: '#2d2d2e', tableStripeBg: '#252526' }`（dark 原值搬家不改值）。
- **themes.css 手工同步**（红线 6 流程）：light `--table-header-bg: #e8e8e8 → #f0f0f0`（注释随 F02 语义更新）；zebra/dark 原值。`palette.test.ts` 既有循环（"theme block declares every palette token value" + "RUNTIME_CSS_VAR maps every token exactly once"）**自动**覆盖新 token——零测试改动即获守护。
- **导出两面切同源**：`exportCss.ts` `.export-doc th`/`tbody tr:nth-child(2n)` 的 `--bg-alt` → `--table-header-bg`/`--table-stripe-bg`（两 var 由 `paletteToCssVars` 生成进 `.export-theme-*`）；`inlineStyles.ts` `th` 样式与 zebra 行走（`inlineHtml`）的 `p.bgAlt` → `p.tableHeaderBg`/`p.tableStripeBg`。
- **th 下边框**：删 `.cm-md-table th { border-bottom: 2px … }` 覆盖，回落 `th,td` 共享 1px（导出本就 1px，归一）。
- **测试补钉**（按 callout 字节级钉先例）：`palette.test.ts`「generated export surfaces」加两条——`EXPORT_DOC_CSS` 含 `background: var(--table-header-bg);` 与 `background: var(--table-stripe-bg);`；`tagStyles(LIGHT/DARK_PALETTE).th` 含对应 palette 值。`inlineStyles.test.ts` kebab 面补 `--table-header-bg`/`--table-stripe-bg` 发射钉。
- **纯函数面**：palette/inlineStyles 均 node 可测；CSS 值改动无新逻辑。

## 文件切法

| 源 | 改动 |
|---|---|
| `export/palette.ts` | token 并入（union/RUNTIME_CSS_VAR/双 palette）+ 模块注释 |
| `styles/themes.css` | light `--table-header-bg` → `#f0f0f0` |
| `styles/markdown.css` | `.cm-md-table th` 删 `border-bottom: 2px` |
| `export/exportCss.ts` | th/zebra 切 table token |
| `export/inlineStyles.ts` | th/zebra 切 `p.tableHeaderBg`/`p.tableStripeBg` |
| `export/palette.test.ts` | 导出面字节钉 +2 |
| `export/inlineStyles.test.ts` | kebab 发射钉 +2 |

## 状态/契约归属

零状态、零 widget、零 i18n。class/attr 零改动（e2e 缝零触碰）；`bgAlt` 保留给 pre/callout 回退等既有消费者（`inlineStyles.test.ts` 的 `--bg-alt` 钉不动）。

## import 改动面

零新增 import（新 token 是同模块数据）。madge 例行守护。

## 任务拆分

1. palette 增补 + themes.css 同步 [先行]
2. 导出两面切源（exportCss/inlineStyles）[依赖 1]
3. markdown.css 边框归一 + 测试补钉 [依赖 1–2]
4. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（palette/inlineStyles 新钉随全量跑）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动（取色/边框值与 token 数据，无 class/attr/id）
- 人工冒烟（**待运行时冒烟补签**）：
  1. light：表头浅灰色带（对照 `table-default.png`）、比 zebra 深一档；th 四周统一 1px 细线
  2. 编辑态把手/工具栏皮肤不回退（随表头变浅属同族观感）
  3. 导出 HTML/PDF/复制富文本：表头/zebra 与编辑器同色同层级（从无层级到有层级）
  4. dark：表头/zebra 与改前一致（值零改动，验不回归）
  5. 深浅主题各一张对照截图

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 落地，无偏离：`palette.ts` token 并入（union + `RUNTIME_CSS_VAR` 同名 kebab 映射 + 双 palette，注释标明 7H 来源/未调值）；`themes.css` light `--table-header-bg: #e8e8e8 → #f0f0f0`（F02 注释补 7H 出处）；`markdown.css` `.cm-md-table th` 删 `border-bottom: 2px` 覆盖（注释记录归一理由）。
- 导出两面切源：`exportCss.ts` `.export-doc th`/`tbody tr:nth-child(2n)` 由 `var(--bg-alt)` 切 `var(--table-header-bg)`/`var(--table-stripe-bg)`（两 var 随 `paletteToCssVars` 自动进 `.export-theme-*`，零额外接线）；`inlineStyles.ts` `tagStyles().th` 与 zebra 行走（`inlineHtml`）切 `p.tableHeaderBg`/`p.tableStripeBg`。
- 测试补钉：`palette.test.ts` +2 例（`EXPORT_DOC_CSS` 消费两 token 字节钉、`tagStyles().th` 带 `tableHeaderBg` 值钉，import 补 `tagStyles`）；`inlineStyles.test.ts` kebab 发射钉补 `--table-header-bg`/`--table-stripe-bg` 双主题 4 行。`bgAlt` 既有消费者（`pre` 样式、`--bg-alt` 钉）零触碰。
- `.cm-md-table-handle-btn` 皮肤共用 `--table-header-bg`（spec 已知连带）：随表头变浅，同族观感，未改。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / **341** 例全绿（339 + 新钉 2）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 7 文件均为 token 数据/取色值/测试钉/注释；`__velox*`、`data-op`、`data-table-handle`、`dataset.tableFrom`、`.cm-md-table-handle-btn`/`.cm-md-table-toolbar` class 零触碰 ✓
- AC2/AC3/AC5 构造性成立（palette 单源 + themes.css 值一致由既有循环守护 + 导出两面消费同源 token + 无 `.theme-dark` 补丁）；AC1/AC4 待运行时冒烟补签（5 点）：
  1. light：表头浅灰色带（对照 `table-default.png`）、比 zebra 深一档；th 四周统一 1px 细线
  2. 编辑态把手/工具栏皮肤不回退（随表头变浅属同族观感）
  3. 导出 HTML/PDF/复制富文本：表头/zebra 与编辑器同色同层级（从无层级到有层级）
  4. dark：表头/zebra 与改前一致（值零改动，验不回归）
  5. 深浅主题各一张对照截图
