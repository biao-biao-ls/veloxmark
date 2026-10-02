# UI 复刻评审报告（r2 · 修复后第 1 次重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。本轮为 r1（`IT-02-FE-10-replica-review.md`）之后修复批 H 落地的重评：先逐项标注 r1 条目「收敛/残留/新证据」，再列本轮未对齐点清单。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-10 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-10.md` |
| 评审时间 | 2026-10-01 17:35 |
| 评审者 | frontend-replica-review subagent（r2） |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-10/IT-02-FE-10-impl.png`（浅色主图，大纲面板；1200×800，mtime 2026-10-01 16:46） |
| 补充取证 | `shots/batch-f2-{light,dark}-{hover,focus,active}.png`（6 图三态矩阵，244×45，md5 两两互异）+ `shots/batch-f2-filetree-hover.png`（文件树 hover 行特写，244×49）+ `shots/batch-f2-matrix-states.json`（DOM 互斥断言） |
| 设计图 | 无 PNG（html 型设计稿，取稿方式为 Read html 精确值；与 IT-01 系列及 r1 同口径） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html`（主稿，唯一） |
| 页面路径 | 左侧导航栏视觉面（ui_05_sidebar.html 全区：侧栏容器 / 面板 tab / 文件树 / 大纲 / 图标与把手 / 主题翻值） |
| 对照基线 | r1 报告 `IT-02-FE-10-replica-review.md`（2026-09-30 22:55） |

---

## 一、r1 条目逐项标注（收敛/残留/新证据）

### r1 本体清单 #1–#9

| r1 # | 项目 | 本轮判定 | 依据（本轮像素实测 / DOM 断言） |
|---|---|---|---|
| 1 | 树行行高 `--tree-row-h`（r1：实测 ≈25px vs mock 28px） | **收敛（像素已对齐 mock）·登记口径待核对** | 新图行高实测 28px：主图大纲行 bg 带 y85/112/140/168 步距 27–28px、文本带 y92/120/148/177/204 步距 27–29px；`batch-f2-light-hover` hover 填充高 28px；`batch-f2-filetree-hover` 文本带 y18–29 与 y46–48 步距 28px。对照旧图（`IT-02-FE-10-impl-light.png`）active 填充 y216–240 = **25px**、行距 24–25px——行高确已由 25px 改到 28px（mock 值）。**但**任务 frontmatter `doc-drift`/`implementation-notes` 仍登记「25px 为 FileTree ROW_HEIGHT 虚拟化契约，勿改 28px 而不动窗口化数学」——像素与登记不一致，需主 agent 核对 ROW_HEIGHT 是否已联动（见未对齐清单 R1） |
| 2 | 树缩进步长 `--tree-indent`（r1：≈14px vs mock 16px） | **收敛（像素已对齐 mock）·登记口径待核对** | 新图缩进实测 16px/级：主图 5 行标题起点 x49/65/81/98/65，步距 16/16/17px；`.lv` 徽标起点行1 x5、行4 x55，3 级差 50px ≈ 16.7px/级；三态矩阵 hover/focus 徽标 x21–32（l2）vs active 徽标 x53–64（l4），2 级差 32px = 16px/级。与 doc-drift 登记的「树 14px / 大纲 --space-3 12px」不符（见未对齐清单 R2） |
| 3 | 圆角收敛（裸 4/6px → `--radius-sm`/`--radius-md`） | **残留（无新证据）** | 本轮帧内无可测圆角元素（行特写无容器圆角入画）；doc-drift 登记维持，r1 建议豁免登记有效 |
| 4 | 行 hover 底色 token（r1：impl `--code-bg` vs mock `--bg-inset`） | **收敛** | 三态矩阵 hover 填充实测 = mock `--bg-inset` 值：亮 `#f2f2f2`（242,242,242）/ 暗 `#2a2a2b`（42,42,43），两主题均无环、无左条；焦点行同底色 + accent 环（与用户给定契约及 mock `.tree-row.kbd-focus` 一致，hover/focus 以环区分）。token 名实一致性按 skill 禁读源未复核，以像素值判定 |
| 5 | 激活文件行名称/图标着 accent（选中文件行） | **残留（无新证据）** | 本轮文件树帧仅 hover 特写（`batch-f2-filetree-hover`），无「选中文件」帧；主图为大纲面板。r1 的二选一裁决（补 `.tree-row.current` 样例 or 回改 `--fg`/`--fg-dim`）仍待主 agent 裁决 |
| 6 | hover 态出图缺口（两主题） | **收敛** | `batch-f2-{light,dark}-hover.png` + `batch-f2-filetree-hover.png` 齐备；hover 与静息/焦点可区分（见三态契约核验节） |
| 7 | 文件树键盘焦点环·浅色主题 | **残留（证据缺口）** | 焦点环样式本轮已两主题出图，但 `batch-f2-*-focus.png` 的 DOM 断言是 `outline-item outline-l2 outline-kbd-focus`（**大纲行**）；文件树焦点环（浅色）仍无帧。深色文件树焦点环系 r1 已验（深色旧图 root.md 行） |
| 8 | 大纲键盘焦点环·深浅两主题 | **收敛** | `batch-f2-{light,dark}-focus.png`：左缘 x0–1 / 右缘 x237–238 为 accent 环（亮 `#0969da` / 暗 `#58a6ff`），行内填充 `--bg-inset`，2px 环宽与 mock `outline: 2px solid var(--accent); outline-offset: -2px` 一致 |
| 9 | （并入跨任务 C） | — | 见下行 C |

### r1 跨任务存量 A–H

| 代号 | 项目 | 本轮判定 | 依据 |
|---|---|---|---|
| A | 目录图标色应 accent | **残留（无新证据）** | 本轮帧内无目录行（主图大纲、特写为文件行/大纲行） |
| B | 同深度图标列对齐（文件行缺 twisty 占位） | **残留（无新证据）** | filetree-hover 为单行特写，无同深度目录/文件并列可对列；该行图标起于 x≈39–40，是否已补 twisty 占位无法单帧确证 |
| C | 大纲「光标标题」accent 蓝态 | **收敛** | 主图 active-follow 行（三级小节 Beta）标题色 (51,51,51) = `--fg`；三态矩阵 active 标题亮 (51,51,51) / 暗 (212,212,212) = `--fg`，两主题均无 accent 蓝标题行。与 mock `.outline-row.active-follow .title { font-weight:700; color: var(--fg) }` 一致 |
| D | 缩进导引线（1px `--border` 垂直线） | **残留（新证据支持）** | `batch-f2-filetree-hover` 缩进区 x0–38 全程纯 `--bg-inset` 填充（242,242,242），x16/x32 等候选位无 1px 导引线像素；主图大纲区按 mock 本无导引线（导引线属 `.tree-row .indent`），不计。注：特写无法确证该行深度，此为支持性证据非终判 |
| E | 根行右侧「+」按钮 | **残留（无新证据）** | 本轮帧无根行（WORKSPACE/FE10-FIXTURE）入画 |
| F | 面板底栏「＋ 新建」文案缺字 | **残留（无新证据）** | 主图底栏仅见状态栏「7:1」「字数 41 字符 117 行数 18」，侧栏 foot-btn 未入画 |
| G | 大纲行首 `.lv` 层级徽标缺失 | **收敛（修复批 H 成果）** | 主图 H1/H2/H3/H4 徽标均在（行1 徽标墨迹 x5–18、行4 x55–67，随缩进右移）；三态特写徽标带 x21–32 / x53–64 与层级对应。与 mock `.outline-row .lv`（22px 宽 / 10px / 700 / `--fg-disabled`）同构 |
| H | 折叠三角字形 ˅/› 线形 chevron | **部分收敛（新证据）** | 主图行1 折叠把手墨迹 x33–36 y96–98（4×3px，顶宽底窄、顶行连续墨迹）呈**实心三角状**；行2 折叠态把手 x49–51 y124–126（左宽右尖）呈右指三角状——形态已非 r1 的线形 chevron，向 ▾/▸ 靠拢。但 3–4px 墨迹不足以从像素终判 Unicode 身份（U+25BE/25B8 vs 小号实心绘制），不再计为确认性偏差 |

---

## 二、三态样式契约核验（本轮专项）

用户给定契约：**hover = `--bg-inset` 无环；focus = `--bg-inset` + accent 焦点环；active = `--accent-soft` + 左条**。6 图矩阵像素实测（行特写 244×45，色值为行内采样均值）：

| 态 | 契约 | 浅色实测 | 深色实测 | 判定 |
|---|---|---|---|---|
| hover | bg-inset，无环无左条 | 填充 `#f2f2f2`（242,242,242）= mock `--bg-inset` 亮值；左缘 x0 无 accent（左 6 列 accent 像素来自邻行切边，非本行）；右缘无环 | 填充 `#2a2a2b`（42,42,43）= `--bg-inset` 暗值；无环 | **对齐** |
| focus | bg-inset + accent 焦点环 | 填充 `#f2f2f2` + 左缘 x0–1、右缘 x237–238 = `#0969da`（9,105,218），环宽 2px | 填充 `#2a2a2b` + 左/右缘 = `#58a6ff`（88,166,255） | **对齐** |
| active | accent-soft + 左条 | 填充 (221,233,247) = `rgba(9,105,218,0.12)` over sidebar 底（= `--accent-soft` 亮）+ 左条 x0–2 3px = `#0969da` | 填充 (44,55,69) ≈ `--accent-soft` 暗 + 左条 `#58a6ff` | **对齐** |

- DOM 互斥断言（`batch-f2-matrix-states.json`）：hover 帧 `hover=true` 且无 `outline-kbd-focus`/`outline-active`；focus 帧 `outline-kbd-focus` + `nav=true`；active 帧 `outline-active` 且 `hover=false, nav=false`。六态两两互斥成立，md5 两两互异（无复用帧）。
- 层级几何互证：hover/focus 均为 `outline-l2`（徽标 x21–32、标题起点 x65），active 为 `outline-l4`（徽标 x53–64、标题起点 x97）——与 JSON class 层级一致，未见串帧。
- active 标题色两主题 = `--fg`（亮 `#333333` / 暗 `#d4d4d4`），非 accent（r1 跨任务 C 收敛的同源证据）。

---

## 三、本轮未对齐点清单（按区域分组，不打分）

### 登记同步（非视觉偏差，像素已对齐 mock；需核对 doc-drift / 虚拟化契约）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| R1 | Important | 行高登记口径与 ROW_HEIGHT 联动 | `:root --tree-row-h: 28px` | **像素实测 28px（已对齐 mock）**，但任务 frontmatter doc-drift 仍登记「实现 25px / ROW_HEIGHT 虚拟化契约」 | 视觉已收敛；登记文本与像素不一致，且若 `FileTree.tsx ROW_HEIGHT` 未同步改 28px 会出现虚拟化滚动错位（frontmatter 自警「勿改 28px 而不动窗口化数学」） | 主 agent 核对 ROW_HEIGHT 与 token 是否同为 28px：是 → 勾销 doc-drift #1 并更新登记；否 → 另立联动修复。本评审禁读源，仅报像素实测 |
| R2 | Minor | 缩进登记口径 | `:root --tree-indent: 16px`（标注卡「树缩进 16px」） | **像素实测 16px/级（已对齐 mock）**；doc-drift 仍登记「树 14px / 大纲 --space-3 12px 步进」 | 视觉已收敛；登记文本过期 | 勾销 doc-drift #2 或改写为现状口径（16px token 步进，大纲同步） |

### 文件树（token 度量与三态）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 3 | Minor（已登记 doc-drift） | 圆角收敛 | 行内装饰 `--radius-sm` 3px / 容器 `--radius-md` 8px | 本轮帧内无可测圆角元素（r1 时读图未见异常） | 无新证据，维持 r1 结论（视觉差异 ≤2px，token 最小集收敛） | 维持 r1 建议：tokens.css 迁移注释登记豁免即可，不建议回改 |
| 5 | Minor | 激活文件行名称/图标色 | `.tree-row.selected` 仅 `background: var(--accent-soft)`，`.name`/`.icon` 保持 `--fg`/`--fg-dim` | 本轮无「选中文件」帧（仅有 hover 特写），无法复核 r1 实测的 accent 着色是否仍在 | 证据缺口延续（r1 实现值：激活行名称/图标着 accent 蓝 + accent-soft 底） | 维持 r1 二选一裁决：① 补 `.tree-row.current` 样例做 doc 对齐；② 或名称/图标回 `--fg`/`--fg-dim`。补一张选中文件帧供 r3/终验 |
| 7 | Important | 文件树键盘焦点环·浅色主题 | `.tree-row.kbd-focus`：`outline: 2px solid var(--accent)` + `outline-offset: -2px` + `--bg-inset` 底 | 焦点环样式已两主题出图（大纲行，见 #8 收敛）；**文件树面浅色焦点环仍无帧** | 核验缺口延续（阶段 3「焦点环生效于两个键盘导航面」中的文件树面未证） | 补一张浅色文件树 ArrowDown 焦点环截图；或以 self-test「FE-06 焦点环真实 ArrowDown 验证」记录由主 agent 豁免 |

### 跨任务存量（本轮可见/有新证据，归属 FE-06，不计入本任务必修）

| 代号 | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 归属与修复建议 |
|---|---|---|---|---|---|---|
| D | Important | 缩进导引线 | 每级 indent 内 1px `--border` 垂直导引线 | filetree-hover 特写缩进区 x0–38 无导引线像素（行深度未确证，支持性证据） | 导引线疑似仍缺 | FE-06 评审 #4 同源；按层级补 1px 垂直导引线，补帧时带多级嵌套行同框 |
| A/B/E/F | Important / Minor | 目录图标色 / 同深度图标列对齐 / 根行「+」按钮 / 底栏「＋ 新建」文案 | 同 r1 表述 | 本轮无对应帧（无目录行、无根行、无面板底栏） | 无新证据，维持 r1 结论 | 仍归 FE-06 评审 #5/#3/#8/#9 同源，主 agent 分流回 FE-06 |

> 统计（本轮清单，仅供参考，非通过门槛）：Important 3（R1、7、D）/ Minor 3（R2、3、5）；另有跨任务 A/B/E/F 存量 4 项维持 r1 结论不重复展开。无 Critical。

---

## 四、已知背景对齐（不计必修）

1. **侧栏面板 tab 下划线**：`IT-02-FE-10-impl.png` 实测下划线 y=83、x58–99 = **42px 整宽**（两尖端与 tab 同宽，无 8px 内缩）——**图源系修复前旧态，已修**（并行修复批已改 `.sidebar-tab.is-active::after` 两端内缩 8px）。不计入未对齐点。
2. **FE-08#5 折叠态子树口径**：已裁定任务契约优先入登记，不重复报。

---

## 五、取证与读图备注

- **图身份核对（取证纪律）**：全部 7 图 Read 前经 文件名 + 尺寸 + mtime + md5 核对，两两哈希互异（矩阵 6 图 + filetree-hover + 主图均唯一）。内容侧互证：6 图矩阵行内容经缩进/徽标几何 + JSON class 交叉验证为同一 fixture 的 `outline-l2/l2/l4` 行（hover/focus/active）；filetree-hover 呈文档型图标（x39–53，矩形折角字形）+ 名称行（x56–100，「intro.md」类文件名，字首 i 点画 y19–20 可辨）+ hover 填充，与「文件树 hover 行特写」文件名预期相符。**未发现一图双命名或串图**。
- **小图读图稳定性**：244×45 CJK 特写的目视辨认在多轮 Read 间出现过不一致（徽标「H2/H4」、行文内容错觉），已全部以像素取证（边缘/底色采样、徽标与标题聚类分割、图标区点阵渲染、JSON DOM 断言）交叉复核后再下结论；报告中所有判定均不依赖不稳定目视读法。
- **邻行切边**：`batch-f2-*-hover.png` 顶/底部 8px 为邻行切边（亮色帧顶部为 accent-soft 邻行切边，易误读为本行 active）；三态判定只取各行本体填充/环/左条像素。
- **行高新旧对照**：旧图（2026-09-30 21:31）文件树 active 填充 25px、行距 24–25px；新图（2026-10-01 16:46 后）大纲/文件树均 28px。结论以新图为准，旧图仅作收敛轨迹佐证。
- 对比度（≥4.5:1）无法由 PNG 像素可靠测得，以 `IT-02-FE-10-self-test.md` 实测记录为准，本报告不作独立背书。
- token 零裸值 / 零 `.theme-dark` 补丁选择器扫描属代码级检查，按 skill 禁读实现源铁律未复核，以任务自测与守护测试为准。
- 设计稿取稿方式同 r1：Read `ui_05_sidebar.html` 源精确样式值（本评审禁用浏览器，与 IT-01 系列同口径）。

---

## 六、评审者声明

本报告由独立 subagent（frontend-replica-review）基于实现图 + 补充三态取证帧与设计稿 html 精确值对比产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。r2 为修复批 H 后第 1 次重评：r1 条目收敛 6 项（#1/#2 像素收敛含登记核对、#4/#6/#8、跨任务 C/G）、部分收敛 1 项（H）、残留 6 项（#3/#5/#7、跨任务 A/B/D/E/F 中除 C/G/H 外）。
