# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-10 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-10.md` |
| 评审时间 | 2026-09-30 22:55 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10/IT-02-FE-10-impl-light.png`、`IT-02-FE-10-impl-dark.png`（主图，文件树）；`IT-02-FE-10-impl-light-outline.png`、`IT-02-FE-10-impl-dark-outline.png`（大纲；文件名与主题对调，见读图备注） |
| 设计图 | 无 PNG（html 型设计稿，取稿方式为 Read html 精确值；与 IT-01 系列报告同口径） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html`（主稿，唯一） |
| 页面路径 | 左侧导航栏视觉面（ui_05_sidebar.html 全区：侧栏容器 / 面板 tab / 文件树 / 大纲 / 图标与把手 / 主题翻值） |

## 严重度分布（仅供参考，非通过门槛）

> 统计范围：FE-10 自身口径（token 取值 / 三态 / 深浅主题走查证据）。「跨任务存量差异」8 项归属 FE-06/FE-07，不计入分布，供主 agent 分流。

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 4 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 / 关键状态核验缺口 |
| Minor | 5 | 微小视觉差异 / 装饰元素细节偏差 / 已登记 doc-drift 的度量偏差 |
| **合计** | **9** | —（另有跨任务存量 8 项单列） |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。#1–#5 均为任务 frontmatter `doc-drift` 已登记条目（改造前既有口径的有意保留），#6–#8 为截图证据缺口而非确认性偏差。

---

## 未对齐点清单（按区域分组）

### 文件树（token 度量与三态）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important（已登记 doc-drift） | 树行行高 `--tree-row-h` | 28px（`:root --tree-row-h: 28px`；标注卡 dim-chip「行高 28px」） | ≈25px（行距实测 y101/128/153/179/204/229/255，步距 25–26px；两主题一致） | 每行矮约 3px（-11%） | 已登记 doc-drift：25px 为 FileTree `ROW_HEIGHT` 虚拟化契约（行高等差滚动），改 28px 需联动窗口化数学。若主 agent 判定必修，应另立布局变更任务并同步 `ROW_HEIGHT` 与 token；否则勾豁免 |
| 2 | Minor（已登记 doc-drift） | 树缩进步长 `--tree-indent` | 16px/级（`:root --tree-indent: 16px`；dim-chip「树缩进 16px」） | ≈14px/级（图标左缘 x≈28/42/56，步距 14px） | 每级窄 2px | 已登记 doc-drift：保持改造前缩进数学 12+14n。若必修则改 `--tree-indent: 16px` 并核对嵌套行缩进回归 |
| 3 | Minor（已登记 doc-drift） | 圆角收敛 | 行内装饰圆角 `--radius-sm` 3px / 容器 `--radius-md` 8px（mock 直接引用同名 token） | 改造前裸 4px/6px 已收敛到 `--radius-sm`(3px)/`--radius-md`(8px)，读图未见异常圆角 | 视觉差异 ≤2px（收敛到 token 最小集） | 已登记 doc-drift。如需与 mock 完全同值，可在 tokens.css 迁移注释中登记豁免即可，不建议回改 |
| 4 | Minor（已登记 doc-drift） | 行 hover 底色 token | `--bg-inset`（亮 `#f2f2f2` / 暗 `#2a2a2b`，标注卡明示「hover 行 --bg-inset」） | `--code-bg`（全仓 chrome hover 惯用色）；`--bg-inset` 改作键盘焦点行填充 | hover 与焦点填充的 token 语义对调（三态线索拆分为 hover 填充 / active 文字 / focus 环，仍可区分） | 已登记 doc-drift。建议保持现状并在 ui_05 标注卡补一行 hover 色口径说明做 doc 对齐，或由主 agent 裁决回改 `--bg-inset` |
| 5 | Minor | 激活文件行名称/图标色 | `.tree-row.selected` 仅 `background: var(--accent-soft)`，`.name`/`.icon` 保持 `--fg`/`--fg-dim` | 激活行（intro.md，两主题）名称与文件图标均着 accent 蓝（亮 `#0969da` 系 / 暗 `#58a6ff` 系）+ accent-soft 底 | 激活行文字/图标超出设计稿 selected 语义着色（注：Q9 多选不实现，该态在产品上映射为「当前文件」高亮，设计稿未定义此态） | 二选一裁决：① 认可「当前文件」高亮态 → 在 ui_05 设计稿补 `.tree-row.current` 样例（accent-soft 底 + accent 文字）做 doc 对齐；② 以设计稿为准 → 名称/图标回 `--fg`/`--fg-dim` |

### 三态走查证据（AC-FN-12 两遍清单）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 6 | Important | hover 态出图（两主题） | hover 行底色弱高亮（标注卡「hover 行 --bg-inset，文件树/大纲统一悬停反馈」），属三态之一 | 四张截图均无 hover 态帧（仅激活态 + 深色焦点态） | 核验缺口（非确认性偏差）：hover 态深浅两主题均无截图证据，AC-FN-12「两遍走查」缺一态 | 补 hover 态截图各一张（浅/深），确认 hover 填充与静息行、焦点行可区分；或以 `IT-02-FE-10-self-test.md` 走查记录佐证后由主 agent 豁免 |
| 7 | Important | 文件树键盘焦点环·浅色主题 | `.tree-row.kbd-focus`：`outline: 2px solid var(--accent)` + `outline-offset: -2px` + `--bg-inset` 底 | 深色主图 root.md 行有完整焦点环（亮蓝描边 + 内填充，与设计一致）；**浅色主图无任何焦点环帧** | 核验缺口：浅色主题焦点环未出图（阶段 3 要求「焦点环生效于两个键盘导航面，深浅主题一致」） | 补一张浅色主题文件树 ArrowDown 焦点环截图；或以 self-test 中「FE-06 焦点环真实 ArrowDown 验证」记录豁免 |
| 8 | Important | 大纲键盘焦点环·深浅两主题 | 同上（大纲行三态含键盘焦点环，UI-ELEM-01 口径） | 两张大纲截图仅呈现 active-follow 态（左 accent 条 + 底色）与疑似光标标题高亮，无焦点环帧 | 核验缺口：大纲面板（FE-08 联动面）焦点环两主题均无截图证据 | 补大纲面板 ArrowDown 焦点环截图深浅各一张；或以自测记录豁免 |

### 大纲（active-follow 与层级）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 9 | *（合并入跨任务存量 #C）* | — | — | — | — | — |

> 大纲区其余可见偏差均为 IT-02-FE-07 评审已登记存量（见下节 A/B/C），本任务 token 审计口径下 active-follow 样式本身读图正常：左 accent 条 + 行底高亮 + 标题加粗 `--fg`（较 FE-07 评审时的「标题着 accent 蓝」已有改善——accent 蓝现转移到另一行，见存量 C）。

---

## 跨任务存量差异（本任务帧内可见，归属 FE-06 / FE-07，不计入上方分布）

> 以下 8 项在 FE-10 截图中依旧可见，且已被 IT-02-FE-06 / IT-02-FE-07 评审登记。FE-10 任务口径是 token 溯源、不重排版面，这些应由主 agent 分流回对应任务修复，避免在 FE-10 内重复开销。

| 代号 | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 归属与修复建议 |
|---|---|---|---|---|---|---|
| A | Important | 目录行图标色 | `.icon.folder { color: var(--accent) }`（亮 `#0969da` / 暗 `#58a6ff`） | 目录图标呈 `--fg-dim` 灰（两主题均灰） | 目录图标未用主题强调色 | FE-06 评审 #5 同源未修；目录图标色改 `var(--accent)` |
| B | Important | 同深度图标列对齐 | 文件行保留 twisty 18px+4px 占位，同级图标同列 | 文件行不占 twisty 位，同深度文件图标较目录图标左偏约 14px（如 guide.md 图标 x≈28 vs 同级 deep 图标 x≈42） | 同级文件/目录图标错列 | FE-06 评审 #3 同源未修；文件行补 twisty 等宽占位 |
| C | Important | 大纲行标题 accent 蓝态 | hover=`--bg-inset` 底 + 标题 `--fg`；active-follow=accent-soft 底 + 左条 + 标题 700 `--fg`；无「纯 accent 蓝标题」态 | 大纲「第二节 Alpha」行标题呈 accent 蓝且无行底高亮（深浅两图一致；疑似光标所在标题映射态） | 设计稿未定义该高亮态，三态语义外多出一种着色 | FE-07 评审 #1 相关（原 active 标题着蓝，现转移到光标映射行）；裁决：① 补设计稿样例定义「光标所在标题」态；② 或回改 `--fg` 并只留 active-follow 三要素 |
| D | Important | 缩进导引线 | 每级 indent 内 1px `--border` 垂直导引线（标注「逐级缩进 + 导引线」） | 深浅图均无导引线像素 | 导引线缺失 | FE-06 评审 #4 同源未修；按层级补 1px 垂直导引线 |
| E | Important | 根行右侧「+」按钮 | `.tree-row.root` 仅文本（WORKSPACE），无按钮 | 根行（FE10-FIXTURE）右侧多出「+」新建按钮 | 设计稿无此按钮（新建入口在底栏） | FE-06 评审 #8 同源未修；移除根行「+」或收口到面板底栏 |
| F | Important | 面板底栏「＋ 新建」文案 | 「＋ 新建」（图标 + 文字，`.foot-btn`） | 「+」仅图标，无「新建」文字 | 按钮文案缺字（checklist ④ 口径为 Critical 档，此处按存量注记） | FE-06 评审 #9 同源未修；底栏新建按钮补「新建」label |
| G | Minor | 大纲行首层级徽标 `.lv` | 每行行首 22px 宽「H1/H2/H3」徽标（10px/700/`--fg-disabled`） | 行首仅见「·」/twisty 占位，无 Hn 徽标 | 层级徽标缺失 | FE-07 评审 #3 同源未修；渲染 lv 徽标或主 agent 豁免移交 |
| H | Minor | 折叠三角字形 | ▾/▸ 实心三角字形（10px） | ˅/› 线形 chevron（FE-06 评审实测） | 字形不一致（展开/收起指向切换本身正确） | FE-06 评审 #7 同源未修；换用 ▾/▸ 字形 |

---

## 取稿与读图备注

- 设计稿类型：html（`ui_05_sidebar.html`，43KB，含 `:root`/`.theme-dark` 全套 token 声明）
- 取稿方式：Read html 源（精确样式值取自 CSS；按 skill 对 html 稿的口径，视觉以浏览器渲染为准，本评审禁用浏览器故以源码值为设计基准，与 IT-01 系列报告同口径）
- 读图方式：Read PNG ×4（两主题 × 文件树/大纲）
- **实现图文件名与主题对调**：`IT-02-FE-10-impl-light-outline.png` 画面实为**深色**主题（暗色 titlebar/背景），`IT-02-FE-10-impl-dark-outline.png` 画面实为**浅色**主题。本报告按画面实际主题采证。建议开发侧重命名或重截以免后续误引（属产物命名问题，非 UI 偏差）。
- 设计稿 mock 与产品 fixture 的内容差异不计文案偏差：根行「WORKSPACE」vs 实现「FE10-FIXTURE」、底栏面包屑均为工作区动态命名，非固定文案。
- 设计稿中的 Q9 已裁决「不实现」示意（batch-bar 多选条、checkbox、drag-handle 拖拽把手、drop-line）在实现中正确缺席，不记缺失。
- 深色主图 root.md 的焦点环与 intro.md 的激活态同框，可直接对照三态可区分性：环+内填充（焦点） vs accent-soft 底+accent 文字（激活）区分清晰；浅色缺该对照帧（见 #7）。
- 精确对比度（≥4.5:1）无法由 PNG 像素可靠测得，读图目测深浅两主题文字与底色对比均在可用区间；该指标以 `IT-02-FE-10-self-test.md` 的实测记录为准，本报告不作独立背书。
- token 零裸值 / 零 `.theme-dark` 补丁选择器的扫描断言属代码级检查，按本 skill 禁读实现源的铁律未复核，以任务自测与守护测试（`styles/sidebarTokens.test.ts`）为准。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。
