# 5C 标题体系与区块垂直节奏 实施方案

## 技术决策与理由

**根因（代码核实）**：

1. **H2 无底线**：H1 带 `border-bottom: 1px solid var(--border)`（markdown.css L17–23），H2（L24–29）裸标题——区块边界弱的直接原因。
2. **公式发飘主因 = KaTeX display 自带 `margin: 1em 0`**：`renderKatexHtml(tex, true)` 产出 `.katex-display`，katex.css 默认上下 margin 未被重置；叠加 `wrapWithGap` 的 `.cm-md-block-gap { padding: 6px 0 }`（L369）+ `.cm-md-math-block { padding: 8px 0 }`（L575）≈ **2.5 行纵向空档**，与截图 18–21 区间吻合。
3. **节奏发虚**：空行占真实行高（AC3 保留，编辑语义）+ 标题 padding 阶梯（F06，h1 0.8em→h6 0.4em）+ block-gap 6px 三者叠加后节间/段间比 Typora 松。垂直量来源分散（katex margin / block-gap / math padding / heading padding）——「单一节奏源」即收敛这些入口到统一档位。

**决策**：

- **D1 H2 底线同 H1**：`border-bottom: 1px solid var(--border)`（token 现成，palette 零触碰）；H3–H6 不加（Typora 默认主题仅 h1/h2 带线）。
- **D2 公式垂直量单一来源**：`.cm-md-math-block .katex-display { margin: 0 }`（katex 内部 margin 归零）；垂直空档只由 `.cm-md-block-gap` + `.cm-md-math-block` padding 提供，两者合计收敛到 ≈1 行（block-gap `var(--space-2)` 8px + math padding `var(--space-2)` → 约 32px，含上下对称）。**不动 `widgets-math.ts`**（CSS 解决，widget 的 eq/toDOM 契约零触）。
- **D3 节奏 = 调 padding 阶梯，禁 margin**（F06/NOTE 硬约束：line decoration 带 vertical margin 会破坏 CM6 heightmap 坐标映射）。`.cm-md-block-gap` 统一 `var(--space-2)`；h1–h3 阶梯在现状（0.8/0.7/0.6em 上）微调；以同视口截图对照 Typora 目测 ±20% 收敛，调参留 implement 微调窗口。
- **D4 导出平行同步**（3C 契约）：`export/exportCss.ts` 补 h2 底线；若导出 CSS 含 katex display 段，margin 同步归零（implement 时核对 inlineStyles/exportCss 的 katex 出口）。

## 文件切法

| 源 | 改动 |
|---|---|
| `styles/markdown.css` | L24–29 h2 + `border-bottom`；L14–19 阶梯微调；L369 `.cm-md-block-gap` 统一档；L575 math padding 收敛；katex-display margin 归零新规则（math 区） |
| `export/exportCss.ts` | h2 底线平行；katex display margin 平行（如有） |

不动：`editor/widgets-math.ts`、`handlers-*`（纯 CSS 单元，装饰快照零变化）。

## 状态/契约归属

- 无模块状态。`--border` 现有 token（themes.css 双主题已声明），**主题色 4 处副本零触碰**。
- F06/NOTE（padding-only）保持；底线走 line class（`cm-md-h2` 已有）无需新装饰路径。

## import 改动面

无。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | H2 底线 + exportCss 平行（D1/D4） | [P] T2 |
| T2 | katex-display margin 归零 + math/block-gap 收敛（D2） | [P] T1 |
| T3 | 标题/块间距阶梯微调 + 截图对照收敛（D3） | T1, T2 |

T1/T2 无文件交集可 [P]；T3 依赖两者完成后统一目测调参。**建议在 5B 收敛后实施**（底线宽度=内容列宽，列稳定后再对照节奏）。

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 装饰快照预期零 diff（纯 CSS）
- 人工冒烟：H1–H6 目测底线/字号阶梯；块级公式上下 ≈1 行、点击进源码编辑不变；节间/段间/列表前后节奏对照 Typora 截图（AC2 ±20% 目测）；空行占行不跳行（AC3）
- 导出 HTML/PDF/复制富文本各一：h2 底线、公式间距、callout/表格无回归
- 深色主题底线不刺眼
