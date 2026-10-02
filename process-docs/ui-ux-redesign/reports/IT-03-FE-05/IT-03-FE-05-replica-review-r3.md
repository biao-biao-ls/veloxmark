# UI 复刻评审报告（r3 · 第 2 次重评 · 终轮）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。本轮为修复核验 + 无回归抽查（聚焦轮），不重开全量。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-03-FE-05 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-03/FE-05.md` |
| 评审时间 | 2026-10-02 00:35 |
| 评审者 | frontend-replica-review subagent（r3 · 终轮） |
| 评审范围 | r2 N1 修复核验（url-box 浮层 × linkNav tooltip 互斥）+ 无回归抽查；**不重开全量** |
| 对照帧 | `reports/IT-03-FE-05/shots/batch-r3-bare-url-composite.png`（1200×800，mtime 2026-10-02 00:19）<br>`reports/IT-03-FE-05/shots/batch-r3-link-tooltip.png`（1200×800，mtime 2026-10-02 00:16） |
| 旧帧（修复前对照） | `reports/IT-03-FE-05/IT-03-FE-05-impl.png`（1200×800，mtime 2026-10-01 17:26，r2 采信帧；本轮**仅作新旧对比证据，不作现存偏差判据**） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_06_render_zone.html`（区块 B 链接 hover 浮层；html 直读取稿，同 r1/r2 口径） |
| 上一轮报告 | `IT-03-FE-05-replica-review-r2.md`（N1 本轮修复对象；N2 底缘上翻已裁定登记豁免，本轮不重查） |

## 补充取证清单（按文件名+尺寸+mtime 辨识）

| 文件 | 尺寸 | mtime | 辨识结论 |
|---|---|---|---|
| `shots/batch-r3-bare-url-composite.png` | 1200×800 | 2026-10-02 00:19 | 核验帧 1：`[text](url)` hover 合成态（Alpha 链接，url-box 浮层在台） |
| `shots/batch-r3-link-tooltip.png` | 1200×800 | 2026-10-02 00:16 | 核验帧 2：对照帧（选区态、Beta 链接 hover，tooltip 上台、浮层不上台） |
| `IT-03-FE-05-impl.png` | 1200×800 | 2026-10-01 17:26 | 修复前旧帧（r2 主实现图），仅作 N1 新旧对比 |

两核验帧均为 2026-10-02 新拍、晚于修复批次，非旧态，采信。

---

## 结论

**修复项全部收敛，零新增。**

r2 遗留未对齐点共 2 项：

| r2 # | 严重度 | 摘要 | r3 标注 | 依据 |
|---|---|---|---|---|
| 1 | Important | hover 合成态下 linkNav 深色 `.vm-link-tooltip` 叠在 url-box 浮层上，遮挡 url-box 大部（旧遮挡区 x=463–634 / y=172–214） | **收敛** | 核验帧 1 像素复核：旧遮挡区深色 `#1f2328` 系占比从旧帧 78.6% → 0.8%（残余 59px 为 URL 文字字形笔画，非实心块），区域主导色为 url-box 底 `#fafafa`(2825px) + 浮层白底 `#ffffff`(2736px)；深色 tooltip **完全不出现**，url-box 全幅可读（完整 URL 行 + 三钮）。核验帧 2 独立行为无损（详见下节） |
| 2 | Minor | 浮层方位底缘上翻 vs「贴链接下方」字面 | **不再重查** | 已裁定登记豁免（浮层底缘上翻 = 自适应行为常量） |

r1 已收敛项（pop-btn 无 UA 盒、图标字形豁免）按指令不重查。

---

## N1 修复逐项核验（声称 vs 像素）

### 核验帧 1 — `batch-r3-bare-url-composite.png`（`[text](url)` hover 合成态）

| 声称 | 像素证据 | 判定 |
|---|---|---|
| url-box 浮层全幅可读 | url-box x≈438–670、y≈187–211 全程可见：URL 行完整显示 `https://example.com/alpha`（x=447–598 为字形段，其后至 668 为 `#fafafa` 留白，省略号未截断主 URL）；右侧三钮完整（见无回归抽查） | 成立 |
| 深色 `.vm-link-tooltip` 不出现 | 旧遮挡区 x=463–634 / y=172–214：`#1f2328` 系实心块 **0**（占比 0.8% 全部为 URL 字形暗像素混色）；浮层全景带 x=430–840 / y=165–235 深色占比 0.2%，无任何 `#1f2328` 实心块连片 | 成立 |
| 旧遮挡区为 url-box 内容/背景 | 同区主导色：`(250,250,250)`= `#fafafa`（url-box 底）2825px + `(255,255,255)`= `#ffffff`（浮层底）2736px，另见 URL 字形笔画与 AA 混色 | 成立 |
| 新旧对比确认修复生效 | 旧 impl.png 同区（x=463–634 / y=172–214）：`#1f2328` 系 **5644/7182 = 78.6%** 实心块（tooltip 遮挡态）→ 新帧同区 0.8%（字形级）。遮挡层是消失而非 z-index 压栈，与修复声称一致 | 成立 |

### 核验帧 2 — `batch-r3-link-tooltip.png`（对照帧：选区态、浮层不上台）

| 声称 | 像素证据 | 判定 |
|---|---|---|
| 链接 hover 的 URL + 「按住 Ctrl+点击打开」tooltip 正常显示（独立行为不受损） | 深色 tooltip 实心块边界 x=529–693 / y=173–213，底色精确命中 `(31,35,40)`=`#1f2328` 系（该区 76.7%）；块内两行浅色字形（line1 URL 行 493px / line2 Ctrl 提示行 404px），视觉可读 `https://example.com/beta` + 「按住 Ctrl+点击打开」 | 成立 |
| 浮层不上台（互斥另一侧） | 浮层带 x=430–850 / y=170–235：`#fafafa` 仅 217px（散点 AA/字形），无 url-box 底色连片，无浮层本体 | 成立 |

---

## 无回归抽查（r2 已核口径，本轮新帧复核）

| 项 | 设计稿值（ui_06 区块 B） | 新帧实现值 | 判定 |
|---|---|---|---|
| url-box 结构 | 浮层首行 url-box + 按钮行三钮 | url-box 首行 + 三钮单行，结构同 r2 | 保持 |
| 三钮顺序 | ✎ 编辑 URL → ↗ 外开 → ⧉ 复制 | 列簇 x=679–720（编辑 URL）→ x=743–760（外开）→ x=794–812（复制），左→右顺序正确 | 保持 |
| 按钮文案逐字 | 「编辑 URL」「外开」「复制」 | 逐字一致（视觉可辨） | 保持 |
| url-box 底/边 | `--widget-surface: #fafafa` / `--border: #e5e5e5` | 底色精确命中 `(250,250,250)`=`#fafafa`；边框 AA 带落在 `(225–229)` 系 ≈ `#e5e5e5`（1px 光栅化 AA，按既定口径） | 保持 |
| 链接色 | `--accent: #0969da` + 下划线 | Alpha 字形精确命中 `(9,105,218)`=`#0969da`，下划线行 y=162（41px 宽） | 保持 |
| 不遮挡锚文本（UI-IXD-07） | 「浮层不遮挡正文锚点内容」；`.link-pop { top: calc(100% + 6px) }` | Alpha 字形下缘 y≈164（蓝字形行止于 164），浮层顶边 y≈170+，间隙 ≈6px；锚文本「Alpha」完整可读未被压盖 | 保持 |

其他：浮层白底 + 浅边 + 向下淡阴影同 r2；帧内正文（`Alpha`/`Beta`/`fe05-r3-evidence.md` 夹具内容、演示 URL `example.com/alpha`）属自测文档内容/演示几何，按既定口径不作判差基准（设计稿 `example.com/design-spec` 同理）。

---

## 未对齐点清单

**本轮无未对齐点。修复项全部收敛，零新增。**

---

## 列账（缺口/行为态，不判偏差；Phase 2 复核 — 承 r2 维持）

1. **深色主题链接浮层**：无深色取证帧，浮层/按钮/url-box 深色 token 翻转未核验。
2. **浮层按钮 hover 态**：设计 `.pop-btn:hover → --bg-inset`、`.is-primary:hover → accent 字色`；无按钮 hover 帧，三态样式未核验。
3. **编辑 URL 输入态/确认取消**：设计稿仅提供 hover 展示态画面，编辑输入态由 AC/CDP 自测面承接（self-test 49/49），视觉面不判差。
4. **N1 互斥的反向时序面**（= r2 #1 行为面收口）：本轮两帧证明「浮层在台 → tooltip 消失」「选区态 → tooltip 正常、浮层不上台」；「tooltip 在台中途浮层弹起」的时序切换未单独取证，属行为态，由 linkNav 订阅 hoverDiscipline 的实现面 + CDP 自测承接。

---

## 取稿与读图备注

- 设计稿类型：html；取稿方式：Read 直读 `ui_06_render_zone.html`（区块 B CSS：`.link-pop`/`.url-box`/`.pop-btn`、token 区 `--widget-surface`/`--border`/`--bg`/`--accent`/`--fg-dim`、区块 B markup 与文案）。
- 读图方式：Read PNG（两核验帧 1200×800 + 旧 impl 帧）+ 只读像素采样（PIL 扫描/采色/量距，未写任何文件）校准视觉读图；**凡视觉与像素冲突一律采信像素**。
- 取证纪律执行：Read 前核文件名+尺寸+mtime（`file` 双帧均 1200×800 PNG，mtime 00:16/00:19 晚于修复批次）；旧帧仅作新旧对比不报现存偏差；N2 底缘上翻按裁定豁免不重查。
- 175% DPI 读数伪影未计入偏差：边框 1px 光栅化 AA（`#e5e5e5` 显示为 225–247 灰阶带）、URL 字形 LCD 次像素混色（`(250,206,138)` 系非真实底色）、0.571px 换算。
- 评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）产出（r3 终轮复核：聚焦 N1 修复核验 + 无回归抽查，不重开全量）。评审者未读取实现源码、未启动浏览器、未修改任何文件（本评审报告除外）。不打总分、无 PASS/FAIL；本轮未对齐点清单为空——**修复项全部收敛，零新增**。
