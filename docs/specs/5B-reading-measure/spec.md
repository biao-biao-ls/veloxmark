# 5B 阅读版心与行号（任务 5.2 + 5.3）

## What / Why

① 正文改为**居中窄栏**阅读版心（Typora 书写排版的分水岭：像 Typora 还是像 IDE 编辑器）；② 行号默认关闭，去掉阅读态持续噪声。当前正文贴行号槽起排、几乎通栏（约 1590px），中文长行可读性差；行号 + 空行编号构成左侧持续视觉噪声。

## 背景与现状

- 版心机制碎片化：token `--editor-max-width`（`styles/tokens.css` L59，默认 `100%`）+ 偏好 `editorMaxWidth`（`preferences/store.ts` L127 默认 800；`applyPreferencesCssVars` L344–356 runtime 写入，0 → `100%`——4.1 决议知情豁免）。但消费点只有块 widget（`styles/markdown.css` L736 `.cm-md-table-wrap`、`styles/code-chrome.css` L57、`styles/ext-syntax.css` L62 等），**正文 `.cm-line` 无 max-width、无居中**——文字通栏而块 widget 限宽 800px，两列还不对齐（评估新发现）。
- 行号：`editor/setup.ts` `gutterCompartment`（L42–43 / L88–89）+ 偏好 `showLineNumbers` 默认 `true`（`preferences/store.ts` L131）；fold gutter 在行号左侧（F06 注释）。
- 截图症状：正文自 x≈295 起通栏约 1590px（Typora 居中约 1150px）；行号槽含空行编号（2/4/6/…）持续噪声。

## 验收标准（AC）

1. 全部正文行（段落/标题/列表/空行）位于同一**水平居中**内容列，列宽受 `editorMaxWidth` 偏好控制。
2. 全部块 widget（表格/代码/公式/mermaid/callout/图片/front-matter 等）与正文同列同宽对齐（F05 契约保持）。
3. `editorMaxWidth > 0`：列宽 = 该像素值；`editorMaxWidth = 0`：**已决（2026-09-23）**= 软上限 `min(90%, 1200px)` + 居中（用户拍板）。
4. 行号默认不显示（`showLineNumbers` 默认值 `true` → `false`，**行为变更**）；偏好可开，开启时 gutter 与内容列相对位置正确（F06 契约：number-right → prose-left = `--editor-gutter` 保持）。
5. 写作模式（typewriter/focus）、编辑器内查找面板、表格单元格内嵌编辑器布局不回归。
6. 深浅主题正常；窗口缩放 / 侧栏调宽后内容列仍居中。

## 约束

- `applyPreferencesCssVars` 的 runtime inline 写入是宪法知情豁免（4.1 决议），不扩大到其他 token。
- F05（块 widget 与正文同列）/F06（gutter 对齐、heading padding-only 阶梯）注释契约不得破坏。
- 涉及 line decoration 的布局改动遵守「禁 vertical margin」NOTE（`styles/markdown.css` L8–13，CM6 heightmap 坐标映射）。
- `showLineNumbers` 默认值变更属行为变更：收敛记录注明 + 人工冒烟（偏好开关来回切、重启保持）。
- e2e 缝不可破坏（含 P03 偏好切换行号路径 `toggleLineNumbers` / `gutterCompartment`）。

## ~~[NEEDS CLARIFICATION]~~ 已决（2026-09-23，用户拍板）

`editorMaxWidth = 0` = 软上限 `min(90%, 1200px)` + 居中（方案 A：任意窗口宽度下保持可读行长，最接近 Typora 观感）。实现落点见 [plan.md](plan.md) D1。
