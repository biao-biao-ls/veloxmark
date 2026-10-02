# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-03-FE-03 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-03/FE-03.md` |
| 评审时间 | 2026-09-30 23:13 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-03-FE-03/IT-03-FE-03-impl.png`（864×73，列表行 hover 把手浮现态） |
| 设计图 | N/A（设计稿为 `.html`，按 skill 取稿表直读 HTML 源，未生成 design.png；见「取稿与读图备注」） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_06_render_zone.html`（主稿，区块 C 列表与任务项）、`D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_01_main_quiet.html`（交叉印证） |
| 页面路径 | 正文渲染区（render zone 全 hover 控件共用基座） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 1 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 4 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **5** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 列表与任务项（ui_06 区块 C）· 行首拖拽把手

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | 行首拖拽把手（浮现态）外形尺寸 | 18×22px（`.drag-handle` `width:18px; height:22px`，accent 底满铺） | 实测 13×21px（accent 色块 bbox x24–36 / y24–44） | 宽度 −5px（−28%），纵横比由 18:22 变 13:21，视觉明显偏窄 | 将把手块尺寸调至 18×22px（或收口到 `--handle-*` token 并取值 18×22） |

### 列表与任务项（ui_06 区块 C）· hover 行底色带

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 2 | Minor | hover 行左侧 accent 指示条 | `.li-row.is-hover` 有 `box-shadow: inset 2px 0 0 var(--accent)`（行左缘 2px `#0969da` 竖条） | 行左缘 x41–43 全高纯 `#f2f2f2`，整行范围无任何 accent 像素 | hover 态 accent 左缘指示条缺失（注：设计中该条大部分被把手压盖、仅上下露头，视觉权重低） | 给 hover 行加 2px accent 左缘 inset 条；若产品裁定不采用，回写设计稿/任务表豁免记录 |
| 3 | Minor | hover 行底色带圆角 | `border-radius: 3px`（`--radius-sm`） | 直角矩形（角像素 (41,24)、(840,24) 即纯色，无圆角 AA） | 3px 圆角缺失 | hover 行底色带加 `border-radius: var(--radius-sm)` |
| 4 | Minor | hover 行底色带盒模型（内边距/行高） | `.li-row` `padding: 4px 8px` + 16px/1.6 行盒 → 行盒高 ≈34px，行间距 `gap:2px`（行距节奏 ≈36px） | 底色带高 25px（y24–48，恰为行盒无垂直 padding），相邻行文字基线间距 25px（无行间 gap） | 垂直内边距 4px 未体现，行底色带矮 9px、行距节奏 25px vs ≈36px | hover 底色带补 4px 垂直 / 8px 水平 padding 并保留 2px 行间 gap；若应用「整行 line-box hover」为既定渲染样式，回写设计稿豁免 |
| 5 | Minor | 把手与行底色带相对位置 | 把手 `margin-left:-22px`，与行左缘重叠约 4px（把手压盖行底色带左缘） | 把手（x24–36）与底色带左缘（x41）间隔 5px 纯白，完全不重叠 | 把手与行底色带脱开，压盖关系与设计不一致 | 把手右移约 9px 使右缘压入行底色带 ~4px；若接受绝对定位 row-start 槽（位移 0px 优先）的实现形态，回写设计稿标注豁免 |

---

## 核对通过项（仅列结论，供主 agent 参考）

以下项经双图比对无偏差，未计入未对齐点：

- **① 结构**：实现图两行列表结构（hover 行 + 静息行）与 ui_06 区块 C 的 `.md-list` 双行演示结构一致；行内元素序「行首把手 → 圆点 bullet → 正文」与设计 `.li-row` 的 flex 序（drag-handle → li-bullet → li-text）一致。
- **② 元素清单**：行首拖拽把手浮现态存在且位于行首左侧（hover 行）；静息行（第二行）把手零残留（不渲染，符合任务表「静息不渲染（`is-idle` aria-hidden）」）；bullet 圆点存在；无半透明遮罩/残影残留；两行 bullet 对齐于同一 x（x58–61），符合设计把手负边距不挤占内容的布局意图。页面元素表第 1–2 行（图片/链接浮层显隐通道）与第 4 行（位移/残留守护）为状态机/时序行为，静态单帧无法核验，且任务阶段 1 明文约定实现图为「列表行 hover 把手浮现态」，未判缺失（见备注 3）。
- **③ 关键样式**：把手底色 `#0969da` = 设计 `--accent` 精确一致；hover 行底色 `#f2f2f2` = 设计 `--bg-inset` 精确一致；非 hover 行/画布底 `#ffffff` = 设计 `--bg` 精确一致；正文与 bullet 字色 `#333333` = 设计 `--fg` 精确一致；把手图标为 2 列×3 行白点阵，与设计 `⠿`（U+283F）字形一致；正文字号观感 ≈16px（行盒高 25px ≈ 16px×1.6，文字 asc–desc 跨度 17px）与 `--text-body:16px` 无明显偏差；把手圆角观感 ≈2–3px 与 `--radius-sm:3px` 无明显偏差；bullet 4×4px 点径与 16px 字号下的 `•` 字形观感一致。
- **④ 文案逐字**：截图内无 UI 文案元素（把手仅 `title="拖拽排序"` tooltip，静态图不可见）；列表正文「list item one/two with enough text to hover」为 CDP 自测测试文档内容而非 UI 文案，不判偏差；与设计演示句（「梳理渲染区四项高收益交互的目标态」等）的差异属演示数据差异。

## 取稿与读图备注

- 设计稿类型：html（2 份，均存在于 `docs/requirements/ui-ux-redesign/ui/`）
- 取稿方式：Read 直读 HTML 源（skill 取稿表 `.html` 行约定；无浏览器、未生成 design.png——用户禁令禁止启动浏览器，HTML 直读为该类型唯一取稿路径；设计稿存在性校验通过，未触发 fail-closed）
- 读图方式：Read PNG（`IT-03-FE-03-impl.png`，864×73）+ Pillow 像素级色值/几何采样（仅 stdout 分析，未落盘中间图、未读实现源码）
- 备注：
 1. 实现图为浅色主题单帧、局部裁切（仅列表 hover 区域），设计稿含 `.theme-dark` 翻值，深色主题复刻一致性本次未覆盖。
 2. 本任务为 hover 防抖基座（状态机/时序类交付），其核心验收（≥150ms 双向防抖、快速掠过 0 闪烁、位移 0px、无残留）均无法从静态截图核验，已由任务阶段 2 的 CDP 自测数据面（`IT-03-FE-03-selftest.md` / `IT-03-FE-03-cdp-data.json`）覆盖；本报告仅评截图可见的把手/行 hover 复刻样式。
 3. 图片编辑浮层、链接 hover 浮层两组页面元素为「基座状态机」通道，静息态不渲染，且其 UI 内容由 FE-04/FE-05/FE-06 消费方注入（任务 implementation-notes 第 3 条），本任务阶段 1 约定的实现图口径为「列表行 hover 把手浮现态」——截图与口径相符，未按「元素缺失」判罚；三类控件同 delayMs 同表现的时序一致性属任务阶段 3 联调验收项。
 4. #2（accent 左缘指示条）与 #5（把手压盖关系）存在相互作用：设计中 2px 指示条大部分被把手遮盖；若主 agent 采纳 #5 的绝对定位 row-start 槽豁免，#2 可随之一并裁定。#4 的行盒 padding 差异亦可能源于「编辑器 line-box hover」与「原型演示卡片行」两种产品形态的基准差异，建议主 agent 裁定基准归属后再决定必修性。
 5. hover 浮现/消失过渡时长（FE-01 防抖过渡时长 token）、把手 `title="拖拽排序"` tooltip 等瞬态/悬停元素静态图无法核验；token 命名契约（`--handle-accent` 等）属代码契约面，本 skill 铁律不读实现源，留待 code-review/单测门禁。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本评审报告除外）。
