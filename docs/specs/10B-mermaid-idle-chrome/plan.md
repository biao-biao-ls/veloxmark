# 10B 实施方案

## 技术决策与理由

- **静息态去盒 + hover 轻边框**（spec 决策）：`.cm-md-mermaid` 删 `background`、边框改 `1px solid transparent` 占位，新增 `.cm-md-mermaid:hover { border-color: var(--border) }`。`padding: 16px`/`text-align`/`overflow-x`/`cursor`/`position: relative`（badge/错误条锚点）全保留。
- **聚焦预览补盒**（两态分叉，修订 10A 假设）：`.cm-md-mermaid-preview` 追加 `border: 1px solid var(--border); border-radius: 6px; background: var(--bg);`（白底轻盒，`mermaid-focus.png` 基准）——`margin-top` 拼缝规则原样。
- **导出纯减法**：`.export-doc .export-mermaid` 删 `border`/`background`（margin/padding/text-align/overflow 保留）；`.export-mermaid-error` 不动。`inlineStyles.ts` 的 `export-mermaid` 条目本就无盒（WeChat 极简面），零改动。
- **CSS-only 零新测试**（7C/8A chrome 任务先例；无纯逻辑面）；门禁 = typecheck/test:unit 回归 + madge + 缝核对。
- **圆角 6px 沿用既有字面量**（不引入新值、不入 token——`--radius-*` 体系化归 ⑱/7H 收口，本项不扩面）。

## 文件切法

| 源 | 改动 |
|---|---|
| `styles/markdown.css` | `.cm-md-mermaid` 去底色/透明边框 + hover 轻边框规则；`.cm-md-mermaid-preview` 补盒 |
| `export/exportCss.ts` | `.export-doc .export-mermaid` 去边框/底色 |

## 状态/契约归属

零状态、零 widget、零 i18n。class 名全保留（e2e 缝零触碰）；P25 探针面不涉。

## import 改动面

零（纯 CSS/样式串）。madge 例行守护。

## 任务拆分

1. live CSS（两态分叉）[先行]
2. 导出 CSS [依赖 1]
3. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（全量回归）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动（class 名仅属性值变化）
- 人工冒烟（**待运行时冒烟补签**）：
  1. 静息态：图表直接落正文背景（对照 `mermaid-default.png`），无盒
  2. hover：轻边框浮现、零位移；click-to-source 不变
  3. 渲染中 placeholder / 更新中 badge / last-good dim / 错误条 + 跳转钮全不回退
  4. 聚焦双区：预览白底轻盒（对照 `mermaid-focus.png`）+ 源码面板拼缝
  5. 导出 HTML/PDF/复制富文本：图表无盒、错误条仍在
  6. 深浅主题两张对照

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 落地，无偏离：`.cm-md-mermaid` 删 `background`、边框改 `1px solid transparent` 占位 + `:hover { border-color: var(--border) }`；`.cm-md-mermaid-preview` 补轻盒（`--border` + 6px + `var(--bg)`）；`.export-doc .export-mermaid` 删 border/background 两属性。
- `inlineStyles.ts` 确认零改动（`export-mermaid` 条目本就无盒，WeChat 极简面）。
- CSS-only：零新单测（同 7C/8A 先例）；badge/错误条/placeholder/is-dim 规则零触碰。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：36 文件 / 339 例全绿（全量回归）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝核对：diff 内 class 名零改动（仅属性值/选择器增删）；`.mermaid-preview-*` P25 探针面、`data-op`/`__velox*` 零触碰 ✓
- AC1–5 逻辑路径核对全通；待运行时冒烟补签（6 点）：
  1. 静息态：图表直接落正文背景（对照 `mermaid-default.png`），无盒
  2. hover：轻边框浮现、零位移；click-to-source 不变
  3. 渲染中 placeholder / 更新中 badge / last-good dim / 错误条 + 跳转钮全不回退
  4. 聚焦双区：预览白底轻盒（对照 `mermaid-focus.png`）+ 源码面板拼缝
  5. 导出 HTML/PDF/复制富文本：图表无盒、错误条仍在
  6. 深浅主题两张对照
