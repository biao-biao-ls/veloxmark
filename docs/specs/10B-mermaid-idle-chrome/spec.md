# 10B spec — mermaid 静息态去边框盒（10.2 / ⑭）

> 看板任务：⑭ 10.2（`docs/markdown-ux-optimization.md` 实施优先级 P2 观感对齐）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/mermaid-default.png`：静息态图表**直接落在正文背景上**——无边框、无底色盒。VeloxMark 现状：`.cm-md-mermaid` 有 `1px 边框 + 6px 圆角 + var(--widget-surface) 灰底 + 16px padding` 的盒（差距表：「比 Typora 重一档」）。

**What**：静息态去边框/去底色（hover 时浮现轻边框作可点击提示）；导出侧平行契约同步。

**Why**：观感对齐基准；图表内容自绘形状（节点/连线），外层再套盒是双重框。

## 两态分叉决策（修订 10A「两态同改」假设，implement 前定）

10A plan 曾记「⑭ 去边框盒时两态同改」。核对基准后**修订**：两态基准本就不同——

- **静息态**（`mermaid-default.png`）：扁平（无盒）。
- **聚焦预览**（`mermaid-focus.png`）：预览区是**带轻边框的白底盒**（与源码面板灰底盒并列）。

故 `.cm-md-mermaid`（静息 wrap）去盒、`.cm-md-mermaid-preview`（聚焦预览，双 class）**补回轻盒**（border + radius + `var(--bg)` 底）。共享面其余不改：svg 缩放、`is-dim`、placeholder、badge、错误条/跳转钮（AC 明令不回退）。

## hover 轻边框（零位移）

静息态 `border: 1px solid transparent` 占位 + `:hover { border-color: var(--border) }`——边框浮现零布局位移（UX-P28 F3 精神）。否决「hover 才加 border-width」方案（2px 推挤）。

## AC（可测试）

1. **静息观感**：无边框/无底色盒（与 `mermaid-default.png` 对齐）；hover 轻边框浮现（零位移）；点击语义（click-to-source）不变。
2. **错误态/瞬态不回退**：`is-dim` last-good、placeholder（渲染中/空代码）、badge（更新中）、错误条 + 跳转钮全部原样。
3. **聚焦预览不回退**：`.cm-md-mermaid-preview` 保持轻盒（`mermaid-focus.png` 观感），与源码面板拼缝不变。
4. **导出同步**：`.export-doc .export-mermaid` 同步去边框/底色（HTML/PDF/复制富文本）；错误条样式不回退。
5. **双主题**：深浅主题观感不回归（透明→`var(--border)` 两主题均成立）。

## Out of scope

- badge 位置/文案、错误条皮肤（8C 已共享）、P25 底栏面板（`.mermaid-preview-*` 探针类名不触碰）。
- 图表 svg 自身主题色（mermaid 主题随 app theme 是既有行为）。
- 代码块/表格/公式盒（⑬⑮⑯ 另项）。

## 约束引用

1（e2e 缝）→ class 名零改动（仅属性值/选择器增删），`.mermaid-preview-*` 不触碰；3（Widget 纪律）→ 纯 CSS 零 widget 改动；5（i18n）→ 零 key；6（红线 6/token）→ 全 token（`--border`/`--bg`），无 `.theme-dark` 补丁、无裸 px 新值（6px 圆角沿用既有值——不引入新数值体系，⑱/7H 统一收口时再入 token）；CSS-only → 零新单测（同 7C/8A chrome 任务先例）。
