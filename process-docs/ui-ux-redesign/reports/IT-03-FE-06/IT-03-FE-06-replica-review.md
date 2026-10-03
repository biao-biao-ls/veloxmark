# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-03-FE-06 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-03/FE-06.md` |
| 评审时间 | 2026-09-30 23:23 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-06/IT-03-FE-06-impl.png` |
| 设计图 | 未生成 design.png（见「取稿与读图备注」）；设计稿源直接读取 |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_06_render_zone.html`（区块 C · 列表与任务项微操作） |
| 页面路径 | 正文渲染区 · 列表与任务项微操作（ui_06 区块 C） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 2 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 4 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **6** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 列表行 · hover 态样式

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | hover 行左侧 accent 内嵌条 | `.li-row.is-hover`：`box-shadow: inset 2px 0 0 var(--accent)`（#0969da 2px 左缘条，叠在 --bg-inset 底上） | hover 行仅见 #f2f2f2 底（像素实证：行底 x70–869 纯 #f2f2f2，左缘 x70–71 无任何蓝色像素；全图 accent 像素仅把手 x48–65 一处） | hover 态左缘强调条缺失 | hover/拖拽目标行补 inset 2px accent 左缘条 |
| 2 | Minor | hover 行块指标（行高/圆角） | `.li-row`：padding 4px 8px、border-radius 3px（--radius-sm）、line-height 1.6×16px，行高约 34px | hover 高亮带 y278–303 共 26px 高、四角直角、横向满铺内容区 | 行高偏矮约 8px、无 3px 圆角 | 按 li-row 指标调整 hover 高亮盒；或接受编辑器行高口径并在自测报告登记差异声明 |

### 任务列表 · 勾选框

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 3 | Important | 勾选框尺寸 | `.task-box`：16×16px | 13×13px（像素实证：已勾选 accent 填充 bbox x110–122 / y261–273；未勾选边框 bbox x110–122 / y312–324） | 边长短 3px（约小 19%） | 勾选框改为 16×16 |
| 4 | Minor | 未勾选框边框 | 1.5px solid var(--fg-dim)（#6b6b6b） | 约 1px、#767676（像素实证：边框纯色 118,118,118） | 边框略细、灰度略浅（#767676 vs #6b6b6b） | 边框加粗至 1.5px 并使用 fg-dim #6b6b6b |

### 任务列表 · 完成态文本

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 5 | Minor | task-done 删除线范围 | `.task-done`：line-through 与文本等宽（text-decoration-color #b0b0b0） | 文本起点 x134，删除线自 x128 起左伸约 6px 悬空短横（像素实证：y265 删除线 run x128–211，首字形 x134 起） | 删除线左端超出文本约 6px | 核对完成态装饰 range 是否多含前导空白/标记残留，使删除线与文本等宽 |

### 列表行 · 静息/占位形态

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 6 | Minor | 静息把手占位 | `.drag-handle.is-idle`：透明底 + #b0b0b0 淡灰 ⠿（保留 18×22 占位防布局抖动） | 静息行完全无把手像素（gutter x30–80 全图仅 hover 行一处把手） | 与设计稿占位形态不同；但与任务「页面元素」表口径「静息不渲染（is-idle aria-hidden）」一致 | 主 agent 可判无需修复；若需严格复刻设计稿，可在静息态放 aria-hidden 占位（不渲染可交互把手） |

---

## 已核对一致项（供主 agent 参考，不计入未对齐点）

- 行首拖拽把手：18×22px、底色 #0969da（= --accent 精确一致）、白色 ⠿ 点阵、圆角小块；右缘距 hover 行左缘 4px，与设计稿 `margin-left:-22px` + 宽 18px 的几何完全吻合（像素实证 bbox x48–65 / y279–300）。
- hover 行底色：#f2f2f2 = --bg-inset 精确一致。
- 已勾选框填充：#0969da 精确一致，内含白色 ✓。
- 完成态文本样式：文字 #6b6b6b（= --fg-dim）、删除线 #b0b0b0（= --fg-disabled），与 `.task-done` 完全一致。
- 未勾选框内底 #ffffff（= --bg）；两态（已勾选/未勾选）并存可见。
- 文案 ④：区块 C 产品可见文案仅 title「拖拽排序」（tooltip，静态图不可见）与 toast（不可见）；实现图中文本均为 .md 夹具文档内容（review PRs / write docs 等），与设计稿示例文案（「梳理渲染区四项高收益交互的目标态」等）属文档数据差异，非 UI 文案偏差，不列未对齐点。

## 静态图不可核验项（建议走功能自测/QA 通道确认）

| 项目 | 原因 |
|---|---|
| 插入位置指示线（2px accent 线） | 仅拖动过程可见，实现图为静息截图 |
| toast「已移动列表项（Ctrl+Z 可撤销）」/ 勾选不回 toast | 静态图无 toast |
| 单例列表把手灰显不可拖（only-item 行） | 截图 hover 落在任务行，单例行未 hover |
| 普通 bullet 列表行 hover 浮现把手 | 截图把手浮现在任务行；bullet 行未 hover |
| 拖动 ghost、落位后顺序调整、一步 undo、只读拦截 | 均为行为，非静态视觉 |
| title「拖拽排序」tooltip | hover tooltip 未在截图呈现 |

---

## 取稿与读图备注

- 设计稿类型：html（`ui_06_render_zone.html` 区块 C，含完整 CSS token 与组件样式定义）。
- 取稿方式：Read 直接读取 HTML 源（精确样式值：`--accent:#0969da`、`--bg-inset:#f2f2f2`、`--fg-dim:#6b6b6b`、`--fg-disabled:#b0b0b0`、`--radius-sm:3px`、`--space-1:4px`、`--space-2:8px`、`--text-body:16px`）。
- 读图方式：Read PNG（918×479）视觉读图 + 对实现图做只读像素取样（取色/bbox 测量，未落盘任何中间文件）以确认尺寸与色值证据。
- 备注：
  1. 调用方明确禁止写入评审报告以外的任何文件，故未按 skill 常规产出 `{任务ID}-design.png`；设计稿以 HTML 源路径作为对比基准（HTML 自带完整样式，精度高于截图）。
  2. 实现图为真实编辑器夹具文档截图（嵌套 bullet 列表 + 任务列表 + 单例行 + 段落），非设计稿的静态演示面板；结构对比以「UI 原语（列表/任务列表/把手/勾选框/完成态）」为口径，夹具文案与嵌套层级差异不判偏差。
  3. 设计稿中 `state-chip`（「hover」「未完成」）、`hint-inline`、`zone-note` 为原型标注件，非产品 UI，不要求实现，未计入缺失项。
  4. 未对齐点 #1/#3/#4/#5 有像素级实证（取样坐标已写入实现值列）；#2/#6 为视觉/几何推断，供主 agent 参考。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。
