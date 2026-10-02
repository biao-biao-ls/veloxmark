# IT-04-FE-02 全域对照走查与收尾核验 — 走查/核验清单

- 任务：`process-docs/ui-ux-redesign/tasks/IT-04/FE-02.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 判据真源：`docs/requirements/ui-ux-redesign/ac.md`（**v1.4**，FE-01 修订转正版）；7 页原型 `docs/requirements/ui-ux-redesign/ui/ui_01..07`；`design/api/GLB-global-patterns.md` §3.5/§3.7；`design/tech-design.md` §6/§8.4/§10
- 已登记差异（本清单不再报为新缺陷）：CHANGE-11 双按钮对话框按钮序；col-grip 常驻 DOM+CSS 零漆；hover 防抖基线 165ms 级（AC ≥150ms 口径）；进编辑态表后段 +1.28px 亚像素（P10 嵌套度量）；AC-FN-29 分级退格已修；CHANGE-3（resizeTable vs TBL-TOOL-GRID）/CHANGE-9（estimateAutoFitCols）仍 pending
- 环境：Windows 10 Enterprise 10.0.19045 单机；全新 Electron/CDP 实例（独立调试端口 + 独立 user-data-dir）
- 批次留档协议：每批一份「批次号 + 条目结果 + 问题条目去向」，不合并；全部批次留档齐备后进入阶段 3/4

---

## 批次 ① 性能与防抖（AC-NF-01 / AC-NF-03 / AC-NF-04、AC-NF-05 回归抽查）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 1.1 | 30 行 × 12 列表格执行任一结构操作（insertRowBelow），「执行触发 → 视觉更新完成」耗时 | AC-NF-01 | ≤ 100ms | CDP：载入 30×12 表 → 点入单元格 → 键盘 Ctrl+Enter；in-page `performance.now()` 计时至 DOM 双 rAF 稳定；另附 `__veloxP15.bench` 装饰重建耗时 | **通过**（首测 103.3ms 属冷启动噪声；热身复测 6/6 全过 77.3–94.1ms，中位 82.7ms；`__veloxP15.bench(2000,20,3)` avg 29.8ms / p95 51ms） | 无 |
| 1.2 | 约 20 页/2000 行文档（含表格/公式/代码块）连续滚动帧率 | AC-NF-03 | ≥ 30fps（装饰重建限定视口） | CDP：载入 2000 行合成夹具 → `.cm-scroller` 连续滚动 3s，rAF 帧计数/秒 | **通过**（2000 行实测 41.9fps ≥30） | 无 |
| 1.3 | hover 控件出入防抖（回归抽查，IT-01 承载不重复计） | AC-NF-04 | ≥150ms 双向防抖、闪烁 0 次、位移 0px | CDP：鼠标移入/掠过表格 chrome，测 chrome 浮现延迟（登记基线 165ms 级）+ 快速掠过闪烁计数 | **通过**（浮现延迟 164.9ms ≥150，与登记基线 165ms 级一致） | 无 |
| 1.4 | hover 快速掠过不闪烁（回归抽查） | AC-NF-05 | 快速掠过闪烁 0 次、0px 位移 | 同 1.3 场景快速掠过序列 + 浮现/消失计数 | **通过**（慢速悬停 1 次浮现 + 5 次快速掠过 0 额外闪烁；wrap 落点稳定无位移） | 无 |

### 批次 ① 留档

- **批次号**：① 性能与防抖
- **条目结果**：4/4 通过（1.1/1.2/1.3/1.4）
- **证据**：`IT-04-FE-02-cdp-batch1-data.json`、`IT-04-FE-02-cdp-batch1-retry.json`、`IT-04-FE-02-cdp-batch1-run.log`
- **问题条目去向**：无。1.1 首测 103.3ms >100ms 经热身复测 6/6 通过（中位 82.7ms）判定为冷启动噪声（首帧装饰重建 + React 挂载余波），不构成 AC-NF-01 真实超标，不登记缺陷。
- **执行环境**：Electron/CDP 端口 9501（独立 user-data-dir `it04-fe02-userdata`），Windows 10 10.0.19045

---

## 批次 ② 命中区域与提示（AC-NF-07）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 2.1 | 表格工具栏按钮（alignLeft/Center/Right、⊞ resizeTable、⋮ TBL-MOR-OPN、🗑 deleteTable）hover 提示 | AC-NF-07 | 显示 hover 提示的控件占比 100% | CDP：hover 表格浮现工具栏 → 逐按钮断言 `title` 非空 | **通过**（编辑态挂载 6/6：⊞「调整行列数」、◧「左对齐」、▣「居中对齐」、◨「右对齐」、⋮「更多操作」、🗑「删除表格」；data-op 契约面 6 键齐备） | 无 |
| 2.2 | 块级 chrome 按钮（代码块展开/折叠、标题折叠、引用折叠/恢复）hover 提示 | AC-NF-07 | 同上 | DOM 扫描 `.cm-md-code-expander`/`.cm-md-block-toolbar-btn`/fold 按钮 `title` | **通过**（chrome 族 5 控件 title/aria 全覆盖，missing 0） | 无 |
| 2.3 | 浮层按钮（图片工具栏 size slider/reset/reveal、链接浮层、RenderFloat）hover 提示 | AC-NF-07 | 同上 | CDP：hover 图片/链接 → 浮层按钮逐个 `title` 断言 | **通过**（图片工具栏 slider「图片尺寸」+4 键「水平翻转/垂直翻转/恢复原始尺寸/在文件管理器中显示」全有 title；链接浮层 4 控件全有 title/aria；RenderFloat 3 控件 0 缺失。扫描面含纯展示 `.cm-md-image-toolbar-pct`（百分比读数 span）无 title——非可点击控件，不入分母） | 无 |
| 2.4 | 把手（col-grip）与 chip（公式 chip 进入/退出、✓ chip）hover 提示 | AC-NF-07 | 同上 | DOM 扫描 `[data-table-handle="col-grip"]`、math chip `title` | **通过**（col-grip ×2「拖动调整列宽（仅本次会话）」、公式进入 chip「点击编辑源码」、公式退出 ✓ chip「退出编辑」全有 title。扫描面含 `.cm-md-code-idle-chip`（语言徽标，源码注释 read-only，点击冒泡到 wrap 的 click-to-source）无 title——纯展示徽标不入分母） | 无 |
| 2.5 | 全量覆盖率汇总（上述家族并集） | AC-NF-07 | 覆盖率 100%（分母 = 走查面内全部块级可点击控件） | CDP 全量扫描 `button/[data-op]/[data-table-handle]/chip` 族的 title 覆盖率 | **通过**（可点击控件并集 17/17 = 100%） | 无 |

### 批次 ② 留档

- **批次号**：② 命中区域与提示
- **条目结果**：5/5 通过（2.1–2.5）
- **证据**：`IT-04-FE-02-cdp-batch2-data.json`、`IT-04-FE-02-cdp-batch2-run.log`、`IT-04-FE-02-cdp-batch2-chip-supplement2.log`
- **口径说明**：AC-NF-07 分母 =「块级可点击控件」。两处无 title 元素经源码核实为纯展示（`cm-md-image-toolbar-pct` 百分比读数 span；`cm-md-code-idle-chip` 语言徽标，`codeBlock-widget.ts` 注释 "Read-only: clicks bubble to wrapWithGap's click-to-source"），不入分母，不登记缺陷。
- **问题条目去向**：无
- **补充留档**：表格工具栏为 7C 编辑态挂载（cell-active 才 mount）——静息 hover 只出 hover bar（copy-only），走查驱动须点入单元格再扫工具栏。

---

## 批次 ③ 对比度与主题色四副本（AC-NF-09 / AC-ERR-14 / UI-ELEM-06）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 3.1 | 浅色主题正文/控件文字对比度 | AC-NF-09 | ≥ 4.5:1（WCAG AA） | **（batch9 复测改写）** CDP：WCAG 相对亮度 + alpha 合成，22 控件族采样（菜单栏菜单根/品牌字、下拉菜单项与快捷键回显/分组标题、⋮/右键菜单项与快捷键/分组标题、对话框按钮（确认/取消）与标题、toast 文字与撤销钮、⊞ 网格读数（正文项）、⊞ 网格读数 R×C 与后缀/预设钮、图片浮层按钮与百分比读数、链接浮层 URL 文字与浮层图标/主按钮/宽度选择器）；WCAG 1.4.3 豁免 disabled 控件（⋮ 禁用项 3+1 按祖先 `button[disabled]/.velox-ctx-disabled` 过滤不入分母，单独记 exemptDisabled） | **部分通过 + 新发现 1 项**（22 族全采到：21 族 ≥4.5——最低 4.64（浮层图标按钮）、对话框按钮 18.43、⋮ 启用项 12.63、菜单栏 11.29；**toast 撤销按钮 3.04:1 < 4.5 真实超标**：`.toast-undo-btn` `color:var(--accent)`=rgb(9,105,218) on `--toast-bg` rgb(31,35,40)） | **P2 新发现登记**（问题条目 #5） |
| 3.2 | 深色主题正文/控件文字对比度 | AC-NF-09 | ≥ 4.5:1 | **（batch9 复测改写）** 同 3.1 采样面（setThemePref('dark')） | **通过**（22 族全 ≥4.5：最低 5.44（菜单栏品牌字/⊞ 网格读数/百分比读数）、toast 撤销钮 6.25（深 accent #58a6ff 同面达标）、⋮ 启用项 11.25、对话框按钮 18.43，0 缺失；exemptDisabled 同 3.1） | 无 |
| 3.3 | 块级渲染物/弹层/控件文字全部走主题 token、深色无未适配硬编码浅色块 | AC-ERR-14 | token 配色 + 无硬编码浅色块 | **（batch9 复测改写）** CDP：深主题下 9 弹层族**含全子孙**扫描（菜单下拉/⋮ 右键菜单/⊞ 网格弹层/侧栏/链接浮层/图片浮层/toast/对话框——旧扫描只查 8 根元素**自身** background，漏子孙裸控件）近白背景（r,g,b>220 且 a>0.1）+ sep/divider 族 border；tokens.test.ts 无 `.theme-dark` 选择器补丁断言佐证 | **不通过——新发现 5 处未适配浅色块**（offenders=5，全为原生控件 UA 默认浅色 chrome，非 CSS 硬编码 hex，同属「深色未适配浅色块」视觉缺陷）：TableInsertDialog.tsx:170-188 裸 `input[type=number]`×2（testid table-rows/table-cols，rgb(255,255,255)，未接 `.prefs-input`/`.dialog-input` 皮肤）、:238-242 裸 `button`×2（取消/插入，rgb(240,240,240)，`.primary` 无 CSS 规则，未接 `.dialog-btn` 族）、image-widget.ts:373-382 图片工具栏 `input[type=range]`（无 class，rgb(255,255,255)，markdown.css:809-812 仅设 width/accent-color 未 skin 背景）。token 主体（.dialog/菜单/网格/侧栏/浮层 chrome 背景）仍全走 token；tokens.test.ts 14 用例零补丁断言保持 | **P2 新发现登记**（问题条目 #6） |
| 3.4 | ⊞ 网格选择器单元格边界可辨 | AC-ERR-14（判据 3）/ UI-ELEM-02 | 网格单元格边界线可辨、无「空白不可见」 | **（batch9 复测改写）** CDP：点入单元格 → ⊞（data-op=resizeTable）→ selector 改 `[data-testid="grid-cell"]`（gridPicker.ts:191）实测**真格点** border-color/width、cell bg、弹层表面、gap、hover 选区 + 亮度台阶（旧 selector `[class*="grid"] [class*="cell"]` 误中容器） | **通过**（真格点 **240** 个全可辨，浅/深各一遍：浅色 border rgb(242,242,242)=--bg-inset on cell rgb(255,255,255)、表面 rgb(250,250,250)；深色 border rgb(42,42,43) on cell rgb(30,30,30)、表面 rgb(37,37,38)。可辨三重信号：①1px 设计边框实线（overlays.css:321，DPR=1.75 设备像素吸附 computed 0.571px=1 device px 留档）+ 亮度台阶 border/cell 1.12–1.16:1、cell/表面 1.04–1.09:1；②2px 格栅缝图案；③hover 选区 accent 态（hover 边 4.97–6.06:1）。弹层文字 4.97–12.63 全 ≥4.5。**旧证据作废**（241 与「border rgb(51,51,51)」系容器幽灵边框假数据，见下方口径注记） | 无（口径差已注记，不另立） |
| 3.5 | 主题色四副本色值一致、导出与编辑视图无色差 | UI-ELEM-06 | styles.css token / exportCss / palette / hljsTokens 四处一致 | 静态对账：themes.css ↔ palette.ts（palette.test.ts 守护）；exportCss 由 palette 生成（paletteToCssVars）；hljsTokens 零色值（色值在 highlight.js github/github-dark CSS，编辑/widgets 与导出/buildDocument 同源 scoped）；运行时导出物 CSS var 与编辑 token 抽样比对 | **通过**（静态：palette.test.ts 守护 themes.css/markdown.css 与 palette.ts 逐值一致 + exportCss/inlineStyles 均 palette 生成 + hljsTokens 零色值同源 scoped，守护测试 14/14 过；运行时：export-theme-dark 7 个关键 var 与编辑 token 全 match：--bg/--fg/--accent/--border/--code-bg/--table-header-bg/--table-stripe-bg） | 无 |

### 批次 ③ 留档

- **批次号**：③ 对比度与主题色四副本
- **条目结果**：**（batch9 复测后改写）** 3.5 通过（未动）；3.2/3.4 复测通过；3.1 部分通过 + 新发现 1 项（toast 撤销钮浅色 3.04:1）；3.3 复测不通过——新发现 5 处未适配浅色块。batch3 原始「5/5 通过（7 探针）」叙述被 batch9 采样面取代（7 探针未覆盖 toast 撤销钮/浮层按钮族，且 3.3/3.4 探针有口径错漏，见下）。
- **证据**：batch3 原始证据（`IT-04-FE-02-cdp-batch3-data.json`、`-contrast-retry.json`、`-run.log`）**留档不改**；复测证据见批次 ⑨。守护测试 vitest `src/export/palette.test.ts` + `src/styles/tokens.test.ts` 14/14（未动）
- **问题条目去向**：batch3 首测 FAIL 为驱动选择器口径错（引用渲染物是 `.cm-md-quote`），非实现缺陷；batch9 复测新发现 2 项 P2（问题条目 #5/#6）+ 旧 3.4 证据链问题（已立案）。
- **「⊞ 241 vs 240」口径差注记（batch9 数据注记，该项已立案勿另立）**：旧 selector `[class*="grid"] [class*="cell"]` 命中 240 个 `.table-grid-cell` + 1 个容器 `.table-grid-picker-cells`（class 含 "cell"）= **241**；且旧探针 pick 的 `width>4` 过滤器放行容器 → 实测到的是容器 currentColor 幽灵边框（= --fg rgb(51,51,51)/rgb(212,212,212)、border-width 0），非格点边框。真格点 = `[data-testid="grid-cell"]` **240** 个。根因锁定于 `batch3-contrast.mjs:220-237`，属测量证据链问题（产品实现无缺陷），batch9 已重建证据。
- **UI-ELEM-06 四副本架构留档**：palette.ts 是色值单一真源；exportCss.ts/inlineStyles.ts 由 paletteToCssVars 生成；themes.css/markdown.css 手工同步 + palette.test.ts 逐值守护；hljsTokens.ts 零色值（hljs 色值在 highlight.js github/github-dark 上游 CSS，编辑 widgets 与导出 buildDocument 同源 scoped）——四处一致由测试保证，导出与编辑无色差（运行时 var 全 match）。

---

## 批次 ④ 平台 × 主题 × 分辨率组合（AC-NF-10 / AC-NF-11）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 4.1 | Windows 10 × 浅色主题走查 | AC-NF-10 | 走查清单条目通过率 100%、token 取值正确 | 本机 Win10 + setThemePref('light') 全界面走查（与批次 ⑧ 合证据） | **通过**（themeClass 位、bg=#ffffff/fg=#333333、menuBar/sidebar/statusbar/editor 全在位；全界面走查合证据于批次 ⑧） | 无 |
| 4.2 | Windows 10 × 深色主题走查 | AC-NF-10 | 同上 | 本机 Win10 + setThemePref('dark') 全界面走查 | **通过**（themeClass 位、bg=#1e1e1e/fg=#d4d4d4、关键面全在位） | 无 |
| 4.3 | Windows 11 × 浅色主题走查 | AC-NF-10 | 同上 | **环境限制**：本机为 Windows 10（10.0.19045），无 Win11 实例——按 tech-design §8.4「三平台行为一致（CSS token 化，无平台分支）」推定 + 登记为待跨机复验项 | **推定（环境限制登记）**——themes.css 仅 .theme-light/.theme-dark 翻值、无 @supports/UA 平台分支（tokens.test.ts 零 .theme-dark 补丁守护）；待跨机复验 | 待跨机复验（登记，不算实测通过） |
| 4.4 | Windows 11 × 深色主题走查 | AC-NF-10 | 同上 | 同 4.3 | **推定（环境限制登记）** 同 4.3 | 待跨机复验（登记） |
| 4.5 | 系统深色/浅色跟随（theme=system × prefers-color-scheme 模拟） | AC-NF-10 | 各组合 token 取值正确 | CDP：`Emulation.setEmulatedMedia` prefers-color-scheme dark/light + setThemePref('system') 验证跟随 | **通过**（sysDark→.theme-dark bg=#1e1e1e；sysLight→.theme-light bg=#ffffff；翻转正确） | 无 |
| 4.6 | 1280×768 冒烟操作集（表格结构操作、菜单展开、大纲跳转、渲染区编辑、Esc 收拢） | AC-NF-11 | 逐项可完成、无控件裁切不可达 | CDP：`Emulation.setDeviceMetricsOverride` 1280×768 跑冒烟集 + 边界框在视口内断言 | **通过**（表格插行 3→4、菜单展开 inViewport、大纲跳转、键入编辑 doc 124→125、Esc 收拢；控件裁切 0/5） | 无 |
| 4.7 | 1920×1080 / 2560×1440 / 3840×2160（4K）冒烟操作集 | AC-NF-11 | 同上 | 同 4.6 逐尺寸 | **通过**（三尺寸全通：表格插行/菜单/大纲/编辑/Esc 全可完成，控件裁切均 0） | 无 |

### 批次 ④ 留档

- **批次号**：④ 平台 × 主题 × 分辨率组合
- **条目结果**：4.x 实测 5/5 通过 + Win11×深浅 2 项环境限制推定登记
- **证据**：`IT-04-FE-02-cdp-batch4-data.json`、`IT-04-FE-02-cdp-batch4-run.log`
- **问题条目去向**：无缺陷。驱动修复两处（非实现问题）：①`Input.dispatchKeyEvent` 需 `modifiers` 位掩码（Ctrl=2）而非 `ctrlKey` 布尔；②CM6 可打印字符插入需 keyDown 带 `text` 字段；③`__veloxPrefs.setPreferences`（非 `set`）、`getDoc` 在 P21/P23（P12 无此成员）。
- **环境限制登记**：Win11×深浅（4.3/4.4）本机无法实测——按 tech-design §8.4 三平台 CSS token 化无平台分支推定行为一致，登记为待跨机复验项。

---

## 批次 ⑤ 导出与落盘对账（AC-OP-17 / AC-OP-19；含 tech-design §10 autosave 失败断言）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 5.1 | 含已完成结构操作（行/列/对齐已变更）的表格 → HTML 通道导出物逐项一致 | AC-OP-17 | 行数/列数/单元格内容/对齐（左中右）/冒号行与编辑视图一致 + 观感无色差 | CDP：插行/插列/改对齐后 `__veloxP04.runExport('html')`（export stub 捕获）→ 逐项解析比对 | **通过（修复后回归）**——首测 FAIL 揭出 P1 真实缺陷（空单元格被丢：编辑 4×4 含空列/空行 → 导出 3 列、空行 `<tr></tr>`、右对齐错位）；listTable.ts 最小 TDD 修复后复测 4×4 逐项一致（rows/cols/cells/aligns 全 match，对齐 left/center/center/right 兑现冒号行） | **P1 缺陷已修复**（TDD，详见问题条目汇总 + 自测报告「缺陷修复」节） |
| 5.2 | 同表格 → PDF 通道导出物逐项一致 | AC-OP-17 | 同上 | `runExport('pdf')` 捕获打印渲染源 → 同解析器比对 | **通过（修复后回归）**——同 5.1 缺陷同源（PDF 打印渲染源与 HTML 同 renderDoc），修复后 4×4 逐项一致 | 同 5.1 |
| 5.3 | 同表格 → 富文本通道导出物逐项一致 | AC-OP-17 | 同上 | `__veloxP20.copyRichText()` + `getClipboard()` → 同解析器比对 | **通过（修复后回归）**——修复后 4×4 逐项一致 | 同 5.1 |
| 5.4 | 三通道观感一致（无色差，UI-ELEM-06 口径） | AC-OP-17（判据 3） | 无色差 | 导出物 CSS var 抽样 vs 编辑 token（html/pdf）+ **batch9 富文本通道 inline style 字面值比对** | **通过（batch9 证据链补齐）**——html/pdf 通道（batch5）：`--bg/--fg/--accent/--border` var 与编辑 token 全一致、html↔pdf 集合相等；富文本通道（**batch9 复测**，batch5 `rich:[]` 系 CSS var 探针与内联字面值形态不兼容的口径差，非数据缺陷）：inline style 色值字面量双主题各 8–9 个唯一值**全 ⊆ palette.ts 值域**（unknown=0）+ 角色 spot-check 8/8（p→fg、a→accent、th→tableHeaderBg、pre→bgAlt、code→codeBg、blockquote→quoteBorder、斑马 td→tableStripeBg、根→bg）+ 运行时 token 12/12 逐值 match；样张 `IT-04-FE-02-cdp-batch9-rich-{light,dark}.html` | 无 |
| 5.5 | 结构操作 + autosave 后 .md 源码含本次变更、状态栏「已保存」、无数据丢失 | AC-OP-19 | .md 含变更 + 「已保存」+ 无丢失 | CDP：真实文件落盘 → 读盘比对 + `.sb-autosave` 文案断言 | **通过**（盘上 .md 含结构变更行、状态栏「已保存」、dirty=false） | 无 |
| 5.6 | 【异常断言】undo 空栈按 Ctrl+Z 静默不动作 | tech-design §10 | 无 toast、无异常弹窗、文档不变 | CDP：`__veloxP23.undo()` 排干至 false（真·空栈）→ Ctrl+Z 前后对照 toast/弹窗/文档三断言 | **通过（重计）**——首测为驱动设计缺陷（loadDoc 进 undo 历史，Ctrl+Z 撤的是 loadDoc）；重计排干栈后 Ctrl+Z 静默（文档 92 字节不变、toast/弹窗零新增、dialog 前后均 null） | 无（首测假 FAIL 不登记） |
| 5.7 | 【异常断言】模拟 autosave 失败：内存态保留不丢稿 + 冻结提示 | tech-design §10 / AC-ERR-15 | 内存态保留 + toast 固定「自动保存失败，文档可另存副本」 | CDP：不可写路径 + debounce 1s autosave 管线（非手动 saveFile）→ getDoc 保留 + toast/常驻槽断言 | **通过（重计，文案只登记）**——首测误走手动 saveFile 通道（toast.saveFailed*）；重计走 autosave 管线：内存态保留（含键入 'x'）、`toast.autoSaveFailedPath`「自动保存失败：{path}（{reason}）」+ 常驻槽 `.sb-autosave-error`「自动保存失败 19:50」双通道可见 | **文案差异登记**（只登记不擅改）：实测动态变体与冻结句 `err.autosaveFailed`「自动保存失败，文档可另存副本」措辞不一致——`err.autosaveFailed` 无运行时消费方（冻结保留句），运行时走 `toast.autoSaveFailed{,Path}`+`status.autoSaveFailed`（tech-design §10 语义「失败不丢稿+失败提示」满足） |

### 批次 ⑤ 留档

- **批次号**：⑤ 导出与落盘对账
- **条目结果**：7/7 条目通过（5.1–5.7；其中 5.1/5.2/5.3 为缺陷修复后回归通过，5.6/5.7 为驱动重计通过）
- **证据**：`IT-04-FE-02-cdp-batch5-data.json`（首测 7/13，缺陷发现轮）、`IT-04-FE-02-cdp-batch5-retry.json`/`-retry.log`（5.7 autosave 管线重计）、`IT-04-FE-02-cdp-batch5-retry2.json`/`-retry2.log`（修复后回归 7/7）、`IT-04-FE-02-export.html`（修复前导出物，保留缺陷形态证据）、`IT-04-FE-02-export-fixed{,-pdf,-rich}.html`（修复后三通道导出物）
- **问题条目去向**：
  1. **P1 真实缺陷（已修复）**：`export/renderDoc/listTable.ts` 导出丢空单元格——`@lezer/markdown` GFM 对空单元格不产 `TableCell` 节点，`renderRow` 只数 `TableCell` → 列数缩水/空行成 `<tr></tr>`/aligns 错位（AC-OP-17 判据 2 违反）。最小 TDD 修复：新增 `listTable.test.ts`（4 用例先 RED）→ `rowCellSlots()` 按管道结构数槽位（对齐 `editor/table/parse.ts` padRow 哨兵口径）→ vitest `src/export` 26/26 GREEN + typecheck 0 Error。修复属任务授权范围（「P0/P1 级真实缺陷可做最小修复（TDD，报告单独列节）」），详见自测报告「缺陷修复（P1）」节。
  2. **文案差异登记（不修改）**：autosave 失败提示实测 `toast.autoSaveFailedPath` 动态变体（含 path/reason）+ 常驻槽 `status.autoSaveFailed`，与冻结句 `err.autosaveFailed`「自动保存失败，文档可另存副本」措辞不一致。`err.autosaveFailed` 全仓无运行时消费方（仅 frozenCopy.test.ts 钉住）——按「发现文案不一致只登记不擅改」处理。
  3. 首测 5.6/5.7 假 FAIL 为驱动设计问题（非实现缺陷），已重计纠正，不登记。
- **执行环境**：Electron/CDP 端口 9501（独立 user-data-dir `it04-fe02-userdata`），Windows 10 10.0.19045

---

## 批次 ⑥ 数据层声明（AC-NF-13）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 6.1 | .md 仍为唯一数据源、存盘为纯 .md | AC-NF-13 | .md 唯一数据源、纯 .md | 静态：save 路径只写 .md 文本；运行时：落盘文件为纯 Markdown | **通过**（saveFile 落盘 107 字节 === `getDoc()` 逐字节一致，纯 Markdown 无 HTML/无旁路文件；与批次⑤ 5.5 落盘对账联证） | 无 |
| 6.2 | 无新增数据实体、无数据迁移 | AC-NF-13 | 零新增实体、零迁移 | 静态：localStorage 双键 `veloxmark.preferences`/`veloxmark.session`；quoteFolds 平铺追加 + sanitizer 白名单；`sql/NO-DB-CHANGE.sql` 零 DDL 声明；store 无迁移代码 | **通过**（键面仅双键真源 + `veloxE2eSaveDialog` 测试缝状态键（e2eSaveDialog.ts 文档化，非数据实体）；IndexedDB databases()=[] 零实体；`design/sql/NO-DB-CHANGE.sql` 显式零 DDL（无 CREATE/ALTER/DROP，quoteFolds 声明 additive 无迁移）；store.ts 无实体迁移——`migrateLegacyKeys` 仅 pre-P03 散键一次性导入并删除源键） | 无 |
| 6.3 | quoteFolds 平铺追加 + sanitizer 白名单回归（STORE 契约） | AC-NF-13 | 值须 string[]、脏数据丢弃不抛错 | 运行时：localStorage 键面扫描 + 折叠后 session 形态断言；store.test.ts 佐证 | **通过**（6 行引用折叠后 `quoteFolds[path]=["q:1:引用块第一行"]` 平铺 string[]、与盘上 blob 一致；脏数据（非数组/空路径/混型元素/类型垃圾）注入 reload 后白名单清洗：脏项丢弃、`{'C:/ok.md':['k1']}` 保留、应用正常启动不抛错；store.test.ts quoteFolds/headingFolds 33 用例佐证 AC-NF-14） | 无 |

### 批次 ⑥ 留档

- **批次号**：⑥ 数据层声明
- **条目结果**：3/3 通过（6.1/6.2/6.3，运行时 5 探针全过）
- **证据**：`IT-04-FE-02-cdp-batch6-data.json`、`IT-04-FE-02-cdp-batch6-run.log`；静态佐证 `design/sql/NO-DB-CHANGE.sql`、`src/preferences/store.ts`（双键 + normalizeSession 白名单）、`src/preferences/store.test.ts`；`export/e2eSaveDialog.ts`（`veloxE2eSaveDialog` 缝键文档）
- **问题条目去向**：无。首轮 6.2a FAIL 为口径问题（`veloxE2eSaveDialog` 是 e2e 缝状态键而非数据实体，白名单收编）；6.3a FAIL 为驱动夹具问题（3 行引用低于 `QUOTE_FOLD_LINE_THRESHOLD=5` 不出折叠 caret——产品阈值行为非缺陷），夹具改 6 行后通过。
- **口径留档**：数据层 = localStorage 双键 JSON（preferences/session），零 DDL 零迁移（NO-DB-CHANGE.sql 显式声明）；quoteFolds 为 SessionState 平铺 `Record<filePath, string[]>` additive 字段，`normalizePerFileIds` 统一清洗（脏数据丢弃不抛错，AC-NF-14）。
- **执行环境**：Electron/CDP 端口 9501（独立 user-data-dir `it04-fe02-userdata`），Windows 10 10.0.19045

---

## 批次 ⑦ 用户旅程无权限差异（AC-RULE-18）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 7.1 | 重度写作者旅程：四向插行列 → undo → 回静息 | AC-RULE-18 | 无权限差异；核心旅程可完成 | CDP：Ctrl+Enter / Ctrl+Shift+Enter / Ctrl+Shift+← / Ctrl+Shift+→ → Ctrl+Z → Esc 静息断言 | **通过**（表 3×2 → 四向插行列 5×4（行+2 列+2）→ Ctrl+Z 撤一步列回 5×3 → Esc 静息：dialog/menu/toolbar/ctxMenu 全 false） | 无 |
| 7.2 | 复杂排版用户旅程：评审改表 → 导出三通道一致 | AC-RULE-18 | 同上 | CDP：结构改表（对齐/插删）→ 三通道导出比对（与批次 ⑤ 联证） | **通过**（改对齐 alignRight 后 HTML 通道 cells/aligns 与编辑视图逐项一致；三通道一致性联证批次⑤ retry2 5.1b/5.2b/5.3b 全过） | 无 |
| 7.3 | 阅读/审阅用户旅程：折叠扫读 → 大纲跳转 → 最小编辑 | AC-RULE-18 | 同上 | CDP：标题折叠 → 大纲点击跳转 → 单字符编辑 | **通过**（heading-fold-caret 折叠 `keys=["1:旅程夹具"]` + summary 行在位；大纲 4 项点击末节点跳转成功（selection 落位）；键入 z doc 197→198） | 无 |
| 7.4 | 新用户/轻度用户旅程：菜单浏览 → 发现快捷键 → Esc 回安静 | AC-RULE-18 | 同上 | CDP：菜单栏逐项展开（shortcut 回显可见）→ Esc 收拢 | **通过**（文件/编辑/视图/插入/帮助 5 菜单全展开；shortcut 回显：文件 12 项（Ctrl+N/Ctrl+O/…）、编辑 10 项（Ctrl+Z/…）、视图 8 项（Ctrl+Shift+F/F8/F9）、插入/帮助 0（本无绑定属正常）；任一菜单含 shortcut 回显 ✓；Esc 后 menu/dialog 全 false） | 无 |
| 7.5 | 四旅程无权限差异（全功能可及，无角色门槛） | AC-RULE-18 | 无权限差异 | 静态：无权限/角色分支代码（桌面单机全功能）+ 四旅程均全通 | **通过**（静态扫描 renderer 全源码 role/permission/rbac/acl/isAdmin/authorize/login 仅命中 ARIA `role="listbox|option|grid"` 属性，零业务权限分支；四旅程 7.1–7.4 全通——桌面单机全功能，无角色门槛） | 无 |

### 批次 ⑦ 留档

- **批次号**：⑦ 用户旅程无权限差异
- **条目结果**：5/5 通过（7.1–7.5）
- **证据**：`IT-04-FE-02-cdp-batch7-data.json`、`IT-04-FE-02-cdp-batch7-run.log`、`IT-04-FE-02-journey-export.html`（7.2 本轮 HTML 通道）；静态扫描留档（grep role/permission 族仅 ARIA 命中）
- **问题条目去向**：无
- **口径留档**：四旅程（重度写作者/复杂排版/阅读审阅/新用户）全部可完成且互不依赖权限差异——AC-RULE-18「无权限差异」同时以静态（零角色分支代码）+ 动态（四旅程全通）双证。
- **留档形态说明（batch9 附注）**：`IT-04-FE-02-cdp-batch7-run.log` 报 **4/4** 系驱动对交互旅程条目 7.1–7.4 的运行计数；7.5 为静态汇总行（无独立驱动运行段）计入本清单 **5/5**。两数形态不同（运行计数 vs 清单计数），不构成矛盾。
- **执行环境**：Electron/CDP 端口 9501（独立 user-data-dir `it04-fe02-userdata`），Windows 10 10.0.19045

---

## 批次 ⑧ 双主题走查总口径与 converge 收口（AC-NF-15 / AC-NF-16 / AC-RULE-17）

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 8.1 | 浅色主题全界面 7 页原型对照走查（ui_01 主静息 / ui_02 表编辑 / ui_03 表菜单 / ui_04 菜单栏 / ui_05 侧栏 / ui_06 渲染区 / ui_07 全局浮层） | AC-NF-15 | 通过率 100%；未过条目回单项迭代后重走 | CDP 结构对照（原型标记类/data-op 对应实现 DOM）+ 截图留档；PEND-14 口径无数值视觉断言 | **通过**（ui_01 静息面 menubar/tabsBar/editor/sidebar/statusbar 全在位且无表工具栏；ui_02 cell-active 后 7C 工具栏 6 键 + ⊞ 网格 240 单元 + col-grip×2；ui_03 ⋮ 菜单 data-op 面覆盖；ui_04 5 菜单根；ui_05 sidebar-tabs×2 + resizer + 文件树；ui_06 代码/公式/引用/任务/折叠 caret/表格渲染物全在位；ui_07 toast「已撤销」+ velox-ctx-menu 右键菜单 + prefs 对话框全触发）；截图 `IT-04-FE-02-light-full.png` | 无 |
| 8.2 | 深色主题全界面 7 页原型对照走查 | AC-NF-15 | 同上 | 同 8.1（dark 一遍） | **通过**（深色下同面全在位，与浅色同断言全过）；截图 `IT-04-FE-02-dark-full.png` | 无 |
| 8.3 | converge：`npm run typecheck`（tsconfig.web + tsconfig.node） | AC-NF-16 | 通过 | 双 tsconfig 0 Error | **通过**（修复后 2 次执行均 0 Error） | 无 |
| 8.4 | converge：`npm run test:unit` | AC-NF-16 | 通过 | Vitest 全绿 | **通过**（66 文件 / 873 用例全绿，含新增 listTable.test.ts 4 用例） | 无 |
| 8.5 | converge：cdp 冒烟且 e2e 缝契约未破坏 | AC-NF-16 / AC-RULE-17 | 冒烟通过 + `window.__velox*` 集、`data-op` 集、`data-table-handle`={col-grip}、命令 id 字面量不变 | CDP 驱动自检（本任务驱动即冒烟载体；`scripts/cdp-smoke.mjs` 不随仓 INFRA-01 已登记）+ 终态缝扫描 | **通过**（8.5a `__velox*` 26 键全在（含懒装 TableCellView）；8.5b data-op 冻结集菜单 19 + 工具栏 6 全在位；8.5c `data-table-handle`={col-grip}；8.5d 命令 id 字面量 68 项扫描存证、本任务 src 增量仅 `export/renderDoc/listTable.ts`+`listTable.test.ts` 未触缝面；批次①–⑦ 驱动自检全过即冒烟载体） | 无 |

### 批次 ⑧ 留档

- **批次号**：⑧ 双主题走查 + converge 收口
- **条目结果**：5/5 通过（8.1–8.5；8.5 含 a/b/c/d 四段缝扫描）
- **证据**：`IT-04-FE-02-cdp-batch8-data.json`、`IT-04-FE-02-cdp-batch8-run.log`、`IT-04-FE-02-light-full.png`、`IT-04-FE-02-dark-full.png`；收敛门禁 `npm run typecheck`（0 Error）+ `npm run test:unit`（873/873）
- **问题条目去向**：无缺陷。驱动教训两轮：①toast/右键触发口径（toast 须先键入再 Ctrl+Z；右键须落正文行而非 cm-content 几何中心——表格 widget 另有 ctx 入口）；②探针手工 `remove()` React 托管的 `.velox-ctx-menu` 节点会引发 React DOMException 全树卸载（无 error boundary）——属探针越权改 DOM，非产品缺陷，恢复后干净重跑全过（登记为驱动纪律：探针不得手工移除 React 托管节点）。
- **口径留档**：PEND-14 口径下走查为结构对照（原型标记类/data-op → 实现 DOM）+ 截图留档，无数值视觉断言；Win11 组合沿批次④环境限制推定登记。
- **执行环境**：Electron/CDP 端口 9501（独立 user-data-dir `it04-fe02-userdata`），Windows 10 10.0.19045

---

## 批次 ⑨ 测量证据链补测（fix-biz-IT04PATH02-evidence + PATH-04 折入；零产品代码改动）

> 业务流评审裁定：IT-04/PATH-02 3×P2 系**测量证据链问题**（产品实现疑无缺陷）——只补测量证据与报告回填，零产品代码改动（不改 src/）。batch1-8 留档只增不改，新产物一律 batch9 前缀。本批同时折入 IT-04/PATH-04 的 AC-OP-17 判据 3 富文本通道证据链（fix-list 追加项 5a，同文件面避免并发冲突）。

| # | 条目 | AC | 判据（ac.md v1.4） | 执行方式 | 结果 | 去向 |
|---|---|---|---|---|---|---|
| 9.1 | ⊞ 网格格点「单元格边界可辨」证据链重建（AC-ERR-14 判据 3 / UI-ELEM-02） | 同 3.4 | 边界可辨、无空白不可见 | `[data-testid="grid-cell"]` 真格点双主题实测（改写后 3.4 口径）+ 截图 `IT-04-FE-02-cdp-batch9-grid-{light,dark}.png` | **通过**（240 格全可辨，双主题） | 旧 241/幽灵边框证据作废（口径差已注记，已立案勿另立） |
| 9.2 | 控件文字对比度补测（AC-NF-09 / AC-ERR-14 判据 1） | 同 3.1/3.2 | ≥4.5:1 | 22 控件族双主题采样（改写后 3.1/3.2 口径；disabled 豁免过滤） | **浅色 21/22 ≥4.5 + 新发现 1 项**（toast 撤销钮 3.04:1）；**深色 22/22 通过** | P2 #5 登记 |
| 9.3 | 硬编码浅色块扫描面扩面（AC-ERR-14 判据 2） | 同 3.3 | 无未适配浅色块 | 9 弹层族含全子孙深色扫描（改写后 3.3 口径） | **新发现 5 处未适配浅色块**（UA 默认 chrome） | P2 #6 登记 |
| 9.4 | 富文本通道色值证据链（AC-OP-17 判据 3，PATH-04 折入） | 同 5.4 | 色值 ⊆ palette 值域、无色差 | live 导出富文本样张 → inline style 字面值 vs palette.ts 双主题逐值比对 + 运行时 token 逐值比对（改写后 5.4 口径） | **通过**（双主题 unknown=0、角色 8/8、token 12/12） | 无 |
| 9.5 | 零 src 改动门禁 | — | typecheck + unit 过、e2e 缝零触碰 | `npm run typecheck` + `npm run test:unit`（现态基线报数） | **通过**（typecheck 0 Error；unit **1066/1066**（76 文件）全绿——现态基线含并发批在途测试增量，本批零 src 改动证零回归；e2e 缝零触碰） | 无 |

### 批次 ⑨ 留档

- **批次号**：⑨ 测量证据链补测
- **条目结果**：9.1/9.4/9.5 通过；9.2/9.3 如实出**新发现 2 项 P2 真实缺陷**（问题条目 #5/#6；本批授权零产品改动，登记不修）
- **证据**：`IT-04-FE-02-cdp-batch9-data.json`、`IT-04-FE-02-cdp-batch9-run.log`、`IT-04-FE-02-cdp-batch9-electron.log`、`IT-04-FE-02-cdp-batch9-grid-light.png`、`IT-04-FE-02-cdp-batch9-grid-dark.png`、`IT-04-FE-02-cdp-batch9-rich-light.html`、`IT-04-FE-02-cdp-batch9-rich-dark.html`、探针 `IT-04-FE-02-cdp-batch9-evidence.mjs`（rev3）
- **采集口径注记**：
  1. **DPR 线宽**：本机 DPR=1.75，Chromium 边框设备像素吸附——设计 1px（overlays.css:321）实测 computed 0.571px（=1 device px）。线宽数值与 DPR 一并留档，判据按「实线边框 + 亮度台阶 + 格栅缝 + hover accent」四信号。
  2. **富文本采集路径**：OS 剪贴板被外部进程锁死（Electron clipboardWrite/Read 静默空转、PowerShell Set/Get-Clipboard 同报 ExternalException——环境问题非产品缺陷），首选 `copyRichText → getClipboard` 空回后走 fallback：动态 import 复现 `copyRichText.ts` writeRichText 的**同一函数组合** `wrapFragment(inlineStyleFragment(renderDoc(md,{baseDir,theme,imageMode:'embed'}), theme), theme)`，与 `clipboardWriteHtml` 载荷严格等值（逐参一致），仅绕开 OS 传输层。capturePath 已入 data.json。
  3. **样张瘦身**：`-rich-*.html` 留档时 data URI 图体截断标记 `[elided-for-archive]`（色值分析用未截断原串，htmlLen ~585K）。
  4. **探针纪律**：崩溃恢复对话框一律点「稍后」；探针不手工 remove() React 托管 DOM；Esc 收拢 overlay；图片浮层 clickAt（非 moveTo）、toast 撤销钮走 ⋮→insertRowBelow 结构操作（键入+Ctrl+Z 的 toast 无钮）、⋮ 菜单须直接点 td 进 cell-active（经 ⊞+Escape 会退出编辑态摘掉 7C 工具栏）。
- **问题条目去向**：新增 P2 #5/#6（登记不修，本批零产品改动）；「⊞ 241 vs 240」口径差根因注记（旧 selector 240 格+1 容器）——该项本身已立案，不另立。
- **执行环境**：Electron/CDP 端口 9563（独立 user-data-dir `it04-fe02-batch9-userdata`），Windows 10 10.0.19045

---

## 问题条目登记汇总

| # | 条目 | 定级 | 批次 | 处置 |
|---|---|---|---|---|
| 1 | **导出丢空单元格**：`export/renderDoc/listTable.ts` `renderRow` 只数 lezer `TableCell` 节点，而 GFM 对空单元格不产节点 → 导出列数缩水、空行 `<tr></tr>`、冒号行对齐错位（AC-OP-17 判据 2 违反，HTML/PDF/富文本三通道同源） | **P1 真实缺陷** | ⑤ | **已修复**（任务授权「P0/P1 最小修复 TDD」）：新增 `export/renderDoc/listTable.test.ts`（4 用例 RED→GREEN）；`rowCellSlots()` 按管道结构数槽位（对齐 `editor/table/parse.ts` padRow 哨兵口径）+ 宽度 rectify；`vitest src/export` 26/26 + 全量 873/873 + typecheck 0 Error；三通道复测逐项一致（retry2 7/7）。change-log 已登记 CHANGE 项；自测报告「缺陷修复（P1）」专节 |
| 2 | **autosave 失败文案与冻结句不一致**：实测 `toast.autoSaveFailedPath`「自动保存失败：{path}（{reason}）」+ 常驻槽 `status.autoSaveFailed`「自动保存失败 {time}」，与冻结句 `err.autosaveFailed`「自动保存失败，文档可另存副本」措辞不一致；`err.autosaveFailed` 全仓无运行时消费方（仅 frozenCopy.test.ts 钉住） | 文案登记（不动代码） | ⑤ | **只登记不擅改**（任务硬约束「发现文案不一致只登记」）。语义满足 tech-design §10（失败不丢稿 + 失败提示可见）；差异移交 doc-reconcile 裁定（err.autosaveFailed 是否补消费方或更新冻结句） |
| 3 | Win11 × 浅/深组合无法实测（本机 Win10 单机） | 环境限制 | ④ | **登记待跨机复验**：按 tech-design §8.4 三平台 CSS token 化无平台分支推定一致；不算实测通过 |
| 4 | 探针手工 `remove()` React 托管节点引发 DOMException 全树卸载（无 error boundary） | 驱动纪律问题（非产品缺陷） | ⑧ | 登记驱动纪律：CDP 探针不得手工移除 React 托管 DOM；恢复后干净重跑全过。不回炉产品任务（正常交互面未复现） |
| 5 | **toast 撤销按钮浅色主题对比度 3.04:1 < 4.5**：`.toast-undo-btn`（toast.css:46-58）ghost 形态 `color:var(--accent)` on `--toast-bg:#1f2328`（themes.css:83-85——浅色主题即用深色 toast 面，ui_07 全局浮层设计）。浅色 `--accent:#0969da` 对该面 **3.04:1**（AC-NF-09 违反）；深色 `--accent:#58a6ff` 同面 6.25:1 达标。toast 正文 `--toast-fg:#e6edf3` 13.37:1 达标。batch3 七探针面未覆盖撤销钮故未暴露 | **P2 真实缺陷**（AC-NF-09 / AC-ERR-14 判据 1） | ⑨（复测发现） | **登记不修**（本批零产品改动授权）。修复方向（移交后续批次）：toast 面上用高亮 accent 变体（浅色主题 toast 内取 #58a6ff 级）或增设 toast 专用 accent token；勿改全局 `--accent`（会牵动主题色四副本）。**【batch10 已修复】**新增 toast 专用 token `--toast-accent: #58a6ff`（themes.css `.theme-light`/`.theme-dark` 双侧声明——toast 面 ui_07 恒深 #1f2328 故双侧同值），`.toast-undo-btn` color/border 改挂该 token，**全局 `--accent` 未动**（四副本零牵动）；batch10 复测：撤销钮双主题 **6.25:1**（浅色 3.04→6.25 达标，深色 6.25 保持）、toast 正文 13.37:1 不降级、ghost 形态（透明底+accent 描边）保持。证据：`IT-04-FE-02-cdp-batch10-retest.mjs`/`-data.json`/`-run.log`（10.1 PASS）+ `-toast-{light,dark}.png`；tokens.test.ts `THEME_SPLIT_OVERLAY_TOKENS` 已收录守护 |
| 6 | **深色未适配浅色块 5 处（原生控件 UA 默认 chrome）**：①`TableInsertDialog.tsx:170-188` 裸 `input[type=number]`×2（testid table-rows/table-cols，仅 data-testid 无皮肤类，UA rgb(255,255,255)；对照 overlays.css:40 `.dialog-input`、forms.css:77 `.prefs-input` 有 token 皮肤但本对话框未接）；②`TableInsertDialog.tsx:238-242` 裸 `button`×2（取消/插入，UA rgb(240,240,240)；`.primary` 全仓无 CSS 规则；对照 Dialog.tsx:501-514 正确用 `.dialog-btn` 族）；③`image-widget.ts:373-382` 图片工具栏 `input[type=range]` 无 class（markdown.css:809-812 仅设 width/accent-color，背景留 UA 白）。旧 batch3 扫描只查 8 根元素自身 background，漏子孙裸控件故未暴露 | **P2 真实缺陷**（AC-ERR-14 判据 2「无未适配浅色块」） | ⑨（复测发现） | **登记不修**（本批零产品改动授权）。修复方向（移交后续批次）：补接既有 token 皮肤（`.dialog-input`/`.prefs-input`/`.btn`/`.dialog-btn`）+ range 滑条 skin；注意 `.primary` 为死类（无规则），接皮肤时并入 `.dialog-btn-primary` 族。**【batch10 已修复】**number×2 挂既有 `.prefs-input`、按钮改 `.dialog-btn`/`.dialog-btn dialog-btn-primary`（**`.primary` 死类清账**——删零 CSS 规则死类改挂真 primary 族，DOM `.primary` 残留 0 / `dialog-btn-primary` 1）、range 走 `appearance:none` + token track/thumb 皮肤（markdown.css，先例 `.cm-md-task`）；buttons.css 补 `.btn`/`.dialog-btn` active（brightness 0.92）/disabled（opacity 0.5）态。batch10 复测：**深色五处 nearWhite offenders=[]**（rows/cols/cancel bg rgb(30,30,30)=--bg、confirm rgb(88,166,255)=--accent、range 透明），浅色无回归（bg=浅 --bg 协调）；hover/active/disabled 三态实测（matchesHover/matchesActive true）；深色弹层族硬编码浅色块重扫 offenders=[]。证据：`IT-04-FE-02-cdp-batch10-retest.mjs`/`-data.json`/`-run.log`（10.2/10.3/10.4 PASS）。**【r2 补注】**batch10-data 中 native.*.rangeTrack 字段实为宿主 input 回退值（getComputedStyle 读不到 UA shadow 伪元素：height=20px=input 高、thumbSize=140×20=input 宽高），不作伪元素皮肤证据采信——range 皮肤证据由 -image-{light,dark}.png 实拍 + markdown.css 静态引用承担+ `-dialog-{light,dark}.png`/`-image-{light,dark}.png` |

- 已登记差异（CHANGE-11 按钮序 / col-grip 常驻零漆 / hover 165ms 基线 / +1.28px 亚像素 / AC-FN-29 已修 / CHANGE-3/CHANGE-9 pending）按「已登记」对待，本轮无回归，不重复上报。
- 首测假 FAIL（批次① 1.1 冷启动 103.3ms、批次③ blockquote 选择器、批次⑤ 5.6/5.7 驱动设计、批次⑥ 6.2a/6.3a 口径与夹具、批次⑧ toast/右键触发口径）均经复测/修正判定非实现缺陷，不入缺陷账。batch9 的 9.2/9.3 两项**不是**假 FAIL——22 族/9 族扩面实测后的真缺陷（#5/#6）。
- 回炉任务：P1 已在本任务内修复收敛（#1）；**#5/#6 为 batch9 复测新发现 P2，登记待后续批次修复**（本批零产品改动授权未修）；文案差异（#2）与环境限制（#3）照旧移交。
