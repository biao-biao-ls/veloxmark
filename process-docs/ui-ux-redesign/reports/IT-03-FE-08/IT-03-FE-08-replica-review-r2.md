# UI 复刻评审报告（r2 · 第 1 次重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-03-FE-08 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-03/FE-08.md` |
| 评审时间 | 2026-10-02 00:36 |
| 评审轮次 | r2（第 1 次重评；r1 于 2026-09-30 23:41 输出） |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-08/IT-03-FE-08-impl.png`（折叠态主图；`IT-03-FE-08-impl-folded.png` 与之 md5 一致 `412e11c8…`；辅证 `IT-03-FE-08-impl-expanded.png` 展开态） |
| 实现图 mtime | 2026-10-01 17:26（**晚于 2026-10-01 12:00，判定为当前态**，涉近期修复项直接采信本图） |
| 设计图 | 设计稿为 `.html`，按取稿规则 Read HTML 源直读（未产出 `design.png`，见「取稿与读图备注」） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_06_render_zone.html`（区块 E · 长引用折叠） |
| 页面路径 | 正文渲染区 · 长引用折叠（ui_06 区块 E） |
| 补充取证 | `reports/batch-B/batch-B-quote-folded.png`、`batch-B-quote-expanded.png`、`batch-B-verify-data.json`（批 B 引用面修复证据，2026-10-01 12:27–12:28）；`reports/IT-03-FE-02/shots/batch-f-qf-expanded-node.png`（批 F quoteFolds 节点补证，存储面）。注：`reports/IT-03-FE-08/shots/` 目录**不存在**，本任务无 shots/ 补证帧 |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 1 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 1 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **2** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。r1 全部 5 项已逐项标注处置（见下节）。

---

## r1 逐项标注（收敛 / 残留 / 新证据）

r1 报告：`IT-03-FE-08-replica-review.md`（5 项）。逐项结论：

| r1# | r1 事项 | 裁决（Step 3.2） | r2 证据 | 标注 |
|---|---|---|---|---|
| 1 | 展开态引用正文色 `#6b6b6b` vs 设计 `.md-quote p { color: var(--fg) }` = `#333333` | 必修（批 B） | 新实现图展开态正文核心墨色实测 **`#333333`**（暗像素 2089 点，LCD 亚像素边缘色如 `#336cb2`/`#b26c33` 为抗锯齿混色不计）；批 B DOM 断言 `S3 引用正文色 = --fg`：`color: "rgb(51, 51, 51)"`，ok=true | **收敛** |
| 2 | 引用竖线 4px vs 设计 `border-left: 3px` | 必修（并批 B） | 新图竖线实测 x=312–315：核心 2px 实心 `#d0d7de` + 两侧半覆盖 AA 列 `#ebeef1`（偏移量 20/47 ≈ 半像素），有效宽 ≈ **3px**；批 B DOM `borderLeftWidth: "3px"`、色 `rgb(208,215,222)`= `#d0d7de`，ok=true。1px/1.5px 边框光栅化伪影按全局口径不判 | **收敛** |
| 3 | 摘要尾标「6 行」vs 设计「（共 4 段长引用已折叠）」 | **豁免**（AC-FN-16「N 行」口径，勿重开） | 新图尾标仍为「6 行」（=全块 6 源码行，implementation-notes 定稿 N=全块源码行数），口径未变 | **豁免维持**（非残留必修；勿重开） |
| 4 | 折叠摘要行内 caret 左侧 1px×28px 浅灰竖线（疑光标残留/多余装饰） | 核对（批 B） | 新图折叠行 y=435–465 全列扫描：caret（x=335–339）左侧仅合法 quote 边框（x=312–315），**无 1px 残线**；批 B `S5 摘要行无二次边框（border-left 0，残线排除）` + residueProbe 仅命中 `cm-md-quote` 的 3px 合法边框，ok=true | **收敛** |
| 5 | 展开态折叠入口 caret 在首行行尾 vs 元素表「引用块右上」 | 必修（批 B） | 新图展开态 caret `▾` 实测 x=1095–1099、y=423–427：贴 quote 行盒**右上**（距顶 ≈4px、距右缘 ≈8px），字形 `▾` 向下（指向可折叠）；批 B DOM `S4`：`position: absolute; top: 4px; right: 8px`、`distFromLineRight: 8, distFromLineTop: 4`，「caret 贴引用块右上（距右缘 ≤24px、距顶 ≤12px）」ok=true | **收敛** |

**r1 清单结转**：0 残留 / 1 豁免维持 / 4 收敛。r1 未列、本轮新发现 2 项（下表 N1–N2）。

---

## 未对齐点清单（按区域分组）

### 折叠态 · 引用块容器（摘要行外框）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| N1 | Important | 折叠态引用块/左边框的整体高度 | `.quote-folded` 紧凑单行：`padding: 4px 16px` + `line-height: 1.6 × 13px = 20.8px` → 总高 **≈28.8px**，`border-left: 3px` 贴此行高 | 摘要行本体 DOM 高 **28.8px 与设计精确一致**（批 B S5 row: top 433.97 → bottom 462.77），但可见 3px 竖线/容器高 **80px**（y=408–487，两态图与批 B 三图一致）；摘要文字墨迹仅居中占 442–454，上下各约 26px/24px 空白（≈各一条 25.6px 空行盒） | 折叠后块高未收拢到摘要行：外框较设计多出约 **51px（≈2 条空行盒）**，视觉上「折叠了但块仍留白一段」。28.8+51.2=80.0 与「摘要行 + 2 条残留源行行盒」吻合（机制推断，非实证） | 排查 quoteFold replace 装饰的替换范围是否漏收首/末行行盒（或折叠 widget 外层 `cm-md-quote` 行盒残留）；目标：`border-left` 所贴容器高 ≈28.8px，与 `.quote-folded` 行一致。注意本项属折叠态整体几何，是否被 AC-FN-16「观感豁免」覆盖由主 agent 裁定 |
| N2 | Minor | 引用块（含展开态/短引用）上下内边距 | `.md-quote` / `.quote-folded` `padding: var(--space-1) var(--space-4)` = **4px** 16px（竖直 4px） | 竖直 padding ≈ **0**：1 行短引用边框实测 26px（=1×25.6px 行盒），6 行展开引用边框实测 154px（=6×25.6px 行盒），均恰为纯行盒高、无 4px 上下留白（水平 16px 已对，r1 已过） | 上下各少 4px（合计 8px）留白，引用块顶/底与边框端点几乎贴字 | 若 CM6 行盒容器不承载竖直 padding，可在装饰层给首/末行补等效留白，或与设计确认「行盒贴边」口径后登记 change-log；两态一致，属全局引用样式面（markdown.css 一带），与批 B 同文件面一次修 |

### 长引用折叠入口 / 摘要行 / 展开还原（本轮复核全对齐，无未对齐项）

- **结构**：折叠态行内序 `▸ caret → 摘要 → 尾标 → 展开还原` 与设计 `.quote-folded` flex 序一致；展开/折叠两态在实现图集中均可见（UI-IXD-14 两态可辨）。
- **元素存在性**（任务页面元素表 5 行）：引用块本体（两态）／折叠入口（展开态右上 `▾`、折叠态摘要行左侧 `▸`）／摘要行（`「首行」` 包装）／展开还原入口／存储面（无 UI，图上不可验）——全部在场。
- **文案逐字**：`▸ 展开还原` 与设计逐字一致；摘要 `「架构评审结论：实时预览装饰引擎维持 viewport 级收敛方案不动摇。」` 与设计样例同源文案一致（设计稿 `……」` 省略号系样例文本超宽所致，实现 text-overflow 仅溢出才出省略号，批 B 长首行夹具已见 `……」` 截断模式；不判文案偏差）。
- **样式精测（新图像素 + 批 B DOM 互证）**：摘要文字色 `#333333` = `--fg`；尾标 `6 行` 色 `#6b6b6b` = `--fg-dim`（继承 `.quote-folded`）；展开还原色 `#0969da` = `--accent` 精确一致；caret 色 `#6b6b6b` = `--fg-dim`；竖线色 `#d0d7de` = `--quote-border` 精确一致；摘要字号墨迹高 13px = `--text-ui: 13px`；摘要行高 28.8px = 设计 4+20.8+4 精确一致；caret→摘要 gap ≈8px（含 18px caret 盒半宽）= `--space-2`。
- **折叠入口字形**：折叠态 `▸`（右向，指向摘要）、展开态 `▾`（下向，指向可折叠），与设计 fold-caret 语义一致。
- **阈值边界**：≤5 行短引用（「短引用内容一行。」/「短引用第一、二行」）两态均无折叠入口，符合 `QUOTE_FOLD_LINE_THRESHOLD=5` 判定。
- **摘要尾标 N 值**：「6 行」= 全块 6 源码行，与 implementation-notes 定稿一致（「（共 4 段…）」措辞差已豁免登记，勿重开）。

---

## 取稿与读图备注

- **设计稿类型**：`.html`（`docs/requirements/ui-ux-redesign/ui/ui_06_render_zone.html` 区块 E：`.md-quote` / `.quote-folded` / `.quote-summary` / `.quote-restore` / `.fold-caret` 规则 + 展开/折叠两态标记结构）。
- **取稿方式**：Read HTML 源直读（CSS 变量 + 规则 + 结构）。调用方明确禁止启动浏览器，故未渲染产出 `design.png`（fail-closed 仅适用设计稿取不到——本稿存在且成功读取，不触发）。token 真源：`--fg #333333` / `--fg-dim #6b6b6b` / `--accent #0969da` / `--quote-border #d0d7de` / `--space-1 4px` / `--space-2 8px` / `--space-4 16px` / `--text-ui 13px`。
- **读图方式**：Read PNG 直视 + PIL 像素采样/量测（ASCII 位图定位字形、列扫描测边框宽高、暗像素直方图测文字色）；实现侧样式值均自像素/批 B DOM 证据推断，未 Read 任何 `.ts/.css` 实现源。
- **取证纪律执行**：三张 impl 图 mtime 均 2026-10-01 17:26（>10-01 12:00 阈值）→ 当前态直采；`impl.png` 与 `impl-folded.png` md5 相同（同一折叠态帧）；批 B 三份引用面证据（12:27–12:28）与新图结论互证一致。凡视觉读数与像素冲突一律采信像素。
- **图源存疑项**：无。
- **双态取材**：主图折叠态（摘要行 + 短引用对照 + 展开还原入口）；展开态 6 行原文 + 右上 `▾` 入口以 `impl-expanded.png` 交叉印证；批 B 双图（长首行截断夹具）补充「溢出省略号」模式证据。
- **不可验项**（静态图无法核对，未列入未对齐点）：
  - title 属性：折叠入口「折叠本节」/ 展开还原入口「展开还原完整引用」（task doc-drift 已登记：restore 文案冻结为 FE-01 `render.fold.restore=「展开还原」`）；
  - 点击折叠/展开交互、quoteFolds localStorage 读写、跨重启恢复、.md 零字节差异（frontend-dev 自测 62/62 + 批 B 交互断言已覆盖，静态评审不重复开列）；
  - hover 态（`.fold-caret:hover` / `.quote-restore:hover` 背景 `--accent-soft`）——深色/hover/行为态缺口按口径列账不判偏差（Phase 2 复核）。
- **口径冲突说明**（沿 r1，不重开）：任务目标段「N=折叠隐藏行数」与 implementation-notes「N=全块源码行数」冲突，实现与后者一致，按定稿口径不判偏差。
- **设计稿 chrome**：区块 E 的「长引用 · 展开态/折叠态」h3 标题、state-chip、hint-inline、旁注为原型标注，不在应用复刻范围。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图/多帧视觉对比与任务「页面元素」表核对产出，为 r1 之后的第 1 次重评。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本报告除外）。不打总分、无 PASS/FAIL；未对齐点严重度仅作主 agent 判断参考。
