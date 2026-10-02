# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-10 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md` |
| 评审时间 | 2026-09-30 |
| 评审者 | frontend-replica-review subagent |
| 实现图（主） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10/IT-01-FE-10-impl.png`（编辑态，浅色） |
| 实现图（静息） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10/IT-01-FE-10-idle-quiet.png`（静息态，浅色） |
| 辅证图 | `IT-01-FE-10-select-safe.png`（拖选复制安全）、`IT-01-FE-10-final-quiet.png`（Esc 后终态静息） |
| 设计图 | 未产出 `design.png`（设计稿类型为 html，取稿方式为 Read 直读源码+CSS 值，见「取稿与读图备注」） |
| 设计稿源 | `docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（主稿）、`docs/requirements/ui-ux-redesign/ui/ui_07_global.html`（交叉印证） |
| 页面路径 | 表格编辑视图（chrome 显隐四态）+ 全局浮层 |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 6 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 / 证据缺口 |
| Minor | 2 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **8** | 另附 1 条时序类备注（静态图不可判，不计入） |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 表格工具栏（编辑态 chrome 载体）

> 载体形态与控件集主责在 FN-03/FE-03，FE-10 主责为显隐时机；以下形态偏差仍按设计稿如实记录，修复建议中附职责面提示。

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | 工具栏布局 | 单条 pill 浮层，`position:absolute; top:-40px; right:0`（对齐表右缘），控件序 `⊞ ◧ ▣ ◨` + 分隔线 + `⋮` `🗑`（ui_02 `.table-toolbar`） | 拆为两簇：表左上 4 钮簇（图标与 `⊞ ◧ ▣ ◨` 同族）+ 表右上 2 钮簇（`⋮` + 一枚疑似复制钮），无统一条 | 统一右对齐单条形态丢失，控件分居两端 | 合并为表右上单条 overlay（`top:-40px/right:0` 尺规）；若属 FE-03 块工具栏裁决差异（方案 A），登记到 change-log 并在设计稿侧标注 |
| 2 | Important | `🗑` 删除钮 | 工具栏尾部 `🗑`，`color:#d1242f`（`--danger`），`.tbtn.danger` | 两簇共 6 钮，未见红色删除钮 | 缺失 | 补 `🗑` danger 钮；若删除表入口已收口进 `⋮` 菜单，登记裁决差异 |
| 3 | Important | 工具栏/按钮尺寸 | 条高 32px、按钮 28×28px、圆角 3px、gap 4px、内边距 0 8px（ui_02 `.table-toolbar`/`.tbtn`） | 目测条高约 22px、按钮约 20–22px（1200×800 截图下约为设计 2/3） | 尺寸明显偏小，点击热区不足 | 按 32/28px 尺规复核工具栏尺寸 token；如为 FE-03 载体既有规格，与 FE-03 一并裁决 |
| 4 | Minor | 右簇第二钮 | 设计工具栏控件集为 `⊞ ◧ ▣ ◨ ⋮ 🗑`（无复制钮） | 疑似 `⧉` 复制样式钮（FE-03 hover copy bar 控件） | 与 ui_02 编辑态工具栏控件集不符 | 明确 hover copy bar 在编辑态是否驻留；若驻留，设计稿补标注 |

### 表格编辑态（整表 / 激活单元格）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 5 | Important | 整表编辑态外框 | `table.gfm { border:1px solid var(--accent) }`（#0969da，注释明确为 edit-state container outline，ui_02 L325） | 无整表 accent 外框；仅激活单元格有 2px 蓝 outline | 缺整表编辑态轮廓 | 编辑态给表格容器加 1px accent 外框（token 化，深浅主题各自翻值）；如为有意省略，登记裁决差异 |
| 6 | Minor | 激活单元格光标 | `.caret` 2px×18px，`background:var(--accent)`（#0969da 蓝） | 深色（近黑）光标 | 色值不符 | 光标着 accent 色，或登记「系统光标色优先」裁决 |

### 证据缺口（无法从所给截图核验，非目测偏差）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 7 | Important | 深色主题显隐面 | 深浅两主题显隐过渡一致，token 统一翻转（任务阶段 3 AC；ui_07 规则表「深浅主题对比 ≥4.5:1」） | 调用方标注「深浅各一」，但 `impl.png` 与 `idle-quiet.png` 实读均为浅色主题；无深色实现图 | 深色面证据缺失，无法核验 | 补深色主题下 idle / edit / quiet 三态截图 |
| 8 | Important | hover 微控件浮现态 | hover 停留 ≥150ms 后 col-grip 等微控件浮现（token 提示线，不遮挡被 hover 正文；ui_07 规则表「hover 防抖 ≥150ms」） | 四张截图（idle/edit/select/final-quiet）均无 hover 浮现态画面 | 浮现形态、提示线样式、遮挡关系无法核验 | 补慢速 hover 到点浮现截图（含 col-grip 提示线可见态） |

---

## 时序类备注（静态图不可判，不计入未对齐点）

- **防抖 ≥150ms / 快速掠过 0 闪烁 / 不半途浮现（AC-NF-04）**：属时序行为，静态截图无法判定阈值与闪烁次数。本次评审仅核对终态面——`idle-quiet`/`final-quiet` 无半途浮现残留、`select-safe` 无浮层误弹，与「无残留/无误触」终态语义一致；阈值与时间轴以单测（chromeState 36 例）及自测 `IT-01-FE-10-debounce-timeline.svg` 为准，由主 agent 另行核验。
- **位移 0px（AC-NF-05）**：`idle-quiet` / `impl` / `final-quiet` 三图同视口下，正文段落、表格上下缘、尾段、代码块的纵向坐标目测一致（工具栏出现在表格上方空隙内，未推开正文），与 ui_02 设计标注「进出编辑零布局抖动（位移 0px）」及 ui_07 规则表「零布局抖动 0px」一致，未发现偏差。

## 核对通过面（无偏差，供参考）

- **静息零 chrome（AC-FN-23/UI-ELEM-05）**：`idle-quiet`、`final-quiet` 全表格区无工具栏、无把手带、无 chip、无浮层；与 ui_02 设计标注「零把手带（静息/编辑均无）」、ui_07「终态必为静息——不存在工具栏残留、半展开菜单、浮层驻留」一致。
- **Esc 一次收拢终态静息**：`final-quiet` 相对 `impl` 的全部 chrome 消失且无残留，焦点回正文（状态栏光标位于正文行），与 ui_07 场景 A「一次收拢（非逐个关闭）· 焦点回正文 · 终态必为静息」一致。
- **选中复制安全（AC-FN-33）**：`select-safe` 大面积拖选正文+表格单元格期间，无工具栏渲染、无浮层弹出、未进入编辑态（状态栏「10:2 选中 101 字符」），与「拖选复制不触发编辑、不弹浮层」一致。
- **表格左缘对齐**：表格左缘与正文文字列对齐、无增删把手带，符合 ui_02 引言「表格左缘与正文文字列对齐——不再缩进、无增删把手带」。
- **激活单元格样式**：2px accent outline + 白底，与 ui_02 `.active-cell` 的 `outline:2px solid var(--accent); outline-offset:-2px` 一致（光标色除外，见 #6）。
- **表头/斑马纹**：表头灰底加粗、数据行隔行浅灰，与 `--table-header-bg`/`--table-stripe-bg` 色阶观感一致。

## 取稿与读图备注

- **设计稿类型**：html ×2（`ui_02_table_edit.html` 主稿、`ui_07_global.html` 交叉印证）。
- **取稿方式**：Read 直读 html 源码与 CSS 精确值（skill 对 html 稿的规定取稿路径）。**未产出 `design.png`**：本评审被调用方明令禁止启动浏览器/写入报告以外任何文件，无法将 html 渲染为 PNG；html 为 skill 列明的合法取稿类型且两稿均成功读取，**不构成「设计稿取稿失败」fail-closed**。样式对比以 html 源码声明值（字号/hex/px）为设计侧基准。
- **读图方式**：Read PNG ×4（impl / idle-quiet / select-safe / final-quiet），逐图视觉核对。
- **双稿关系**：ui_02 提供表格编辑态精确样式（工具栏、激活单元格、token 值）；ui_07 提供行为规则表（hover 防抖 ≥150ms、零布局抖动 0px、Esc 一次收拢、终态静息）与收拢前后对照，用于静息/防抖/位移口径交叉印证。
- **范围口径**：设计稿为场景原型（含场景横幅、设计标注面板、快捷键卡片等原型脚手架），实现图为真实应用（含菜单栏/标签栏/侧栏/状态栏外壳）。脚手架与外壳差异、fixture 文案差异（设计稿 4 列演示表 vs 实现 2 列 `h1/h2` 测试表）属任务范围外，不计入未对齐点；本评审聚焦 FE-10 页面元素表所辖的 chrome 显隐面（工具栏载体 / hover 微控件 / 槽位 0px / 静息断言面）与表格编辑态样式。
- **实现图主题**：调用方称两张主图「深浅各一」，实读 `impl.png` 与 `idle-quiet.png` 均为浅色主题——已按证据缺口 #7 记录。
- **实现图状态对应**：`impl.png`=编辑态（单元格 `a` 激活、caret 可见、chrome 显示）；`idle-quiet.png`=静息态（零 chrome）；`select-safe.png`=拖选态（选中 101 字符、零 chrome）；`final-quiet.png`=Esc/回安静后终态（零 chrome）。四态覆盖静息/编辑/选中/复位，缺 hover 浮现态（见 #8）。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。
