# 8D spec — 行内公式 hover 高亮（8.3 / ⑰）

> 看板任务：⑰ 8.3（`docs/markdown-ux-optimization.md` 实施优先级 P2 观感对齐）。
> 命名说明：看板原文「spec `8A` 内或独立」——8A（块级 hover 提示带）已并入 8B 一并收敛、无独立 spec 目录，本项取**独立** spec，续批次字母 `8D`。

## 背景 / 差距（what & why）

行内公式渲染为 `.cm-md-math-inline` widget 后**无任何 hover 反馈**（现仅 `padding: 0 2px`），用户无从得知「可点击进入源码编辑」；块级公式 8A 已有 hover 底纹 + chip 先例（`.cm-md-math-block:hover { background: var(--widget-surface) }`），行内缺位。

**What**：hover 行内公式时浮现**浅色底纹**（提示可点击编辑）；点击行为完全沿用 P09 mark 规则（`markTouched` 选区触碰即显源码）——纯视觉提示，零行为改动。

**Why**：可发现性对齐块级 8A；补上「行内公式 hover 提示」差距（基准截图未覆盖行内 hover，观感取同族块级 hover 先例，不发明新皮肤）。

## 决策

- **纯 CSS，零 TS**：`.cm-md-math-inline:hover` 加底纹 + 圆角；显隐契约（P09 `markTouched`）零触碰——CSS-only 即 AC2 构造性成立（8A/7G 先例，纯 CSS 零新测试）。
- **皮肤同族**：底纹用 `--widget-surface`（与 8A 块级 hover 同 token——F08 内容 widget 表面，非 chrome）；圆角 `--radius-sm`（行内尺度）；`cursor: pointer` 与 `.cm-md-math-block` 既有先例一致（「可点击」提示的组成部分）。
- **不加 chip**：任务点名「浅色底纹」为提示形态；块级 `公式 </>` chip 是块级专属（行内空间不足且任务未要求）——不发明（⑱ 规范再收口显隐时机）。
- **导出侧零改动**：hover 是编辑器态交互，静态导出无 hover 面（8A 同先例，`export-math-inline` 零触碰）。

## AC（可测试）

1. **hover 观感**：悬浮行内公式浮现浅色底纹（圆角、含既有 2px padding 呼吸区），移出即隐；深浅主题走 `--widget-surface` token（无裸色值、无 `.theme-dark` 补丁）。
2. **显隐契约零改**：选区/cursor 触碰行内公式仍显源码（P09 `markTouched`）；点击行为与改前一致；hover 纯 CSS 不改任何 TS 分支。
3. **红线**：class 名 `.cm-md-math-inline` 不改（e2e 缝/`detect.ts` 消费方零触碰）；导出侧零改动。

## Out of scope

- 行内公式 chip/编辑浮层（⑱ 块级 chrome 规范统一收口）；行内公式错误态提示（8C 管块级）；点击进入 8B 式双区编辑（块级专属，行内保持 mark 显源码语义）。

## 约束引用

1（e2e 缝）→ 纯 CSS 伪类，class 零改动；6（主题 token）→ 底纹走 `--widget-surface`，不新增 `.theme-dark` 补丁；9（单测纯函数）→ 零新逻辑零新测试（8A/7G 先例）。
