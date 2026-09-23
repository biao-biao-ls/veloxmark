# 5A 列表与任务列表渲染修复（任务 5.1）

## What / Why

恢复列表的视觉体系——marker（无序圆点 / 有序编号）、悬挂缩进、嵌套层级缩进——并清除任务项复选框后的 `+•` 残渣字符。列表占样稿近半版面，当前渲染成裸文字行，是与 Typora 观感的头号单项差距；`+•` 残留是明确渲染缺陷而非风格差异。

## 背景与现状

- 机制已存在但输出不达预期：
  - `src/renderer/src/editor/livePreview/handlers-tree.ts` `enterListMark`（L169–194，P09 显隐规则：光标在 marker/缩进上显源码 marker + 抑制 CSS 圆点，否则 hide + CSS `::before` 圆点）、`enterTaskMarker`（L305–318，`TaskWidget` 替换 `[x]`）
  - `src/renderer/src/styles/markdown.css` `.cm-md-list::before`（L194–227，`content:'•'` 绝对定位 `left:34px` 固定常量）、深度类 `cm-md-list-d1`–`d6`（L205–224，**d1 仅 `padding-top`，d2 起才有 `padding-left` 阶梯**）、`.cm-md-list-open::before`（L226，`content:none` 抑制）
- 截图症状（`temp/veloxmark/veloxmark-1.png` ↔ `temp/typora/typora-1.png`，2026-09-23，光标不在列表行）：
  1. 顶层列表项无圆点、无悬挂缩进，与段落同起排（对照 Typora：实心圆点 + 缩进）
  2. 嵌套任务子项与父项无缩进差（对照 Typora：层级缩进清晰）
  3. 任务项复选框后出现 `+•` 残渣字符（`☑+•打开文件`）
- 根因未锁定：`::before` 绝对定位常量、d1 缺 `padding-left`、hide 与 open 抑制条件交互、`TaskWidget` 替换范围遗留字符均可疑——定位与修法属 plan 阶段内容。

## 验收标准（AC）

1. 无序列表预览态渲染实心圆点 marker；有序列表渲染**连续编号**（视觉重编号，与 Typora 一致）；光标进入 marker/缩进时回到源码 marker 且 CSS marker 被抑制（**P09 语义不变**）。
2. 列表项悬挂缩进：多行文本对齐文字起点而非 marker。
3. 嵌套层级每级缩进视觉可辨（约 2ch/级），任务子项相对父项正确缩进。
4. 任务列表：复选框前后无任何残渣字符；点击勾选/取消勾选行为不变。
5. 深浅主题下 marker/复选框配色跟随 token，无硬编码色。
6. `build.test.ts` 装饰快照若输出变化，同步更新并在收敛记录说明变化点。

## 约束

- P09 marker 显隐规则是行为契约，不改语义。
- Decoration 规范（Constitution）：改变行布局的装饰走 `EditorView.decorations` 直供并正确 `map(tr.changes)`；装饰计算限 viewport；replace 超 1 字符同步 `atomicRanges`。
- 导出侧列表渲染（`export/renderDoc/listTable.ts`）与 livePreview 是手工平行实现：若动 class 契约或 marker 语义须双处同步（见 `export/renderDoc/index.ts` 文件头平行契约注释）。
- 单测只测纯函数，禁止在单测里渲染 widget（Constitution）。
- e2e 缝不可破坏：`window.__velox*` 系列、命令 id 字面量；`TaskWidget` 落点 `widgets-extended.ts`。
- 改色必查主题色 4 处副本（本任务预期不改色，走既有 token）。
