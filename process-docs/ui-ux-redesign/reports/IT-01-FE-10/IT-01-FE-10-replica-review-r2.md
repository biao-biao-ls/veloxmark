# UI 复刻评审报告 · r2（第 1 次重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。
> 本报告为重评 r2：对 r1 清单逐项标注「收敛 / 残留 / 新证据」，并确认修复批 A/B 点名项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-10 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md` |
| 评审时间 | 2026-10-01 |
| 评审轮次 | r2（第 1 次重评）；r1 报告 `IT-01-FE-10-replica-review.md`（2026-09-30 21:57） |
| 评审者 | frontend-replica-review subagent |
| 实现图（主） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10/IT-01-FE-10-impl.png`（编辑态，浅色，1200×800，mtime 2026-10-01 17:26，md5 `a3b28956da845b6f90cdc1add54375f3`，晚于 r1 报告——修复批后新截） |
| 实现图（静息） | `IT-01-FE-10-idle-quiet.png`（静息态，浅色，旧证 mtime 2026-09-30 17:33） |
| 辅证图 | `IT-01-FE-10-select-safe.png`（拖选复制安全，旧证）、`IT-01-FE-10-final-quiet.png`（Esc 后终态静息，旧证） |
| 时序辅证 | `IT-01-FE-10-debounce-timeline.svg`、`IT-01-FE-10-zero-shift-compare.svg`、`IT-01-FE-10-cdp-results.json`（47/47）、`IT-01-FE-10-self-test.md` |
| 设计图 | 未产出 `design.png`（设计稿类型为 html，取稿方式为 Read 直读源码+CSS 值，见「取稿与读图备注」） |
| 设计稿源 | `docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（主稿）、`docs/requirements/ui-ux-redesign/ui/ui_07_global.html`（交叉印证） |
| 机制口径 | change-log CHANGE-15（U1 整表外框 = `.cm-md-table-wrap.cm-md-table-editing` wrap `outline: 1px solid var(--accent); outline-offset: -1px`）、CHANGE-13/14（批 A 工具栏 pill/危险色/尺寸、按下态） |
| 页面路径 | 表格编辑视图（chrome 显隐四态）+ 全局浮层 |

---

## r1 清单逐项回标（收敛 / 残留 / 新证据）

| r1 # | 严重度（r1） | 元素 | r2 标注 | 判定依据（新图像素取证 + 旧证） |
|---|---|---|---|---|
| 1 | Important | 工具栏布局（两簇→单条） | **收敛** | 新图工具栏为表右上**单条 pill**：连续载体 x≈880–1095、y≈323–355；控件序 4 图标钮 + 1px 分隔线（x=1019）+ `⋮` + `🗑`，与 ui_02 `.table-toolbar` 控件集 `⊞ ◧ ▣ ◨` + `.tsep` + `⋮` `🗑` 一致；右缘 x≈1095 与表右缘对齐（`right:0`），顶缘 y=323 = 表顶 363−40（`top:-40px`）精确命中 |
| 2 | Important | `🗑` 删除钮 danger 色 | **收敛** | 尾钮图标呈 danger 红（图标像素系 `(216,116,167)`/`(226,169,205)` 等亚像素混色，色相红系；8×12px 小字形未达纯 `#d1242f` 属正常 AA），按钮底透明（底色 = 条底 `(250,250,250)`），与 `.tbtn.danger { color:var(--danger) }` 规格一致；r1「未见红色删除钮」不复存在 |
| 3 | Important | 工具栏/按钮尺寸 | **收敛** | 实测条高 y=323→355 ≈ **32px**（含 1px 边框），激活钮宽 x=952→979 ≈ **28px**，钮节距 ≈32px（28 + gap 4），与 ui_02 `height:32px` / `.tbtn 28×28` / `gap:var(--space-1)=4px` 尺规吻合（1200×800 图上 1:1 CSS px）；r1 目测 ~22px 系两簇散落 chip 时代的读数，已过时 |
| 4 | Minor | 右簇第二钮（疑似复制钮） | **收敛** | 新图右端仅 `⋮` + `🗑` 两钮，无复制样式钮；控件集与 ui_02 一致 |
| 5 | Important | 整表编辑态外框（U1） | **残留（新证据：确认仍不可见）** | 见下方未对齐点 #1。表缘全环 7392px 采样 **chroma 直方图 = {0: 7392}**（纯灰阶 228–255，0 彩色像素）；对照激活单元格 outline 像素 chroma=209（同图同一 accent token 可见）——外框缺失非检测误差。像素特征与 CHANGE-15 记载的失败签名（「外缘像素为 --border 灰，蓝框不可见」）完全一致 |
| 6 | Minor | 激活单元格光标色 | **残留待证（新证据不足，不判偏差方向）** | 见下方未对齐点 #2。新图激活单元格（b1，outline 环 x=490–712/y=404–446）内部仅文本像素（x=592–608，y=419–431），**无 2px×18px 光标条可测色**（全内域逐列扫描 y=407–444 无候选）；疑 blink 灭相或 CDP 截图抑制光标。r1 深色光标既未复证，accent 蓝修复亦无法确认——需补 caret 亮相帧 |
| 7 | Important | 深色主题显隐面证据缺口 | **缺口依旧（按调用方口径如实列，不判偏差）** | `impl.png` 与全部旧证仍均浅色主题，无深色实现图 |
| 8 | Important | hover 微控件浮现态证据缺口 | **缺口依旧（按调用方口径如实列，不判偏差）** | 五图（impl/idle/final/select）均无 hover 浮现画面；浮现形态/提示线/遮挡关系无截图可核（自测有 `gripOpacity:0.5 + accent 提示线` 文字记录与 CDP 时序，但无定格图） |

**修复批点名项确认（并批 A / 并批 B）**：

| 修复批项 | 对应 r1 | 确认结果 |
|---|---|---|
| A·工具栏簇（两簇→单 pill） | #1 | 收敛 |
| A·🗑 危险色 | #2 | 收敛 |
| A·细滚动条 webkit 单通道 | — | **取证缺口（非偏差）**：CHANGE-13 登记的 5px 定制细滚动条属 ⋮/右键**菜单**滚动条；impl.png 无展开菜单，无从核验。窗口侧滚动条实测 ~16px（x=1183–1198）为编辑器滚动面，ui_02 无滚动条规格、不在 FE-10 设计面对照面，不计入 |
| A·尺寸（32/28px） | #3 | 收敛 |
| B·编辑态整表外框 U1（wrap outline 机制） | #5 | **残留**——机制口径按 CHANGE-15 wrap outline 核对，像素仍 0 命中 |
| B·激活单元格 caret accent 蓝 | #6 | **待证**——caret 帧缺失，无法核验色值 |

---

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | — |
| Important | 1 | 样式明显偏离（U1 外框仍缺失） |
| Minor | 1 | 证据不足待证（caret 色值） |
| **合计（计入未对齐点）** | **2** | 另有 2 条取证缺口按口径如实列不判偏差（#3/#4）；时序类沿用旧证（见备注） |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 表格编辑态（整表 / 激活单元格）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | 整表编辑态外框（U1） | 编辑态整表 1px solid `var(--accent)` 蓝外框（`#0969da`/暗 `#58a6ff`）；ui_02 `table.gfm` L325 注释「edit-state container outline」；机制口径按 CHANGE-15 = `.cm-md-table-wrap.cm-md-table-editing` wrap `outline: 1px solid var(--accent); outline-offset: -1px`，退出编辑态无框 | **外框不可见**：表缘四边全环 7392px 采样 chroma 全 0（纯灰阶 `(228–255)`，含 `(240)` 表头灰、`(244/246)` cell 边框灰），accent 像素 0；8px 外环带 bluish 命中 0。同图激活单元格 outline 为纯正 `(9,105,218)`（chroma 209）作对照，证明 accent 可渲染、非取色失败 | U1 整表外框在修复批后新图中仍缺失，像素特征与 CHANGE-15 记载的 border-collapse 压盖失败签名一致（「四边采样 accent 计数 0」）——与「wrap outline 已落地」的机制登记矛盾 | ① 先核图源时点：impl.png（10-01 17:26）是否确实截于 CHANGE-15 CSS 生效之后（change-log 更新时间同为 10-01，无法从 mtime 单独证实先后）；② 若已生效，排查 outline 画序——wrap outline（offset -1px）与子级 th/td 背景/边框的覆盖关系是否令 outline 被压盖（仿真 temp/batch-r2-fix-sim.mjs 结论需以真实渲染复核）；③ 修复后补截编辑态整表图，验收判据=表缘 1px 环纯 accent、四边采样 accent 计数 >0 |
| 2 | Minor（待证） | 激活单元格光标（caret） | `.caret` 2px×18px，`background:var(--accent)`（#0969da 蓝），ui_02 活单元格 `陈屿<span class="caret">` 内嵌形态 | 激活单元格（b1）内**无光标条**：内域逐列扫描（x=493–710, y=407–444）仅文本像素 x=592–608，无 2px 竖条候选；outline 环除外全白 | caret 修复效果无法核验——r1 深色光标问题未复证，accent 蓝亦无法确认（疑 blink 灭相或截图抑制光标） | 补截 caret 亮相帧（触发键入/强制 blink-on 后截）复核色值是否为 accent 蓝；若本就系统光标色优先，登记裁决差异 |

### 证据缺口（无法从所给截图核验，按调用方口径不判偏差）

| # | 元素 | 设计稿值 | 实现值 | 说明 | 处置 |
|---|---|---|---|---|---|
| 3 | 深色主题显隐面 | 深浅两主题显隐过渡一致，token 翻值（任务阶段 3 AC；ui_07「深浅主题对比 ≥4.5:1」） | 全部图证均浅色主题，无深色实现图 | 深色面缺口，r1 判不阻塞 | 如实列缺口；如需闭环补深色 idle/edit/quiet 三态图 |
| 4 | hover 微控件浮现态 | hover 停留 ≥150ms 后 col-grip 等微控件浮现（token 提示线，不遮挡被 hover 正文；ui_07「hover 防抖 ≥150ms」） | 无浮现态定格图 | 浮现形态/提示线样式/遮挡关系无截图可核；CDP 时序证据（reveal 165.2ms、gripOpacity:0.5、toolbar:0）自测已录 | 如实列缺口；如需闭环补慢速 hover 到点浮现截图 |

---

## 时序类备注（静态图不可判，沿用 r1 口径 + 旧证确认）

- **防抖 ≥150ms / 快速掠过 0 闪烁 / 不半途浮现（AC-NF-04）**：属时序行为。旧证确认有效：`cdp-results.json` 47/47 PASS——rapidPass `flashes:0`（enter→leave 73.9ms）、slowHover reveal 165.2ms / 156.3ms（深色复测）、leaveHide 162.9ms，均落 150–320ms 判定窗；`debounce-timeline.svg` 时间轴与文字口径一致。终态面：`idle-quiet`/`final-quiet` 无半途浮现残留。
- **位移 0px（AC-NF-05）**：旧证确认有效：`zeroShiftHover` 六组 dTop/dLeft 全 0（prose/table/tail × idle↔hover↔gone）；toast 组全 0；进编辑态 tail +1.28px 属 P10 嵌套单元格编辑器度量（非 chrome 显隐面，自测已登记）。新图目视复核：工具栏浮于表上方空隙内（top:-40px 槽位），未推开正文，与 idle-quiet 同视口坐标一致。
- **静息零 chrome / Esc 收拢 / 拖选安全（r1 已过，旧证确认）**：`idle-quiet`（零 chrome = 纯正文）/`final-quiet`（Esc 后终态零 chrome，焦点回正文）/`select-safe`（大面积拖选压零 chrome，状态栏「10:2 选中 101 字符」）三图复核无变化，与 ui_07「终态必为静息」、ui_02「零把手带（静息/编辑均无）」一致。
- **时序窗可信度**：全部 CDP 数字来自 2026-09-30 自测批（旧证）；修复批 A/B 未重跑时序探针，但 A/B 均为呈现层形态/色值改动，防抖状态机与 0px 槽位不在其改动面（CHANGE-13/15 登记「UX-P28 F3 零位移保持」），旧证沿用成立。

## 核对通过面（无偏差，供参考）

- **工具栏载体形态**：表右上浮动紧凑 pill 单组连续排列（⊞ ◧ ▣ ◨ + 1px×18px 分隔线 + ⋮ 🗑），容器底 `--widget-surface` 系 `(250,250,250)` + 1px 边框 + 投影，与 ui_02 `.table-toolbar` 及 CHANGE-13 裁定一致（r1 #1/#4 收敛，详见回标表）。
- **工具栏定位与槽位**：`top:-40px`（顶缘 y=323 = 表顶 363−40）/`right:0`（右缘与表右缘 x≈1095 对齐）精确命中；工具栏出现不推开正文（0px 旧证 + 目视）。
- **激活单元格**：2px accent outline（环像素纯 `(9,105,218)`，左 x=490–491 / 右 x=711–712 / 上 y=404–406 / 下 y=445–446）+ 白底，与 `.active-cell` 的 `outline:2px solid var(--accent); outline-offset:-2px` 一致（光标色除外，见 #2）。
- **激活/按下态样式**：第 3 钮 accent-soft 底 `(220,232,246)` + accent 图标 `(9,105,218)`，与 ui_02 `.tbtn.active`（rgba(9,105,218,0.12)+#0969da）及 CHANGE-14 按下态归一一致；编辑列 Center 对应中对齐键按下，runtime 映射合理。
- **表头/斑马纹**：表头灰底加粗、数据行隔行浅灰，与 `--table-header-bg`/`--table-stripe-bg` 色阶观感一致。
- **表格左缘对齐**：表左缘与正文文字列对齐（x≈328 起），无增删把手带，符合 ui_02「表格左缘与正文文字列对齐——不再缩进、无增删把手带」「零把手带（静息/编辑均无）」。
- **fixture 口径**：新图 fixture 为 4 列（Left/Center/Right/Extra）×3 行演示表（对齐 ui_02 四列结构，优于 r1 时的 2 列测试表）；fixture 文案差异按 r1 范围口径不计入。

---

## 取稿与读图备注

- **设计稿类型**：html ×2（`ui_02_table_edit.html` 主稿、`ui_07_global.html` 交叉印证）。
- **取稿方式**：Read 直读 html 源码与 CSS 精确值（skill 对 html 稿的规定取稿路径）。**未产出 `design.png`**：本评审被调用方明令禁止启动浏览器/写入报告以外任何文件，无法将 html 渲染为 PNG；html 为 skill 列明的合法取稿类型且两稿均成功读取，**不构成「设计稿取稿失败」fail-closed**。样式对比以 html 源码声明值（字号/hex/px）为设计侧基准。
- **读图方式**：Read PNG（impl 新图 + idle-quiet/final-quiet/select-safe 旧证）+ 像素级取证（PIL 采样，仅 stdout 分析，未写任何中间文件）。像素读数注意 Windows 175% DPI 环境伪影；本轮全部几何读数（32px 条高/28px 钮/40px top 偏移）在 1200×800 图上呈 1:1 CSS px 命中设计尺规，无换算残差。
- **图源核验**：impl.png 文件名/尺寸（1200×800 PNG）/mtime（2026-10-01 17:26:06，晚于 r1 报告 09-30 21:57）/md5（`a3b28956da845b6f90cdc1add54375f3`）已核，与调用方声明一致。**图源时点保留一处存疑**（见未对齐点 #1 修复建议①）：mtime 仅能证明晚于 r1，不能单独证明晚于 CHANGE-15 CSS 生效时点；若 U1 外框应可见而不可见，需优先排查此点。三张旧证（idle/final/select）mtime 09-30 17:33，为 r1 已采信的原图，未更换。
- **像素取证摘要**（全部基于 impl.png）：
  - 表缘全环（4 边 × 2–4 候选行列，7392px）chroma 直方图 `{0: 7392}`——外框缺失铁证；
  - 对照：激活单元格 outline 像素 `(9,105,218)` chroma 209——同图 accent 可渲染；
  - 工具栏条体 y=323–355（32px）、激活钮 x=952–979（28px）、分隔线 x=1019（1px `(238,238,238)`）、`🗑` 图标红系像素集中于 x=1070–1077/y=333–344 且钮底透明；
  - caret 全内域逐列扫描 0 候选。
- **双稿关系**：ui_02 提供表格编辑态精确样式（工具栏/外框/激活单元格/caret/token 值）；ui_07 提供行为规则表（hover 防抖 ≥150ms、零布局抖动 0px、Esc 一次收拢、终态静息）用于静息/防抖/位移口径交叉印证。
- **范围口径**（沿用 r1）：设计稿为场景原型（含场景横幅、设计标注面板等脚手架），实现图为真实应用（含菜单栏/标签栏/侧栏/状态栏外壳）；脚手架与外壳差异、fixture 文案差异不计入未对齐点。本评审聚焦 FE-10 页面元素表所辖 chrome 显隐面（工具栏载体/hover 微控件/槽位 0px/静息断言面）与表格编辑态样式，及修复批 A/B 点名项。
- **本轮取证纪律执行**：Read PNG 前核文件名+尺寸+mtime+md5（疑时）；未 Read 实现源码、未启动浏览器、未连 dev server；唯一写入文件为本报告。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比、像素级取证与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。不打总分、无 PASS/FAIL；r1 八项已逐项标注收敛/残留/新证据，未对齐点以 6 元组输出，必修性由主 agent 逐条判断。
