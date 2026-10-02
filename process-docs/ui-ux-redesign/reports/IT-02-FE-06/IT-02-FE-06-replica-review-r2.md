# UI 复刻评审报告（r2 · 修复后重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。
> 本轮为批 H（文件树/大纲侧栏簇）修复后第 1 次重评；上一轮报告：`IT-02-FE-06-replica-review.md`。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-06 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-06.md` |
| 评审时间 | 2026-10-01 |
| 评审轮次 | r2（修复批 H 后第 1 次重评） |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-06/IT-02-FE-06-impl.png`（深色主稿，1200×800，mtime 2026-10-01 16:46，md5 78a145df…） |
| 实现图（辅） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-06/IT-02-FE-06-impl-light.png`（浅色交叉印证，1200×800，mtime 2026-10-01 16:46，md5 34f821f6…） |
| 设计图 | 未生成 PNG（设计稿为 `.html`，按 skill 取稿规则直接 Read 源码取样式值，不产 design.png） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html`（43222B，mtime 2026-10-01 11:32） |
| 页面路径 | 左侧导航栏文件树面板（ui_05_sidebar.html 文件树区） |

**图源身份核对**：两图均 1200×800 RGB PNG（非裁剪小图），mtime 同批（批 H 后新截），md5 互异，内容与文件名预期一致（深/浅主题同构侧栏截图）——图源可信，无串图污染。

---

## 一、上一轮（r1）9 项逐项标注

| # | r1 未对齐点 | 本轮判定 | 本轮证据 |
|---|---|---|---|
| 1 | 树行行高 ≈25px（设计 28px） | **收敛** | 深浅两图行中心 129/157/185/213/241/269，步距精确 28px；高亮行 y144–171 亦恰 28px |
| 2 | 树缩进级差 ≈14px（设计 16px） | **收敛** | 同级列步距 16px（目录图标 x38→54，twisty 盒中心 25→41）；与 `--tree-indent: 16px` 一致 |
| 3 | 文件行不占 twisty 位，同级图标错列 ~22px | **收敛** | 同深度图标同列：depth1 目录图标 54–66 vs 文件图标 56–65（中心均 ≈60）；文件行 twisty 槽为空占位（点阵无字形），与设计 `.twisty.empty{visibility:hidden}` 语义一致 |
| 4 | 缩进导引线缺失 | **收敛** | 1px 垂直导引线已补：一级行无线、二级行 x=8 一条、三级行 x=8+x=24 两条（nested 点阵实测）；色 `#333333`/`#E5E5E5` = 设计 `--border` 精确值；定位=祖先步中心（`16*i+8`），与设计 `<i style="left:8px">`（二级仅第一条）的「祖先级步中心、不含当前级」口径一致 |
| 5 | 目录图标色 `--fg-dim` 灰（设计 `--accent`） | **收敛** | 目录图标核心色深 `(88,166,255)`=`#58A6FF`、亮 `(9,105,218)`=`#0969DA`，与 `--accent` 深浅主题值逐字节一致 |
| 6 | 目录名色 `--fg-dim` 灰（设计 `--fg`） | **收敛** | docs/deep 名称核心色 `(212,212,212)`=`#D4D4D4`=`--fg`（暗）；亮侧 `(51,51,51)`=`#333333`=`--fg`；与文件名同色，`.name.dim` 未滥用 |
| 7 | 折叠三角为线形 chevron（设计实心 ▾/▸） | **收敛** | 点阵为实心下三角（上宽下尖，▾ 形）：docs/deep 展开态均 ▾，与设计 U+25BE 实心字形一致 |
| 8 | 根行右侧多出「+」新建按钮 | **残留** | 深浅两图根行右侧 x209–216 仍有「+」字形（点阵十字），设计 `.tree-row.root` 仅文本 `WORKSPACE`、无按钮 |
| 9 | 底栏新建按钮缺「新建」文案 | **残留** | 底栏 x0–60 仅 x16–23 的「+」图标，无「新建」文字（设计 `.foot-btn`＝「＋ 新建」图标+文案）；与 r1 同注：底栏不在 FE-06 页面元素表内，属侧栏存量差异 |

**r1 备注项顺带核销**：r1 备注 4 曾记「浅色辅稿仅侧栏+状态栏为浅色、窗口其余呈深色」——本轮浅色图菜单栏/标签栏/正文/状态栏已全链路浅色，主题应用一致，该观察点**收敛**。

---

## 二、本轮未对齐点清单（按区域分组，不打分；严重度仅作主 agent 判断参考）

### 文件树 · 键盘焦点态（FE-06 核心 / UI-ELEM-01）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 10 | Important | kbd-focus 焦点环（本轮取证缺口） | `.tree-row.kbd-focus{outline:2px solid var(--accent); outline-offset:-2px; background:var(--bg-inset)}`（dim-chip「焦点环 2px accent」） | 本轮两图**无任何行**呈现 2px accent 外描边（全侧栏蓝像素仅目录图标笔画与文字次像素边缘，无环形几何）；r1 图曾实测到该环，r2 图丢失该态 | UI-ELEM-01 核心态在 r2 实现图中缺证，无法复核焦点环与 hover/激活三态可区分 | 重截实现图：用真实键盘导航（非合成 PointerEvent）把焦点停在树行上再截深/浅两图，确保焦点环可见 |

### 文件树 · 行状态归属

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 11 | Important | deep 行整行高亮 | 设计文件树仅三种行态：hover=`--bg-inset`（中性灰）、kbd-focus=描边+`--bg-inset`、`.selected`=`--accent-soft`（多选态，Q9 裁决**不实现**）；无「active 打开行」样式规格 | deep 行 y144–171 整行填充，色值深 `(44,55,69)`、亮 `(221,233,247)`，与 `--accent-soft` 逐通道精确吻合（0.14/0.12 透明度合成验算通过）；无描边、无左条；但打开文件是 **intro.md**（标题栏/标签/正文均为 Intro），deep 既非打开行也非其祖先，intro.md 行反而无任何高亮 | 高亮态无法归入设计三态中任何一种：非 hover（色不是 bg-inset）、非 kbd-focus（无 2px 描边）、若视为 selected 则撞 Q9「不实现」、若视为 active 则高亮行与打开文件不符且设计无 active 规格 | 先明确该高亮的产品语义：若是 hover 应改 `--bg-inset`；若是打开行 active 应落到 intro.md 且与主 agent 确认是否需要补设计规格（目前设计稿无 active 态）；若仅为截图摆拍请改截无高亮或焦点环态 |

### 侧栏面板 · 根行与底栏（r1 遗留）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 8 | Important | 根行右侧按钮 | 根行仅文本 `WORKSPACE`（`.tree-row.root` 无按钮；新建入口在底栏） | 根行右侧「+」按钮仍在（x209–216，深浅两图） | 设计稿无此按钮（r1#8 未修） | 移除根行「+」，新建入口收口到面板底栏 |
| 9 | Minor | 底栏新建按钮文案 | 「＋ 新建」（图标+文字，`.foot-btn`） | 「+」仅图标，无「新建」文案 | 按钮文案缺字（r1#9 未修；底栏不在 FE-06 页面元素表内，属侧栏存量差异，供主 agent 酌情取舍） | 底栏新建按钮补「新建」label |

---

## 三、无偏差确认项（要点，供主 agent 参考）

- **行几何**：行高 28px、缩进 16px/级，与 dim-chip「行高 28px / 树缩进 16px」及 `:root` token 一致（r1#1/#2 收敛后的复核）。
- **导引线**：1px、`--border` 色、祖先级步中心定位，与设计 `<i style="left:8px">` 规则同构（设计稿示例只到二级，三级两导引线为该规则的自然延伸）。
- **着色**：目录图标 `--accent`、目录名 `--fg`、文件图标 `--fg-dim`、文件名 `--fg`，深浅主题均取色吻合 token 真值。
- **折叠三角**：目录行实心 ▾（展开态），18px 槽/10px 字形与设计 `.twisty` 一致；文件行 `.empty` 隐藏占位。
- **面板 tab**：「文件 / 大纲」文案逐字一致；激活下划线 2px `--accent`（暗 y83–84 x12–53 `#58A6FF` / 亮 `#0969DA`），与 `.panel-tab.active::after` 一致。
- **侧栏宽 240px**、树层级顺序与嵌套（docs→deep→nested.md / guide.md / intro.md / root.md）自洽，导引线随层级递增。
- **Q9 裁决项缺席属预期**：batch-bar、checkbox 多选、拖拽排序标注均未出现，与任务「页面元素」表注记一致（但见 #11：`.selected` 同款填充被用在了普通行上）。
- **图标字形集**：设计稿用 ▤ 统一占位，实现为语义化 folder/file 图标——图标集差异，r1 未列偏差，本轮维持不列。

---

## 四、取稿与读图备注

- 设计稿类型：html（`ui_05_sidebar.html`，43KB 含完整 token/CSS）。
- 取稿方式：Read（skill 规定 html 取稿为 Read 源码；禁启浏览器故不产 design.png；设计侧样式值取自 html 源 token/规则）。
- 读图方式：Read PNG（深色主稿 + 浅色辅稿）+ PIL 像素采样/点阵放大/取色（只读分析，未接触实现源码、未启浏览器、未连 dev server）。
- 设计侧关键值来源：`:root`/`.theme-dark` token（`--tree-row-h:28px`、`--tree-indent:16px`、`--sidebar-width:240px`、`--accent`、`--accent-soft`、`--bg-inset`、`--fg`/`--fg-dim`、`--border`）、`.tree-row`/`.twisty`/`.indent i`/`.icon.folder`/`.name`、`.tree-row.kbd-focus`、`.selected`、`.panel-tab.active::after`、`.panel-foot`/`.foot-btn`、dim-chip「左导航宽 240px / 树缩进 16px / 行高 28px / 焦点环 2px accent / UI 13px」。
- 备注：
  1. 树行数据（`FE10-FIXTURE`/`fe10-fixture`/`docs`/`deep`/`nested.md`/`guide.md`/`intro.md`/`root.md`）为运行夹具（本轮夹具前缀为 FE10-，r1 为 FE06-，属共享夹具命名），与设计稿示例数据（`WORKSPACE`/`design.md`…）不同，按运行数据处理，不计入文案偏差；底栏 crumb「fe10-fixture」同理。
  2. 设计稿树区的 `kbd-hint` 键盘标注 chip、`diff-note` 差异注记、下方交互卡片/标注面板均为原型注记层，非产品 UI，实现不包含属预期。
  3. #11 的高亮填充色经合成验算精确等于 `--accent-soft`（暗：37+0.14×(88−37)=44、37+0.14×(166−37)=55、38+0.14×(255−38)=68.4 → (44,55,69)；亮同法得 (221,233,247)），故判为「accent-soft 语义」而非 hover/bg-inset 或渲染噪声。
  4. 焦点环缺证（#10）不排除样式仍在实现中、仅截图未捕获键盘调制态——r1 已实测过该环存在且取值正确；本轮只就图证缺失与行状态归属记点，不推断代码层回归。
  5. UI-ELEM-01 的「token 化、代码无裸值」属代码层验收，本评审按铁律不读实现源，仅做视觉与 token 值比对。
  6. 取证纪律执行：Read 前已核文件名+尺寸（1200×800）+mtime（2026-10-01 16:46）+md5，与「250×720 裁剪串图」特征不符，图源无疑。

---

## 五、评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比、像素级测量与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。不打总分、不出 PASS/FAIL；未对齐点的必修性由主 agent 逐条判断。
