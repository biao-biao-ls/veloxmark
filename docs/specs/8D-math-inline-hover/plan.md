# 8D 实施方案

## 技术决策与理由

- **纯 CSS 一条规则**（spec 决策）：`.cm-md-math-inline:hover { background: var(--widget-surface); border-radius: var(--radius-sm); }` + `cursor: pointer`（与 `.cm-md-math-block` 的 `cursor: pointer` 先例一致，「可点击」提示的组成部分）。hover 只 paint、不占 layout（背景/圆角/光标均 paint-level）——零布局抖动契约（约束 10）天然满足。
- **皮肤同族**：`--widget-surface` = 8A 块级 hover 同 token（F08 内容 widget 表面）；行内尺度圆角取 `--radius-sm`（块级 hover 用 `--cb-radius`，行内不套块级尺度）。无裸色值、无新 token、无 `.theme-dark` 补丁。
- **底纹含呼吸区**：`.cm-md-math-inline` 既有 `padding: 0 2px`——hover 背景 paints 整个 padding box，观感带 2px 呼吸区，零改动获得。
- **P09 零触碰**：`markTouched`（handlers-math.ts:58）分支、`InlineMathWidget`（eq/ignoreEvent/toDOM）零改动——hover 是 CSS 伪类，显隐契约构造性不变。
- **导出零改动**：`export-math-inline` 无 hover 面（8A 同先例）。

## 文件切法

| 源 | 改动 |
|---|---|
| `styles/markdown.css` | `.cm-md-math-inline` 规则旁加 `:hover` 底纹规则（+ `cursor: pointer`，注释记 8D/8A 同族） |

## 状态/契约归属

零状态、零 TS、零 i18n、零测试（纯 CSS，8A/7G 先例）。class 名零改动（`detect.ts` `math-inline` 消费方、e2e 缝零触碰）。

## import 改动面

零（纯 CSS）。madge 例行守护。

## 任务拆分

1. CSS 规则落地 [唯一改动]
2. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（全量回归）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 仅 `styles/markdown.css`（新增伪类规则，零既有字面量改动）
- 人工冒烟（**待运行时冒烟补签**）：
  1. hover 行内公式：浅灰底纹浮现（含 2px 呼吸区、圆角），移出即隐（对照块级 8A hover 观感）
  2. 点击/光标触碰：仍显 `$…$` 源码（P09 不回退）；移开选区回渲染
  3. 深浅主题两张对照（token 走 `--widget-surface`）
  4. 选区拖过行内公式跨文本选择不回退（背景 paint-only）

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 落地，无偏离：`markdown.css` `.cm-md-math-inline` 既有规则内加 `cursor: pointer`（注释记 8D/块级先例），其后新增 `.cm-md-math-inline:hover { background: var(--widget-surface); border-radius: var(--radius-sm); }` 一条（注释记 8A 同族/P09 零触碰/2px 呼吸区）。纯附加 diff，既有声明行零改动。
- TS/测试/导出侧确认零触碰（显隐契约 = P09 `markTouched` 分支未读改；`detect.ts` `math-inline` 消费方未动）。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / 341 例全绿（纯 CSS 零新测试，8A/7G 先例）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 仅 `styles/markdown.css` 一文件、纯附加（新增伪类规则 + 一行 cursor）；`.cm-md-math-inline` class 名/声明行零改动、`detect.ts`/`__velox*`/`data-op` 零触碰 ✓
- AC2/AC3 构造性成立（纯 CSS = 显隐契约不可能被改；token/零补丁/导出零改动）；AC1 待运行时冒烟补签（4 点）：
  1. hover 行内公式：浅灰底纹浮现（含 2px 呼吸区、圆角），移出即隐（对照块级 8A hover 观感）
  2. 点击/光标触碰：仍显 `$…$` 源码（P09 不回退）；移开选区回渲染
  3. 深浅主题两张对照（token 走 `--widget-surface`）
  4. 选区拖过行内公式跨文本选择不回退（背景 paint-only）
