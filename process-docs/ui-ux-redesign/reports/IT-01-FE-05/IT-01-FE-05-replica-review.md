# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-05 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-05.md` |
| 评审时间 | 2026-09-30 21:17 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-05/IT-01-FE-05-impl.png`（另有辅证图 `IT-01-FE-05-overlimit-matrix.png`） |
| 设计图 | 无 PNG（html 型设计稿，见设计稿源；取稿方式为 Read html 精确值） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（主稿，⊞ 网格选择器区域） |
| 页面路径 | 表格编辑视图（⊞ 网格选择器浮层） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 1 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 3 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 2 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **6** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。#1（行上界 12 而非 20）为本任务核心行为（AC-RULE-12）的视觉证据冲突，建议优先核实；#3（读数后缀）存在任务/mock 契约冲突，行内已注明。

---

## 未对齐点清单（按区域分组）

### ⊞ 网格选择器 · 格点矩阵（核心）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Critical | 格点矩阵 · 行上界 | 任务元素表/AC-RULE-12「上界 max(20,R0)×max(12,C0) 动态渲染」→ 小表（R0=4~5×C0=3）应为 **20 行 × 12 列**（mock 示意 8×8 不作基准；列上界 12 已符合） | impl.png 矩阵读图实测 **12 行 × 12 列**：格距 24px（22px 格 + 2px 缝）band 精确计数，行/列各 12；矩阵区高约 286px（=12 行），下方 10px 即读数「5 × 4」，**无滚动条**（超限辅证图证明溢出时滚动条会正常显示，故主图无滚动条=内容仅 12 行） | 小表行上界渲染为 12 而非 20——若 DOM 走 `max(12,R0)`（或渲染未消费 `gridUpperBound` 的 maxRow）即得此形；与 self-test 单测结论「R0=5 → 20×12」冲突（单测测纯函数，DOM 渲染面可能未走同一上界）。超限图 25×15 正确，仅小表行维度不符 | 核对 gridPicker DOM 渲染循环的 maxRow 来源是否为 `max(20,R0)`（勿用 `max(12,R0)` 或固定 12）；修复后补一张小表 ⊞ 矩阵截图证明 20 行可选（全展或带滚动条），与 self-test §1 单测结论对齐 |

### ⊞ 网格选择器 · 浮层容器

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 2 | Important | 浮层外框 | `.grid-pop { border: 1px solid var(--border) }` = `#e5e5e5` 灰边 + `--shadow-pop`（ui_02 line 424-433） | 像素采样：浮层外缘 1px 纯 `#0969da`（--accent）描边，其内侧再叠 1px `#e5e5e5` 灰线（四边同形，超限图同） | 多出 accent 蓝外描边（设计稿开放态即为纯灰边框，无蓝描边） | 去掉 accent 外描边，收敛为设计稿 `1px solid #e5e5e5`；若该蓝描边是有意的 open/focus 态标识，则与 mock 对齐口径后记 CHANGE，或改为非边框通道（如阴影强化） |
| 6 | Minor | 浮层锚定位置 | `.grid-pop { position:absolute; top:0; right:var(--space-2) }`——锚在**表块右上**（ui_02 line 425-427；mock 工具栏亦为右上紧凑药丸） | 浮层锚在 **⊞ 正下方（表块左上）**（impl.png 浮层 x≈385-692，表块横跨 x≈380-1150） | 水平锚点与 mock 相反（右→左）；根源与 FE-01 已记录的工具栏布局偏差（右上紧凑药丸→通栏横条、⊞ 居左）同源牵连 | 任务元素表写「工具栏 ⊞ 下方浮层」，实现相对 ⊞ 关系正确；建议随 FE-01/FE-03 工具栏布局收敛一并处理（工具栏归位右上后浮层锚点自然对齐），不必单修 |

### ⊞ 网格选择器 · 尺寸读数

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 3 | Important（按 checklist ④ 可升 Critical，任务冻结可豁免） | 读数文案 | `<b>3 × 4</b> · 缩放整表`（ui_02 line 668） | 「5 × 4」（超限图「25 × 15」），无后缀 | 缺「· 缩放整表」后缀。**注意契约冲突**：任务页面元素表将读数文案冻结为「R × C」，实现符合任务冻结值；与 mock 差后缀属任务/mock 冲突而非实现走样 | 主 agent 裁定：若以 mock 为准→读数补「· 缩放整表」后缀；若以任务冻结「R × C」为准→维持现状并记 CHANGE（与 CHANGE-9 预设组同族），避免 QA 阶段按 mock 复验误判 |
| 4 | Important | 读数样式 | `.grid-pop-label b { color: var(--accent); font-weight: 600 }`——维度数字部分为 accent `#0969da` 加粗，后缀部分 `--fg-dim` 灰（ui_02 line 451-458） | 「5 × 4」整体 `--fg-dim`（像素采样 = `#6b6b6b`）灰、常规字重，无 accent 加粗部分 | 读数缺 accent 强调层，视觉层级弱于 mock（mock 中「R × C」是浮层内唯一 accent 文本焦点） | 「R × C」数字部分着 `--accent` + `font-weight:600`，若采纳 #3 补后缀则后缀维持 `--fg-dim` |

### ⊞ 网格选择器 · 选区/格点态

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 5 | Minor | 选区锚点格 | mock 选区统一 `.gcell.sel`（`--accent-soft-strong` 底 + `--accent` 边），无实心锚点态 | 拖选右下锚点格为**实心 `#0969da`**（像素采样确认），其余选区格为 soft-strong（≈rgb(197,218,243)，与 rgba(9,105,218,0.22) over white 吻合） | 多出实心锚点格状态（mock 未定义） | 若为拖选锚点/可辨性增强（服务 UI-ELEM-02「边界可辨」）可保留并记 CHANGE；否则统一为 `.gcell.sel` soft-strong 口径 |

---

## 取稿与读图备注

- 设计稿类型：html（`ui_02_table_edit.html`）
- 取稿方式：Read html 直读（精确 token：`--accent #0969da` / `--border #e5e5e5` / `--accent-soft-strong rgba(9,105,218,0.22)` / `--fg-dim #6b6b6b` / `--widget-surface #fafafa` / `--radius-sm 3px` / `--radius-md 8px` / `.gcell 22×22px gap 2px`）；html 型设计稿不出 design.png（与 IT-01-FE-01 同口径）
- 读图方式：Read PNG（`IT-01-FE-05-impl.png` 主图 + `IT-01-FE-05-overlimit-matrix.png` 超限辅证图）；关键色值/行数以像素采样与 24px 行距 band 计数交叉复核（选区几何二次验证：5 选中行 × 24px = 120px，占矩阵高 286px 的 12 行窗口）
- mock 口径说明（不计入未对齐点，任务已显式取代）：
  - mock 矩阵 8×8 为示意，任务 AC-RULE-12 取代为动态上界 max(20,R0)×max(12,C0)；
  - mock 设计标注「缩放上限 20×12 钳制」被任务取代（超限表自身行列可选 AC-ERR-13、缩到 1×1 允许 AC-OP-07）；
  - 4 预设按钮组（1×1 / 2×2 / 3×3 / 自动适应窗口）mock 无此组，按任务页面元素表 #3 落地（CHANGE-9 已溯源）——实现文案与任务逐字一致，位置（读数下方）正确，无 mock 样式基线可对照，不判偏差。
- 核验缺口（静态图无法核对，非确认性偏差）：亮格 hover 高亮态、拖选动态过程、toast 冻结文案「表格缩放为 R×C（Ctrl+Z 可撤销）」、一次 Ctrl+Z 还原——均为行为面，留 QA 阶段（AC-OP-07/UI-IXD-02）；深色主题浮层未入图（self-test §10 已自报）。
- 范围外观察（不计入分布）：超限图中表格工具栏呈「通栏横条、⊞/对齐钮居左、⋮/🗑 分居最右」——与 mock 右上紧凑药丸不符，已在 IT-01-FE-01 复刻评审 #1-#3 记录，不重复立单。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。
