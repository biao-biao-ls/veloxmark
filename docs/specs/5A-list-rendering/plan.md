# 5A 列表与任务列表渲染修复 实施方案

## 技术决策与理由

**根因链（截图放大 + 代码核实，2026-09-23）**：

1. **深度缩进全灭**：`.cm-md-list-dN` 的 `padding-left`（markdown.css，特异度 0,1,0）被 `editor/theme.ts` 两个主题的 `.cm-line { padding: 0 var(--editor-gutter) }`（`.ͼX .cm-line`，0,2,0）压制——**与 F03 callout 已记载的坑完全同源**。d2–d6 的 24px 阶梯是死规则；d1 本来就没有 `padding-left`（第二处缺陷）。
2. **圆点错位**：`.cm-md-list::before` 绝对定位常量 `left: 34px`，假定文本起点在 40px（死掉的 d2 值 16+24）。实际文本永远从 16px 起排 → 圆点压在文字上：CJK 墨色掩蔽（"实时预览编辑" 看似干净）、拉丁文显形（放大图 "M●ermaid"）、任务行贴在复选框后（放大图 "☑•打开文件"——评估阶段误读的 `+•` 残渣即此圆点 + 复选框边缘）。
3. **任务行不该有圆点**：Typora 语义是 checkbox 取代 bullet；现状 checkbox 后还挂着 `::before` 圆点。
4. **有序列表会显圆点**：`::before` 恒为 `content: '•'`（样稿未覆盖，AC1 补齐项）。

**决策**：

- **D1 缩进走 F03 先例提特异度**：`.cm-editor .cm-line.cm-md-list`（0,3,0）单条规则设 `padding-left: var(--list-indent)`；每深度类只携带 `--list-indent`（d1–d6 = 1.5em 起步、每级 +2em，em 基准随字号——同文件 heading 阶梯已有 em 先例）。d1 补基缩进是修复不是调参。
- **D2 圆点挂进悬挂区**：`::before { left: calc(var(--list-indent) - 1.5em) }`，废除 34px 常量。文本起点 = `padding-left` 边缘 → 多行悬挂缩进天然对齐（marker 已被 hide，无双重占位）。hide 范围 `line.from → end`（含嵌套行首缩进空格）**保持不变**——缩进完全由 CSS 提供，源码缩进空格本就要藏。
- **D3 任务行去圆点**：`enterTaskMarker` 追加 line class `cm-md-task-item`，CSS `::before { content: none }`。checkbox 置于文本起点（现状行为不变），与 Typora「checkbox 在悬挂列」的差异记为已知偏差（AC4 不含此约束）。
- **D4 有序编号 build 期计算**：`enterListMark` 判定 ordered（ListMark 文本匹配 `/^\d/`）后，数同 List 父下前序 ListItem 兄弟得 n，line decoration 携 `attributes: { 'data-vm-n': String(n) }` + class `cm-md-list-ol`；CSS `content: attr(data-vm-n) '.'`。**不用 CSS counters**——CM6 扁平行 DOM（所有 `.cm-line` 平铺在 `.cm-content` 下）无法按嵌套 List 边界 reset 计数器；装饰每次 doc change 重建，build 期重编号成本可忽略。
- **D5 导出零同步面**：`export/renderDoc/listTable.ts` 渲染原生 `<ul>/<ol>/<li>`（浏览器自编号），不消费 `cm-md-list*` class——3C 平行契约注释点名的 class 契约清单（image-ext/callout/inlineStyles）不含列表，确认不动。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/livePreview/handlers-tree.ts` | `enterListMark`：ordered 判定 + `data-vm-n` + `cm-md-list-ol`；d-class 携带 `--list-indent` 语义不变。`enterTaskMarker`：追加 `cm-md-task-item` line class |
| `editor/livePreview/handlers-ctx.ts` | 新增纯函数 `orderedListIndex(node, state): number`（前序 ListItem 兄弟计数 +1），入 BuildCtx 共享工具区 |
| `styles/markdown.css` | 列表区（L194–227）重写：特异度修复（D1）、圆点定位（D2）、ol 编号（D4）、任务行抑制（D3）、`.cm-md-list-open` 语义保留 |
| `editor/livePreview/build.test.ts` | 快照更新 + 新用例：ol 重编号（`1. 1. 1.` → 1/2/3）、任务行 class、嵌套 dN 缩进 class |

不动：`widgets-extended.ts`（TaskWidget 行为契约原样）、`handlers.ts` barrel、`build.ts`。

## 状态/契约归属

- 无模块可变状态。`orderedListIndex` 纯函数无状态。
- **P09 显隐语义是行为契约**：`markTouched` 判定、hide 范围、`cm-md-list-open` 抑制逻辑一字不改。
- class 契约 `cm-md-list*` / `cm-md-task*` 为 livePreview 私有；e2e 缝（`window.__velox*`、命令 id）零触碰。

## import 改动面

- `handlers-tree.ts` → `handlers-ctx.ts` 新增 `orderedListIndex` import（既有 import 面内追加，下游 `build.ts` 经 barrel 零改动）。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | CSS 重写：特异度修复 + 缩进阶梯 + 圆点挂悬挂区（D1/D2） | — |
| T2 | 任务行去圆点：`enterTaskMarker` line class + CSS（D3） | T1（同 CSS 区） |
| T3 | ol 重编号：`orderedListIndex` + `data-vm-n` + CSS（D4） | T1 |
| T4 | build.test 快照更新 + ol/task 新用例 | T2, T3 |

顺序执行（T1–T3 共用 markdown.css 列表区与 handlers-tree.ts，不做 [P] 并行）。

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 快照 diff 逐行核对（预期：list line class / attributes 变化，hide 范围不变）
- 新单测：`orderedListIndex` 纯函数（嵌套/续行/有序无序混排）+ 快照覆盖任务行
- e2e 缝核验：无命令 id / `__velox*` / `data-op` 改动（本单元纯 CSS + 装饰 class）
- 人工冒烟：样稿 `D:/Downloads/untitled.md`——圆点不压字、嵌套缩进、任务 checkbox 无残渣、勾选/取消、光标进列表行回到源码 marker（P09）、有序列表 `1. 1. 1.` 显 1/2/3、暗色主题
