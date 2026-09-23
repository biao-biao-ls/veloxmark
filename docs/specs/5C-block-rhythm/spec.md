# 5C 标题体系与区块垂直节奏（任务 5.4 + 5.5）

## What / Why

① H2 补统一底部分隔线（H1/H2 同系），强化区块边界；② 收敛「空行占位 + 块间距」叠加造成的发虚节奏，建立单一垂直节奏源；③ 块级公式上下留白收紧。目标：同视口下垂直节奏与 Typora 截图一致（区块边界清晰、间距均匀稳定）。

## 背景与现状

- H1 已有 `border-bottom: 1px solid var(--border)`（`styles/markdown.css` L17–23），H2–H6 无底线（L24–46）——与 Typora 默认主题（H1/H2 均带线）不一致，截图中「功能/数学/代码」区块边界弱。
- 垂直节奏硬约束：line decoration 只能用 padding 阶梯、**禁 vertical margin**（F06 + NOTE，`styles/markdown.css` L8–19，CM6 heightmap）；现状空行占真实行高 + 标题 `padding-top` 阶梯（0.8em→0.4em）叠加后，节间空档偏大、节奏发虚（截图行号 2/4/6/14 空行可见）。
- 公式：`editor/widgets-math.ts` `MathBlockWidget` 上下空档约 3 行（截图行号 18–21 区间），内部居中正常——纵向发飘。
- 导出侧标题/间距样式在 `export/exportCss.ts` 平行实现（平行契约）。

## 验收标准（AC）

1. H1、H2 均有统一浅色底线（宽度 = 内容列宽，色走 token），H3–H6 无底线（与 Typora 默认主题一致）。
2. 同视口对照 Typora 截图：节间、段间、列表前后**总间距节奏一致**（人工目测判定，允许约 ±20%）。
3. 空行仍占行（编辑语义不变：行号、光标移动、点击定位不跳行），仅收敛间距叠加，不引入空行折叠。
4. 块级公式上下留白收紧到约一行量级；居中、点击编辑源码行为不变。
5. 底线/间距 token 化：底线在深色主题不刺眼；改色走 palette 单源纪律（改色必查主题色 4 处副本）。
6. 导出 HTML/PDF 的标题底线与间距同步（`exportCss` 平行契约双处同步）。
7. `build.test.ts` 装饰快照若输出变化，同步更新并说明。

## 约束

- F06 padding-only 与 NOTE（heightmap 禁 vertical margin）是硬约束；块 widget（replace/widget 装饰）的间距规则与 line decoration 不同，plan 分清两类装饰路径分别处理。
- 标题底线若经 Decoration.line class 实现，属布局类装饰 → `EditorView.decorations` 直供规则适用。
- 与 5B（版心）同改 CSS 时注意合并收敛顺序（底线宽度依赖内容列宽，建议 5B 先行或同单元实施）。
- e2e 缝不可破坏；行为不变类任务需人工冒烟确认 UI 无回归。
