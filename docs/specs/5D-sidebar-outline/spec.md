# 5D 侧边栏大纲精致度（任务 5.6）

## What / Why

大纲是阅读导航主视图。补齐层级缩进缺失（多级标题零缩进、层级不可辨），hover/active 质感对齐 Typora 大纲（缩进层级 + 当前项强调 + 细字号浅色），提升侧栏整体精致度。

## 背景与现状

- `src/renderer/src/components/Outline.tsx`（L15–40）：`outline-item outline-l{level}` + `outline-active` + 折叠钮 `outline-fold`（P18）。
- 样式在 `styles/chrome.css` L328–358：item 基础 / `:hover`（`--code-bg`）/ `.outline-active`（`--accent` + 600）已有；**层级类只有 `outline-l1`（L354，仅 `font-weight: 600`），`outline-l2`–`outline-l6` 无任何样式**——多级标题零缩进，层级不可辨（评估新发现，截图文件树模式未直接暴露，大纲模式已核实）。
- 截图对照（Typora 大纲 Tab）：清晰的标题缩进层级、当前项加粗、细字号浅色、与「文件」Tab 统一质感；VeloxMark 侧栏（文件树模式）行距紧凑、缺 hover 层次感，整体偏平。

## 验收标准（AC）

1. 大纲项按标题级别缩进（H1 起排，每级约 12–16px / 一个 `--space-*` 档），六级层级一眼可辨。
2. 当前标题项 active 强调保留（加粗 + 强调色或 Typora 式左侧强调），滚动跟随切换 active 无抖动。
3. hover 反馈、折叠钮状态（P18 三角）与文件树 hover 质感一致。
4. 长标题省略号截断（现状 nowrap + ellipsis 已有）并有 `title` 提示全文（现状无则补）。
5. 空态文案 `outline.empty` 保持 i18n 双字典同步纪律（如新增 key 必须 en+zh 同加）。
6. 深浅主题正常。

## 约束

- i18n 纪律：新 key 同加 `i18n/en.ts` + `i18n/zh.ts`（Constitution）。
- 样式落 `styles/chrome.css` 大纲区（或 plan 决定的分区）；间距/圆角用 `--space-*`/`--radius-*`，不写裸 px 新值。
- P18 折叠交互契约不变；e2e 缝不可破坏。
- 行为不变类：人工冒烟大纲点击跳转、折叠/展开、滚动跟随、active 切换。
